(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KandoPlayerSession = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SESSION_KEY = 'kando-nyiltnap-player';
  var LATEST_KEY = SESSION_KEY + ':latest';
  var TTL = 24 * 60 * 60 * 1000;

  function validCode(code) {
    return typeof code === 'string' && /^\d{6}$/.test(code);
  }

  function storageAdapter(storage) {
    var memory = new Map();
    var pending = new Map();
    return {
      get: function (key) {
        if (pending.has(key)) return pending.get(key);
        try {
          var value = storage.getItem(key);
          if (value === null) memory.delete(key);
          else memory.set(key, value);
          return value;
        } catch (_) {
          return memory.has(key) ? memory.get(key) : null;
        }
      },
      set: function (key, value) {
        memory.set(key, value);
        try {
          storage.setItem(key, value);
          pending.delete(key);
        } catch (_) {
          pending.set(key, value);
        }
      },
      remove: function (key) {
        memory.delete(key);
        try {
          storage.removeItem(key);
          pending.delete(key);
        } catch (_) {
          pending.set(key, null);
        }
      }
    };
  }

  function parse(raw) {
    try {
      var value = JSON.parse(raw);
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function validFields(value) {
    return value && validCode(value.code) && typeof value.token === 'string' && value.token.trim().length > 0 &&
      (value.name === undefined || typeof value.name === 'string') &&
      (value.paused === undefined || typeof value.paused === 'boolean');
  }

  function copy(value) {
    return {
      code: value.code,
      token: value.token,
      name: value.name || '',
      paused: value.paused === true,
      updatedAt: value.updatedAt
    };
  }

  function create(sessionStorage, localStorage, options) {
    var session = storageAdapter(sessionStorage);
    var local = storageAdapter(localStorage);
    var now = options && typeof options.now === 'function' ? options.now : Date.now;

    function fresh(value) {
      return Number.isFinite(value.updatedAt) && value.updatedAt >= 0 &&
        value.updatedAt <= now() && now() - value.updatedAt < TTL;
    }

    function persist(value) {
      var raw = JSON.stringify(value);
      session.set(SESSION_KEY, raw);
      local.set(SESSION_KEY + ':' + value.code, raw);
      local.set(LATEST_KEY, value.code);
      return copy(value);
    }

    function save(value) {
      if (!validFields(value)) return null;
      var record = copy(value);
      record.updatedAt = now();
      return persist(record);
    }

    function clearLocal(code) {
      local.remove(SESSION_KEY + ':' + code);
      if (local.get(LATEST_KEY) === code) local.remove(LATEST_KEY);
    }

    function get(code) {
      code = code === undefined ? '' : code;
      if (code !== '' && !validCode(code)) return null;

      var current = parse(session.get(SESSION_KEY));
      if (current && validFields(current)) {
        if (code === '' || current.code === code) {
          // The previous app stored only {code, token} in this tab. Migrate it once.
          if (current.updatedAt === undefined) return save(current);
          if (fresh(current)) return copy(current);
          session.remove(SESSION_KEY);
        }
      } else {
        session.remove(SESSION_KEY);
      }

      var room = code || local.get(LATEST_KEY);
      if (!validCode(room)) return null;
      var record = parse(local.get(SESSION_KEY + ':' + room));
      if (!validFields(record) || record.code !== room || !fresh(record)) {
        clearLocal(room);
        return null;
      }
      // Recover the tab without extending the lifetime of an abandoned session.
      session.set(SESSION_KEY, JSON.stringify(copy(record)));
      local.set(LATEST_KEY, room);
      return copy(record);
    }

    function forget(code) {
      if (!validCode(code)) return;
      var current = parse(session.get(SESSION_KEY));
      if (current && current.code === code) session.remove(SESSION_KEY);
      clearLocal(code);
    }

    return { get: get, save: save, forget: forget };
  }

  return { create: create };
}));
