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
from project import (DEFAULTS, PHASES, ROLE_LABELS, CATALOGUE, ALL_CATALOGUE,
                     GROUP_SIZES, TASKS_PER_PLAYER, PROJECT_VIEWS,
                     PUBLICATION_LABELS, assign, check, new_tasks, group_tasks, task_dependencies)

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
PRESENCE_TIMEOUT = 30
HEARTBEAT_INTERVAL = 10


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
        # Existing groups get a one-time grace period, not a fresh one on every poll.
        migrated = False
        for person in room['players'].values():
            if 'active' not in person:
                person['active'] = True
                migrated = True
            if 'lastSeen' not in person:
                person['lastSeen'] = time.time()
                migrated = True
        if migrated:
            save(room)
        # Copy changes also reach active rooms without resetting any task progress.
        catalogue = {task['id']: task for task in ALL_CATALOGUE}
        if room['mode'] == 'group':
            group_size = sum(connected(person) for person in room['players'].values()) if room['status'] == 'lobby' else room.get('participantCount')
            catalogue.update({task['id']: task for task in group_tasks(group_size)})
        available = {task['id'] for task in room['tasks']}
        for task in room['tasks']:
            current = catalogue.get(task['id'])
            if current:
                task.update({key: current[key] for key in ('title', 'hint', 'options')})
                task['dependsOn'] = task_dependencies(current, available)
        room['project']['config'] = dict(DEFAULTS, **room['project']['config'])
        if room['status'] == 'lobby':
            assign_present(room)
            save(room)
        update(room)
    return room


def save(room):
    values = (room['code'], json.dumps(room, ensure_ascii=False))
    if connection() is not None:
        connection().execute('INSERT OR REPLACE INTO rooms VALUES (?,?)', values)
    else:
        with closing(sqlite3.connect(DB_PATH)) as db, db:
            db.execute('INSERT OR REPLACE INTO rooms VALUES (?,?)', values)


def event(room, text, **details):
    room['eventSequence'] += 1
    item = dict(id=room['eventSequence'], text=text, **details)
    room['events'].append(item)
    room['events'] = room['events'][-40:]
    return item


def project_change(room, task, actor, kind, label):
    details = dict(key=task['key'], taskId=task['id'], actor=actor,
                   label=label, view=PROJECT_VIEWS.get(task['key'], 'home'),
                   kind=kind, revision=room['project']['revision'])
    item = event(room, actor + ' · ' + label, **details)
    room['project']['lastChange'] = dict(details, eventId=item['id'])


def live_drafts(room, now):
    """Only authorized, still-live drafts are public; baseline work is separate."""
    if room['status'] != 'working' or room['phase'] not in ('build', 'review') or room['pause'] is not None:
        return {}
    people = {person['id']: person for person in room['players'].values()}
    tasks = {task['id']: task for task in room['tasks']}
    valid = {}
    for actor_id, draft in room.get('liveDrafts', {}).items():
        task = tasks.get(draft.get('taskId'))
        person = people.get(actor_id)
        if (now - draft.get('at', 0) >= 15 or not task or task['kind'] == 'test'
                or (actor_id != 'host' and (not person or not person.get('active', True)
                                           or task['ownerId'] != actor_id))):
            continue
        valid[actor_id] = draft
    return valid


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
        room['deadline'] = at + phase['duration'] if room['mode'] != 'demo' else 0
        event(room, 'Új szakasz: ' + phase['label'] + '.')


def update(room):
    changed = False
    now = time.time()
    while room['mode'] != 'demo' and room['status'] == 'working' and room['pause'] is None and now >= room['deadline']:
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


def connected(person, now=None):
    return person.get('active', True) and (time.time() if now is None else now) - person.get('lastSeen', 0) <= PRESENCE_TIMEOUT


def assign_present(room):
    if room['status'] != 'lobby':
        return
    assign(room, [person for person in room['players'].values() if connected(person)])


