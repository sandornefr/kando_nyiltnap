'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {create} = require('./player-session.js');

const SOURCE = fs.readFileSync(require.resolve('./app.js'), 'utf8');
const KEY = 'kando-nyiltnap-player';
const NOW = 1800000000000;
const PLAYER = {code: '123456', token: 'existing-private-player-token', name: 'Anna', paused: false};

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)};
}

function savedLocal(player = PLAYER) {
  const local = storage();
  create(storage(), local, {now: () => NOW}).save(player);
  return local;
}

function response(body, status = 200) {
  return {ok: status >= 200 && status < 300, status, json: async () => structuredClone(body)};
}

function playerState(overrides = {}) {
  return {code: PLAYER.code, project: {revision: 0, config: {}}, status: 'lobby', phase: 'brief', mode: 'group',
    paused: false, self: {id: 'player-one', name: PLAYER.name, role: 'designer', active: true}, players: [], tasks: [], ...overrides};
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
}

function boot({session = storage(), local = storage(), search = '', handler} = {}) {
  const listeners = {};
  const intervals = [];
  const requests = [];
  const nodes = new Map();
  const timers = new Map();
  let now = NOW, timerSerial = 0;
  function element(id) {
    return {id, innerHTML: '', textContent: '', hidden: false, value: '', dataset: {}, attributes: {},
      classList: {add() {}, remove() {}, toggle() {}},
      setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; },
      addEventListener(type, fn) { (listeners[id + ':' + type] ||= []).push(fn); },
      querySelector() { return null; }, querySelectorAll() { return []; }, remove() {}, focus() {}};
  }
  for (const id of ['app', 'context', 'notice', 'connection', 'help', 'full', 'join-code', 'join-name']) nodes.set(id, element(id));
  const document = {
    hidden: false,
    querySelector(selector) {
      const id = selector.slice(1);
      if (id.startsWith('join-') && !nodes.get('app').innerHTML.includes('id="join-form"')) return null;
      return nodes.get(id) || null;
    },
    addEventListener(type, fn) { (listeners['document:' + type] ||= []).push(fn); }
  };
  class FixedDate extends Date { static now() { return now; } }
  const sandbox = {document, sessionStorage: session, localStorage: local, Date: FixedDate,
    location: {hostname: '127.0.0.1', search, href: 'http://127.0.0.1:8772/' + search},
    URL, URLSearchParams, innerWidth: 390, innerHeight: 844,
    crypto: {randomUUID: () => 'test-request-' + requests.length},
    setInterval(fn) { intervals.push(fn); return intervals.length; },
    setTimeout(fn, delay = 0) { const id = ++timerSerial; timers.set(id, {fn, at: now + delay}); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener() {}, confirm: () => true,
    fetch: async (url, options = {}) => {
      const item = {path: new URL(url, 'http://127.0.0.1').pathname, method: options.method || 'GET',
        body: options.body ? JSON.parse(options.body) : null, authorization: options.headers?.Authorization};
      requests.push(item);
      if (handler) return handler(item, requests);
      if (item.path === '/api/resume') return response({code: PLAYER.code, token: PLAYER.token});
      if (item.path === '/api/leave') return response({ok: true});
      if (item.path === '/api/state') return response(playerState());
      throw Error('Unexpected request ' + item.path);
    }};
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require.resolve('./player-session.js'), 'utf8'), context);
  vm.runInContext(SOURCE, context);
  return {
    session, local, requests,
    html: () => nodes.get('app').innerHTML,
    notice: () => nodes.get('notice').textContent,
    connection: () => nodes.get('connection'),
    tick: () => intervals.forEach(fn => fn()),
    run: source => vm.runInContext(source, context),
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) {timers.delete(id); timer.fn();}
    },
    click(action) {
      assert.ok(nodes.get('app').innerHTML.includes('data-action="' + action + '"'), 'Action must be visible: ' + action);
      const button = {disabled: false, dataset: {action}};
      for (const fn of listeners['app:click'] || []) fn({target: {closest: () => button}});
    },
    submit(code, name) {
      assert.ok(nodes.get('app').innerHTML.includes('id="join-form"'), 'Join form must be visible');
      nodes.get('join-code').value = code;
      nodes.get('join-name').value = name;
      for (const fn of listeners['app:submit'] || []) fn({target: {id: 'join-form'}, preventDefault() {}});
    }
  };
}

