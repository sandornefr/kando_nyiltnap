"""Kandó Kódlabor API: persisted shared project, private capabilities, atomic writes."""
import functools
from contextlib import closing
import hashlib
import json
import os
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

from flask import Flask, jsonify, request, send_from_directory
from project import DEFAULTS, PHASES, ROLE_LABELS, CATALOGUE, assign, check, new_tasks

ROOT = Path(__file__).parent
app = Flask(__name__, static_folder=None)
app.config['MAX_CONTENT_LENGTH'] = 12000
LOCK = threading.RLock()
LOCAL = threading.local()
DB_PATH = os.environ.get('DATA_PATH', str(ROOT / '.data' / 'games.sqlite3'))
Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
with closing(sqlite3.connect(DB_PATH)) as db, db:
    db.execute('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL)')
PASSWORD = os.environ.get('TEACHER_PASSWORD', '')
PUBLIC_URL = os.environ.get('PUBLIC_URL', 'https://sandornefr.github.io/kando_nyiltnap/').rstrip('/') + '/'
ALLOWED_ORIGINS = set(filter(None, (item.strip() for item in os.environ.get('ALLOWED_ORIGINS', 'https://sandornefr.github.io').split(','))))
ALLOWED_ORIGINS.add(urlsplit(PUBLIC_URL).scheme + '://' + urlsplit(PUBLIC_URL).netloc)
ADMINS = {}
LIMITS = {}
TTL = 86400


def error(message, status=400):
    return jsonify(error=message), status


def connection():
    return getattr(LOCAL, 'db', None)


def load(code):
    if not isinstance(code, str) or len(code) != 6 or not code.isascii() or not code.isdigit():
        return None
    db = connection()
    if db is None:
        with closing(sqlite3.connect(DB_PATH)) as temporary:
            row = temporary.execute('SELECT data FROM rooms WHERE code=?', (code,)).fetchone()
    else:
        row = db.execute('SELECT data FROM rooms WHERE code=?', (code,)).fetchone()
    if not row:
        return None
    room = json.loads(row[0])
    if room.get('created', 0) < time.time() - TTL:
        return None
    if room.get('schema') == 2:
        update(room)
    return room


def save(room):
    values = (room['code'], json.dumps(room, ensure_ascii=False))
    if connection() is not None:
        connection().execute('INSERT OR REPLACE INTO rooms VALUES (?,?)', values)
    else:
        with closing(sqlite3.connect(DB_PATH)) as db, db:
            db.execute('INSERT OR REPLACE INTO rooms VALUES (?,?)', values)


def event(room, text):
    room['eventSequence'] += 1
    room['events'].append(dict(id=room['eventSequence'], text=text))
    room['events'] = room['events'][-40:]


def advance(room, at):
    index = next(index for index, phase in enumerate(PHASES) if phase['id'] == room['phase'])
    room['pause'] = None
    if index == len(PHASES) - 1:
        room['status'] = 'finished'
        room['deadline'] = 0
        event(room, 'A közös bemutató lezárult. Ezt az oldalt együtt alkottátok!')
    else:
        phase = PHASES[index + 1]
        room['phase'] = phase['id']
        room['deadline'] = at + phase['duration']
        event(room, 'Új szakasz: ' + phase['label'] + '.')


def update(room):
    changed = False
    now = time.time()
    while room['status'] == 'working' and room['pause'] is None and now >= room['deadline']:
        advance(room, room['deadline'])
        changed = True
    if changed:
        save(room)


def task_status(task, tasks):
    if any(not tasks[dependency]['done'] for dependency in task['dependsOn']):
        return 'locked'
    if task['done']:
        return 'done'
    return 'issue' if task['issue'] else 'ready'