def public(room, player=None, host=False):
    phase_index = next(index for index, phase in enumerate(PHASES) if phase['id'] == room['phase'])
    automatic = room['mode'] != 'demo'
    remaining = room['pause'] if room['pause'] is not None else max(0, room['deadline'] - time.time())
    if not automatic or room['status'] != 'working':
        remaining = 0
    tasks = {task['id']: task for task in room['tasks']}
    people = {person['id']: person for person in room['players'].values()}
    task_data = []
    for task in room['tasks']:
        item = {key: task[key] for key in ('id', 'title', 'role', 'kind', 'key', 'options', 'dependsOn', 'ownerId', 'value', 'hint')}
        item.update(ownerName=people.get(task['ownerId'], {}).get('name', 'Tanár'),
                    status=task_status(task, tasks), issue=task['issue'], roleLabel=ROLE_LABELS[task['role']],
                    publishVersion=task.get('publishVersion', 0))
        task_data.append(item)
    players = []
    now = time.time()
    for person in sorted(room['players'].values(), key=lambda item: item['order']):
        owned = [task for task in room['tasks'] if task['ownerId'] == person['id']]
        players.append(dict(id=person['id'], name=person['name'], avatar=person['avatar'], role=person['role'],
                            roleLabel=ROLE_LABELS[person['role']], done=sum(task['done'] for task in owned),
                            total=len(owned), me=person is player,
                            active=person.get('active', True), connected=connected(person, now)))
    session_remaining = remaining + sum(phase['duration'] for phase in PHASES[phase_index + 1:]) if automatic and room['status'] == 'working' else 0
    connected_count = sum(person['connected'] for person in players)
    participant_count = connected_count if room['status'] == 'lobby' else room.get('participantCount')
    group_size = participant_count if room['mode'] == 'group' and participant_count in GROUP_SIZES else None
    built_keys = [task['key'] for task in room['tasks']
                  if task['kind'] != 'test' and task.get('value') is not None]
    # Older small groups never received the second service-card assignment.
    # Restore that service in their completed presentation only; do not invent
    # a contribution, alter their task history, or complete unfinished new work.
    if (room['status'] == 'finished' and 'participantCount' not in room
            and 'cardCode' in built_keys
            and not any(task['kind'] != 'test' and task['key'] == 'cardNetwork' for task in room['tasks'])):
        built_keys.append('cardNetwork')
    data = dict(schema=2, code=room['code'], status=room['status'], phase=room['phase'],
                phaseLabel=PHASES[phase_index]['label'], phases=PHASES, remaining=round(remaining),
                sessionRemaining=round(session_remaining), paused=room['pause'] is not None,
                mode=room['mode'], automatic=automatic, limit=3 if room['mode'] == 'demo' else 9,
                minPlayers=0 if room['mode'] == 'demo' else 3, allowedPlayerCounts=list(GROUP_SIZES),
                tasksPerPlayer=TASKS_PER_PLAYER.get(group_size),
                participantsPerRole=group_size // 3 if group_size else None,
                plannedTotal=group_size * TASKS_PER_PLAYER[group_size] if group_size else
                             (len(room['tasks']) if room['status'] != 'lobby' or room['mode'] == 'demo' else 0),
                joinUrl=room['joinUrl'], players=players, connectedCount=connected_count,
                presentation=room.get('presentation'),
                project=dict(config=dict(room['project']['config']), revision=room['project']['revision'],
                             builtKeys=built_keys,
                             lastChange=room['project'].get('lastChange'),
                             liveDrafts=sorted(live_drafts(room, now).values(), key=lambda draft: draft['id'], reverse=True),
                             liveTest=room['project'].get('liveTest') if
                             room['status'] == 'working' and room['phase'] in ('build', 'review')
                             and room['pause'] is None
                             and now - room['project'].get('liveTest', {}).get('at', 0) < 5 else None),
                tasks=task_data, events=list(room['events']),
                progress=dict(done=sum(task['done'] for task in room['tasks']), total=len(room['tasks'])),
                brief='A Tücsök Kutyakozmetika nyilvános Facebook-oldala alapján készítünk tanulói weboldaltervet. Mutassuk be a Fürdetés és a Teljes kozmetika szolgáltatást, az elérhetőségeket és a bejelentkezés alapján működő szalont. A bemutató időpontfoglalóhoz kitalált kutyanevet és időpontokat használunk; adatot nem küldünk, valódi foglalás nem történik.')
    if player:
        data['self'] = dict(id=player['id'], name=player['name'], avatar=player['avatar'], role=player['role'],
                            roleLabel=ROLE_LABELS[player['role']], active=player.get('active', True), connected=connected(player, now),
                            taskIds=[task['id'] for task in room['tasks'] if task['ownerId'] == player['id']])
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
    if player and not player.get('active', True):
        return None, None, None, None, error('Folytasd a korábbi belépésedet, hogy újra dolgozhass!', 409)
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
    return jsonify(ok=True, version='kodlabor-2')


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
                phase='brief', mode=mode, pause=None, deadline=0, presentation=None, joinUrl=PUBLIC_URL, created=time.time(),
                project=dict(config=dict(DEFAULTS), revision=0), tasks=new_tasks(len(CATALOGUE)) if mode == 'demo' else [], events=[], eventSequence=0,
                joinRequests={}, controlRequests=[], createRequest=digest)
    event(room, 'Üres oldalból indulunk. A Tücsök weboldalát ti építitek fel.')
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
    if player and player.get('active', True):
        changed = False
        if time.time() - player.get('lastSeen', 0) >= HEARTBEAT_INTERVAL:
            player['lastSeen'] = time.time()
            changed = True
        # A backgrounded tab can return by polling, without reloading or resuming.
        if room['mode'] == 'demo' and room['status'] == 'working' and room['phase'] in ('brief', 'build', 'review'):
            if not any(task['ownerId'] == player['id'] for task in room['tasks']):
                changed = assign_late(room, player) or changed
        if changed:
            if room['status'] == 'lobby':
                assign_present(room)
            save(room)
    return jsonify(public(room, player, host))