async function settle() {
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
}

test('opening a new tab resumes the saved player and polls using the same token', async () => {
  const app = boot({local: savedLocal()});
  await settle();
  assert.deepEqual(app.requests.map(r => r.path), ['/api/resume', '/api/state']);
  assert.equal(app.requests[0].body.token, PLAYER.token);
  assert.equal(app.requests[1].authorization, 'Bearer ' + PLAYER.token);
  assert.match(app.html(), /Benne vagy a csapatban/);
});

test('a legacy tab-only session migrates and learns the player name from the server', async () => {
  const app = boot({session: storage({[KEY]: JSON.stringify({code: PLAYER.code, token: PLAYER.token})})});
  await settle();
  const stored = JSON.parse(app.local.getItem(KEY + ':' + PLAYER.code));
  assert.equal(stored.token, PLAYER.token);
  assert.equal(stored.name, PLAYER.name);
  assert.equal(stored.paused, false);
});

test('explicit leave stays paused across timer ticks and resumes only after Folytatom', async () => {
  const app = boot({local: savedLocal()});
  await settle();
  app.click('leave');
  await settle();
  assert.match(app.html(), /Folytatom a játékom/);
  assert.equal(JSON.parse(app.local.getItem(KEY + ':' + PLAYER.code)).paused, true);
  const count = app.requests.length;
  app.tick();
  await settle();
  assert.equal(app.requests.length, count);
  app.click('resume-player');
  await settle();
  assert.match(app.html(), /Benne vagy a csapatban/);
  assert.equal(JSON.parse(app.local.getItem(KEY + ':' + PLAYER.code)).paused, false);
  assert.equal(app.requests.filter(r => r.path === '/api/join').length, 0);
});

test('a paused saved identity is offered without an automatic request', async () => {
  const app = boot({local: savedLocal({...PLAYER, paused: true})});
  await settle();
  assert.match(app.html(), /Szia, Anna/);
  assert.equal(app.requests.length, 0);
});

test('revoked startup identity is forgotten and the player sees the normal join form', async () => {
  const app = boot({local: savedLocal(), handler: () => response({error: 'Ez a belépés már nem használható.'}, 403)});
  await settle();
  assert.match(app.html(), /id="join-form"/);
  assert.equal(app.local.getItem(KEY + ':' + PLAYER.code), null);
  assert.equal(app.session.getItem(KEY), null);
  assert.match(app.notice(), /már nem használható/);
});

test('a supplied different room never sends the previous room token', async () => {
  const app = boot({local: savedLocal(), search: '?code=654321'});
  await settle();
  assert.match(app.html(), /id="join-form"/);
  assert.match(app.html(), /value="654321"/);
  assert.equal(app.requests.length, 0);
});

test('temporary startup network failure preserves identity and retries on the next tick', async () => {
  let attempts = 0;
  const app = boot({local: savedLocal(), handler: item => {
    if (item.path === '/api/resume') {
      if (++attempts === 1) throw Error('Offline');
      return response({code: PLAYER.code, token: PLAYER.token});
    }
    return response(playerState());
  }});
  await settle();
  assert.ok(app.local.getItem(KEY + ':' + PLAYER.code));
  assert.equal(app.connection().hidden, false);
  app.tick();
  await settle();
  assert.match(app.html(), /Benne vagy a csapatban/);
  assert.equal(attempts, 2);
});

test('an old in-flight state response cannot reactivate a player after explicit leave', async () => {
  let polls = 0;
  const oldPoll = deferred();
  const app = boot({local: savedLocal(), handler: item => {
    if (item.path === '/api/resume') return response({code: PLAYER.code, token: PLAYER.token});
    if (item.path === '/api/leave') return response({ok: true});
    if (item.path === '/api/state' && ++polls === 2) return oldPoll.promise;
    return response(playerState());
  }});
  await settle();
  app.tick();
  app.click('leave');
  await settle();
  oldPoll.resolve(response(playerState()));
  await settle();
  assert.match(app.html(), /Folytatom a játékom/);
  assert.equal(JSON.parse(app.local.getItem(KEY + ':' + PLAYER.code)).paused, true);
});