def public(room, player=None, host=False):
    phase_index = next(index for index, phase in enumerate(PHASES) if phase['id'] == room['phase'])
    remaining = room['pause'] if room['pause'] is not None else max(0, room['deadline'] - time.time())
    if room['status'] != 'working':
        remaining = 0
    tasks = {task['id']: task for task in room['tasks']}
    people = {person['id']: person for person in room['players'].values()}
    task_data = []
    for task in room['tasks']:
        item = {key: task[key] for key in ('id', 'title', 'role', 'kind', 'key', 'options', 'dependsOn', 'ownerId', 'value', 'hint')}
        item.update(ownerName=people.get(task['ownerId'], {}).get('name', 'Tanár'),
                    status=task_status(task, tasks), issue=task['issue'], roleLabel=ROLE_LABELS[task['role']])
        task_data.append(item)
    players = []
    for person in sorted(room['players'].values(), key=lambda item: item['order']):
        owned = [task for task in room['tasks'] if task['ownerId'] == person['id']]
        players.append(dict(id=person['id'], name=person['name'], avatar=person['avatar'], role=person['role'],
                            roleLabel=ROLE_LABELS[person['role']], done=sum(task['done'] for task in owned),
                            total=len(owned), me=person is player))
    session_remaining = remaining + sum(phase['duration'] for phase in PHASES[phase_index + 1:]) if room['status'] == 'working' else 0
    data = dict(schema=2, code=room['code'], status=room['status'], phase=room['phase'],
                phaseLabel=PHASES[phase_index]['label'], phases=PHASES, remaining=round(remaining),
                sessionRemaining=round(session_remaining), paused=room['pause'] is not None,
                mode=room['mode'], limit=35, minPlayers=4, joinUrl=room['joinUrl'], players=players,
                project=dict(config=dict(room['project']['config']), revision=room['project']['revision']),
                tasks=task_data, events=list(room['events']),
                progress=dict(done=sum(task['done'] for task in room['tasks']), total=len(room['tasks'])),
                brief='Készítsünk együtt egy Kandó nyílt napos weboldalt! Minden hozzájárulás számít: tervezz, építs, próbáld ki, és segíts a társadnak. A próbaűrlap nem küld adatot.')
    if player:
        data['self'] = dict(id=player['id'], name=player['name'], avatar=player['avatar'], role=player['role'],
                            roleLabel=ROLE_LABELS[player['role']], taskIds=[task['id'] for task in room['tasks'] if task['ownerId'] == player['id']])
    if host:
        data['host'] = True
    return data


def locked(fn):
    @functools.wraps(fn)
    def wrap(*args, **kwargs):
        # One SQLite transaction spans read/modify/write, also preventing lost updates across workers.
        with LOCK, closing(sqlite3.connect(DB_PATH, timeout=20)) as db, db:
            db.execute('BEGIN IMMEDIATE')
            LOCAL.db = db
            try:
                return fn(*args, **kwargs)
            finally:
                LOCAL.db = None
    return wrap


def room_for(code):
    room = load(code)
    if not room:
        return None, error('Ez a csoport nem található vagy lejárt. Ellenőrizd a kódot!', 404)
    if room.get('schema') != 2:
        return None, error('Ez egy korábbi játék csoportja. A tanár indítson új Kódlabor-csoportot!', 410)
    return room, None


def identity(room, token):
    if not isinstance(token, str):
        return None, False
    return room['players'].get(token), secrets.compare_digest(token.encode(), room['host'].encode())


def request_key(data):
    value = data.get('requestId')
    if value is not None and (not isinstance(value, str) or not 8 <= len(value) <= 100):
        return None, error('Hibás kérésazonosító.')
    return value, None


def edit_context(data):
    room, failed = room_for(data.get('code'))
    if failed:
        return None, None, None, None, failed
    player, host = identity(room, data.get('token'))
    if not player and not host:
        return None, None, None, None, error('Csatlakozz a csoporthoz!', 403)
    task_id = data.get('taskId')
    task = next((item for item in room['tasks'] if item['id'] == task_id), None) if isinstance(task_id, str) else None
    if task is None:
        return None, None, None, None, error('Nincs ilyen feladat.', 404)
    if not host and task['ownerId'] != player['id']:
        return None, None, None, None, error('Ezt a feladatot a felelőse vagy a tanár módosíthatja.', 403)
    if room['status'] != 'working' or room['phase'] not in ('build', 'review') or room['pause'] is not None:
        return None, None, None, None, error('Az építés és kipróbálás szakaszában dolgozhatsz. Szünetben a feladatok is várnak.', 409)
    return room, task, player, host, None