def assign_late(room, person):
    # A started group keeps its exact roster and workloads. Reconnection is
    # allowed, but cannot take another participant's contribution away.
    if room['mode'] == 'group':
        return False
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


def resume_person(room, person):
    person.update(active=True, lastSeen=time.time())
    if room['status'] == 'lobby':
        assign_present(room)
    elif room['mode'] == 'demo' and room['status'] == 'working' and room['phase'] != 'handover':
        if not any(task['ownerId'] == person['id'] for task in room['tasks']):
            assign_late(room, person)


@app.post('/api/resume')
@locked
def resume():
    data = request.json
    room, failed = room_for(data.get('code'))
    if failed:
        return failed
    person, _host = identity(room, data.get('token'))
    if not person:
        return error('Ez a korábbi belépés már nem használható. Csatlakozz újra, vagy szólj a tanárnak!', 403)
    if room['status'] == 'closed':
        return error('A tanár lezárta ezt a csoportot. Csatlakozz az új csoporthoz!', 409)
    resume_person(room, person)
    save(room)
    return jsonify(code=room['code'], token=data['token'])


@app.post('/api/leave')
@locked
def leave():
    data = request.json
    room, failed = room_for(data.get('code'))
    if failed:
        return failed
    person, _host = identity(room, data.get('token'))
    if not person:
        return error('Nincs ilyen belépés ebben a csoportban.', 403)
    if person.get('active', True):
        person['active'] = False
        room.get('liveDrafts', {}).pop(person['id'], None)
        if room['status'] == 'lobby':
            assign_present(room)
        event(room, person['name'] + ' kilépett. A korábbi belépésével folytathatja.')
        save(room)
    return jsonify(ok=True)


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
        existing_token = room['joinRequests'][key]
        person = room['players'].get(existing_token)
        if person:
            if room['status'] == 'closed':
                return error('A tanár lezárta ezt a csoportot. Csatlakozz az új csoporthoz!', 409)
            resume_person(room, person)
            save(room)
            return jsonify(token=existing_token, code=room['code'])
        room['joinRequests'].pop(key, None)
    if room['status'] not in ('lobby', 'working') or room['phase'] == 'handover':
        return error('Ez a csoport már a bemutatónál tart vagy lezárult. Várd meg az új csoportot!', 409)
    if room['mode'] == 'group' and room['status'] != 'lobby':
        return error('A csoport már elindult. A korábbi belépéseddel folytathatod, új résztvevőként a következő csoporthoz csatlakozhatsz.', 409)
    name = data.get('name', '')
    if not isinstance(name, str):
        return error('Válassz egy becenevet!')
    name = ' '.join(name.split())[:18]
    if not name:
        return error('Válassz egy becenevet!')
    if any(person['name'].casefold() == name.casefold() for person in room['players'].values()):
        return error('Ez a becenév már bent van. A korábbi eszközön válaszd a folytatást; ha nem megy, a tanár törölheti a régi belépést.', 409)
    limit = 3 if room['mode'] == 'demo' else 9
    if len(room['players']) >= limit:
        return error('A bemutató mód legfeljebb 3 résztvevős.' if room['mode'] == 'demo' else 'A csoport megtelt (9 fő).', 409)
    token = secrets.token_urlsafe(24)
    avatar = data.get('avatar', 0)
    if type(avatar) is not int or not 0 <= avatar < 6:
        avatar = 0
    person = dict(id=secrets.token_hex(8), name=name, avatar=avatar,
                  order=max((item['order'] for item in room['players'].values()), default=-1) + 1,
                  role='designer', active=True, lastSeen=time.time())
    if room['status'] == 'working' and not assign_late(room, person):
        return error('Már minden hozzájárulás elkészült. Csatlakozz a közös bemutatóhoz!', 409)
    room['players'][token] = person
    if room['status'] == 'lobby':
        assign_present(room)
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
    if action == 'remove-player':
        player_id = data.get('playerId')
        removed_token = next((token for token, person in room['players'].items() if person['id'] == player_id), None) if isinstance(player_id, str) else None
        if removed_token is None:
            return error('Ez a résztvevő már nincs a csoportban.', 404)
        removed = room['players'].pop(removed_token)
        room.get('liveDrafts', {}).pop(player_id, None)
        room['joinRequests'] = {key: token for key, token in room['joinRequests'].items() if token != removed_token}
        for task in room['tasks']:
            if task['ownerId'] == player_id:
                task['ownerId'] = None
            task.get('probes', {}).pop(removed_token, None)
        if room['status'] == 'lobby':
            assign_present(room)
        event(room, removed['name'] + ' kikerült a csoportból. A megmaradt munkáját a tanár folytathatja.')
    elif action in ('code-html', 'code-css', 'code-javascript', 'code-path', 'code-close'):
        if room['status'] not in ('working', 'finished') or (room['phase'] != 'handover' and room['status'] != 'finished'):
            return error('A kódot a közös bemutatónál vagy a lezárás után mutathatod meg.', 409)
        if action == 'code-close':
            room['presentation'] = None
        elif action == 'code-path':
            presentation = room.get('presentation') or dict(tab='html', path=False)
            room['presentation'] = dict(tab=presentation['tab'], path=not presentation['path'])
        else:
            room['presentation'] = dict(tab=action.removeprefix('code-'), path=False)
    elif action in ('start', 'next') and room['status'] == 'lobby':
        participants = [person for person in room['players'].values() if connected(person)]
        if room['mode'] != 'demo' and len(participants) not in GROUP_SIZES:
            return error('A csoportos játék pontosan 3, 6 vagy 9 jelen lévő résztvevővel indítható. Minden szerephez ugyanannyi játékos kell.', 409)
        assign_present(room)
        room['participantCount'] = len(participants)
        room['participantIds'] = [person['id'] for person in participants]
        room['status'] = 'working'
        room['phase'] = 'brief'
        room['deadline'] = time.time() + PHASES[0]['duration'] if room['mode'] != 'demo' else 0
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
            room['deadline'] = time.time() + room['pause'] if room['mode'] != 'demo' else 0
            room['pause'] = None
            event(room, 'Folytatódik a közös alkotás.')
    elif action == 'resume' and room['status'] == 'working':
        if room['pause'] is not None:
            room['deadline'] = time.time() + room['pause'] if room['mode'] != 'demo' else 0
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
        # A publication ends all preceding draft attempts even when its value
        # is unchanged. This generation is separate from the visual revision.
        task['publishVersion'] = task.get('publishVersion', 0) + 1
        room['liveDrafts'] = {actor_id: draft for actor_id, draft in room.get('liveDrafts', {}).items()
                              if draft.get('taskId') != task['id']}
        # Choosing the preset is still the first actual publication. A test
        # report reopens work without removing that published element.
        changed = task.get('value') is None or room['project']['config'][task['key']] != value
        was_done = task['done']
        if changed:
            room['project']['config'][task['key']] = value
            room['project']['revision'] += 1
        task.update(done=True, issue=None, value=value)
        if changed or not was_done:
            for dependent in room['tasks']:
                if task['id'] in dependent['dependsOn']:
                    dependent.update(done=False, issue=None, value=None, probes={})
            project_change(room, task, actor, 'publish', PUBLICATION_LABELS[task['key']])
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
            project_change(room, task, actor, 'test-pass', 'Ellenőrizve: ' + task['title'])
        else:
            if probe['passed']:
                return error('Ez az ellenőrzés megfelelő működést látott. Jóváhagyhatod az eredményt.', 409)
            task.update(done=False, issue=probe['hint'], value='report')
            for dependency in task['dependsOn']:
                if dependencies[dependency]['key'] == task['key']:
                    dependencies[dependency].update(done=False, issue=probe['hint'])
            project_change(room, task, actor, 'test-report', 'Javításra visszaküldve: ' + task['title'])
    save(room)
    return jsonify(public(room, player, host))


