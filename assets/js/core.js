/* ==========================================================================
   DeepLearn Lab — core.js
   Creates the single global namespace DL. Everything else hangs off it.
   No dependencies, no modules, works from file://.
   ========================================================================== */
(function (w, d) {
  "use strict";

  var DL = w.DL || {};
  w.DL = DL;
  DL.version = "1.0.0";

  /* ------------------------------------------------------------------ *
   * Module registry
   * ------------------------------------------------------------------ */
  DL.MODULES = [
    {
      id: "m0", n: 0, key: "foundations",
      title: "Foundations",
      short: "M0",
      accent: "#6d5efc",
      href: "modules/m0-foundations/index.html",
      blurb: "Perceptrons to MLPs, losses, backprop, optimizers, init and the PyTorch loop.",
      tags: ["MLP", "backprop", "PyTorch"],
      lessons: 5
    },
    {
      id: "m1", n: 1, key: "cnns",
      title: "Convolutional networks",
      short: "M1",
      accent: "#2563eb",
      href: "modules/m1-cnns/index.html",
      blurb: "Convolution, pooling, ResNets, training recipes, detection, transfer learning.",
      tags: ["CNN", "ResNet", "detection"],
      lessons: 8
    },
    {
      id: "m2", n: 2, key: "sequences",
      title: "Sequences & NLP",
      short: "M2",
      accent: "#0d9488",
      href: "modules/m2-sequences/index.html",
      blurb: "RNNs, BPTT, LSTM/GRU, tokenizers, embeddings, attention and transformers.",
      tags: ["RNN", "LSTM", "attention"],
      lessons: 7
    },
    {
      id: "m3", n: 3, key: "gans",
      title: "Generative models",
      short: "M3",
      accent: "#db2777",
      href: "modules/m3-gans/index.html",
      blurb: "GAN objectives, DCGAN, mode collapse, FID, CycleGAN, StarGAN, WGAN-GP.",
      tags: ["GAN", "DCGAN", "FID"],
      lessons: 4
    },
    {
      id: "m4", n: 4, key: "autoencoders",
      title: "Autoencoders & pretrained",
      short: "M4",
      accent: "#d97706",
      href: "modules/m4-autoencoders/index.html",
      blurb: "AE, VAE with ELBO and reparameterisation, BERT, GPT decoding, LoRA.",
      tags: ["VAE", "BERT", "GPT"],
      lessons: 5
    },
    {
      id: "m5", n: 5, key: "segmentation",
      title: "Segmentation & Kaggle",
      short: "M5",
      accent: "#16a34a",
      href: "modules/m5-segmentation/index.html",
      blurb: "FCN, U-Net, Mask R-CNN, IoU/Dice, then a full competition playbook.",
      tags: ["U-Net", "Mask R-CNN", "Kaggle"],
      lessons: 4
    },
    {
      id: "m6", n: 6, key: "toolkit",
      title: "Advanced toolkit",
      short: "M6",
      accent: "#b91c1c",
      href: "modules/m6-toolkit/index.html",
      blurb: "Reproducibility, AMP/DDP, interpretability, deployment, debugging, maths.",
      tags: ["AMP", "Grad-CAM", "ONNX"],
      lessons: 7
    }
  ];

  DL.moduleMeta = function (id) {
    for (var i = 0; i < DL.MODULES.length; i++) {
      if (DL.MODULES[i].id === id || DL.MODULES[i].key === id) return DL.MODULES[i];
    }
    return null;
  };

  /* ------------------------------------------------------------------ *
   * DOM helpers
   * ------------------------------------------------------------------ */
  DL.ready = function (fn) {
    if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  };

  DL.qs = function (sel, root) { return (root || d).querySelector(sel); };
  DL.qsa = function (sel, root) {
    return Array.prototype.slice.call((root || d).querySelectorAll(sel));
  };

  DL.el = function (tag, attrs, children) {
    var node = d.createElement(tag || "div");
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined) continue;
        if (k === "class" || k === "className") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "style" && typeof v === "object") {
          for (var s in v) if (Object.prototype.hasOwnProperty.call(v, s)) {
            if (s.charAt(0) === "-" && s.charAt(1) === "-") node.style.setProperty(s, v[s]);
            else node.style[s] = v[s];
          }
        } else if (k === "dataset") {
          for (var dd in v) if (Object.prototype.hasOwnProperty.call(v, dd)) node.dataset[dd] = v[dd];
        } else if (k === "on" && typeof v === "object") {
          for (var ev in v) if (Object.prototype.hasOwnProperty.call(v, ev)) node.addEventListener(ev, v[ev]);
        } else if (k === "ref" && typeof v === "function") v(node);
        else node.setAttribute(k, v);
      }
    }
    if (children !== null && children !== undefined) {
      if (!Array.isArray(children)) children = [children];
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c === null || c === undefined || c === false) continue;
        node.appendChild(typeof c === "string" || typeof c === "number" ? d.createTextNode(String(c)) : c);
      }
    }
    return node;
  };

  DL.on = function (el, ev, fn, opts) {
    if (!el) return function () {};
    el.addEventListener(ev, fn, opts);
    return function () { el.removeEventListener(ev, fn, opts); };
  };
  DL.off = function (el, ev, fn) { if (el) el.removeEventListener(ev, fn); };

  /* Prefix a root-relative href for pages that live in modules/<dir>/.
     Lesson pages set data-root="../../" on <body>. */
  DL.root = function (href) {
    var r = (d.body && d.body.getAttribute("data-root")) || "";
    return r + href;
  };

  /* ------------------------------------------------------------------ *
   * rAF loop
   * ------------------------------------------------------------------ */
  DL.raf = function (fn) {
    return (w.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); })(fn);
  };
  DL.caf = function (id) {
    if (w.cancelAnimationFrame) w.cancelAnimationFrame(id); else clearTimeout(id);
  };

  DL.loop = function (fn) {
    var running = false, id = 0;
    function tick(t) {
      if (!running) return;
      fn(t);
      if (running) id = DL.raf(tick);
    }
    return {
      start: function () { if (!running) { running = true; id = DL.raf(tick); } return this; },
      stop: function () { running = false; DL.caf(id); return this; },
      toggle: function () { return running ? this.stop() : this.start(); },
      isRunning: function () { return running; }
    };
  };

  /* ------------------------------------------------------------------ *
   * Time-sliced trainer — never blocks for more than ~12 ms
   * ------------------------------------------------------------------ */
  DL.trainer = function (opts) {
    opts = opts || {};
    var totalSteps = opts.steps || 0;
    var speed = opts.speed || 1;
    var now = function () { return (w.performance && w.performance.now) ? w.performance.now() : Date.now(); };
    var st = {
      step: 0, running: false, done: false, speed: speed, frames: 0
    };
    var id = 0;

    function frame() {
      id = 0;
      if (!st.running) return;
      var budget = opts.budget || 12;
      var t0 = now();
      var n = 0;
      var maxSteps = Math.max(1, st.speed | 0);
      var finished = false;
      while (n < maxSteps) {
        st.step += 1;
        n += 1;
        var stop = false;
        if (opts.onStep) stop = opts.onStep(st.step) === true;
        if (stop || (totalSteps && st.step >= totalSteps)) { finished = true; break; }
        if (now() - t0 > budget) break; // guard even with huge speed
      }
      st.frames += 1;
      if (finished) { st.running = false; st.done = true; }
      if (opts.onFrame) opts.onFrame(st.step, st.done);
      if (st.running) id = DL.raf(frame);
    }

    return {
      state: st,
      start: function () {
        if (st.running || st.done) return this;
        st.running = true;
        if (!id) id = DL.raf(frame);
        return this;
      },
      pause: function () { st.running = false; if (id) { DL.caf(id); id = 0; } return this; },
      resume: function () { return this.start(); },
      toggle: function () { return st.running ? this.pause() : this.start(); },
      reset: function () {
        this.pause();
        st.step = 0; st.done = false; st.frames = 0;
        return this;
      },
      setSpeed: function (v) { st.speed = Math.max(1, Math.round(v)); return this; },
      isRunning: function () { return st.running; },
      stepOnce: function () {
        st.step += 1;
        if (opts.onStep) opts.onStep(st.step);
        if (opts.onFrame) opts.onFrame(st.step, false);
      }
    };
  };

  /* ------------------------------------------------------------------ *
   * Motion preference
   * ------------------------------------------------------------------ */
  DL.motionOK = function () {
    try {
      return !w.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { return true; }
  };

  /* ------------------------------------------------------------------ *
   * Random numbers — deterministic, seedable
   * ------------------------------------------------------------------ */
  DL.rng = function (seed) {
    var a = (seed === undefined ? 42 : seed) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  DL.randn = function (rng) {
    var u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  DL.uniform = function (rng, lo, hi) { return lo + (hi - lo) * rng(); };

  DL.hash = function (str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  /* ------------------------------------------------------------------ *
   * Math helpers
   * ------------------------------------------------------------------ */
  DL.clamp = function (x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; };
  DL.lerp = function (a, b, t) { return a + (b - a) * t; };
  DL.round = function (x, dg) {
    var m = Math.pow(10, dg === undefined ? 2 : dg);
    return Math.round(x * m) / m;
  };
  DL.range = function (a, b, step) {
    var out = [], i;
    if (b === undefined) { b = a; a = 0; }
    step = step || 1;
    for (i = a; i < b - 1e-12; i += step) out.push(i);
    return out;
  };
  DL.sum = function (arr) {
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s;
  };
  DL.mean = function (arr) { return arr.length ? DL.sum(arr) / arr.length : 0; };
  DL.maxOf = function (arr) {
    var m = -Infinity;
    for (var i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
    return m;
  };
  DL.minOf = function (arr) {
    var m = Infinity;
    for (var i = 0; i < arr.length; i++) if (arr[i] < m) m = arr[i];
    return m;
  };
  DL.argmax = function (arr) {
    var best = -Infinity, bi = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i] > best) { best = arr[i]; bi = i; }
    return bi;
  };
  DL.std = function (arr) {
    if (arr.length < 2) return 0;
    var m = DL.mean(arr), s = 0;
    for (var i = 0; i < arr.length; i++) s += (arr[i] - m) * (arr[i] - m);
    return Math.sqrt(s / arr.length);
  };

  DL.fmt = function (x, dg) {
    if (x === null || x === undefined || isNaN(x)) return "—";
    if (!isFinite(x)) return x > 0 ? "∞" : "−∞";
    var a = Math.abs(x);
    if (a !== 0 && (a < 1e-4 || a >= 1e6)) return DL.sci(x);
    dg = dg === undefined ? 2 : dg;
    var s = x.toFixed(dg);
    if (s.indexOf(".") >= 0) s = s.replace(/\.?0+$/, "");
    return s === "-0" ? "0" : s;
  };
  DL.sci = function (x, dg) {
    if (!isFinite(x)) return String(x);
    return x.toExponential(dg === undefined ? 2 : dg).replace("e+", "e");
  };
  DL.pct = function (x, dg) { return DL.fmt(x * 100, dg === undefined ? 0 : dg) + "%"; };
  DL.pad2 = function (n) { return (n < 10 ? "0" : "") + n; };

  DL.throttle = function (fn, ms) {
    var last = 0, timer = null;
    return function () {
      var args = arguments, self = this, t = Date.now();
      var wait = ms - (t - last);
      if (wait <= 0) { last = t; fn.apply(self, args); }
      else if (!timer) {
        timer = setTimeout(function () { timer = null; last = Date.now(); fn.apply(self, args); }, wait);
      }
    };
  };
  DL.debounce = function (fn, ms) {
    var timer = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, ms || 150);
    };
  };

  DL.uid = (function () {
    var n = 0;
    return function (prefix) { n += 1; return (prefix || "dl") + "-" + n; };
  })();

  DL.escapeHTML = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  /* ------------------------------------------------------------------ *
   * Badges
   * ------------------------------------------------------------------ */
  DL.badge = function (kind, text) {
    var k = (kind === "exact" || kind === "illustrative") ? kind : "illustrative";
    return DL.el("span", {
      class: "badge badge--" + k,
      text: text || (k === "exact" ? "Exact math" : "Illustrative")
    });
  };

  /* ------------------------------------------------------------------ *
   * KaTeX
   * ------------------------------------------------------------------ */
  DL.katex = function (tex, el, display) {
    if (!el) return;
    if (w.katex && w.katex.render) {
      try { w.katex.render(tex, el, { throwOnError: false, displayMode: !!display }); return; }
      catch (e) { /* fall through */ }
    }
    el.textContent = tex;
  };

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */
  var THEME_KEY = "dll:theme";
  function readTheme() {
    try { return w.localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function queryTheme() {
    try {
      var m = /[?&]theme=(light|dark)\b/.exec(w.location.search);
      return m ? m[1] : null;
    } catch (e) { return null; }
  }
  DL.theme = function () { return d.documentElement.getAttribute("data-theme") || "light"; };
  DL.setTheme = function (t) {
    d.documentElement.setAttribute("data-theme", t);
    try { w.localStorage.setItem(THEME_KEY, t); } catch (e) {}
    var ev;
    try { ev = new CustomEvent("dl:theme", { detail: { theme: t } }); }
    catch (e2) { ev = d.createEvent("CustomEvent"); ev.initCustomEvent("dl:theme", false, false, { theme: t }); }
    d.dispatchEvent(ev);
  };
  DL.toggleTheme = function () {
    var t = DL.theme() === "dark" ? "light" : "dark";
    DL.setTheme(t);
    return t;
  };
  // apply stored / system theme as early as possible
  (function () {
    var t = queryTheme() || readTheme();
    if (!t) {
      try { t = w.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
      catch (e) { t = "light"; }
    }
    d.documentElement.setAttribute("data-theme", t);
  })();

  /* ------------------------------------------------------------------ *
   * Storage availability probe (DL.store builds on this)
   * ------------------------------------------------------------------ */
  DL._storageOK = (function () {
    try {
      var k = "__dll_probe__";
      w.localStorage.setItem(k, "1");
      w.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

})(window, document);
