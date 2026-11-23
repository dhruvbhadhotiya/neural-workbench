/* ==========================================================================
   DeepLearn Lab — M3 widgets
   Registered ids must match docs/CONTENT_PLAN.md. Never rename an id.
   ========================================================================== */
(function (DL) {
  "use strict";

  var V = DL.viz, U = DL.ui, T = DL.tensor;

  /* ------------------------------------------------------------------ *
   * Small numeric helpers shared by several M3 labs.
   * ------------------------------------------------------------------ */
  function scaleInPlace(arr, s) {
    if (!Array.isArray(arr)) return;
    for (var i = 0; i < arr.length; i++) {
      if (Array.isArray(arr[i])) scaleInPlace(arr[i], s);
      else arr[i] *= s;
    }
  }
  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
  function bceProb(p, t) {
    return -(t * Math.log(Math.max(p, 1e-12)) + (1 - t) * Math.log(Math.max(1 - p, 1e-12)));
  }
  function normalPdf(x, mu, sd) {
    var z = (x - mu) / sd;
    return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
  }

  /* ------------------------------------------------------------------ *
   * m3-01-gan-1d — flagship: two MLPs trained live on a 1-D mixture.
   * Exact: G and D are DL.nn.MLP models; all curves come from their weights.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m3-01-gan-1d", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var hview = V.canvas(stage.canvasWrap, { w: 520, h: 260, label: "Target density versus generated histogram" });
    var dview = V.canvas(stage.canvasWrap, { w: 520, h: 230, label: "Discriminator decision curve and its theoretical optimum" });
    var lview = V.canvas(stage.canvasWrap, { w: 520, h: 190, label: "Smoothed discriminator and generator losses versus step" });

    var modeSel = U.select({
      label: "Target mixture", ariaLabel: "Number of target modes",
      options: [{ value: "2", label: "2 modes at ±1.2" }, { value: "3", label: "3 modes at −1.6, 0, 1.6" }],
      value: "2", onChange: function () { reference = false; syncReplayBtn(); rebuild(); }
    });
    var lrCtl = U.slider({
      label: "η (learning rate, both networks)", min: 0.0002, max: 0.002, step: 0.0001,
      value: 0.001, digits: 4, hint: "Changing η restarts the run from random weights.",
      onInput: function () { rebuild(); }
    });
    var replayBtn = DL.el("button", {
      type: "button", class: "btn", text: "Load reference trace (fixed seed)",
      "aria-label": "Switch to the fixed-seed reference trace", "aria-pressed": "false",
      on: { click: function () {
        reference = !reference;
        syncReplayBtn();
        rebuild();
        trainer.start();
        play.setRunning(true);
      } }
    });
    var reads = U.readouts(["step", "D loss (raw)", "G loss (raw)", "fake mass by mode", "run"]);

    stage.controls.appendChild(U.row(replayBtn));
    stage.controls.appendChild(modeSel.el);
    stage.controls.appendChild(lrCtl.el);
    stage.controls.appendChild(reads.el);

    var play = U.playback({
      started: false, speeds: [1, 4, 12, 40],
      onToggle: function (on) { if (on) trainer.start(); else trainer.pause(); },
      onReset: function () { reference = false; syncReplayBtn(); rebuild(); },
      onSpeed: function (v) { trainer.setSpeed(v); }
    });
    stage.controls.insertBefore(play.el, stage.controls.firstChild);

    var CFG = {
      "2": { gap: 2.4, sd: 0.30, scale: 2.0, width: 16, steps: 800, seedD: 2025, seedG: 2024 },
      "3": { gap: 1.6, sd: 0.20, scale: 2.2, width: 16, steps: 1000, seedD: 2025, seedG: 2024 }
    };
    var BATCH = 32, BUF = 256, XMIN = -2.6, XMAX = 2.6;
    var reference = false, cfg, real, fakeBuf, fakeIdx, G, D, optG, optD, trainRng;
    var emaD = Math.log(2), emaG = Math.log(2), history = [], lastD = Math.log(2), lastG = Math.log(2);
    var trainer, themeHandler;

    function syncReplayBtn() {
      replayBtn.textContent = reference ? "Back to live training" : "Load reference trace (fixed seed)";
      replayBtn.setAttribute("aria-pressed", String(reference));
      replayBtn.setAttribute("aria-label", reference
        ? "Return to fresh random live training"
        : "Switch to the fixed-seed reference trace");
    }

    function centers(m) {
      var out = [];
      for (var k = 0; k < m.modes; k++) out.push((k - (m.modes - 1) / 2) * m.gap);
      return out;
    }

    function rebuild() {
      if (trainer) trainer.pause().reset();
      var m = parseInt(modeSel.value(), 10);
      cfg = CFG[String(m)];
      cfg.modes = m;
      var dataRng = DL.rng(11);
      real = [];
      var cs = centers(cfg);
      for (var i = 0; i < BUF; i++) {
        real.push(cs[i % m] + DL.randn(dataRng) * cfg.sd);
      }
      var sg = reference ? 7 : cfg.seedG;
      var sd = reference ? 8 : cfg.seedD;
      G = DL.nn.MLP([1, cfg.width, cfg.width, 1], { activation: "tanh", out: "tanh", loss: "bce", init: "xavier", seed: sg });
      D = DL.nn.MLP([1, cfg.width, cfg.width, 1], { activation: "tanh", out: "linear", loss: "bce", init: "xavier", seed: sd });
      optG = DL.nn.opt.Adam({ lr: lrCtl.value() });
      optD = DL.nn.opt.Adam({ lr: lrCtl.value() });
      trainRng = DL.rng(reference ? 33 : 71);
      fakeBuf = new Array(BUF);
      for (var f = 0; f < BUF; f++) fakeBuf[f] = G.forward([DL.randn(DL.rng(1000 + f))]).out[0] * cfg.scale;
      fakeIdx = 0;
      emaD = Math.log(2); emaG = Math.log(2); history = [];
      lastD = Math.log(2); lastG = Math.log(2);
      reads.set("run", reference ? "reference · seed 7" : "live · seed " + sg);
      reads.set("step", "0");
      reads.set("D loss (raw)", DL.fmt(lastD, 4));
      reads.set("G loss (raw)", DL.fmt(lastG, 4));
      draw();
    }

    function targetPdf(x) {
      var s = 0, cs = centers(cfg);
      for (var k = 0; k < cs.length; k++) s += normalPdf(x, cs[k], cfg.sd) / cs.length;
      return s;
    }

    function fakePdf(x) {
      var s = 0, bw = cfg.sd * 1.4, c = 1 / (Math.sqrt(2 * Math.PI) * bw * fakeBuf.length);
      for (var i = 0; i < fakeBuf.length; i++) {
        var z = (x - fakeBuf[i]) / bw;
        s += Math.exp(-0.5 * z * z);
      }
      return s * c;
    }

    function onStep(step) {
      var xs = [], zs = [], fx = [];
      for (var k = 0; k < BATCH; k++) {
        xs.push(real[Math.floor(trainRng() * real.length)]);
        var z = DL.randn(trainRng);
        zs.push(z);
        var x = G.forward([z]).out[0] * cfg.scale; // G's output is detached: plain number
        fx.push(x);
        fakeBuf[fakeIdx] = x;
        fakeIdx = (fakeIdx + 1) % fakeBuf.length;
      }

      // D step: real(1) and fake(0) in ONE fitBatch (fitBatch zeroes grads itself).
      var dAll = D.fitBatch(
        xs.concat(fx).map(function (v) { return [v]; }),
        xs.map(function () { return 1; }).concat(fx.map(function () { return 0; }))
      );
      optD.step(D.params());

      // G step: non-saturating BCE on fresh G(z); propagate through D into G.
      G.zeroGrad(); D.zeroGrad();
      var gLoss = 0;
      for (var j = 0; j < BATCH; j++) {
        var g = G.forward([zs[j]]).out[0];
        var xFake = g * cfg.scale;
        var logit = D.forward([xFake]).out[0];
        gLoss += bceProb(sigmoid(logit), 1);       // report a probability, not the fused loss
        var r = D.lossAndGrad([xFake], 1);         // BCE-with-logits, target 1
        var gx = D.backward(r.gradOut)[0] * cfg.scale;
        G.backward([gx]);
      }
      gLoss /= BATCH;
      var ps = G.params();
      ps.forEach(function (p) { scaleInPlace(p.g, 1 / BATCH); }); // mean reduction
      optG.step(ps);

      lastD = dAll; lastG = gLoss;
      emaD = 0.92 * emaD + 0.08 * dAll;
      emaG = 0.92 * emaG + 0.08 * gLoss;
      if (step % 4 === 0 || step === 1) history.push({ s: step, d: emaD, g: emaG });
      if (history.length > 400) history.shift();

      reads.set("step", String(step));
      reads.set("D loss (raw)", DL.fmt(lastD, 4));
      reads.set("G loss (raw)", DL.fmt(lastG, 4));
      var cs = centers(cfg), bw = cfg.sd * 2.2, masses = cs.map(function (c) {
        return fakeBuf.filter(function (v) { return Math.abs(v - c) < bw; }).length / fakeBuf.length;
      });
      reads.set("fake mass by mode", masses.map(function (v) { return DL.fmt(v, 2); }).join(" / "));
      return step >= cfg.steps; // stop this run; trainer reports done to the play controls
    }

    function draw() {
      var p = V.palette();
      var bins = 34, bw = (XMAX - XMIN) / bins;

      /* panel 1: target density vs generated histogram */
      hview.clear(p.surface);
      var hr = { x: 44, y: 12, w: hview.w - 58, h: hview.h - 46 };
      var binCount = new Array(bins);
      for (var b = 0; b < bins; b++) binCount[b] = 0;
      fakeBuf.forEach(function (v) {
        var idx = Math.floor((v - XMIN) / bw);
        if (idx >= 0 && idx < bins) binCount[idx]++;
      });
      var peak = Math.max(1, DL.maxOf(binCount), BUF * bw * targetPdf(centers(cfg)[0]) * 1.2);
      var scaled = binCount.map(function (c) { return (c / peak) * 0.9; });
      V.bars(hview.ctx, scaled, hr, { values: false, colors: [p.accent] });
      var targetPts = [];
      for (var i = 0; i <= 120; i++) {
        var x = XMIN + (XMAX - XMIN) * i / 120;
        targetPts.push([x, (BUF * bw * targetPdf(x) / peak) * 0.9]);
      }
      var hm = V.line(hview.ctx, [{ pts: targetPts, color: p.danger, width: 2.2 }], hr, {
        axes: false, xmin: XMIN, xmax: XMAX, ymin: 0, ymax: 1, grid: false, padY: false
      });
      V.axes(hview.ctx, hr, { xmin: XMIN, xmax: XMAX, ymin: 0, ymax: 1, grid: false, ticks: 4, xlabel: "x" });
      V.legend(hview.ctx, [
        { color: p.accent, label: "generated histogram (256 samples)" },
        { color: p.danger, label: "target density" }
      ], { x: hr.x + 8, y: hr.y + 6 }, { lh: 13 });

      /* panel 2: D(x) against the theoretical optimum */
      dview.clear(p.surface);
      var dr = { x: 44, y: 12, w: dview.w - 58, h: dview.h - 46 };
      var dPts = [], optPts = [];
      for (var t = 0; t <= 90; t++) {
        var xx = XMIN + (XMAX - XMIN) * t / 90;
        var lg = D.forward([xx]).out[0];
        dPts.push([xx, sigmoid(lg)]);
        var a = targetPdf(xx), bb = fakePdf(xx);
        optPts.push([xx, a + bb > 1e-12 ? a / (a + bb) : 0.5]);
      }
      var dm = V.line(dview.ctx, [
        { pts: dPts, color: p.accent, width: 2.2 },
        { pts: optPts, color: p.danger, width: 1.8, dash: [5, 4] }
      ], dr, { xmin: XMIN, xmax: XMAX, ymin: 0, ymax: 1, grid: true, ticks: 4, xlabel: "x", ylabel: "probability" });
      V.dashedLine(dview.ctx, dr.x, dm.sy(0.5), dr.x + dr.w, dm.sy(0.5), { color: p.lineStrong, dash: [3, 3] });
      V.legend(dview.ctx, [
        { color: p.accent, label: "D(x), current weights" },
        { color: p.danger, label: "D*(x) = p_data/(p_data+p_g)" }
      ], { x: dr.x + 8, y: dr.y + 6 }, { lh: 13 });

      /* panel 3: smoothed losses */
      lview.clear(p.surface);
      var lr2 = { x: 44, y: 12, w: lview.w - 58, h: lview.h - 46 };
      var maxStep = Math.max(80, trainer ? trainer.state.step : 1);
      V.line(lview.ctx, [
        { pts: history.map(function (h) { return [h.s, h.d]; }), color: p.accent, width: 2 },
        { pts: history.map(function (h) { return [h.s, h.g]; }), color: p.danger, width: 2 }
      ], lr2, { xmin: 0, xmax: maxStep, ymin: 0, ymax: 2, grid: true, ticks: 4, xlabel: "step", ylabel: "BCE (EMA 0.92)" });
      var yLog2 = lr2.y + lr2.h - (Math.log(2) / 2) * lr2.h;
      V.dashedLine(lview.ctx, lr2.x, yLog2, lr2.x + lr2.w, yLog2, { color: p.ink3, dash: [3, 3] });
      V.legend(lview.ctx, [
        { color: p.accent, label: "discriminator loss" },
        { color: p.danger, label: "generator loss" },
        { color: p.ink3, label: "log 2 = 0.693 (equilibrium)" }
      ], { x: lr2.x + 8, y: lr2.y + 6 }, { lh: 13 });
      if (reference) {
        V.text(lview.ctx, "REFERENCE REPLAY · fixed seed 7 · not the live run", lr2.x + 8, lr2.y + lr2.h - 8,
          { size: 10, mono: true, color: p.warn });
      }
    }

    trainer = DL.trainer({
      steps: 0, speed: 1,  // cfg.steps ends the run from inside onStep
      onStep: onStep,
      onFrame: function (step, done) {
        draw();
        if (done) play.setRunning(false);
      }
    });

    themeHandler = function () { draw(); };
    document.addEventListener("dl:theme", themeHandler);
    rebuild();

    return {
      reset: function () { reference = false; syncReplayBtn(); rebuild(); },
      pause: function () { trainer.pause(); play.setRunning(false); },
      destroy: function () { trainer.pause(); document.removeEventListener("dl:theme", themeHandler); }
    };
  });

  /* ------------------------------------------------------------------ *
   * m3-02-mode-collapse — schematic trace on a ring of eight modes
   * Illustrative: hand-tuned cluster weights, no network is trained.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m3-02-mode-collapse", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 520, h: 400, label: "Eight Gaussian modes losing coverage as the trace advances" });
    var stepCtl = U.slider({
      label: "Trace step", min: 0, max: 100, step: 1, value: 0, digits: 0,
      hint: "Scrub the stored, schematic trace.", onInput: draw
    });
    var reads = U.readouts(["modes covered", "weight on top mode", "trace phase"]);
    stage.controls.appendChild(stepCtl.el);
    stage.controls.appendChild(reads.el);

    var RNG = DL.rng(9), jitter = [];
    for (var k = 0; k < 8; k++) {
      var ring = [];
      for (var j = 0; j < 30; j++) ring.push([DL.randn(RNG) * 0.20, DL.randn(RNG) * 0.20]);
      jitter.push(ring);
    }
    var endWeights = [0.80, 0, 0, 0, 0.20, 0, 0, 0];

    function weightsAt(t) {
      var e = t * t * (3 - 2 * t); // smoothstep, purely presentational
      var w = jitter.map(function (_, i) { return (1 - e) / 8 + e * endWeights[i]; });
      var sum = DL.sum(w);
      return w.map(function (v) { return v / sum; });
    }

    function draw() {
      var p = V.palette(), t = stepCtl.value() / 100;
      view.clear(p.surface);
      var r = { x: 46, y: 16, w: view.w - 62, h: view.h - 50 };
      V.axes(view.ctx, r, { xmin: -3, xmax: 3, ymin: -3, ymax: 3, grid: true, ticks: 6, xlabel: "feature 1", ylabel: "feature 2" });
      var w = weightsAt(t), sx = function (x) { return r.x + ((x + 3) / 6) * r.w; };
      var sy = function (y) { return r.y + r.h - ((y + 3) / 6) * r.h; };

      // faint target ring
      view.ctx.save();
      view.ctx.beginPath();
      for (var a = 0; a <= 100; a++) {
        var ang = 2 * Math.PI * a / 100;
        var px = sx(2 * Math.cos(ang)), py = sy(2 * Math.sin(ang));
        if (a === 0) view.ctx.moveTo(px, py); else view.ctx.lineTo(px, py);
      }
      view.ctx.strokeStyle = p.lineStrong; view.ctx.setLineDash([4, 5]); view.ctx.lineWidth = 1.2;
      view.ctx.stroke(); view.ctx.restore();

      var covered = 0, top = 0;
      w.forEach(function (mass, i) {
        if (mass > 0.08) covered++;
        top = Math.max(top, mass);
        var ang = 2 * Math.PI * i / 8;
        var cx = 2 * Math.cos(ang), cy = 2 * Math.sin(ang);
        var spread = 0.55 + 0.45 * Math.sqrt(mass * 8); // collapses visually with mass
        jitter[i].forEach(function (d) {
          V.dot(view.ctx, sx(cx + d[0] * spread), sy(cy + d[1] * spread),
            2.5 + 2.5 * mass, i === 0 ? p.accent : (mass > 0.08 ? p.ok : p.ink3));
        });
        V.text(view.ctx, String(i), sx(cx), sy(cy) - 17,
          { align: "center", size: 10, mono: true, color: p.ink2 });
      });

      reads.set("modes covered", covered + " / 8");
      reads.set("weight on top mode", DL.pct(top, 1));
      reads.set("trace phase", t < 0.2 ? "diverse" : (t < 0.7 ? "drifting" : "collapsed"));
      V.text(view.ctx, "SCHEMATIC TRACE (no trained network)", r.x + 8, r.y + 14,
        { size: 10, mono: true, color: p.warn });
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () { stepCtl.set(0, true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m3-02-loss-tugofwar — analytic shapes of three training regimes
   * Illustrative: formulas, not measured training curves.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m3-02-loss-tugofwar", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 520, h: 320, label: "Loss curves for healthy, discriminator-win and generator-win regimes" });
    var regime = U.buttons({
      label: "Regime",
      options: [
        { value: "healthy", label: "Healthy", hint: "Both near log 2" },
        { value: "d-wins", label: "D wins", hint: "D loss → 0" },
        { value: "g-wins", label: "G wins", hint: "G loss → 0" }
      ],
      value: "healthy", onChange: draw
    });
    var horizon = U.slider({ label: "Steps shown", min: 100, max: 600, step: 50, value: 400, digits: 0, onInput: draw });
    var reads = U.readouts(["D loss at end", "G loss at end", "reading"]);
    stage.controls.appendChild(regime.el);
    stage.controls.appendChild(horizon.el);
    stage.controls.appendChild(reads.el);

    function curves(s) {
      if (regime.value() === "d-wins") {
        return [0.69 * Math.exp(-s / 110) + 0.04, 0.69 + 3.1 * (1 - Math.exp(-s / 170))];
      }
      if (regime.value() === "g-wins") {
        return [0.69 + 1.9 * (1 - Math.exp(-s / 150)), 0.69 * Math.exp(-s / 120) + 0.05];
      }
      return [0.69 + 0.10 * Math.sin(s / 17), 0.69 - 0.09 * Math.sin(s / 17 - 0.5)];
    }

    function draw() {
      var p = V.palette(), n = horizon.value(), ds = [], gs = [];
      view.clear(p.surface);
      for (var s = 1; s <= n; s++) {
        var c = curves(s);
        ds.push([s, c[0]]); gs.push([s, c[1]]);
      }
      var r = { x: 46, y: 14, w: view.w - 60, h: view.h - 48 };
      V.line(view.ctx, [
        { pts: ds, color: p.accent, width: 2.2 },
        { pts: gs, color: p.danger, width: 2.2 }
      ], r, { xmin: 1, xmax: n, ymin: 0, ymax: 4, grid: true, ticks: 4, xlabel: "step", ylabel: "BCE (schematic)" });
      V.dashedLine(view.ctx, r.x, r.y + r.h - (Math.log(2) / 4) * r.h,
        r.x + r.w, r.y + r.h - (Math.log(2) / 4) * r.h, { color: p.ink3, dash: [3, 3] });
      V.legend(view.ctx, [
        { color: p.accent, label: "discriminator loss" },
        { color: p.danger, label: "generator loss" }
      ], { x: r.x + 8, y: r.y + 6 }, { lh: 13 });
      var end = curves(n);
      reads.set("D loss at end", DL.fmt(end[0], 3));
      reads.set("G loss at end", DL.fmt(end[1], 3));
      reads.set("reading", regime.value() === "healthy" ? "balanced game"
        : regime.value() === "d-wins" ? "slow D down" : "strengthen D");
      V.text(view.ctx, "ILLUSTRATIVE REFERENCE CURVES", r.x + 8, r.y + r.h - 8,
        { size: 10, mono: true, color: p.warn });
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () { regime.set("healthy", true); horizon.set(400, true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m3-02-fid-slider — exact general 2-D Frechet distance
   * ------------------------------------------------------------------ */
  DL.widgets.register("m3-02-fid-slider", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 480, h: 400, label: "Real and generated 2-D Gaussian clouds" });

    var mgx = U.slider({ label: "μ_g,x", min: -2, max: 4, step: 0.1, value: 1.5, digits: 1, onInput: draw });
    var mgy = U.slider({ label: "μ_g,y", min: -2, max: 5, step: 0.1, value: 2.5, digits: 1, onInput: draw });
    var sgx = U.slider({ label: "σ_g,x", min: 0.2, max: 3, step: 0.1, value: 2, digits: 1, onInput: draw });
    var sgy = U.slider({ label: "σ_g,y", min: 0.2, max: 3, step: 0.1, value: 1, digits: 1, onInput: draw });
    var rho = U.slider({ label: "ρ_g (correlation)", min: -0.9, max: 0.9, step: 0.05, value: 0, digits: 2, onInput: draw });
    var reads = U.readouts(["‖Δμ‖²", "trace term", "2-D FID", "det Σ_g"]);
    var mathBox = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    stage.controls.appendChild(mgx.el); stage.controls.appendChild(mgy.el);
    stage.controls.appendChild(sgx.el); stage.controls.appendChild(sgy.el);
    stage.controls.appendChild(rho.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(mathBox);

    var MR = [1, 2], SR = [[1, 0], [0, 1]];
    var rng = DL.rng(21), zr = [], zg = [];
    for (var i = 0; i < 220; i++) zr.push([DL.randn(rng), DL.randn(rng)]);
    for (var j = 0; j < 220; j++) zg.push([DL.randn(rng), DL.randn(rng)]);

    // Closed-form square root of a symmetric positive semidefinite 2x2 matrix.
    function sqrt2(A) {
      var a = A[0][0], b = A[0][1], c = A[1][1];
      var det = Math.max(0, a * c - b * b), sd = Math.sqrt(det);
      var t = Math.sqrt(Math.max(1e-12, a + c + 2 * sd));
      return [[(a + sd) / t, b / t], [b / t, (c + sd) / t]];
    }
    function mul(A, B) {
      return [[A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
              [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]];
    }
    function fidParts() {
      var gx = mgx.value(), gy = mgy.value(), ax = sgx.value(), ay = sgy.value(), r = rho.value();
      var SG = [[ax * ax, r * ax * ay], [r * ax * ay, ay * ay]];
      var MG = [gx, gy];
      var meanTerm = (MG[0] - MR[0]) ** 2 + (MG[1] - MR[1]) ** 2;
      var R = sqrt2(SR);
      var S = mul(mul(R, SG), [[R[0][0], R[1][0]], [R[0][1], R[1][1]]]);
      var Q = sqrt2(S);
      var trR = SR[0][0] + SR[1][1], trG = SG[0][0] + SG[1][1], trQ = Q[0][0] + Q[1][1];
      return {
        meanTerm: meanTerm, traceTerm: trR + trG - 2 * trQ, fid: meanTerm + trR + trG - 2 * trQ,
        detG: SG[0][0] * SG[1][1] - SG[0][1] * SG[1][0],
        MG: MG, SG: SG, trR: trR, trG: trG, trQ: trQ, ax: ax, ay: ay, r: r
      };
    }

    function draw() {
      var p = V.palette(), f = fidParts();
      view.clear(p.surface);
      var r = { x: 46, y: 14, w: view.w - 62, h: view.h - 48 };
      var realPts = zr.map(function (z) { return { x: MR[0] + z[0], y: MR[1] + z[1], c: 0, r: 2.6 }; });
      var genPts = zg.map(function (z) {
        return { x: f.MG[0] + f.ax * z[0],
                 y: f.MG[1] + f.ay * (f.r * z[0] + Math.sqrt(Math.max(0, 1 - f.r * f.r)) * z[1]),
                 c: 1, r: 2.6 };
      });
      V.scatter(view.ctx, realPts.concat(genPts), r, {
        xmin: -5, xmax: 7, ymin: -5, ymax: 7, grid: true, ticks: 6,
        colors: [p.accent, p.danger], xlabel: "feature 1", ylabel: "feature 2"
      });
      var sx = function (x) { return r.x + ((x + 5) / 12) * r.w; };
      var sy = function (y) { return r.y + r.h - ((y + 5) / 12) * r.h; };
      [[MR[0], MR[1], p.accent], [f.MG[0], f.MG[1], p.danger]].forEach(function (m) {
        view.ctx.strokeStyle = m[2]; view.ctx.lineWidth = 2;
        view.ctx.beginPath();
        view.ctx.moveTo(sx(m[0]) - 7, sy(m[1])); view.ctx.lineTo(sx(m[0]) + 7, sy(m[1]));
        view.ctx.moveTo(sx(m[0]), sy(m[1]) - 7); view.ctx.lineTo(sx(m[0]), sy(m[1]) + 7);
        view.ctx.stroke();
      });
      V.legend(view.ctx, [{ color: p.accent, label: "real cloud: μ=(1,2), Σ=I" },
        { color: p.danger, label: "generated cloud (your sliders)" }], { x: r.x + 8, y: r.y + 6 }, { lh: 13 });

      reads.set("‖Δμ‖²", DL.fmt(f.meanTerm, 4));
      reads.set("trace term", DL.fmt(f.traceTerm, 4));
      reads.set("2-D FID", DL.fmt(f.fid, 4));
      reads.set("det Σ_g", DL.fmt(f.detG, 4));
      mathBox.textContent =
        "Δμ² = (" + DL.fmt(f.MG[0], 2) + "−1)² + (" + DL.fmt(f.MG[1], 2) + "−2)² = " + DL.fmt(f.meanTerm, 4) +
        "   ·   Tr Σr = " + DL.fmt(f.trR, 3) + ", Tr Σg = " + DL.fmt(f.trG, 3) +
        ", Tr[(ΣrΣg)^½] = " + DL.fmt(f.trQ, 3) +
        "   ·   FID = " + DL.fmt(f.fid, 4) + ". Image FID uses Inception features instead of these 2-D points.";
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () {
      mgx.set(1.5, true); mgy.set(2.5, true); sgx.set(2, true); sgy.set(1, true); rho.set(0, true); draw();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m3-03-gan-architecture — DCGAN shape and parameter walkthrough
   * Exact: output sizes from the conv formulas; counts from shown arithmetic.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m3-03-gan-architecture", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 540, h: 160, label: "DCGAN feature-map shapes from latent vector to image" });

    var netCtl = U.buttons({
      label: "Network",
      options: [{ value: "G", label: "Generator" }, { value: "D", label: "Discriminator" }],
      value: "G", onChange: draw
    });
    var bnCtl = U.toggle({ label: "BatchNorm", checked: true, onChange: draw });
    var leakyCtl = U.toggle({ label: "LeakyReLU in D", checked: true, onChange: draw });
    var snCtl = U.toggle({ label: "Spectral norm (no extra params)", checked: false, onChange: draw });
    var reads = U.readouts(["final shape (N,C,H,W)", "total parameters", "last computed layer"]);
    var formulaBox = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var table = U.table({
      columns: ["#", "layer", "output (N,C,H,W)", "params", "arithmetic"],
      rows: [], caption: "Forward pass, computed layer by layer"
    });

    stage.controls.appendChild(netCtl.el);
    stage.controls.appendChild(U.row(bnCtl.el, leakyCtl.el, snCtl.el));
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(formulaBox);
    stage.controls.appendChild(table.el);

    // One transposed-conv plan from tools/params.py; H' = (H-1)S - 2P + K.
    var G_PLAN = [
      { cout: 512, k: 4, s: 1, p: 0, bn: true },
      { cout: 256, k: 4, s: 2, p: 1, bn: true },
      { cout: 128, k: 4, s: 2, p: 1, bn: true },
      { cout: 64, k: 4, s: 2, p: 1, bn: true },
      { cout: 3, k: 4, s: 2, p: 1, bn: false }
    ];
    // D: first conv has no BN; last conv is a 4x4 to one logit.
    var D_PLAN = [
      { cout: 64, k: 4, s: 2, p: 1, bn: true },
      { cout: 128, k: 4, s: 2, p: 1, bn: true },
      { cout: 256, k: 4, s: 2, p: 1, bn: true },
      { cout: 512, k: 4, s: 2, p: 1, bn: false },
      { cout: 1, k: 4, s: 1, p: 0, bn: false }
    ];
    var convOut = function (h, k, s, p) { return Math.floor((h + 2 * p - (k - 1) - 1) / s) + 1; };
    var tOut = function (h, k, s, p) { return (h - 1) * s - 2 * p + k; }; // D=1, output_padding=0

    function buildRows() {
      var isG = netCtl.value() === "G";
      var rows = [], shapes = [], total = 0, h = isG ? 1 : 64, c = isG ? 100 : 3;
      var plan = isG ? G_PLAN : D_PLAN;
      shapes.push((isG ? "1," : "1,") + c + "," + h + "," + h);
      rows.push([0, isG ? "Input z (100)" : "Input image", "(1," + c + "," + h + "," + h + ")", 0, "given"]);
      var lastFormula = "";
      plan.forEach(function (L, i) {
        var oh = isG ? tOut(h, L.k, L.s, L.p) : convOut(h, L.k, L.s, L.p);
        var n = L.k * L.k * c * L.cout + L.cout; // bias = True, matching tools/params.py
        var arith = isG
          ? "(" + h + "−1)·" + L.s + "−2·" + L.p + "+" + L.k + "=" + oh + ";  " + L.k + "²·" + c + "·" + L.cout + "+" + L.cout + "=" + n
          : "⌊(" + h + "+2·" + L.p + "−" + (L.k - 1) + "−1)/" + L.s + "⌋+1=" + oh + ";  " + L.k + "²·" + c + "·" + L.cout + "+" + L.cout + "=" + n;
        var name = (isG ? "ConvT2d(" : "Conv2d(") + c + "→" + L.cout + ", " + L.k + "×" + L.k + ", s=" + L.s + ", p=" + L.p + ")";
        rows.push([rows.length, name, "(1," + L.cout + "," + oh + "," + oh + ")", n, arith]);
        total += n; shapes.push("1," + L.cout + "," + oh + "," + oh);
        lastFormula = arith;
        if (bnCtl.checked() && L.bn) {
          rows.push([rows.length, "BatchNorm2d(" + L.cout + ")", "(1," + L.cout + "," + oh + "," + oh + ")", 2 * L.cout, "2C = 2·" + L.cout + " = " + 2 * L.cout]);
          total += 2 * L.cout;
        }
        if (!isG && i < plan.length - 2) {
          rows.push([rows.length, leakyCtl.checked() ? "LeakyReLU(0.2)" : "ReLU", "(1," + L.cout + "," + oh + "," + oh + ")", 0, snCtl.checked() ? "spectral norm applied, 0 params" : "0 parameters"]);
        }
        if (isG && i < plan.length - 1) {
          rows.push([rows.length, "ReLU", "(1," + L.cout + "," + oh + "," + oh + ")", 0, "0 parameters"]);
        }
        c = L.cout; h = oh;
      });
      rows.push(["", "TOTAL", "", total, snCtl.checked() ? "W_SN = W/σ(W): no extra params" : "sum of all layers"]);
      return { rows: rows, total: total, shapes: shapes, final: "(1," + c + "," + h + "," + h + ")", formula: lastFormula, isG: isG };
    }

    function draw() {
      var p = V.palette(), b = buildRows();
      view.clear(p.surface);
      var n = b.shapes.length, bw = 68, gap = (view.w - 24 - n * bw) / Math.max(1, n - 1);
      for (var i = 0; i < n; i++) {
        var x = 12 + i * (bw + gap);
        V.roundRect(view.ctx, x, 46, bw, 58, 7);
        view.ctx.fillStyle = i === n - 1 ? p.accent : p.surface2;
        view.ctx.fill();
        view.ctx.strokeStyle = p.accent; view.ctx.lineWidth = 1.4; view.ctx.stroke();
        var parts = b.shapes[i].split(",");
        V.text(view.ctx, parts[1] + "ch", x + bw / 2, 68, { align: "center", size: 10, mono: true, color: i === n - 1 ? p.accent : p.ink });
        V.text(view.ctx, parts[2] + "×" + parts[3], x + bw / 2, 88, { align: "center", size: 10, mono: true, color: i === n - 1 ? p.accent : p.ink2 });
        if (i < n - 1) V.arrow(view.ctx, x + bw + 2, 75, x + bw + gap - 3, 75, { color: p.ink3, head: 5 });
      }
      V.text(view.ctx, b.isG ? "z (100) → image" : "image → real/fake logit", 12, 24,
        { size: 11, mono: true, color: p.ink2 });

      table.update(b.rows);
      reads.set("final shape (N,C,H,W)", b.final);
      reads.set("total parameters", DL.nn.formatCount(b.total));
      reads.set("last computed layer", b.isG ? "ConvTranspose2d" : "Conv2d");
      formulaBox.textContent = (b.isG ? "Transposed conv: " : "Conv output: ") + b.formula +
        ". With BatchNorm on, 2C parameters are added per normalised layer. " +
        "All-on totals: G = 3,577,667; D = 2,765,633 (tools/params.py).";
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () {
      netCtl.set("G", true); bnCtl.set(true, true); leakyCtl.set(true, true); snCtl.set(false, true); draw();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m3-04-cyclegan-walkthrough — schematic A -> B -> A' with three losses
   * Illustrative: procedural panels and the lesson's worked example values.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m3-04-cyclegan-walkthrough", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 560, h: 300, label: "CycleGAN three-panel translation and reconstruction walkthrough" });
    var stepCtl = U.buttons({
      label: "Walkthrough step",
      options: [
        { value: 0, label: "1 · Real A", hint: "Start with a horse" },
        { value: 1, label: "2 · G: A→B", hint: "Translate to zebra" },
        { value: 2, label: "3 · F: B→A′", hint: "Translate back" },
        { value: 3, label: "4 · Losses", hint: "Highlight the objective" }
      ],
      value: 0, onChange: draw
    });
    var reads = U.readouts(["active step", "content check", "worked objective"]);
    stage.controls.appendChild(stepCtl.el);
    stage.controls.appendChild(reads.el);

    function paintPanel(ctx, x, y, w, h, kind, p) {
      var cool = kind === "A" || kind === "A'";
      ctx.save();
      V.roundRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = cool ? p.accentSoft : "#f6dfc4";
      ctx.fill();
      ctx.strokeStyle = p.lineStrong; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.58, w * 0.28, h * 0.24, 0, 0, Math.PI * 2);
      ctx.fillStyle = cool ? p.accent : p.warn; ctx.fill();
      if (kind === "B") {
        ctx.strokeStyle = p.ink; ctx.lineWidth = 2;
        for (var s = -2; s <= 2; s++) {
          ctx.beginPath();
          ctx.moveTo(x + w / 2 + s * w * 0.1 - 6, y + h * 0.38);
          ctx.lineTo(x + w / 2 + s * w * 0.1 + 4, y + h * 0.78);
          ctx.stroke();
        }
      }
      V.text(ctx, kind, x + w / 2, y + 18, { align: "center", size: 13, mono: true, color: p.ink });
      ctx.restore();
    }

    function draw() {
      var p = V.palette(), step = parseInt(stepCtl.value(), 10);
      view.clear(p.surface);
      var py = 44, pw = 120, ph = 130, gap = 70;
      var xs = [18, 18 + pw + gap, 18 + 2 * (pw + gap)];
      var kinds = ["A", "B", "A'"];
      for (var i = 0; i < 3; i++) {
        var visible = i === 0 || (i === 1 && step >= 1) || (i === 2 && step >= 2);
        view.ctx.globalAlpha = visible ? 1 : 0.18;
        paintPanel(view.ctx, xs[i], py, pw, ph, kinds[i], p);
        view.ctx.globalAlpha = 1;
        if (step === i) {
          view.ctx.strokeStyle = p.accent; view.ctx.lineWidth = 3;
          V.roundRect(view.ctx, xs[i] - 4, py - 4, pw + 8, ph + 8, 10);
          view.ctx.stroke();
        }
        V.text(view.ctx, i === 0 ? "real photo" : (i === 1 ? "G(x) · fake B" : "F(G(x)) · cycled A'"),
          xs[i] + pw / 2, py + ph + 20, { align: "center", size: 10, mono: true, color: p.ink2 });
      }
      V.arrow(view.ctx, xs[0] + pw + 6, py + ph / 2, xs[1] - 6, py + ph / 2, { color: step >= 1 ? p.accent : p.lineStrong });
      V.arrow(view.ctx, xs[1] + pw + 6, py + ph / 2, xs[2] - 6, py + ph / 2, { color: step >= 2 ? p.accent : p.lineStrong });
      V.text(view.ctx, "G", xs[0] + pw + gap / 2, py + ph / 2 - 10, { align: "center", size: 12, mono: true, color: p.ink });
      V.text(view.ctx, "F", xs[1] + pw + gap / 2, py + ph / 2 - 10, { align: "center", size: 12, mono: true, color: p.ink });

      var lines = [
        "x = (1, 0, −1)   →   F(G(x)) = (0.8, 0.1, −0.9)",
        "L_cyc = (0.2+0.1+0.1)/3 = 0.13333   ·   λ_cyc = 10   →   1.33333",
        "L = L_GAN(G,D_B) + L_GAN(F,D_A) + λ_cyc L_cyc = 0.71 + 0.68 + 1.33333 = 2.72333"
      ];
      V.roundRect(view.ctx, 18, 212, view.w - 36, 70, 8);
      view.ctx.fillStyle = p.surface2; view.ctx.fill();
      for (var k = 0; k < lines.length; k++) {
        V.text(view.ctx, lines[k], 28, 230 + k * 17,
          { size: 10.5, mono: true, color: k === step ? p.accent : p.ink2, weight: k === step ? "700" : "500" });
      }
      reads.set("active step", ["real A", "G: A→B", "F: B→A′", "three losses"][step]);
      reads.set("content check", step >= 2 ? "A′ vs A: L1 = 0.13333 (worked)" : "not drawn yet");
      reads.set("worked objective", step === 3 ? "2.72333" : "reveal at step 4");
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () { stepCtl.set(0, true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m3-04-stargan-walkthrough — one G, target-domain slider, D heads
   * Illustrative: procedural attribute changes, no trained model.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m3-04-stargan-walkthrough", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 480, h: 320, label: "One generator conditioned on a target domain, with four discriminator heads" });
    var domains = ["black hair", "blond hair", "brown hair", "blue hair"];
    var colors = ["#2b2431", "#d8b45a", "#8b5a3c", "#5b8bd8"];
    var domainCtl = U.slider({
      label: "Target domain c", min: 0, max: 3, step: 1, value: 1, digits: 0,
      hint: "The same generator is re-conditioned on the chosen domain.", onInput: draw
    });
    var reads = U.readouts(["target domain", "active D domain head", "one-hot code", "domain CE (worked)"]);
    stage.controls.appendChild(domainCtl.el);
    stage.controls.appendChild(reads.el);

    function face(ctx, x, y, w, h, color, p) {
      ctx.save();
      V.roundRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = p.surface2; ctx.fill();
      ctx.strokeStyle = p.lineStrong; ctx.stroke();
      ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.61, w * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = "#f0cfb4"; ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h * 0.47, w * 0.30, Math.PI, 0);
      ctx.lineTo(x + w / 2 + w * 0.28, y + h * 0.53);
      ctx.lineTo(x + w / 2 - w * 0.28, y + h * 0.53);
      ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
      V.dot(ctx, x + w * 0.41, y + h * 0.62, 3, p.ink);
      V.dot(ctx, x + w * 0.59, y + h * 0.62, 3, p.ink);
      ctx.restore();
    }

    function draw() {
      var p = V.palette(), d = domainCtl.value();
      view.clear(p.surface);
      face(view.ctx, 18, 28, 140, 160, colors[d], p);
      V.text(view.ctx, "G(x, c): x + target code", 88, 208, { align: "center", size: 10, mono: true, color: p.ink2 });

      // D with four heads
      var bx = 210, by = 48, bw = 250, bh = 120;
      V.roundRect(view.ctx, bx, by, bw, bh, 8);
      view.ctx.fillStyle = p.surface2; view.ctx.fill();
      view.ctx.strokeStyle = p.lineStrong; view.ctx.stroke();
      V.text(view.ctx, "D(image): real/fake + domain heads", bx + 10, by + 20, { size: 10.5, mono: true, color: p.ink2 });
      for (var k = 0; k < 4; k++) {
        var hx = bx + 16 + k * 57;
        V.roundRect(view.ctx, hx, by + 44, 48, 52, 6);
        view.ctx.fillStyle = k === d ? p.accent : p.surface;
        view.ctx.fill();
        view.ctx.strokeStyle = k === d ? p.accentStrong : p.lineStrong; view.ctx.stroke();
        V.text(view.ctx, "D" + k, hx + 24, by + 66, { align: "center", size: 11, mono: true, color: k === d ? p.accent : p.ink2 });
        V.text(view.ctx, ["0", "1", "2", "3"][k], hx + 24, by + 84, { align: "center", size: 10, mono: true, color: k === d ? p.accent : p.ink3 });
      }
      V.arrow(view.ctx, 164, 108, bx - 6, 108, { color: p.accent, head: 6 });
      var code = ["0", "0", "0", "0"]; code[d] = "1";
      V.text(view.ctx, "condition c = [" + code.join(",") + "] is given to both G and D", 18, 246,
        { size: 10.5, mono: true, color: p.ink2 });
      V.text(view.ctx, "worked: logits (0.1, 2.0, −0.5, 0.3) → p(d=1)=0.7070, CE=0.34666", 18, 266,
        { size: 10.5, mono: true, color: p.ink2 });
      V.text(view.ctx, "ILLUSTRATIVE · procedural image, no trained model", 18, 296,
        { size: 10, mono: true, color: p.warn });

      reads.set("target domain", domains[d]);
      reads.set("active D domain head", "D" + d + " (domain classifier)");
      reads.set("one-hot code", "[" + code.join(", ") + "]");
      reads.set("domain CE (worked)", d === 1 ? "0.34666 for these logits" : "see d=1 example");
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () { domainCtl.set(1, true); draw(); } };
  });

})(window.DL);