def fingerprint(room, task):
    tasks = {item['id']: item for item in room['tasks']}
    return [[dependency, tasks[dependency]['done'], room['project']['config'][tasks[dependency]['key']]] for dependency in task['dependsOn']]


@app.before_request
def guard():
    if not request.path.startswith('/api/'):
        return None
    origin = request.headers.get('Origin')
    own_origin = request.host_url.rstrip('/')
    if origin and origin not in ALLOWED_ORIGINS and origin != own_origin:
        return error('Erről az oldalról nem engedélyezett a csatlakozás.', 403)
    if request.method == 'OPTIONS':
        return '', 204
    if request.method == 'POST':
        if not request.is_json:
            return error('JSON kérés szükséges.', 415)
        if not isinstance(request.get_json(silent=True), dict):
            return error('Hibás kérés.')
        ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[-1].strip()
        limit = 12 if request.path == '/api/login' else 600
        now = time.time()
        key = (ip, request.path)
        with LOCK:
            for old in [key for key, value in LIMITS.items() if now - value[0] > 60]:
                LIMITS.pop(old, None)
            start, count = LIMITS.get(key, (now, 0))
            if count >= limit:
                return error('Túl sok próbálkozás. Várj egy percet!', 429)
            LIMITS[key] = (start, count + 1)


