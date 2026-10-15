'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {create} = require('./player-session.js');

const KEY = 'kando-nyiltnap-player';
const TTL = 24 * 60 * 60 * 1000;
const NOW = 1800000000000;
const alice = {code: '123456', token: 'alice-private-token', name: 'Anna', paused: false};
const bob = {code: '654321', token: 'bob-private-token', name: 'Bence', paused: false};

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    values
  };
}

function helper(session = storage(), local = storage(), now = () => NOW) {
  return create(session, local, {now});
}

test('browser global and CommonJS expose the same factory contract', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('./player-session.js'), 'utf8'), context);
  assert.equal(typeof context.KandoPlayerSession.create, 'function');
  assert.deepEqual(Object.keys(helper()).sort(), ['forget', 'get', 'save']);
});

test('reopening after closing a tab restores the original room, token and name', () => {
  const local = storage();
  helper(storage(), local).save(alice);
  const freshTab = storage();
  const reopened = helper(freshTab, local).get();
  assert.deepEqual(reopened, {...alice, updatedAt: NOW});
  assert.equal(JSON.parse(freshTab.getItem(KEY)).token, alice.token);
});

test('explicit exit preserves the paused flag until the player chooses to resume', () => {
  const local = storage();
  helper(storage(), local).save({...alice, paused: true});
  const reopened = helper(storage(), local);
  assert.equal(reopened.get().paused, true);
  reopened.save({...reopened.get(), paused: false});
  assert.equal(helper(storage(), local).get().paused, false);
});

test('a room link never recovers another room and each room keeps its identity', () => {
  const local = storage();
  const session = storage();
  const account = helper(session, local);
  account.save(alice);
  account.save(bob);
  assert.equal(account.get('123456').token, alice.token);
  assert.equal(account.get('654321').token, bob.token);
  assert.equal(account.get('999999'), null);
  assert.equal(account.get('not-a-code'), null);
  assert.equal(account.get(123456), null);
  assert.equal(account.get().token, bob.token);
});

test('the current tab has priority over the most recently used room in another tab', () => {
  const local = storage();
  const first = helper(storage(), local);
  first.save(alice);
  helper(storage(), local).save(bob);
  assert.equal(first.get().token, alice.token);
  assert.equal(helper(storage(), local).get().token, bob.token);
});

test('reading does not extend the 24-hour lifetime but saving activity does', () => {
  const local = storage();
  let clock = NOW;
  const account = helper(storage(), local, () => clock);
  account.save(alice);
  clock += TTL - 1;
  assert.equal(account.get().token, alice.token);
  assert.equal(helper(storage(), local, () => clock).get().updatedAt, NOW);
  clock += 1;
  assert.equal(account.get(), null);
  assert.equal(local.getItem(`${KEY}:123456`), null);
  account.save(alice);
  clock += TTL - 1;
  assert.equal(helper(storage(), local, () => clock).get().token, alice.token);
});

test('an expired tab can recover a more recently refreshed persistent record', () => {
  const local = storage();
  const session = storage();
  helper(session, local).save(alice);
  helper(storage(), local, () => NOW + 10000).save({...alice, name: 'Anna újra'});
  assert.equal(helper(session, local, () => NOW + TTL).get().name, 'Anna újra');
});

test('legacy tab-only identity migrates once into persistent room storage', () => {
  const session = storage({[KEY]: JSON.stringify({code: alice.code, token: alice.token})});
  const local = storage();
  const migrated = helper(session, local).get('123456');
  assert.deepEqual(migrated, {...alice, name: '', updatedAt: NOW});
  assert.equal(helper(storage(), local).get().token, alice.token);
  assert.equal(helper(session, local, () => NOW + 100).get().updatedAt, NOW);
});

test('a different room link does not migrate or reuse a legacy tab identity', () => {
  const original = JSON.stringify({code: alice.code, token: alice.token});
  const session = storage({[KEY]: original});
  const local = storage();
  assert.equal(helper(session, local).get('654321'), null);
  assert.equal(session.getItem(KEY), original);
  assert.equal(local.getItem(`${KEY}:123456`), null);
});

