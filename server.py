"""Shared game API: single worker, SQLite persistence, GitHub Pages client."""
import functools
import json
import os
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).parent
app = Flask(__name__, static_folder=None)
app.config['MAX_CONTENT_LENGTH'] = 12000
LOCK = threading.RLock()
DB_PATH = os.environ.get('DATA_PATH', str(ROOT / '.data' / 'games.sqlite3'))
Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
with sqlite3.connect(DB_PATH) as db:
    db.execute('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL)')
PASSWORD = os.environ.get('TEACHER_PASSWORD', '')
PUBLIC_URL = os.environ.get('PUBLIC_URL', 'https://sandornefr.github.io/kando_nyiltnap/').rstrip('/')+'/'
ALLOWED_ORIGINS = set(filter(None, os.environ.get('ALLOWED_ORIGINS', 'https://sandornefr.github.io').split(',')))
ALLOWED_ORIGINS.add(urlsplit(PUBLIC_URL).scheme+'://'+urlsplit(PUBLIC_URL).netloc)
ADMINS = {}
LIMITS = {}
ROUNDS = [
    dict(title='Induljon az adás!', field='TÁVKÖZLÉS', brief='Kösd össze a TV-boxot a routerrel, a tévével és a tápegységgel!', duration=100),
    dict(title='Robot a célban', field='PROGRAMOZÁS', brief='Építs útvonalat a robotnak! Kerüld ki a lezárt mezőket!', duration=120),
    dict(title='Kapd el a hibát!', field='SZOFTVERTESZTELÉS', brief='Próbáld ki a jegyautomatát, majd jelöld meg a hibás működést!', duration=100),
]


def error(message, status=400):
    return jsonify(error=message), status


def load(code):
    if not isinstance(code, str) or not (len(code)==6 and code.isdigit()):
        return None
    with sqlite3.connect(DB_PATH) as db:
        row=db.execute('SELECT data FROM rooms WHERE code=?', (code,)).fetchone()
    if not row:
        return None
    room=json.loads(row[0])
    if room['created'] < time.time()-86400:
        return None
    update(room)
    return room


def save(room):
    with sqlite3.connect(DB_PATH) as db:
        db.execute('INSERT OR REPLACE INTO rooms VALUES (?,?)', (room['code'],json.dumps(room,ensure_ascii=False)))


def update(room):
    if room['status']=='playing' and room['pause'] is None and time.time()>=room['deadline']:
        room['status']='results'
        save(room)


def public(room, player=None, host=False):
    remaining=room['pause'] if room['pause'] is not None else max(0,room['deadline']-time.time())
    rank=sorted(room['players'].values(),key=lambda p:(-p['score'],p['order']))
    data=dict(code=room['code'],status=room['status'],round=room['round'],rounds=ROUNDS,
              remaining=round(remaining),paused=room['pause'] is not None,limit=50,joinUrl=room['joinUrl'],
              players=[dict(name=p['name'],avatar=p['avatar'],score=p['score'],done=room['round'] in p['solved'],me=p is player) for p in rank])
    if player:
        data['self']=dict(name=player['name'],avatar=player['avatar'],score=player['score'],
                          done=room['round'] in player['solved'],attempts=player['attempts'].get(str(room['round']),0))
    if host:
        data['host']=True
    return data


def correct(index, answer):
    if index==0:
        return answer=={'router':'lan','tv':'hdmi','power':'dc'}
    if index==1:
        if not isinstance(answer,list) or not 1<=len(answer)<=12:
            return False
        x,y=0,3
        for step in answer:
            if not isinstance(step,str) or step not in ('R','L','U','D'):
                return False
            dx,dy={'R':(1,0),'L':(-1,0),'U':(0,-1),'D':(0,1)}[step]
            x,y=x+dx,y+dy
            if not (0<=x<4 and 0<=y<4) or (x,y) in [(1,2),(2,2),(2,0)]:
                return False
        return (x,y)==(3,0)
    return answer=='quantity'


def locked(fn):
    @functools.wraps(fn)
    def wrap(*args,**kwargs):
        with LOCK:
            return fn(*args,**kwargs)
    return wrap


@app.before_request
def guard():
    if not request.path.startswith('/api/'):
        return None
    origin=request.headers.get('Origin')
    own_origin=request.host_url.rstrip('/')
    if origin and origin not in ALLOWED_ORIGINS and origin!=own_origin:
        return error('Erről az oldalról nem engedélyezett a csatlakozás.',403)
    if request.method=='OPTIONS':
        return '',204
    if request.method=='POST':
        if not request.is_json:
            return error('JSON kérés szükséges.',415)
        data=request.get_json(silent=True)
        if not isinstance(data,dict):
            return error('Hibás kérés.')
        # Behind Railway's proxy the rightmost address is the connecting client.
        ip=request.headers.get('X-Forwarded-For',request.remote_addr or '').split(',')[-1].strip()
        limit=12 if request.path=='/api/login' else 600
        now=time.time()
        key=(ip,request.path)
        with LOCK:
            for old in [k for k,v in LIMITS.items() if now-v[0]>60]:
                LIMITS.pop(old,None)
            start,count=LIMITS.get(key,(now,0))
            if count>=limit:
                return error('Túl sok próbálkozás. Várj egy percet!',429)
            LIMITS[key]=(start,count+1)


@app.after_request
def headers(response):
    response.headers['Cache-Control']='no-store'
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='no-referrer'
    if request.path.startswith('/api/'):
        origin=request.headers.get('Origin')
        if origin in ALLOWED_ORIGINS or origin==request.host_url.rstrip('/'):
            response.headers['Access-Control-Allow-Origin']=origin
            response.headers['Vary']='Origin'
            response.headers['Access-Control-Allow-Headers']='Content-Type, Authorization'
            response.headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS'
    return response