@app.post('/api/try')
@locked
def try_task():
    """Share the selected option before publication, without completing work."""
    data = request.json
    room, task, player, host, failed = edit_context(data)
    if failed:
        return failed
    if task['kind'] == 'test':
        return error('Élő változatot alkotófeladatnál próbálhatsz ki.', 409)
    if set(data) - {'code', 'token', 'taskId', 'value', 'baseValue', 'baseVersion'}:
        return error('Csak a feladat választott lehetőségét küldd!')
    if ('baseValue' not in data or data['baseValue'] != task.get('value')
            or type(data.get('baseVersion')) is not int
            or data['baseVersion'] != task.get('publishVersion', 0)):
        return error('Közben frissült a feladat. Próbáld ki az aktuális változaton!', 409)
    value = data.get('value')
    if not isinstance(value, str) or value not in [option['value'] for option in task['options']]:
        return error('Válassz a feladat lehetőségei közül!')
    now = time.time()
    actor_id = 'host' if host else player['id']
    room['liveDrafts'] = live_drafts(room, now)
    room['draftSequence'] = room.get('draftSequence', 0) + 1
    room['liveDrafts'][actor_id] = dict(id=room['draftSequence'], key=task['key'], value=value,
        view=PROJECT_VIEWS.get(task['key'], 'home'), actor='A tanár' if host else player['name'],
        taskId=task['id'], at=now)
    save(room)
    return jsonify(ok=True)


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