test('same-name form retry clears a revoked saved token instead of retrying it forever', async () => {
  const app = boot({local: savedLocal({...PLAYER, paused: true}), handler: item => {
    if (item.path === '/api/resume') return response({error: 'A tanár törölte a régi belépést.'}, 403);
    if (item.path === '/api/join') return response({code: PLAYER.code, token: 'new-player-token'});
    return response(playerState());
  }});
  app.click('other-player');
  app.submit(PLAYER.code, PLAYER.name);
  await settle();
  if (!app.requests.some(r => r.path === '/api/join')) {
    assert.equal(app.local.getItem(KEY + ':' + PLAYER.code), null, 'The revoked record must be removed');
    app.submit(PLAYER.code, PLAYER.name);
    await settle();
  }
  assert.equal(app.requests.filter(r => r.path === '/api/join').length, 1);
  assert.match(app.html(), /Benne vagy a csapatban/);
});

test('choosing another player cancels old reconnect retries after a network failure', async () => {
  const app = boot({local: savedLocal({...PLAYER, paused: true}), handler: item => {
    if (item.path === '/api/resume') throw Error('Offline');
    throw Error('Unexpected request');
  }});
  app.click('resume-player');
  await settle();
  app.click('other-player');
  const count = app.requests.length;
  app.tick();
  await settle();
  assert.equal(app.requests.length, count, 'Reconnect must stop when the user chooses a different player');
  assert.match(app.html(), /id="join-form"/);
});

test('late reconnect success cannot replace a different player join form', async () => {
  let attempts = 0;
  const reconnect = deferred();
  const app = boot({local: savedLocal({...PLAYER, paused: true}), handler: item => {
    if (item.path === '/api/resume') {
      if (++attempts === 1) throw Error('Offline');
      return reconnect.promise;
    }
    return response(playerState());
  }});
  app.click('resume-player');
  await settle();
  app.tick();
  app.click('other-player');
  reconnect.resolve(response({code: PLAYER.code, token: PLAYER.token}));
  await settle();
  assert.match(app.html(), /id="join-form"/);
});

test('live projection rotates through three different students instead of alternating only the first two', () => {
  const app = boot();
  app.run(`state={project:{liveDrafts:[{taskId:'first',value:'mint'},{taskId:'second',value:'team'},{taskId:'third',value:'build'}]}};followBuild=true;`);
  const shown = [app.run('liveDraft().taskId')];
  app.advance(7999);
  assert.equal(app.run('liveDraft().taskId'), 'first', 'A trial should remain stable within its display window');
  app.advance(2);
  shown.push(app.run('liveDraft().taskId'));
  app.advance(8001);
  shown.push(app.run('liveDraft().taskId'));
  app.advance(8001);
  shown.push(app.run('liveDraft().taskId'));
  assert.deepEqual(shown, ['first', 'second', 'third', 'first']);
});

test('choosing another player clears local choices and cancels a pending trial broadcast', async () => {
  const app = boot({local: savedLocal({...PLAYER, paused: true})});
  app.run(`
    state={project:{},tasks:[{id:'design-theme',key:'theme',value:null}]};
    drafts['design-theme']='mint';
    draftFocus={taskId:'design-theme',until:Date.now()+8000};
    projectedDraftSignature='old-player-preview';lastLiveTest='old-test';followBuild=false;
    broadcastDraft('design-theme');
  `);
  app.click('other-player');
  app.advance(1000);
  await settle();
  assert.equal(app.requests.length, 0, 'A previous player trial must never be sent after switching identity');
  assert.equal(app.run('Object.keys(drafts).length'), 0);
  assert.equal(app.run('draftFocus'), null);
  assert.equal(app.run('projectedDraftSignature'), '');
  assert.equal(app.run('lastLiveTest'), '');
  assert.equal(app.run('followBuild'), true);
  assert.match(app.html(), /id="join-form"/);
});