@app.errorhandler(413)
def too_large(e):
    return error('Túl nagy kérés.',413)


@app.get('/health')
def health():
    return jsonify(ok=True)


@app.post('/api/login')
@locked
def login():
    if len(PASSWORD)<12:
        return error('A tanári belépés még nincs beállítva a szerveren.',503)
    given=request.json.get('password','')
    if not isinstance(given,str) or not secrets.compare_digest(given.encode(),PASSWORD.encode()):
        return error('Hibás tanári jelszó.',401)
    for key in [k for k,v in ADMINS.items() if v<time.time()]:
        ADMINS.pop(key,None)
    token=secrets.token_urlsafe(32)
    ADMINS[token]=time.time()+8*3600
    return jsonify(token=token)


@app.post('/api/create')
@locked
def create():
    token=request.json.get('admin')
    if not isinstance(token,str) or ADMINS.get(token,0)<time.time():
        return error('Jelentkezz be a tanári felületen!',401)
    code=str(secrets.randbelow(900000)+100000)
    while load(code):
        code=str(secrets.randbelow(900000)+100000)
    room=dict(code=code,host=secrets.token_urlsafe(32),players={},status='lobby',round=-1,
              pause=None,deadline=0,joinUrl=PUBLIC_URL,created=time.time())
    save(room)
    with sqlite3.connect(DB_PATH) as db:
        # Remove old groups rather than retaining visitor names indefinitely.
        rows=db.execute('SELECT code,data FROM rooms').fetchall()
        for old,raw in rows:
            if json.loads(raw)['created']<time.time()-86400:
                db.execute('DELETE FROM rooms WHERE code=?',(old,))
    return jsonify(code=code,token=room['host'])


@app.get('/api/state')
@locked
def state():
    room=load(request.args.get('code',''))
    if not room:
        return error('Ez a játék nem található. Ellenőrizd a kódot!',404)
    token=request.headers.get('Authorization','').removeprefix('Bearer ')
    return jsonify(public(room,room['players'].get(token),token==room['host']))


@app.post('/api/join')
@locked
def join():
    d=request.json
    room=load(d.get('code',''))
    if not room:
        return error('Nincs ilyen játék. Nézd meg a kivetítőn a kódot!',404)
    if room['status']!='lobby':
        return error('Ez a játék már elindult vagy lezárult. Várd meg az új csoport kódját!',409)
    name=d.get('name','')
    if not isinstance(name,str):
        return error('Válassz egy becenevet!')
    name=' '.join(name.split())[:18]
    if not name:
        return error('Válassz egy becenevet!')
    if any(p['name'].casefold()==name.casefold() for p in room['players'].values()):
        return error('Ez a becenév már foglalt.',409)
    if len(room['players'])>=50:
        return error('A játék megtelt (50 fő).',409)
    token=secrets.token_urlsafe(24)
    avatar=d.get('avatar',0)
    if type(avatar) is not int or not 0<=avatar<6:
        avatar=0
    room['players'][token]=dict(name=name,avatar=avatar,score=0,solved=[],attempts={},order=len(room['players']))
    save(room)
    return jsonify(token=token,code=room['code'])


@app.post('/api/control')
@locked
def control():
    d=request.json
    room=load(d.get('code',''))
    if not room:
        return error('Ez a játék nem található.',404)
    if d.get('token')!=room['host']:
        return error('Ehhez tanári jogosultság szükséges.',403)
    action=d.get('action')
    if action=='next' and room['status'] in ('lobby','results'):
        if not room['players']:
            return error('Előbb csatlakozzon legalább egy játékos!',409)
        room['round']+=1
        room['pause']=None
        room['status']='finished' if room['round']==len(ROUNDS) else 'playing'
        if room['status']=='playing':
            room['deadline']=time.time()+ROUNDS[room['round']]['duration']
    elif action=='pause' and room['status']=='playing':
        if room['pause'] is None:
            room['pause']=max(0,room['deadline']-time.time())
        else:
            room['deadline']=time.time()+room['pause'];room['pause']=None
    elif action=='end' and room['status']=='playing':
        room['status']='results';room['pause']=None
    elif action=='close':
        room['status']='closed';room['pause']=None
    save(room)
    return jsonify(public(room,host=True))


@app.post('/api/answer')
@locked
def answer():
    d=request.json
    room=load(d.get('code',''))
    if not room:
        return error('Ez a játék nem található.',404)
    token=d.get('token','')
    if not isinstance(token,str) or token not in room['players']:
        return error('Csatlakozz a játékhoz!',403)
    if room['status']!='playing' or room['pause'] is not None or type(d.get('round')) is not int or d['round']!=room['round']:
        return error('Most nincs aktív feladat. Várd meg a tanárt!',409)
    p=room['players'][token];n=room['round']
    if n in p['solved']:
        return jsonify(correct=True,points=0,already=True)
    success=correct(n,d.get('answer'));points=0
    if success:
        points=max(600,1000-100*p['attempts'].get(str(n),0))
        p['solved'].append(n);p['score']+=points
        if all(n in player['solved'] for player in room['players'].values()):
            room['status']='results';room['pause']=None
    else:
        p['attempts'][str(n)]=p['attempts'].get(str(n),0)+1
    save(room)
    return jsonify(correct=success,points=points)


@app.get('/')
def index():
    return send_from_directory(ROOT,'index.html')


@app.get('/<name>')
def asset(name):
    if name not in ('index.html','style.css','app.js','config.js'):
        return error('Nincs ilyen oldal.',404)
    return send_from_directory(ROOT,name)


if __name__=='__main__':
    app.run(host='0.0.0.0',port=int(os.environ.get('PORT','8771')),threaded=True,debug=False)
