/* ==========================================================================
   DeepLearn Lab — progress.js
   Reading + quiz progress per lesson, module stats, progress rings.
   ========================================================================== */
(function (DL) {
  "use strict";

  var KEY = "progress";
  var cache = null;

  function load() {
    if (cache) return cache;
    var raw = DL.store.get(KEY, {});
    cache = (raw && typeof raw === "object") ? raw : {};
    return cache;
  }

  function save() {
    DL.store.set(KEY, cache || {});
  }

  function entry(id) {
    var all = load();
    if (!all[id]) all[id] = { read: false, quizScore: null, total: null, seen: 0 };
    return all[id];
  }

  var api = {
    markLesson: function (id, patch) {
      var e = entry(id);
      if (patch) {
        for (var k in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) e[k] = patch[k];
        }
      }
      e.seen = Date.now();
      save();
      return e;
    },

    markRead: function (id) {
      return api.markLesson(id, { read: true });
    },

    setQuizScore: function (id, res) {
      var e = entry(id);
      e.quizScore = res.correct;
      e.total = res.total;
      if (res.correct === res.total) e.read = true;
      e.seen = Date.now();
      save();
      return e;
    },

    read: function (id) {
      var all = load();
      return all[id] || { read: false, quizScore: null, total: null, seen: 0 };
    },

    isRead: function (id) { return !!api.read(id).read; },

    moduleStats: function (moduleId) {
      var meta = DL.moduleMeta(moduleId);
      if (!meta) return { total: 0, read: 0, quizzes: 0, quizAvg: 0, pct: 0 };
      var all = load();
      var read = 0, quizzes = 0, sum = 0, n = 0;
      for (var k in all) {
        if (!Object.prototype.hasOwnProperty.call(all, k)) continue;
        if (k.indexOf(meta.id + "-") !== 0) continue;
        if (all[k].read) read += 1;
        if (all[k].quizScore !== null && all[k].quizScore !== undefined && all[k].total) {
          quizzes += 1;
          sum += all[k].quizScore / all[k].total;
          n += 1;
        }
      }
      var total = meta.lessons || 1;
      // pct blends reading (60%) and quiz performance (40%)
      var readPct = Math.min(1, read / total);
      var quizPct = n ? sum / n : 0;
      var pct = Math.round((readPct * 0.6 + quizPct * 0.4) * 100);
      return {
        total: total, read: read, quizzes: quizzes,
        quizAvg: n ? quizPct : 0, pct: pct
      };
    },

    overall: function () {
      var read = 0, total = 0, pctSum = 0;
      for (var i = 0; i < DL.MODULES.length; i++) {
        var s = api.moduleStats(DL.MODULES[i].id);
        read += s.read; total += s.total; pctSum += s.pct;
      }
      return {
        read: read, total: total,
        pct: Math.round(pctSum / DL.MODULES.length)
      };
    },

    reset: function () {
      cache = {};
      DL.store.remove(KEY);
    },

    /* Draw a progress ring into a canvas element (or return an SVG string). */
    ring: function (canvas, pct, opts) {
      if (!canvas) return;
      opts = opts || {};
      var size = opts.size || canvas.getAttribute("width") || 44;
      var stroke = opts.stroke || 3.5;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      var r = (size - stroke) / 2;
      var cx = size / 2, cy = size / 2;
      // read from the canvas so per-card / per-module accents are inherited
      var cs = getComputedStyle(canvas);
      var rootCS = getComputedStyle(document.documentElement);
      function tok(name, fallback) {
        var v = cs.getPropertyValue(name).trim() || rootCS.getPropertyValue(name).trim();
        return v || fallback;
      }
      var accent = opts.color || tok("--accent", "#6d5efc");
      var track = tok("--line", "#ddd");
      ctx.lineWidth = stroke;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = track;
      ctx.stroke();
      var p = Math.max(0, Math.min(100, pct || 0)) / 100;
      if (p > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
        ctx.strokeStyle = accent;
        ctx.stroke();
      }
      if (opts.label !== false) {
        ctx.fillStyle = tok("--ink-2", "#444");
        ctx.font = "600 " + Math.round(size * 0.26) + "px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(Math.round(pct || 0) + "%", cx, cy + 0.5);
      }
    }
  };

  DL.progress = api;
})(window.DL);