test('malformed and expired persistent identities are rejected', () => {
  for (const record of ['{broken', 'null', '[]', JSON.stringify({...alice, code: '12345', updatedAt: NOW}),
    JSON.stringify({...alice, token: 12, updatedAt: NOW}), JSON.stringify({...alice, token: '', updatedAt: NOW}),
    JSON.stringify({...alice, name: {}, updatedAt: NOW}), JSON.stringify({...alice, paused: 'false', updatedAt: NOW}),
    JSON.stringify(alice), JSON.stringify({...alice, updatedAt: 'today'}),
    JSON.stringify({...alice, updatedAt: NOW + 1}), JSON.stringify({...alice, updatedAt: NOW - TTL})]) {
    const local = storage({[`${KEY}:123456`]: record, [`${KEY}:latest`]: '123456'});
    assert.equal(helper(storage(), local).get('123456'), null, record);
  }
});

test('invalid saves do not destroy an existing identity', () => {
  const account = helper();
  account.save(alice);
  for (const value of [null, [], {}, {...alice, token: {}}, {...alice, code: 123456}]) {
    assert.equal(account.save(value), null);
    assert.equal(account.get().token, alice.token);
  }
});

test('revocation forgets only the named room and never touches admin storage', () => {
  const local = storage({'kando-nyiltnap-host': 'admin-secret'});
  const session = storage({'kando-nyiltnap-admin': 'teacher-secret'});
  const account = helper(session, local);
  account.save(alice);
  account.save(bob);
  account.forget('123456');
  assert.equal(account.get('123456'), null);
  assert.equal(account.get().token, bob.token);
  assert.equal(local.getItem(`${KEY}:latest`), bob.code);
  assert.equal(local.getItem('kando-nyiltnap-host'), 'admin-secret');
  assert.equal(session.getItem('kando-nyiltnap-admin'), 'teacher-secret');
  account.forget('654321');
  assert.equal(account.get(), null);
  assert.equal(helper(storage(), local).get('654321'), null);
  assert.equal(session.getItem(KEY), null);
  assert.equal(local.getItem(`${KEY}:latest`), null);
});

test('blocked storage stays usable in memory, including save, pause and forget', () => {
  const blocked = {
    getItem() { throw Error('SecurityError'); },
    setItem() { throw Error('QuotaExceededError'); },
    removeItem() { throw Error('SecurityError'); }
  };
  for (const target of [blocked, undefined]) {
    const account = create(target, target, {now: () => NOW});
    assert.equal(account.get(), null);
    account.save(alice);
    assert.equal(account.get().token, alice.token);
    account.save({...account.get(), paused: true});
    assert.equal(account.get().paused, true);
    account.forget(alice.code);
    assert.equal(account.get(), null);
  }
});

test('write failures do not return old stored credentials or resurrect forgotten ones', () => {
  const local = storage({[`${KEY}:123456`]: JSON.stringify({...alice, updatedAt: NOW}), [`${KEY}:latest`]: '123456'});
  local.setItem = () => { throw Error('Storage full'); };
  local.removeItem = () => { throw Error('Storage blocked'); };
  const account = helper(storage(), local);
  account.save({...alice, token: 'replacement-token'});
  assert.equal(account.get('123456').token, 'replacement-token');
  account.forget('123456');
  assert.equal(account.get('123456'), null);
  assert.equal(account.get(), null);
});

test('returned records are copies and only approved player fields are persisted', () => {
  const local = storage();
  const account = helper(storage(), local);
  const returned = account.save({...alice, hostToken: 'never-persist', unknown: true});
  returned.token = 'accidental-mutation';
  assert.equal(account.get().token, alice.token);
  assert.deepEqual(Object.keys(JSON.parse(local.getItem(`${KEY}:123456`))).sort(),
    ['code', 'name', 'paused', 'token', 'updatedAt']);
});
