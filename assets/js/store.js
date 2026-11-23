/* ==========================================================================
   DeepLearn Lab — store.js
   A localStorage wrapper that never throws (private mode, quota, file://).
   ========================================================================== */
(function (DL) {
  "use strict";

  var PREFIX = "dll:";
  var ok = DL._storageOK;

  function key(k) { return PREFIX + k; }

  var store = {
    prefix: PREFIX,

    available: function () { return !!ok; },

    get: function (k, fallback) {
      if (!ok) return fallback;
      try {
        var raw = window.localStorage.getItem(key(k));
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },

    set: function (k, value) {
      if (!ok) return false;
      try {
        window.localStorage.setItem(key(k), JSON.stringify(value));
        return true;
      } catch (e) {
        // quota exceeded: drop the probe flag state and report failure
        ok = false;
        return false;
      }
    },

    remove: function (k) {
      if (!ok) return false;
      try { window.localStorage.removeItem(key(k)); return true; }
      catch (e) { return false; }
    },

    keys: function () {
      if (!ok) return [];
      var out = [];
      try {
        for (var i = 0; i < window.localStorage.length; i++) {
          var full = window.localStorage.key(i);
          if (full && full.indexOf(PREFIX) === 0) out.push(full.slice(PREFIX.length));
        }
      } catch (e) { /* ignore */ }
      return out;
    },

    clear: function () {
      if (!ok) return;
      var ks = store.keys();
      for (var i = 0; i < ks.length; i++) store.remove(ks[i]);
    },

    // namespaced raw access used by progress.js
    _raw: function (k) { return key(k); }
  };

  DL.store = store;
})(window.DL);