@app.after_request
def headers(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    if request.path.startswith('/api/'):
        origin = request.headers.get('Origin')
        if origin in ALLOWED_ORIGINS or origin == request.host_url.rstrip('/'):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Vary'] = 'Origin'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response


@app.errorhandler(413)
def too_large(_error):
    return error('Túl nagy kérés.', 413)


@app.get('/health')
def health():
    return jsonify(ok=True, version='kodlabor-1')


@app.post('/api/login')
@locked
def login():
    if len(PASSWORD) < 12:
        return error('A tanári belépés még nincs beállítva a szerveren.', 503)
    given = request.json.get('password', '')
    if not isinstance(given, str) or not secrets.compare_digest(given.encode(), PASSWORD.encode()):
        return error('Hibás tanári jelszó.', 401)
    for token in [token for token, expires in ADMINS.items() if expires < time.time()]:
        ADMINS.pop(token, None)
    token = secrets.token_urlsafe(32)
    ADMINS[token] = time.time() + 8 * 3600
    return jsonify(token=token)


@app.post('/api/create')
@locked
def create():
    data = request.json
    token = data.get('admin')
    if not isinstance(token, str) or ADMINS.get(token, 0) < time.time():
        return error('Jelentkezz be a tanári felületen!', 401)
    mode = data.get('mode', 'group')
    if mode not in ('group', 'demo'):
        return error('Válassz csoportos vagy bemutató módot!')
    key, failed = request_key(data)
    if failed:
        return failed
    digest = hashlib.sha256((token + ':' + key).encode()).hexdigest() if key else None
    rows = connection().execute('SELECT code,data FROM rooms').fetchall()
    for old_code, raw in rows:
        old = json.loads(raw)
        if old.get('created', 0) < time.time() - TTL:
            connection().execute('DELETE FROM rooms WHERE code=?', (old_code,))
        elif digest and old.get('createRequest') == digest:
            return jsonify(code=old['code'], token=old['host'])
    code = str(secrets.randbelow(900000) + 100000)
    while connection().execute('SELECT 1 FROM rooms WHERE code=?', (code,)).fetchone():
        code = str(secrets.randbelow(900000) + 100000)
    room = dict(schema=2, code=code, host=secrets.token_urlsafe(32), players={}, status='lobby',
                phase='brief', mode=mode, pause=None, deadline=0, joinUrl=PUBLIC_URL, created=time.time(),
                project=dict(config=dict(DEFAULTS), revision=0), tasks=new_tasks(6), events=[], eventSequence=0,
                joinRequests={}, controlRequests=[], createRequest=digest)
    event(room, 'A közös Kandó-oldal készen áll az ötleteitekre.')
    save(room)
    return jsonify(code=code, token=room['host'])


@app.get('/api/state')
@locked
def state():
    room, failed = room_for(request.args.get('code'))
    if failed:
        return failed
    token = request.headers.get('Authorization', '').removeprefix('Bearer ')
    player, host = identity(room, token)
    return jsonify(public(room, player, host))


def assign_late(room, person):
    available = [task for task in room['tasks'] if task['ownerId'] is None and not task['done']]
    if not available:
        counts = {player['id']: sum(task['ownerId'] == player['id'] for task in room['tasks']) for player in room['players'].values()}
        available = [task for task in room['tasks'] if not task['done'] and counts.get(task['ownerId'], 0) > 1]
    if not available and len(room['tasks']) < len(CATALOGUE):
        before = len(room['tasks'])
        room['tasks'] += new_tasks(min(before + 2, len(CATALOGUE)))[before:]
        available = room['tasks'][before:]
    if not available:
        return False
    chosen = available[0]
    chosen['ownerId'] = person['id']
    person['role'] = chosen['role']
    return True


@app.post('/api/join')
@locked
def join():
    data = request.json
    room, failed = room_for(data.get('code'))
    if failed:
        return failed
    key, failed = request_key(data)
    if failed:
        return failed
    if key and key in room['joinRequests']:
        return jsonify(token=room['joinRequests'][key], code=room['code'])
    if room['status'] not in ('lobby', 'working') or room['phase'] == 'handover':
        return error('Ez a csoport már a bemutatónál tart vagy lezárult. Várd meg az új csoportot!', 409)
    name = data.get('name', '')
    if not isinstance(name, str):
        return error('Válassz egy becenevet!')
    name = ' '.join(name.split())[:18]
    if not name:
        return error('Válassz egy becenevet!')
    if any(person['name'].casefold() == name.casefold() for person in room['players'].values()):
        return error('Ez a becenév már foglalt.', 409)
    limit = 3 if room['mode'] == 'demo' else 35
    if len(room['players']) >= limit:
        return error('A bemutató mód legfeljebb 3 résztvevős.' if room['mode'] == 'demo' else 'A csoport megtelt (35 fő).', 409)
    token = secrets.token_urlsafe(24)
    avatar = data.get('avatar', 0)
    if type(avatar) is not int or not 0 <= avatar < 6:
        avatar = 0
    person = dict(id=secrets.token_hex(8), name=name, avatar=avatar, order=len(room['players']), role='designer')
    if room['status'] == 'working' and not assign_late(room, person):
        return error('Már minden hozzájárulás elkészült. Csatlakozz a közös bemutatóhoz!', 409)
    room['players'][token] = person
    if room['status'] == 'lobby':
        assign(room)
    if key:
        room['joinRequests'][key] = token
    event(room, name + ' csatlakozott a csapathoz.')
    save(room)
    return jsonify(token=token, code=room['code'])


@app.post('/api/control')
@locked
def control():
    data = request.json
    room, failed = room_for(data.get('code'))
    if failed:
        return failed
    _person, host = identity(room, data.get('token'))
    if not host:
        return error('Ehhez tanári jogosultság szükséges.', 403)
    key, failed = request_key(data)
    if failed:
        return failed
    if key and key in room['controlRequests']:
        return jsonify(public(room, host=True))
    action = data.get('action')
    if action in ('start', 'next') and room['status'] == 'lobby':
        if room['mode'] != 'demo' and len(room['players']) < 4:
            return error('A csoportos módhoz legalább 4 résztvevő kell. Kisebb létszámhoz indíts bemutató módot!', 409)
        room['status'] = 'working'
        room['phase'] = 'brief'
        room['deadline'] = time.time() + PHASES[0]['duration']
        room['pause'] = None
        event(room, 'Indul a közös terv: mindenki saját hozzájárulást kapott.')
    elif action == 'start' and room['status'] == 'working':
        pass
    elif action == 'next' and room['status'] == 'working':
        advance(room, time.time())
    elif action == 'pause' and room['status'] == 'working':
        if room['pause'] is None:
            room['pause'] = max(0, room['deadline'] - time.time())
            event(room, 'A tanár szünetet tart. Minden feladat megvár benneteket.')
        else:
            room['deadline'] = time.time() + room['pause']
            room['pause'] = None
            event(room, 'Folytatódik a közös alkotás.')
    elif action == 'resume' and room['status'] == 'working':
        if room['pause'] is not None:
            room['deadline'] = time.time() + room['pause']
            room['pause'] = None
    elif action in ('finish', 'end') and room['status'] in ('working', 'finished'):
        if room['status'] != 'finished':
            event(room, 'A tanár lezárta a közös munkát. Nézzétek meg, mit alkottatok!')
        room['status'] = 'finished'
        room['phase'] = 'handover'
        room['pause'] = None
        room['deadline'] = 0
    elif action == 'close':
        if room['status'] != 'closed':
            event(room, 'A tanár lezárta a csoportot.')
        room['status'] = 'closed'
        room['pause'] = None
        room['deadline'] = 0
    else:
        return error('Ez a vezérlés most nem használható.', 409)
    if key:
        room['controlRequests'] = (room['controlRequests'] + [key])[-120:]
    save(room)
    return jsonify(public(room, host=True))


@app.post('/api/task')
@locked
def submit_task():
    data = request.json
    room, task, player, host, failed = edit_context(data)
    if failed:
        return failed
    value = data.get('value')
    if not isinstance(value, str) or value not in [option['value'] for option in task['options']]:
        return error('Válassz a feladat lehetőségei közül!')
    actor = 'A tanár' if host else player['name']
    if task['kind'] != 'test':
        changed = room['project']['config'][task['key']] != value
        was_done = task['done']
        if changed:
            room['project']['config'][task['key']] = value
            room['project']['revision'] += 1
        task.update(done=True, issue=None, value=value)
        if changed or not was_done:
            for dependent in room['tasks']:
                if task['id'] in dependent['dependsOn']:
                    dependent.update(done=False, issue=None, value=None, probes={})
            event(room, actor + ' elkészítette: ' + task['title'])
    else:
        if value == 'confirm' and task['done']:
            return jsonify(public(room, player, host))
        dependencies = {item['id']: item for item in room['tasks']}
        if value == 'report' and task['issue'] and any(not dependencies[key]['done'] for key in task['dependsOn']):
            return jsonify(public(room, player, host))
        if any(not dependencies[key]['done'] for key in task['dependsOn']):
            return error('Előbb készüljön el a kapcsolódó alkotófeladat!', 409)
        probe = task['probes'].get(data['token'])
        if not probe or probe['fingerprint'] != fingerprint(room, task):
            return error('Előbb futtasd le az ellenőrzést az oldal aktuális változatán!', 409)
        if value == 'confirm':
            if not probe['passed']:
                return error('Az ellenőrzés javítandó működést talált. Kérj javítást, majd próbáld újra!', 409)
            task.update(done=True, issue=None, value='confirm')
            event(room, actor + ' ellenőrizte: ' + task['title'])
        else:
            if probe['passed']:
                return error('Ez az ellenőrzés megfelelő működést látott. Jóváhagyhatod az eredményt.', 409)
            task.update(done=False, issue=probe['hint'], value='report')
            for dependency in task['dependsOn']:
                dependencies[dependency].update(done=False, issue=probe['hint'])
            event(room, actor + ' segítséget küldött a javításhoz: ' + probe['hint'])
    save(room)
    return jsonify(public(room, player, host))


@app.post('/api/probe')
@locked
def probe_task():
    data = request.json
    room, task, player, host, failed = edit_context(data)
    if failed:
        return failed
    if task['kind'] != 'test':
        return error('Ezt az ellenőrző feladatoknál használhatod.')
    dependencies = {item['id']: item for item in room['tasks']}
    if any(not dependencies[key]['done'] for key in task['dependsOn']):
        return error('Előbb készüljön el a kapcsolódó alkotófeladat!', 409)
    result = check(task, room['project']['config'])
    task['probes'][data['token']] = dict(result, fingerprint=fingerprint(room, task))
    save(room)
    return jsonify(**result, revision=room['project']['revision'], state=public(room, player, host))


@app.post('/api/answer')
def retired_answer():
    return error('A régi játék lezárult. Nyiss új Kódlabor-csoportot!', 410)


@app.get('/')
def index():
    return send_from_directory(ROOT, 'index.html')


@app.get('/<name>')
def asset(name):
    if name not in ('index.html', 'style.css', 'app.js', 'config.js', 'viewport.js', 'site.js'):
        return error('Nincs ilyen oldal.', 404)
    return send_from_directory(ROOT, name)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '8771')), threaded=True, debug=False)
