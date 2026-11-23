/* ==========================================================================
   DeepLearn Lab — M4 widgets
   Registered ids must match docs/CONTENT_PLAN.md. Never rename an id.
   ========================================================================== */
(function (DL) {
  "use strict";

  var V = DL.viz, U = DL.ui, T = DL.tensor;

  function sq(x) { return x * x; }

  /* ------------------------------------------------------------------ *
   * m4-01-autoencoder-2d — flagship: train a 2→k→2 autoencoder live
   * Exact: DL.nn.MLP + DL.trainer; error colours and MSE come from the points.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m4-01-autoencoder-2d", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, {
      w: 560, h: 360,
      label: "Nonlinear 2-D data with live autoencoder reconstructions coloured by error"
    });
    var latView = V.canvas(stage.canvasWrap, {
      w: 560, h: 200,
      label: "Latent coordinates of the same data points"
    });

    var kCtl = U.slider({
      label: "Latent width k", min: 1, max: 4, step: 1, value: 2, digits: 0,
      hint: "Changing k rebuilds the network from the same seed.", onInput: rebuild
    });
    var reads = U.readouts(["step", "MSE on shown data", "parameters", "latent k"]);
    stage.controls.appendChild(kCtl.el);
    stage.controls.appendChild(reads.el);

    var play = U.playback({
      started: false, speeds: [1, 4, 12, 40],
      onToggle: function (on) { if (on) trainer.start(); else trainer.pause(); },
      onReset: function () { rebuild(); },
      onSpeed: function (v) { trainer.setSpeed(v); }
    });
    stage.controls.insertBefore(play.el, stage.controls.firstChild);

    // Fixed synthetic nonlinear curve; no downloaded data.
    var data = (function () {
      var rng = DL.rng(1907), pts = [], i, t;
      for (i = 0; i < 180; i++) {
        t = DL.uniform(rng, -1.25, 1.25);
        pts.push([
          t + DL.randn(rng) * 0.04,
          0.55 * t * t * t - 0.35 * t + DL.randn(rng) * 0.05
        ]);
      }
      return pts;
    })();

    var model, opt, trainer, rng, recon, latent, mse = 0, k = 2;

    function forwardAll() {
      recon = []; latent = [];
      var s = 0;
      for (var i = 0; i < data.length; i++) {
        var r = model.forward(data[i]);
        recon.push(r.out);
        latent.push(r.hs[0]);
        s += sq(r.out[0] - data[i][0]) + sq(r.out[1] - data[i][1]);
      }
      mse = s / (2 * data.length);
    }

    function onStep(step) {
      var bx = [], by = [], n = data.length, idx;
      for (var i = 0; i < 24; i++) {
        idx = Math.floor(rng() * n);
        bx.push(data[idx]); by.push(data[idx]);
      }
      model.fitBatch(bx, by);
      opt.step(model.params());
    }

    function drawMain() {
      var p = V.palette();
      view.clear(p.surface);
      var r = { x: 46, y: 12, w: view.w - 62, h: view.h - 50 };
      var sx = function (x) { return r.x + ((x + 1.6) / 3.2) * r.w; };
      var sy = function (y) { return r.y + r.h - ((y + 1.1) / 2.2) * r.h; };

      V.axes(view.ctx, r, {
        xmin: -1.6, xmax: 1.6, ymin: -1.1, ymax: 1.1,
        grid: true, ticks: 4, xlabel: "x₁", ylabel: "x₂"
      });

      var cm = V.colormap("inferno");
      view.ctx.save();
      view.ctx.beginPath(); view.ctx.rect(r.x, r.y, r.w, r.h); view.ctx.clip();

      // Fine lines link each source point to its reconstruction.
      view.ctx.strokeStyle = p.line;
      view.ctx.lineWidth = 0.7;
      view.ctx.globalAlpha = 0.45;
      view.ctx.beginPath();
      for (var i = 0; i < data.length; i++) {
        view.ctx.moveTo(sx(data[i][0]), sy(data[i][1]));
        view.ctx.lineTo(sx(recon[i][0]), sy(recon[i][1]));
      }
      view.ctx.stroke();
      view.ctx.globalAlpha = 1;

      for (var j = 0; j < data.length; j++) {
        var e = Math.sqrt(sq(recon[j][0] - data[j][0]) + sq(recon[j][1] - data[j][1]));
        V.dot(view.ctx, sx(recon[j][0]), sy(recon[j][1]), 3.1, cm(DL.clamp(e / 0.55, 0, 1)));
        V.dot(view.ctx, sx(data[j][0]), sy(data[j][1]), 1.7, p.ink3);
      }
      view.ctx.restore();

      V.text(view.ctx, "2 → " + k + " → 2  ·  tanh bottleneck", r.x + 8, r.y + 14,
        { size: 10, mono: true, color: p.ink2 });
      V.legend(view.ctx, [
        { color: p.ink3, label: "original data (small dots)" },
        { color: cm(0.75), label: "reconstruction (colour = error)" }
      ], { x: r.x + 8, y: r.y + 30 }, { lh: 14 });
      V.colorbar(view.ctx, { x: r.x + r.w - 14, y: r.y + 8, w: 8, h: 66 }, "inferno",
        { min: 0, max: 0.55, labels: false });
    }

    function drawLatent() {
      var p = V.palette();
      latView.clear(p.surface);
      var r = { x: 46, y: 12, w: latView.w - 62, h: latView.h - 48 };
      var pts = latent.map(function (h, i) {
        return k === 1
          ? { x: h[0], y: ((i % 7) - 3) * 0.015, r: 2.6, color: V.colormap("inferno")(0.3) }
          : { x: h[0], y: h[1], r: 2.8, color: V.colormap("inferno")(0.3) };
      });
      V.scatter(latView.ctx, pts, r, {
        grid: true, ticks: 4,
        xlabel: "z₁", ylabel: k === 1 ? "jitter only" : "z₂"
      });
      V.text(latView.ctx,
        k === 1 ? "k = 1: one coordinate — the curve must flatten onto a line"
                : "k = " + k + ": showing z₁ vs z₂ (extra coordinates hidden)",
        r.x + 8, r.y + 12, { size: 10, mono: true, color: p.ink2 });
    }

    function refreshReadouts(step) {
      reads.set("step", String(step));
      reads.set("MSE on shown data", DL.fmt(mse, 4));
      reads.set("parameters", String(model.countParams()));
      reads.set("latent k", String(k));
    }

    function draw() { drawMain(); drawLatent(); }

    function rebuild() {
      if (trainer) trainer.pause().reset();
      k = kCtl.value();
      model = DL.nn.MLP([2, k, 2], {
        activation: "tanh", out: "linear", loss: "mse", init: "xavier", seed: 31
      });
      opt = DL.nn.opt.Adam({ lr: 0.02 });
      rng = DL.rng(77);
      forwardAll();
      draw();
      refreshReadouts(0);
      play.setRunning(false);
    }

    trainer = DL.trainer({
      steps: 1600, speed: 1,
      onStep: onStep,
      onFrame: function (step, done) {
        forwardAll();
        draw();
        refreshReadouts(step);
        if (done) play.setRunning(false);
      }
    });

    rebuild();
    return {
      reset: rebuild,
      pause: function () { trainer.pause(); play.setRunning(false); }
    };
  });

  /* ------------------------------------------------------------------ *
   * m4-01-denoising-slider — linear AE = PCA truncation, closed form
   * Exact: top eigenvector of the sample covariance; analytic MSE curves.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m4-01-denoising-slider", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, {
      w: 560, h: 330,
      label: "Reconstruction MSE of a rank-1 linear autoencoder versus noise level sigma"
    });

    var sigCtl = U.slider({
      label: "noise σ", min: 0, max: 1, step: 0.05, value: 0.4, digits: 2,
      onInput: draw
    });
    var shrink = U.toggle({
      label: "Denoising-aware shrinkage  λ₁/(λ₁+σ²)",
      checked: false, onChange: draw
    });
    var reads = U.readouts(["λ₁", "λ₂", "closed-form MSE", "empirical MSE (1200 seeded)"]);
    stage.controls.appendChild(sigCtl.el);
    stage.controls.appendChild(shrink.el);
    stage.controls.appendChild(reads.el);

    // Fixed Gaussian-ish sample; centre it and take the closed-form PCA basis.
    var clean = (function () {
      var rng = DL.rng(51), out = [], u, v;
      for (var i = 0; i < 1200; i++) {
        u = DL.randn(rng); v = DL.randn(rng);
        out.push([u, 0.55 * u + 0.45 * v]);
      }
      return out;
    })();
    var mu = [0, 0], i;
    for (i = 0; i < clean.length; i++) {
      mu[0] += clean[i][0]; mu[1] += clean[i][1];
    }
    mu[0] /= clean.length; mu[1] /= clean.length;
    var a = 0, b = 0, d = 0, dx, dy;
    for (i = 0; i < clean.length; i++) {
      dx = clean[i][0] - mu[0]; dy = clean[i][1] - mu[1];
      a += dx * dx; b += dx * dy; d += dy * dy;
    }
    a /= clean.length; b /= clean.length; d /= clean.length;
    var disc = Math.sqrt(sq(a - d) + 4 * b * b);
    var l1 = (a + d + disc) / 2, l2 = Math.max(0, (a + d - disc) / 2);
    var theta = 0.5 * Math.atan2(2 * b, a - d);
    var v1 = [Math.cos(theta), Math.sin(theta)];

    function analytic(s, useShrink) {
      return l2 + (useShrink ? (l1 * s * s) / (l1 + s * s) : s * s);
    }

    function empirical(s, useShrink) {
      var rng = DL.rng(9001), total = 0, e1, e2, h, gain;
      gain = useShrink ? l1 / (l1 + s * s) : 1;
      for (var n = 0; n < clean.length; n++) {
        e1 = DL.randn(rng) * s; e2 = DL.randn(rng) * s;
        h = ((clean[n][0] + e1 - mu[0]) * v1[0] +
             (clean[n][1] + e2 - mu[1]) * v1[1]) * gain;
        total += sq(mu[0] + h * v1[0] - clean[n][0]) +
                 sq(mu[1] + h * v1[1] - clean[n][1]);
      }
      return total / (2 * clean.length);
    }

    function draw() {
      var p = V.palette();
      var s = sigCtl.value(), on = shrink.checked();
      view.clear(p.surface);
      var r = { x: 52, y: 14, w: view.w - 68, h: view.h - 52 };
      var sigmas = [], plain = [], smart = [];
      for (var k = 0; k <= 20; k++) {
        sigmas.push(k * 0.05);
        plain.push(analytic(k * 0.05, false));
        smart.push(analytic(k * 0.05, true));
      }
      V.line(view.ctx, [
        { x: sigmas, y: plain, color: p.ink3, width: 1.8 },
        { x: sigmas, y: smart, color: p.accent, width: 2.4 }
      ], r, {
        xmin: 0, xmax: 1, ymin: 0, ymax: Math.max(1.3, plain[plain.length - 1]),
        grid: true, xlabel: "noise σ", ylabel: "reconstruction MSE"
      });
      var yv = analytic(s, on);
      V.dashedLine(view.ctx, r.x + s * r.w, r.y,
        r.x + s * r.w, r.y + r.h, { color: p.lineStrong, dash: [3, 3] });
      V.dot(view.ctx, r.x + s * r.w,
        r.y + r.h - (yv / Math.max(1.3, plain[plain.length - 1])) * r.h,
        5, on ? p.accent : p.ink3);
      V.legend(view.ctx, [
        { color: p.ink3, label: "plain rank-1 projection: λ₂ + σ²" },
        { color: p.accent, label: "shrinkage: λ₂ + λ₁σ²/(λ₁+σ²)" }
      ], { x: r.x + 10, y: r.y + 8 }, { lh: 14 });

      reads.set("λ₁", DL.fmt(l1, 4));
      reads.set("λ₂", DL.fmt(l2, 4));
      reads.set("closed-form MSE", DL.fmt(yv, 4));
      reads.set("empirical MSE (1200 seeded)", DL.fmt(empirical(s, on), 4));
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return {
      reset: function () {
        sigCtl.set(0.4, true); shrink.set(false, true); draw();
      }
    };
  });

  /* ------------------------------------------------------------------ *
   * m4-02-reparam-visual — epsilon to z, with the gradient path
   * Exact: pdfs, z = mu + sigma*epsilon and dz/dsigma are computed live.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m4-02-reparam-visual", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, {
      w: 560, h: 320,
      label: "Standard-normal epsilon mapped to a Gaussian latent z by mu plus sigma times epsilon"
    });

    var muCtl = U.slider({ label: "μ", min: -2, max: 2, step: 0.1, value: 1, digits: 1, onInput: draw });
    var sigCtl = U.slider({ label: "σ", min: 0.2, max: 2, step: 0.1, value: 0.8, digits: 1, onInput: draw });
    var epsCtl = U.slider({ label: "ε (seeded draw)", min: -2.5, max: 2.5, step: 0.05, value: -0.8, digits: 2, onInput: draw });
    var resample = DL.el("button", {
      type: "button", class: "btn", text: "Resample ε",
      "aria-label": "Draw a new seeded epsilon", on: { click: function () {
        var e = DL.randn(sampleRng);
        epsCtl.set(DL.clamp(e, -2.5, 2.5), true);
        draw();
      } }
    });
    var sampleRng = DL.rng(2024);
    var reads = U.readouts(["ε", "z = μ + σ ε", "∂z/∂μ", "∂z/∂σ", "log q(z|x)"]);
    stage.controls.appendChild(muCtl.el);
    stage.controls.appendChild(sigCtl.el);
    stage.controls.appendChild(epsCtl.el);
    stage.controls.appendChild(resample);
    stage.controls.appendChild(reads.el);

    function pdf(x, m, s) {
      return Math.exp(-0.5 * sq((x - m) / s)) / (s * Math.sqrt(2 * Math.PI));
    }

    function draw() {
      var p = V.palette();
      var mu = muCtl.value(), s = sigCtl.value(), e = epsCtl.value();
      var z = mu + s * e;
      view.clear(p.surface);

      var left = { x: 44, y: 18, w: 210, h: 232 };
      var right = { x: 314, y: 18, w: 210, h: 232 };
      var xs1 = DL.range(-3.5, 3.51, 0.1), xs2 = xs1.map(function (t) { return mu + s * t; });
      V.line(view.ctx, [{ x: xs1, y: xs1.map(function (t) { return pdf(t, 0, 1); }), color: p.ink3, width: 2 }],
        left, { xmin: -3.5, xmax: 3.5, ymin: 0, ymax: 0.45, grid: true, xlabel: "ε", ylabel: "p(ε)" });
      V.line(view.ctx, [{ x: xs2, y: xs2.map(function (t) { return pdf(t, mu, s); }), color: p.accent, width: 2.4 }],
        right, { xmin: -3.5, xmax: 3.5, ymin: 0, ymax: 0.45, grid: true, xlabel: "z", ylabel: "q(z|x)" });

      var sx1 = function (t) { return left.x + ((t + 3.5) / 7) * left.w; };
      var sx2 = function (t) { return right.x + ((t + 3.5) / 7) * right.w; };
      var y0 = left.y + left.h;

      // Twenty seeded samples make the mapping visible as paired dots.
      var rng = DL.rng(555), i, ei, zi, jitter;
      for (i = 0; i < 24; i++) {
        ei = DL.randn(rng); zi = mu + s * ei; jitter = (i % 5) * 3;
        if (ei > -3.5 && ei < 3.5) V.dot(view.ctx, sx1(ei), y0 - 5 - jitter, 2.2, p.ink3);
        if (zi > -3.5 && zi < 3.5) V.dot(view.ctx, sx2(zi), right.y + right.h - 5 - jitter, 2.2, p.accent);
      }

      V.dashedLine(view.ctx, sx1(e), left.y, sx1(e), y0, { color: p.danger, dash: [4, 3] });
      V.dashedLine(view.ctx, sx2(z), right.y, sx2(z), right.y + right.h, { color: p.danger, dash: [4, 3] });
      V.dot(view.ctx, sx1(e), y0 - pdf(e, 0, 1) / 0.45 * left.h, 5, p.danger);
      V.dot(view.ctx, sx2(z), right.y + right.h - pdf(z, mu, s) / 0.45 * right.h, 5, p.danger);
      V.arrow(view.ctx, left.x + left.w + 12, left.y + 78, right.x - 12, right.y + 78,
        { color: p.ink2, width: 2 });
      V.text(view.ctx, "z = μ + σ ε", (left.x + left.w + right.x) / 2, left.y + 68,
        { align: "center", size: 11, mono: true, color: p.ink2 });
      V.text(view.ctx, "deterministic · differentiable", (left.x + left.w + right.x) / 2, left.y + 100,
        { align: "center", size: 9, mono: true, color: p.ink3 });

      var logq = -0.5 * Math.log(2 * Math.PI * s * s) - 0.5 * sq((z - mu) / s);
      reads.set("ε", DL.fmt(e, 3));
      reads.set("z = μ + σ ε", DL.fmt(z, 3));
      reads.set("∂z/∂μ", "1");
      reads.set("∂z/∂σ", DL.fmt(e, 3));
      reads.set("log q(z|x)", DL.fmt(logq, 4));
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return {
      reset: function () {
        muCtl.set(1, true); sigCtl.set(0.8, true); epsCtl.set(-0.8, true);
        sampleRng = DL.rng(2024); draw();
      }
    };
  });

  /* ------------------------------------------------------------------ *
   * m4-02-beta-vae — illustrative toy aggregate posterior on a latent grid
   * ------------------------------------------------------------------ */
  DL.widgets.register("m4-02-beta-vae", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, {
      w: 520, h: 350,
      label: "Schematic two-component aggregate posterior on a 2-D latent grid as beta increases"
    });

    var betaCtl = U.slider({
      label: "β (KL weight)", min: 1, max: 16, step: 1, value: 1, digits: 0,
      hint: "Illustrative toy density — no network is trained here.", onInput: draw
    });
    var reads = U.readouts(["β", "component mean |m|", "component σ", "grid KL vs N(0,I)"]);
    stage.controls.appendChild(betaCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(DL.el("p", {
      class: "small muted",
      text: "Illustrative: a hand-defined mixture, not a trained VAE. The grid KL is computed numerically for this toy density."
    }));

    function draw() {
      var p = V.palette();
      var beta = betaCtl.value();
      var t = (beta - 1) / 15;
      var m = 1.3 * (1 - t);
      var s = Math.sqrt(1 + (1 - t) * (0.35 * 0.35 - 1));
      var N = 48, grid = [], kl = 0;
      var lo = -3.5, hi = 3.5, cell = (hi - lo) / N;
      for (var iy = 0; iy < N; iy++) {
        var row = [];
        for (var ix = 0; ix < N; ix++) {
          var x = lo + (ix + 0.5) * cell;
          var y = lo + (iy + 0.5) * cell;
          var g1 = Math.exp(-(sq(x - m) + sq(y)) / (2 * s * s)) / (2 * Math.PI * s * s);
          var g2 = Math.exp(-(sq(x + m) + sq(y)) / (2 * s * s)) / (2 * Math.PI * s * s);
          var q = 0.5 * (g1 + g2);
          row.push(q);
          var prior = Math.exp(-(x * x + y * y) / 2) / (2 * Math.PI);
          kl += q * Math.log(q / prior) * cell * cell;
        }
        grid.push(row);
      }

      view.clear(p.surface);
      var r = { x: 46, y: 14, w: view.w - 62, h: view.h - 48 };
      V.heatmap(view.ctx, grid, r, { cmap: "ember", vmin: 0, vmax: 0.7, border: true });
      V.axes(view.ctx, r, {
        xmin: -3.5, xmax: 3.5, ymin: -3.5, ymax: 3.5,
        grid: false, ticks: 4, xlabel: "z₁", ylabel: "z₂", tickLabels: false
      });
      V.colorbar(view.ctx, { x: r.x + r.w + 8, y: r.y + 10, w: 8, h: 70 }, "ember",
        { min: 0, max: 0.7, labels: false });
      V.text(view.ctx, "schematic q(z) — illustrative", r.x + 8, r.y + 14,
        { size: 10, mono: true, color: p.surface });

      reads.set("β", String(beta));
      reads.set("component mean |m|", DL.fmt(m, 3));
      reads.set("component σ", DL.fmt(s, 3));
      reads.set("grid KL vs N(0,I)", DL.fmt(kl, 3));
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () { betaCtl.set(1, true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m4-03-bert-mask-viewer — illustrative stored prediction table
   * ------------------------------------------------------------------ */
  DL.widgets.register("m4-03-bert-mask-viewer", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var EXAMPLES = [
      {
        text: "The cat sat on the [MASK].",
        tokens: ["[CLS]", "the", "cat", "sat", "on", "the", "[MASK]", "[SEP]"],
        masks: [
          { i: 6, top: ["mat", "floor", "sofa"], why: "a surface after “sat on the”" },
          { i: 2, top: ["cat", "dog", "animal"], why: "a singular animal subject" },
          { i: 3, top: ["sat", "lay", "rested"], why: "a past-tense verb after “cat”" }
        ]
      },
      {
        text: "She [MASK] the model at the lab.",
        tokens: ["[CLS]", "she", "[MASK]", "the", "model", "at", "the", "lab", "[SEP]"],
        masks: [
          { i: 2, top: ["trained", "tested", "built"], why: "a verb agreeing with “she”" },
          { i: 4, top: ["model", "network", "dataset"], why: "a singular object of the verb" },
          { i: 7, top: ["lab", "office", "site"], why: "a place after “at the”" }
        ]
      }
    ];

    var tokenView = V.canvas(stage.canvasWrap, {
      w: 560, h: 150, label: "Fixed token sequence with one masked position"
    });
    var attnView = V.canvas(stage.canvasWrap, {
      w: 300, h: 150, label: "Schematic attention pattern thumbnails"
    });

    var sentCtl = U.select({
      label: "Fixed sentence", ariaLabel: "Fixed example sentence",
      options: [
        { value: "0", label: "The cat sat on the [MASK]." },
        { value: "1", label: "She [MASK] the model at the lab." }
      ],
      value: "0", onChange: function () { rebuildMasks(); }
    });
    var maskCtl = U.select({
      label: "Mask position", ariaLabel: "Which token is masked",
      options: [], value: "0", onChange: draw
    });
    var table = U.table({
      columns: ["rank", "stored token", "why it fits"],
      rows: [], caption: "Stored illustrative top-3 (not a live model, no probabilities)"
    });
    stage.controls.appendChild(sentCtl.el);
    stage.controls.appendChild(maskCtl.el);
    stage.controls.appendChild(table.el);
    stage.controls.appendChild(DL.el("p", {
      class: "small muted",
      text: "Illustrative: both sentences and this top-3 table are stored in the widget. Nothing is predicted by a model here, and the scores are deliberately omitted."
    }));

    var active = null;

    function rebuildMasks() {
      var ex = EXAMPLES[parseInt(sentCtl.value(), 10)];
      var sel = maskCtl.select;
      sel.innerHTML = "";
      ex.masks.forEach(function (mk, i) {
        sel.appendChild(DL.el("option", {
          value: String(i), text: "token " + mk.i + " → " + mk.top[0]
        }));
      });
      sel.value = "0";
      draw();
    }

    function draw() {
      var p = V.palette();
      var ex = EXAMPLES[parseInt(sentCtl.value(), 10)];
      var mi = parseInt(maskCtl.value(), 10);
      if (isNaN(mi) || !ex.masks[mi]) mi = 0;
      active = ex.masks[mi];

      tokenView.clear(p.surface);
      var toks = ex.tokens.slice();
      toks[active.i] = "[MASK]";
      var n = toks.length, bw = Math.min(66, (tokenView.w - 30) / n);
      for (var i = 0; i < n; i++) {
        var x = 15 + i * bw;
        V.roundRect(tokenView.ctx, x, 40, bw - 6, 46, 6);
        tokenView.ctx.fillStyle = i === active.i ? p.accent : p.surface2;
        tokenView.ctx.fill();
        tokenView.ctx.strokeStyle = i === active.i ? p.accent : p.lineStrong;
        tokenView.ctx.lineWidth = 1; tokenView.ctx.stroke();
        V.text(tokenView.ctx, toks[i], x + (bw - 6) / 2, 67,
          { align: "center", size: toks[i].length > 6 ? 8 : 10, mono: true,
            color: i === active.i ? "#ffffff" : p.ink });
        V.text(tokenView.ctx, String(i), x + (bw - 6) / 2, 103,
          { align: "center", size: 9, mono: true, color: p.ink3 });
      }
      V.text(tokenView.ctx, "Position " + active.i + " · bidirectional context →",
        15, 22, { size: 10, mono: true, color: p.ink2 });

      attnView.clear(p.surface);
      var panels = [
        { title: "diagonal", fn: function (i, j) { return i === j ? 1 : 0.08; } },
        { title: "[CLS] column", fn: function (i, j) { return j === 0 ? 0.9 : (i === j ? 0.4 : 0.05); } },
        { title: "broad", fn: function (i, j) { return 0.25 + 0.45 / (1 + Math.abs(i - j)); } }
      ];
      panels.forEach(function (pan, k) {
        var r = { x: 8 + k * 98, y: 28, w: 88, h: 88 };
        var M = [], a, b;
        for (a = 0; a < 8; a++) {
          var row = [];
          for (b = 0; b < 8; b++) row.push(pan.fn(a, b));
          M.push(row);
        }
        V.heatmap(attnView.ctx, M, r, { cmap: "accent", vmin: 0, vmax: 1, gap: 0.5 });
        V.text(attnView.ctx, pan.title, r.x + r.w / 2, 132,
          { align: "center", size: 9, mono: true, color: p.ink2 });
      });
      V.text(attnView.ctx, "schematic only — not measured", 8, 16,
        { size: 10, mono: true, color: p.ink2 });

      table.update(active.top.map(function (t, i) {
        return [String(i + 1), t, active.why];
      }));
    }

    document.addEventListener("dl:theme", draw);
    rebuildMasks();
    return { reset: function () { sentCtl.set("0", true); rebuildMasks(); } };
  });

  /* ------------------------------------------------------------------ *
   * m4-04-gpt-sampler — exact temperature / top-k / top-p on a fixed logit vector
   * ------------------------------------------------------------------ */
  DL.widgets.register("m4-04-gpt-sampler", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var probView = V.canvas(stage.canvasWrap, {
      w: 520, h: 240, label: "Final token probabilities after temperature, top-k and top-p"
    });
    var histView = V.canvas(stage.canvasWrap, {
      w: 520, h: 200, label: "Histogram of 200 seeded draws from the final distribution"
    });

    var LOGITS = [2, 1, 0.5, 0, -1];
    var TOKENS = ["the", "cat", "sat", "on", "mat"];
    var tauCtl = U.slider({ label: "temperature τ", min: 0.1, max: 2, step: 0.1, value: 1, digits: 1, onInput: changed });
    var kCtl = U.slider({ label: "top-k", min: 1, max: 5, step: 1, value: 5, digits: 0, onInput: changed });
    var pCtl = U.slider({ label: "top-p", min: 0.1, max: 1, step: 0.05, value: 1, digits: 2, onInput: changed });
    var seedCtl = U.slider({ label: "seed", min: 0, max: 999, step: 1, value: 7, digits: 0, onInput: changed });
    var drawBtn = DL.el("button", {
      type: "button", class: "btn btn--accent", text: "Draw 200 samples",
      "aria-label": "Draw 200 seeded samples", on: { click: sample }
    });
    var reads = U.readouts(["kept after top-k", "kept after top-p", "argmax", "draws"]);
    var table = U.table({
      columns: ["token", "logit", "p(τ=1)", "final p"],
      rows: [], caption: "Fixed 5-token toy vocabulary"
    });

    stage.controls.appendChild(tauCtl.el);
    stage.controls.appendChild(kCtl.el);
    stage.controls.appendChild(pCtl.el);
    stage.controls.appendChild(seedCtl.el);
    stage.controls.appendChild(drawBtn);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(table.el);
    stage.controls.appendChild(DL.el("p", {
      class: "small muted",
      text: "Exact for this fixed distribution: softmax → temperature → top-k → top-p, with each truncation renormalised."
    }));

    var finalP = [], counts = [0, 0, 0, 0, 0], keptK = 0, keptP = 0;

    function recompute() {
      var tau = tauCtl.value(), k = kCtl.value(), topP = pCtl.value();
      var pT = T.softmax(LOGITS, { temperature: tau });
      var order = [0, 1, 2, 3, 4].sort(function (x, y) { return pT[y] - pT[x]; });
      var kIdx = order.slice(0, k), sK = 0, i;
      for (i = 0; i < kIdx.length; i++) sK += pT[kIdx[i]];
      var pK = [0, 0, 0, 0, 0];
      kIdx.forEach(function (idx) { pK[idx] = pT[idx] / sK; });

      var cum = 0, pIdx = [], pSorted = order.filter(function (idx) { return pK[idx] > 0; });
      for (i = 0; i < pSorted.length; i++) {
        cum += pK[pSorted[i]];
        pIdx.push(pSorted[i]);
        if (cum >= topP) break;
      }
      var sP = 0;
      pIdx.forEach(function (idx) { sP += pK[idx]; });
      finalP = [0, 0, 0, 0, 0];
      pIdx.forEach(function (idx) { finalP[idx] = pK[idx] / sP; });
      keptK = kIdx.length; keptP = pIdx.length;
      var base = T.softmax(LOGITS);
      table.update(TOKENS.map(function (tok, j) {
        return [tok, DL.fmt(LOGITS[j], 1), DL.fmt(base[j], 3), DL.fmt(finalP[j], 3)];
      }));
    }

    function draw() {
      var p = V.palette();
      recompute();
      probView.clear(p.surface);
      var r = { x: 44, y: 14, w: probView.w - 60, h: probView.h - 52 };
      V.bars(probView.ctx, finalP, r, {
        labels: TOKENS, values: true, digits: 3, vmax: 1,
        colors: finalP.map(function (v, i) { return v > 0 ? p.accent : p.line; })
      });
      V.axes(probView.ctx, r, {
        xmin: 0, xmax: 5, ymin: 0, ymax: 1, grid: true,
        tickLabels: false, ylabel: "probability"
      });

      histView.clear(p.surface);
      var hr = { x: 44, y: 12, w: histView.w - 60, h: histView.h - 50 };
      V.bars(histView.ctx, counts, hr, {
        labels: TOKENS, values: true, digits: 0,
        vmax: Math.max(1, DL.maxOf(counts)),
        colors: TOKENS.map(function () { return p.ink3; })
      });
      V.axes(histView.ctx, hr, {
        xmin: 0, xmax: 5, ymin: 0, ymax: Math.max(1, DL.maxOf(counts)),
        grid: true, tickLabels: false, ylabel: "draws"
      });

      reads.set("kept after top-k", String(keptK));
      reads.set("kept after top-p", String(keptP));
      reads.set("argmax", TOKENS[DL.argmax(finalP)]);
      reads.set("draws", String(DL.sum(counts)));
    }

    function sample() {
      var rng = DL.rng(seedCtl.value()), n = 200, i, u, acc, j;
      counts = [0, 0, 0, 0, 0];
      for (i = 0; i < n; i++) {
        u = rng(); acc = 0; j = 0;
        for (; j < finalP.length - 1; j++) {
          acc += finalP[j];
          if (u < acc) break;
        }
        counts[j] += 1;
      }
      draw();
    }

    function changed() { counts = [0, 0, 0, 0, 0]; draw(); }

    document.addEventListener("dl:theme", draw);
    draw();
    return {
      reset: function () {
        tauCtl.set(1, true); kCtl.set(5, true); pCtl.set(1, true);
        seedCtl.set(7, true); counts = [0, 0, 0, 0, 0]; draw();
      }
    };
  });

  /* ------------------------------------------------------------------ *
   * m4-05-lora-budget — exact parameter arithmetic, synthetic shape profiles
   * ------------------------------------------------------------------ */
  DL.widgets.register("m4-05-lora-budget", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var barView = V.canvas(stage.canvasWrap, {
      w: 520, h: 260, label: "Full fine-tuning parameters versus LoRA trainable parameters"
    });

    var PROFILES = [
      { value: "a", label: "Profile A · d=k=128, 4 modules", d: 128, k: 128, m: 4 },
      { value: "b", label: "Profile B · d=k=768, 12 modules", d: 768, k: 768, m: 12 },
      { value: "c", label: "Profile C · d=k=1024, 24 modules", d: 1024, k: 1024, m: 24 }
    ];
    var profCtl = U.select({
      label: "Shape profile (synthetic)", ariaLabel: "Synthetic shape profile",
      options: PROFILES, value: "b", onChange: draw
    });
    var rankCtl = U.slider({
      label: "rank r", min: 1, max: 32, step: 1, value: 8, digits: 0, onInput: draw
    });
    var reads = U.readouts([
      "r(d+k) per module", "full per module", "trainable total", "% trainable", "α/r (α=16)"
    ]);
    var table = U.table({
      columns: ["quantity", "expression", "value"],
      rows: [], caption: "All counts are arithmetic from the shape profile above"
    });

    stage.controls.appendChild(profCtl.el);
    stage.controls.appendChild(rankCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(table.el);
    stage.controls.appendChild(DL.el("p", {
      class: "small muted",
      text: "Exact arithmetic for synthetic profiles — these are not parameter counts of any released checkpoint."
    }));

    function draw() {
      var p = V.palette();
      var prof = PROFILES.filter(function (q) { return q.value === profCtl.value(); })[0];
      var d = prof.d, k = prof.k, m = prof.m, r = rankCtl.value();
      var perLora = r * (d + k);
      var perFull = d * k + k;
      var lora = m * perLora, full = m * perFull;
      var pct = 100 * lora / full;

      barView.clear(p.surface);
      var rect = { x: 16, y: 16, w: barView.w - 34, h: barView.h - 58 };
      V.bars(barView.ctx, [full, lora], rect, {
        labels: ["full fine-tune", "LoRA adapter"], values: true, digits: 0,
        vmax: full, colors: [p.ink3, p.accent]
      });
      V.axes(barView.ctx, rect, {
        xmin: 0, xmax: 2, ymin: 0, ymax: full, grid: true,
        tickLabels: false, ylabel: "parameters"
      });

      reads.set("r(d+k) per module", DL.fmt(perLora, 0));
      reads.set("full per module", DL.fmt(perFull, 0));
      reads.set("trainable total", DL.fmt(lora, 0));
      reads.set("% trainable", DL.fmt(pct, 3) + "%");
      reads.set("α/r (α=16)", DL.fmt(16 / r, 3));

      table.update([
        ["LoRA per module", "r(d+k) = " + r + "(" + d + "+" + k + ")", DL.fmt(perLora, 0)],
        ["full per module", "d·k + k = " + d + "·" + k + "+" + k, DL.fmt(perFull, 0)],
        ["modules", "given by profile", String(m)],
        ["adapter total", m + " × r(d+k)", DL.fmt(lora, 0)],
        ["full total", m + " × (d·k+k)", DL.fmt(full, 0)],
        ["reduction", "full / LoRA", DL.fmt(full / lora, 2) + "×"]
      ]);
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () { profCtl.set("b", true); rankCtl.set(8, true); draw(); } };
  });

})(window.DL);