@app.post('/api/preview-action')
@locked
def preview_action():
    """Broadcast a tester's UI action, never the text entered into the form."""
    data = request.json
    room, task, player, host, failed = edit_context(data)
    if failed:
        return failed
    if task['kind'] != 'test':
        return error('Élő próbát ellenőrző feladathoz indíthatsz.', 409)
    tasks = {item['id']: item for item in room['tasks']}
    if any(not tasks[key]['done'] for key in task['dependsOn']):
        return error('Előbb készüljön el a kipróbálandó rész!', 409)
    if set(data) - {'code', 'token', 'taskId', 'action', 'view', 'result'}:
        return error('Az élő próbához csak műveletet és oldalt küldj!')
    action = data.get('action')
    view = data.get('view')
    result = data.get('result')
    if not isinstance(action, str) or action not in {'cta', 'nav', 'program', 'choose', 'filter', 'menu', 'counter', 'submit', 'back'}:
        return error('Nincs ilyen próbaművelet.')
    if not isinstance(view, str) or view not in {'home', 'programs', 'signup', 'contact', 'credits'}:
        return error('Nincs ilyen próbaoldal.')
    allowed_results = {'open', 'closed', 'success', 'error', 'empty', 'blocked', 'bath', 'full', 'all', 'selected', 'available', 'busy'}
    if result is not None and not (isinstance(result, str) and result in allowed_results) and not (type(result) in (int, float) and 0 <= result <= 100):
        return error('Az élő próba eredménye nem tartalmazhat beírt szöveget.')
    now = time.time()
    actor_id = 'host' if host else player['id']
    # Drop bursts harmlessly; rapid clicking must not flood projector updates.
    last_at = room.setdefault('previewActionTimes', {}).get(actor_id, 0)
    if now - last_at < .25:
        return jsonify(ok=True)
    room['previewActionTimes'][actor_id] = now
    room['previewSequence'] = room.get('previewSequence', 0) + 1
    room['project']['liveTest'] = dict(id=room['previewSequence'],
        actor='A tanár' if host else player['name'], taskId=task['id'],
        view=view, action=action, result=result, at=now)
    save(room)
    return jsonify(ok=True)


@app.post('/api/answer')
def retired_answer():
    return error('A régi játék lezárult. Nyiss új Kódlabor-csoportot!', 410)


@app.get('/')
def index():
    return send_from_directory(ROOT, 'index.html')


@app.get('/<name>')
def asset(name):
    if name not in ('index.html', 'style.css', 'app.js', 'config.js', 'viewport.js', 'site.js', 'player-session.js'):
        return error('Nincs ilyen oldal.', 404)
    return send_from_directory(ROOT, name)


@app.get('/assets/<name>')
def photo_asset(name):
    if name not in ('grooming.jpg', 'bath.jpg', 'dog.jpg'):
        return error('Nincs ilyen kép.', 404)
    return send_from_directory(ROOT / 'assets', name)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '8771')), threaded=True, debug=False)
