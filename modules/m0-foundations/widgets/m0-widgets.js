/* ==========================================================================
   DeepLearn Lab — M0 widgets
   Registered ids must match docs/CONTENT_PLAN.md. Never rename an id.
   ========================================================================== */
(function (DL) {
  "use strict";

  var V = DL.viz, U = DL.ui, T = DL.tensor;

  /* ------------------------------------------------------------------ *
   * m0-01-neuron-playground — one neuron on the XOR plane
   * Exact: z = w1*x + w2*y + b, p = sigmoid(z), all computed live.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m0-01-neuron-playground", function (el) {
    var XOR = [
      { x: -1, y: -1, c: 0 }, { x: 1, y: 1, c: 0 },
      { x: -1, y: 1, c: 1 }, { x: 1, y: -1, c: 1 }
    ];

    var stage = U.stage();
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, { w: 560, h: 380, label: "XOR plane with a single neuron's decision boundary" });
    var ctx = view.ctx;

    var w1 = U.slider({ label: "w₁ (weight on x)", min: -3, max: 3, step: 0.05, value: 1, digits: 2, onInput: draw });
    var w2 = U.slider({ label: "w₂ (weight on y)", min: -3, max: 3, step: 0.05, value: 1, digits: 2, onInput: draw });
    var b = U.slider({ label: "b (bias)", min: -3, max: 3, step: 0.05, value: 0, digits: 2, onInput: draw });

    var reads = U.readouts(["accuracy", "best possible", "z at (1, 1)"]);
    stage.controls.appendChild(w1.el);
    stage.controls.appendChild(w2.el);
    stage.controls.appendChild(b.el);
    stage.controls.appendChild(reads.el);

    var probe = { x: 0.4, y: -0.6 };
    view.canvas.style.cursor = "crosshair";
    view.canvas.addEventListener("click", function (e) {
      var r = view.canvas.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      probe.x = -2 + px * 4;
      probe.y = 2 - py * 4;
      draw();
    });
    view.canvas.setAttribute("tabindex", "0");
    view.canvas.setAttribute("role", "application");
    view.canvas.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 0.2 : 0.05;
      if (e.key === "ArrowLeft") probe.x -= step;
      else if (e.key === "ArrowRight") probe.x += step;
      else if (e.key === "ArrowUp") probe.y += step;
      else if (e.key === "ArrowDown") probe.y -= step;
      else return;
      e.preventDefault();
      probe.x = DL.clamp(probe.x, -2, 2);
      probe.y = DL.clamp(probe.y, -2, 2);
      draw();
    });

    function sig(z) { return 1 / (1 + Math.exp(-z)); }

    function parseHex(h) {
      var m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim());
      if (!m) return null;
      var n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function blend(a, b, t) {
      var A = parseHex(a) || [255, 255, 255];
      var B = parseHex(b) || [0, 0, 0];
      return "rgb(" + Math.round(A[0] + (B[0] - A[0]) * t) + "," +
        Math.round(A[1] + (B[1] - A[1]) * t) + "," +
        Math.round(A[2] + (B[2] - A[2]) * t) + ")";
    }

    function draw() {
      var p = V.palette();
      var a = w1.value(), c = w2.value(), d = b.value();
      view.clear(p.surface);

      var pad = { l: 52, r: 18, t: 16, b: 38 };
      var r = { x: pad.l, y: pad.t, w: view.w - pad.l - pad.r, h: view.h - pad.t - pad.b };
      var sx = function (x) { return r.x + ((x + 2) / 4) * r.w; };
      var sy = function (y) { return r.y + r.h - ((y + 2) / 4) * r.h; };

      // probability field: 44 x 34 cells, blended against the surface so there are no seams
      var nx = 44, ny = 34;
      var cw = r.w / nx, ch = r.h / ny;
      for (var iy = 0; iy < ny; iy++) {
        for (var ix = 0; ix < nx; ix++) {
          var x0 = -2 + ((ix + 0.5) / nx) * 4;
          var y0 = 2 - ((iy + 0.5) / ny) * 4;
          var pr = sig(a * x0 + c * y0 + d);
          var strength = Math.abs(pr - 0.5) * 2;
          var tint = (pr >= 0.5 ? p.accent : p.ink3);
          ctx.fillStyle = blend(p.surface, tint, 0.06 + 0.50 * strength);
          ctx.fillRect(r.x + ix * cw - 0.4, r.y + iy * ch - 0.4, cw + 0.9, ch + 0.9);
        }
      }

      // boundary line: a*x + c*y + d = 0
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      if (Math.abs(c) > 1e-6) {
        var yAt = function (x) { return (-d - a * x) / c; };
        ctx.beginPath();
        ctx.moveTo(sx(-2), sy(yAt(-2)));
        ctx.lineTo(sx(2), sy(yAt(2)));
        ctx.strokeStyle = p.ink; ctx.lineWidth = 2; ctx.stroke();
      } else if (Math.abs(a) > 1e-6) {
        var xAt = -d / a;
        ctx.beginPath();
        ctx.moveTo(sx(xAt), sy(-2)); ctx.lineTo(sx(xAt), sy(2));
        ctx.strokeStyle = p.ink; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();

      // axes
      V.axes(ctx, r, {
        xmin: -2, xmax: 2, ymin: -2, ymax: 2, ticks: 4,
        grid: false, xlabel: "x₁", ylabel: "x₂"
      });

      // XOR points
      var correct = 0;
      XOR.forEach(function (q) {
        var pr = sig(a * q.x + c * q.y + d);
        var pred = pr >= 0.5 ? 1 : 0;
        if (pred === q.c) correct++;
        ctx.beginPath();
        ctx.arc(sx(q.x), sy(q.y), 7, 0, Math.PI * 2);
        ctx.fillStyle = q.c === 1 ? p.danger : p.ok;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = pred === q.c ? p.surface : p.ink;
        ctx.stroke();
        V.text(ctx, q.c === 1 ? "1" : "0", sx(q.x), sy(q.y) - 14,
          { align: "center", size: 10, mono: true, color: p.ink2 });
      });

      // probe
      var pz = a * probe.x + c * probe.y + d;
      var pp = sig(pz);
      var px = sx(probe.x), py = sy(probe.y);
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.bg; ctx.fill();
      ctx.strokeStyle = p.ink; ctx.lineWidth = 2; ctx.stroke();
      V.text(ctx, "z=" + DL.fmt(pz, 2) + "  p=" + DL.fmt(pp, 3), px + 9, py - 9,
        { size: 10, mono: true, color: p.ink2 });

      reads.set("accuracy", correct + " / 4");
      reads.set("best possible", "3 / 4");
      reads.set("z at (1, 1)", DL.fmt(a + c + d, 2));

      // legend
      V.legend(ctx, [
        { color: p.danger, label: "XOR label 1" },
        { color: p.ok, label: "XOR label 0" }
      ], { x: r.x + 8, y: r.y + 8 }, {});
    }

    document.addEventListener("dl:theme", draw);
    draw();

    return {
      reset: function () {
        w1.set(1, true); w2.set(1, true); b.set(0, true);
        probe = { x: 0.4, y: -0.6 };
        draw();
      }
    };
  });

  /* ------------------------------------------------------------------ *
   * m0-01-activation-explorer — f(x) and f'(x) for every activation
   * Exact: evaluated from DL.nn.act.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m0-01-activation-explorer", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, { w: 520, h: 300, label: "Activation function and its derivative" });
    var ctx = view.ctx;

    var which = U.select({
      label: "Activation",
      options: DL.nn.actList.map(function (k) { return { value: k, label: DL.nn.act[k].name }; }),
      value: "relu",
      onChange: draw
    });
    var xSlider = U.slider({
      label: "x", min: -4, max: 4, step: 0.05, value: 1.5, digits: 2,
      hint: "Arrow keys move the probe.", onInput: draw
    });
    var reads = U.readouts(["f(x)", "f′(x)", "f(1.5)", "f′(1.5)"]);

    stage.controls.appendChild(which.el);
    stage.controls.appendChild(xSlider.el);
    stage.controls.appendChild(reads.el);

    function draw() {
      var p = V.palette();
      var act = DL.nn.act[which.value()];
      var x = xSlider.value();
      var fx = act.f(x), dfx = act.df(x);

      view.clear(p.surface);
      var r = { x: 48, y: 16, w: view.w - 66, h: view.h - 52 };

      V.line(ctx, [
        { pts: sample(act.f), color: p.accent, width: 2.4 },
        { pts: sample(act.df), color: p.danger, width: 1.8, dash: [5, 4] }
      ], r, {
        xmin: -4, xmax: 4, ymin: -1.4, ymax: 3.2,
        xlabel: "x", ylabel: "y", grid: true
      });

      // zero lines
      var sx = function (t) { return r.x + ((t + 4) / 8) * r.w; };
      var sy = function (t) { return r.y + r.h - ((t + 1.4) / 4.6) * r.h; };
      V.dashedLine(ctx, r.x, sy(0), r.x + r.w, sy(0), { color: p.lineStrong, dash: [3, 3] });

      // probe
      ctx.beginPath();
      ctx.moveTo(sx(x), r.y); ctx.lineTo(sx(x), r.y + r.h);
      ctx.strokeStyle = p.lineStrong; ctx.lineWidth = 1; ctx.stroke();

      V.dot(ctx, sx(x), sy(fx), 4.5, p.accent);
      V.dot(ctx, sx(x), sy(dfx), 4.5, p.danger);

      V.legend(ctx, [
        { color: p.accent, label: act.name + "(x)" },
        { color: p.danger, label: "derivative" }
      ], { x: r.x + 10, y: r.y + 6 }, {});

      reads.set("f(x)", DL.fmt(fx, 3));
      reads.set("f′(x)", DL.fmt(dfx, 3));
      reads.set("f(1.5)", DL.fmt(act.f(1.5), 3));
      reads.set("f′(1.5)", DL.fmt(act.df(1.5), 3));
    }

    function sample(fn) {
      var pts = [];
      for (var i = 0; i <= 240; i++) {
        var t = -4 + (8 * i) / 240;
        var y = fn(t);
        if (!isFinite(y)) y = NaN;
        pts.push([t, Math.max(-2, Math.min(4, y))]);
      }
      return pts;
    }

    document.addEventListener("dl:theme", draw);
    draw();

    return {
      reset: function () { which.set("relu", true); xSlider.set(1.5, true); draw(); }
    };
  });

  /* ------------------------------------------------------------------ *
   * m0-02-backprop-stepper — a 2→3→1 graph with a live grad check
   * Exact: every value comes from DL.nn; maxRelError uses DL.nn.gradCheck.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m0-02-backprop-stepper", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);

    var x = [1, 2], target = 0.5;
    var eta = 0.1;
    var phase = 0, selected = "h1", model, opt, state, check = null;

    var phaseCtl = U.buttons({
      label: "Step",
      options: [
        { value: 0, label: "1 · Forward", hint: "Show activations" },
        { value: 1, label: "2 · Backward", hint: "Show gradients" },
        { value: 2, label: "3 · Grad check", hint: "Compare with finite differences" }
      ],
      value: 0,
      onChange: function (v) {
        phase = parseInt(v, 10);
        if (phase === 2) computeCheck();
        render();
      }
    });
    var etaCtl = U.slider({
      label: "η (learning rate)", min: 0.01, max: 0.3, step: 0.01, value: 0.1, digits: 2,
      onInput: function (v) { eta = v; }
    });
    var stepBtn = DL.el("button", {
      type: "button", class: "btn", text: "Take one gradient step",
      "aria-label": "Take one gradient descent step",
      on: { click: function () { doStep(); } }
    });
    var resetBtn = DL.el("button", {
      type: "button", class: "btn", text: "Reset weights",
      "aria-label": "Reset the network weights",
      on: { click: function () { reset(); } }
    });

    var net = DL.el("div", {
      class: "hstack",
      style: { flexWrap: "wrap", gap: "8px", justifyContent: "center", alignItems: "stretch" }
    });
    var detail = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var reads = U.readouts(["loss  L", "∂L/∂z₂", "maxRelError", "grad check", "L after step"]);

    var paramTable = U.table({
      columns: ["parameter", "analytic ∂L/∂θ", "numeric (central diff)"],
      rows: [],
      caption: "Analytic vs numerical gradients, all 13 parameters"
    });

    stage.controls.appendChild(phaseCtl.el);
    stage.controls.appendChild(etaCtl.el);
    stage.controls.appendChild(U.row(stepBtn, resetBtn));
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(net);
    stage.controls.appendChild(detail);
    stage.controls.appendChild(paramTable.el);

    var desc = {
      x1: { title: "input x₁", formula: "given input", f: function () { return x[0]; }, g: function () { return state.dx[0]; } },
      x2: { title: "input x₂", formula: "given input", f: function () { return x[1]; }, g: function () { return state.dx[1]; } },
      h1: { title: "hidden h₁ = ReLU(z₁)", formula: "ReLU(x·W₁[:,0] + b₁[0])", f: function () { return state.h[0]; }, g: function () { return state.dh[0]; } },
      h2: { title: "hidden h₂ = ReLU(z₁[1])", formula: "ReLU(x·W₁[:,1] + b₁[1])", f: function () { return state.h[1]; }, g: function () { return state.dh[1]; } },
      h3: { title: "hidden h₃ = ReLU(z₁[2])", formula: "ReLU(x·W₁[:,2] + b₁[2])", f: function () { return state.h[2]; }, g: function () { return state.dh[2]; } },
      z2: { title: "output logit ẑ", formula: "h·W₂ + b₂", f: function () { return state.out; }, g: function () { return state.dz2; } },
      L: { title: "loss L", formula: "(ŷ − y)²  (mean over N = 1)", f: function () { return state.loss; }, g: function () { return 1; } }
    };
    var nodes = {};

    function makeNode(key, label) {
      var a = DL.el("span", { class: "bp-val", text: "—" });
      var b = DL.el("span", { class: "bp-grad ui__hint", text: "" });
      var btn = DL.el("button", {
        type: "button", class: "btn bp-node",
        "aria-label": desc[key].title + ". Click to inspect this node.",
        on: { click: function () { selected = key; render(); } }
      }, [DL.el("span", { text: label }), a, b]);
      btn.style.minWidth = "78px";
      btn.style.flexDirection = "column";
      btn.style.alignItems = "flex-start";
      btn.style.textAlign = "left";
      btn.style.padding = "6px 8px";
      nodes[key] = { btn: btn, val: a, grad: b };
      return btn;
    }

    function column(title, keys, labels) {
      var col = DL.el("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } });
      col.appendChild(DL.el("p", { class: "ui__hint", text: title, style: { margin: "0", textAlign: "center" } }));
      keys.forEach(function (k, i) { col.appendChild(makeNode(k, labels[i])); });
      return col;
    }

    var arrow = function () {
      return DL.el("span", { "aria-hidden": "true", text: "→", style: { color: "var(--ink-3)", fontSize: "18px" } });
    };
    net.appendChild(column("input", ["x1", "x2"], ["x₁", "x₂"]));
    net.appendChild(arrow());
    net.appendChild(column("hidden · ReLU", ["h1", "h2", "h3"], ["h₁", "h₂", "h₃"]));
    net.appendChild(arrow());
    net.appendChild(column("output", ["z2"], ["ŷ"]));
    net.appendChild(arrow());
    net.appendChild(column("loss", ["L"], ["L"]));

    function build() {
      model = DL.nn.MLP([2, 3, 1], {
        activation: "relu", out: "linear", loss: "mse", init: "xavier", seed: 7
      });
      opt = DL.nn.opt.SGD({ lr: 0.1 });
      state = { lastLoss: null };
      check = null;
      recompute();
    }

    function recompute() {
      model.zeroGrad();
      var W1 = model.layers[0].W, b1 = model.layers[0].b;
      var W2 = model.layers[1].W;
      var z1 = [0, 1, 2].map(function (o) {
        return x[0] * W1[0][o] + x[1] * W1[1][o] + b1[o];
      });
      var h = z1.map(function (v) { return v > 0 ? v : 0; });
      var out = h[0] * W2[0][0] + h[1] * W2[1][0] + h[2] * W2[2][0] + model.layers[1].b[0];
      var loss = (out - target) * (out - target);

      var lr = model.lossAndGrad(x, target);   // recomputes forward, leaves caches
      model.backward(lr.gradOut);

      var dz2 = lr.gradOut[0];
      var dh = [0, 1, 2].map(function (o) { return W2[o][0] * dz2; });
      var dz1 = dh.map(function (v, o) { return v * (z1[o] > 0 ? 1 : 0); });
      var dx = [0, 1].map(function (i) {
        return W1[i][0] * dz1[0] + W1[i][1] * dz1[1] + W1[i][2] * dz1[2];
      });

      state = {
        z1: z1, h: h, out: out, loss: loss,
        dz2: dz2, dh: dh, dz1: dz1, dx: dx,
        lastLoss: state ? state.lastLoss : null
      };
    }

    function computeCheck() {
      check = DL.nn.gradCheck(function () {
        model.zeroGrad();
        var r = model.lossAndGrad(x, target);
        model.backward(r.gradOut);
        return r.loss;
      }, model.params(), { zeroGrad: function () { model.zeroGrad(); } });
      recompute();
    }

    function doStep() {
      opt.step(model.params());
      recompute();
      state.lastLoss = state.loss;
      if (phase === 2) computeCheck();
      render();
    }

    function reset() {
      build();
      phase = 0;
      phaseCtl.set(0, true);
      render();
    }

    function fmtNode(v) { return DL.fmt(v, 4); }

    function render() {
      Object.keys(nodes).forEach(function (k) {
        var n = nodes[k];
        n.val.textContent = fmtNode(desc[k].f());
        n.grad.textContent = phase > 0 ? "∇ " + fmtNode(desc[k].g()) : "";
        n.btn.setAttribute("aria-pressed", String(selected === k));
        n.btn.style.borderColor = selected === k ? "var(--accent)" : "";
      });

      var d = desc[selected];
      detail.innerHTML = "";
      detail.appendChild(DL.el("p", { class: "callout__title", text: d.title }));
      detail.appendChild(DL.el("p", { text: "Forward value: " + fmtNode(d.f()) + "  ·  " + d.formula }));
      detail.appendChild(DL.el("p", {
        text: phase > 0
          ? "Backward value ∂L/∂(this node): " + fmtNode(d.g())
          : "Advance to step 2 (Backward) to reveal the gradient at this node."
      }));

      reads.set("loss  L", DL.fmt(state.loss, 6));
      reads.set("∂L/∂z₂", DL.fmt(state.dz2, 6));
      reads.set("maxRelError", check ? DL.sci(check.maxRelError, 2) : "—");
      reads.set("grad check", check ? (check.pass ? "PASS" : "FAIL") : "not run");
      reads.set("L after step", state.lastLoss === null ? "—" : DL.fmt(state.lastLoss, 6));

      if (check) {
        var labels = [];
        ["W₁[:,0]", "W₁[:,1]", "W₁[:,2]", "W₁[1,0]", "W₁[1,1]", "W₁[1,2]",
          "b₁[0]", "b₁[1]", "b₁[2]", "W₂[0]", "W₂[1]", "W₂[2]", "b₂"].forEach(function (s) { labels.push(s); });
        var rows = check.analytic.map(function (a, i) {
          return [labels[i] || ("θ" + i), DL.fmt(a, 6), DL.fmt(check.numeric[i], 6)];
        });
        paramTable.update(rows);
        paramTable.el.hidden = phase < 2;
      } else {
        paramTable.el.hidden = true;
      }
    }

    build();
    render();
    return { reset: reset };
  });

  /* ------------------------------------------------------------------ *
   * m0-03-optimizer-race — five optimizers, three loss surfaces
   * Exact: all gradients, optimizer states, trajectories and losses are computed live.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m0-03-optimizer-race", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, { w: 540, h: 340, label: "Loss surface with five optimizer trajectories" });
    var lossView = V.canvas(stage.canvasWrap, { w: 540, h: 190, label: "Loss versus step for five optimizers" });
    var ctx = view.ctx, lctx = lossView.ctx;

    var surfaces = {
      quadratic: {
        label: "Quadratic bowl · L = ½(θ₁² + θ₂²)",
        fn: function (a, b) { return 0.5 * (a * a + b * b); },
        grad: function (a, b) { return [a, b]; },
        start: [1.6, 1.2], lr: 0.02,
        xmin: -2, xmax: 2, ymin: -2, ymax: 2
      },
      ravine: {
        label: "Ravine · L = ½(θ₁² + 100 θ₂²)",
        fn: function (a, b) { return 0.5 * (a * a + 100 * b * b); },
        grad: function (a, b) { return [a, 100 * b]; },
        start: [1.6, 0.22], lr: 0.002,
        xmin: -2, xmax: 2, ymin: -0.3, ymax: 0.3
      },
      saddle: {
        label: "Saddle · L = ½(θ₁² − θ₂²), no minimum",
        fn: function (a, b) { return 0.5 * (a * a - b * b); },
        grad: function (a, b) { return [a, -b]; },
        start: [1.2, 0.12], lr: 0.02,
        xmin: -2, xmax: 2, ymin: -2, ymax: 2
      }
    };
    var names = ["SGD", "Momentum", "RMSProp", "Adam", "AdamW"];
    var pal = V.palette();
    var colors = [pal.accent, pal.danger, pal.ok, pal.warn, "#8b5cf6"];
    var current = "quadratic", lr = 0.02, racers = [], trainer, play;

    var surfaceSel = U.select({
      label: "Loss surface", ariaLabel: "Loss surface",
      options: Object.keys(surfaces).map(function (k) { return { value: k, label: surfaces[k].label }; }),
      value: current,
      onChange: function (v) {
        current = v;
        lr = surfaces[current].lr;
        lrCtl.set(lr, true);
        reset();
      }
    });
    var lrCtl = U.slider({
      label: "η (learning rate)", min: 0.001, max: 0.05, step: 0.001, value: lr, digits: 3,
      hint: "Changing η restarts the race from the same point.",
      onInput: function (v) { lr = v; reset(); }
    });
    var reads = U.readouts(["step"].concat(names));
    stage.controls.appendChild(surfaceSel.el);
    stage.controls.appendChild(lrCtl.el);
    stage.controls.appendChild(reads.el);

    function makeOpt(name, rate) {
      if (name === "SGD") return DL.nn.opt.SGD({ lr: rate });
      if (name === "Momentum") return DL.nn.opt.Momentum({ lr: rate, momentum: 0.9 });
      if (name === "RMSProp") return DL.nn.opt.RMSProp({ lr: rate, rho: 0.9 });
      if (name === "Adam") return DL.nn.opt.Adam({ lr: rate });
      return DL.nn.opt.AdamW({ lr: rate, weightDecay: 0.02 });
    }

    function reset() {
      if (trainer) trainer.pause().reset();
      var s = surfaces[current], start = s.start;
      racers = names.map(function (name, i) {
        return {
          name: name, color: colors[i],
          params: [{ v: [start[0], start[1]], g: [0, 0] }],
          opt: makeOpt(name, lr), path: [[start[0], start[1]]], losses: [],
          loss: s.fn(start[0], start[1]), dead: false,
          read: reads.get(name)
        };
      });
      reads.set("step", "0");
      racers.forEach(function (r) { if (r.read) r.read.set(DL.fmt(r.loss, 4)); });
      if (play) play.setRunning(false);
      draw();
    }

    function onStep(step) {
      var s = surfaces[current];
      racers.forEach(function (r) {
        var v = r.params[0].v;
        var g = s.grad(v[0], v[1]);
        r.params[0].g[0] = g[0]; r.params[0].g[1] = g[1];
        r.opt.step(r.params);
        var a = v[0], b = v[1];
        if (!isFinite(a) || !isFinite(b)) {
          r.dead = true;
          a = DL.clamp(isFinite(a) ? a : 0, s.xmin, s.xmax);
          b = DL.clamp(isFinite(b) ? b : 0, s.ymin, s.ymax);
          v[0] = a; v[1] = b;
        }
        r.path.push([a, b]);
        if (r.path.length > 900) r.path.shift();
        r.loss = s.fn(a, b);
        r.losses.push(Math.min(r.loss, 20));
        if (r.losses.length > 900) r.losses.shift();
        if (r.read) r.read.set(r.dead ? "diverged" : DL.fmt(r.loss, 4));
      });
      reads.set("step", String(step));
    }

    function draw() {
      var p = V.palette();
      var s = surfaces[current];
      view.clear(p.surface);
      var r = { x: 48, y: 14, w: view.w - 62, h: view.h - 56 };
      var nx = 48, ny = 34, M = [];
      var vmax = Math.log1p(Math.max(4, s.fn(s.xmin, s.ymin), s.fn(s.xmax, s.ymax)));
      for (var j = 0; j < ny; j++) {
        var row = [];
        var yy = s.ymax - (j + 0.5) * (s.ymax - s.ymin) / ny;
        for (var i = 0; i < nx; i++) {
          var xx = s.xmin + (i + 0.5) * (s.xmax - s.xmin) / nx;
          var L = Math.max(0, s.fn(xx, yy));
          row.push(Math.log1p(L));
        }
        M.push(row);
      }
      V.heatmap(ctx, M, r, { cmap: "viridis", vmin: 0, vmax: vmax, border: false });
      V.axes(ctx, r, {
        xmin: s.xmin, xmax: s.xmax, ymin: s.ymin, ymax: s.ymax,
        grid: false, ticks: 4, xlabel: "θ₁", ylabel: "θ₂"
      });

      var sx = function (t) { return r.x + ((t - s.xmin) / (s.xmax - s.xmin)) * r.w; };
      var sy = function (t) { return r.y + r.h - ((t - s.ymin) / (s.ymax - s.ymin)) * r.h; };
      if (s.xmin < 0 && s.xmax > 0) V.dashedLine(ctx, sx(0), r.y, sx(0), r.y + r.h, { color: p.surface, dash: [3, 3], width: 1.2 });
      if (s.ymin < 0 && s.ymax > 0) V.dashedLine(ctx, r.x, sy(0), r.x + r.w, sy(0), { color: p.surface, dash: [3, 3], width: 1.2 });

      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      racers.forEach(function (q) {
        if (q.path.length < 2) return;
        ctx.beginPath();
        q.path.forEach(function (pt, i) {
          var px = sx(DL.clamp(pt[0], s.xmin, s.xmax));
          var py = sy(DL.clamp(pt[1], s.ymin, s.ymax));
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = q.color; ctx.lineWidth = 2.2; ctx.stroke();
        var last = q.path[q.path.length - 1];
        V.dot(ctx, sx(DL.clamp(last[0], s.xmin, s.xmax)), sy(DL.clamp(last[1], s.ymin, s.ymax)), 4, q.color);
      });
      ctx.restore();
      V.legend(ctx, racers.map(function (q) { return { color: q.color, label: q.name }; }),
        { x: r.x + 6, y: r.y + 6 }, { lh: 13 });
    }

    function drawLoss() {
      var p = V.palette();
      lossView.clear(p.surface);
      var r = { x: 48, y: 12, w: lossView.w - 62, h: lossView.h - 46 };
      var series = racers.filter(function (q) { return q.losses.length > 1; }).map(function (q) {
        return {
          pts: q.losses.map(function (v, i) { return [i + 1, v]; }),
          color: q.color, width: 1.8, label: q.name
        };
      });
      V.line(lctx, series, r, {
        xmin: 1, xmax: Math.max(120, trainer ? trainer.state.step : 1),
        ymin: 0, ymax: 8, grid: true, xlabel: "step", ylabel: "loss (clipped at 8)"
      });
    }

    play = U.playback({
      started: false, speeds: [1, 4, 12, 40],
      onToggle: function (running) { if (running) trainer.start(); else trainer.pause(); },
      onReset: function () { reset(); },
      onSpeed: function (v) { trainer.setSpeed(v); }
    });
    stage.controls.insertBefore(play.el, stage.controls.firstChild);

    trainer = DL.trainer({
      steps: 600, speed: 1,
      onStep: onStep,
      onFrame: function (step, done) {
        draw(); drawLoss();
        if (done) play.setRunning(false);
      }
    });

    reset();
    return {
      reset: reset,
      pause: function () { trainer.pause(); play.setRunning(false); }
    };
  });

  /* ------------------------------------------------------------------ *
   * m0-04-mlp-trainer — flagship toy-data MLP lab
   * Exact: DL.nn.MLP + DL.nn.gridPredict; all curves are measured values.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m0-04-mlp-trainer", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var bview = V.canvas(stage.canvasWrap, { w: 520, h: 370, label: "Live decision boundary on a 2-D toy dataset" });
    var lview = V.canvas(stage.canvasWrap, { w: 520, h: 190, label: "Training and validation loss curves" });
    var bctx = bview.ctx, lctx = lview.ctx;

    var dsCtl = U.select({
      label: "Dataset", ariaLabel: "Toy dataset",
      options: ["blobs", "moons", "spiral", "xor"].map(function (k) {
        return { value: k, label: k.charAt(0).toUpperCase() + k.slice(1) };
      }),
      value: "blobs", onChange: rebuild
    });
    var depthCtl = U.slider({ label: "Hidden layers", min: 1, max: 4, step: 1, value: 2, digits: 0, onInput: rebuild });
    var widthCtl = U.slider({ label: "Units per layer", min: 4, max: 24, step: 2, value: 12, digits: 0, onInput: rebuild });
    var actCtl = U.select({
      label: "Activation", ariaLabel: "Hidden activation",
      options: ["relu", "tanh", "gelu", "sigmoid"].map(function (k) {
        return { value: k, label: DL.nn.act[k].name };
      }),
      value: "relu", onChange: rebuild
    });
    var initCtl = U.select({
      label: "Initialization", ariaLabel: "Weight initialization",
      options: [
        { value: "he", label: "He · N(0, 2/fan-in)" },
        { value: "xavier", label: "Xavier · N(0, 2/(fin+fout))" },
        { value: "naive", label: "Naive · N(0, 1)" },
        { value: "zeros", label: "Zeros · all weights 0" }
      ],
      value: "he", onChange: rebuild
    });
    var lrCtl = U.slider({ label: "η (learning rate)", min: 0.001, max: 0.1, step: 0.001, value: 0.02, digits: 3, onInput: rebuild });

    var reads = U.readouts(["step", "train loss", "val loss", "train acc", "val acc", "params"]);
    stage.controls.appendChild(dsCtl.el);
    stage.controls.appendChild(depthCtl.el);
    stage.controls.appendChild(widthCtl.el);
    stage.controls.appendChild(actCtl.el);
    stage.controls.appendChild(initCtl.el);
    stage.controls.appendChild(lrCtl.el);
    stage.controls.appendChild(reads.el);

    var play = U.playback({
      started: false, speeds: [1, 4, 12, 40],
      onToggle: function (on) { if (on) trainer.start(); else trainer.pause(); },
      onReset: function () { rebuild(); },
      onSpeed: function (v) { trainer.setSpeed(v); }
    });
    stage.controls.insertBefore(play.el, stage.controls.firstChild);

    var rect = { xmin: -2, xmax: 2, ymin: -2, ymax: 2 };
    var model, opt, Xtr, ytr, Xva, yva, classes, history, boundary, dataRng, trainRng, trainer;
    var nClasses = 2, lastEval = null;

    function rebuild() {
      if (trainer) trainer.pause().reset();
      dataRng = DL.rng(11);
      var ds = DL.nn.datasets[dsCtl.value()](240, dataRng);
      nClasses = ds.classes || 2;
      var order = DL.range(ds.X.length);
      for (var i = order.length - 1; i > 0; i--) {
        var j = Math.floor(dataRng() * (i + 1));
        var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
      }
      var cut = Math.floor(order.length * 0.7);
      Xtr = order.slice(0, cut).map(function (k) { return ds.X[k]; });
      ytr = order.slice(0, cut).map(function (k) { return ds.y[k]; });
      Xva = order.slice(cut).map(function (k) { return ds.X[k]; });
      yva = order.slice(cut).map(function (k) { return ds.y[k]; });
      classes = ds.X.map(function (p, k) { return { x: p[0], y: p[1], c: ds.y[k] }; });

      var sizes = [2];
      for (var h = 0; h < depthCtl.value(); h++) sizes.push(widthCtl.value());
      sizes.push(nClasses);
      model = DL.nn.MLP(sizes, {
        activation: actCtl.value(), out: "linear", loss: "ce",
        init: initCtl.value(), seed: 23
      });
      opt = DL.nn.opt.Adam({ lr: lrCtl.value() });
      trainRng = DL.rng(77);
      history = [];
      lastEval = null;
      reads.set("params", String(model.countParams()));
      reads.set("step", "0");
      refreshBoundary();
      evaluateAndShow(0);
      play.setRunning(false);
      draw();
    }

    function refreshBoundary() {
      boundary = DL.nn.gridPredict(model, rect, 36);
    }

    function evaluateAndShow(step) {
      var a = model.evaluate(Xtr, ytr);
      var b = model.evaluate(Xva, yva);
      lastEval = { step: step, tr: a.loss, va: b.loss, acc: a.acc, vacc: b.acc };
      history.push({ step: step, tr: a.loss, va: b.loss });
      if (history.length > 400) history.shift();
      reads.set("train loss", DL.fmt(a.loss, 4));
      reads.set("val loss", DL.fmt(b.loss, 4));
      reads.set("train acc", DL.pct(a.acc, 0));
      reads.set("val acc", DL.pct(b.acc, 0));
    }

    function onStep(step) {
      var bx = [], by = [], n = Xtr.length;
      for (var k = 0; k < 24; k++) {
        var idx = Math.floor(trainRng() * n);
        bx.push(Xtr[idx]); by.push(ytr[idx]);
      }
      model.fitBatch(bx, by);
      opt.step(model.params());
      if (step === 1 || step % 8 === 0) evaluateAndShow(step);
      if (step === 1 || step % 16 === 0) refreshBoundary();
      reads.set("step", String(step));
    }

    function draw() {
      var p = V.palette();
      bview.clear(p.surface);
      var r = { x: 46, y: 12, w: bview.w - 60, h: bview.h - 48 };
      if (boundary) {
        if (nClasses === 2) {
          V.heatmap(bctx, boundary.values, r, { cmap: "coolwarm", vmin: 0, vmax: 1, border: false });
        } else {
          V.heatmap(bctx, boundary.classes, r, {
            cmap: "viridis", vmin: -0.5, vmax: nClasses - 0.5, border: false
          });
        }
      }
      V.axes(bctx, r, {
        xmin: rect.xmin, xmax: rect.xmax, ymin: rect.ymin, ymax: rect.ymax,
        grid: false, ticks: 4, xlabel: "x₁", ylabel: "x₂"
      });
      var sx = function (t) { return r.x + ((t - rect.xmin) / (rect.xmax - rect.xmin)) * r.w; };
      var sy = function (t) { return r.y + r.h - ((t - rect.ymin) / (rect.ymax - rect.ymin)) * r.h; };
      bctx.save();
      bctx.beginPath(); bctx.rect(r.x, r.y, r.w, r.h); bctx.clip();
      classes.forEach(function (q) {
        bctx.beginPath();
        bctx.arc(sx(q.x), sy(q.y), 3.1, 0, Math.PI * 2);
        bctx.fillStyle = [p.accent, p.danger, p.ok][q.c % 3];
        bctx.fill();
      });
      bctx.restore();
      V.text(bctx, dsCtl.value() + " · " + depthCtl.value() + "×" + widthCtl.value() + " · " + actCtl.value(),
        r.x + 6, r.y + 14, { size: 10, mono: true, color: p.ink2 });

      lview.clear(p.surface);
      var lr = { x: 46, y: 12, w: lview.w - 60, h: lview.h - 46 };
      var series = [
        { pts: history.map(function (h) { return [h.step, h.tr]; }), color: p.accent, width: 2, label: "train" },
        { pts: history.map(function (h) { return [h.step, h.va]; }), color: p.danger, width: 2, label: "val" }
      ];
      V.line(lctx, series, lr, {
        xmin: 0, xmax: Math.max(80, trainer ? trainer.state.step : 0),
        ymin: 0, ymax: Math.max(1.2, lastEval ? Math.max(lastEval.tr, lastEval.va) : 1.2),
        grid: true, xlabel: "step", ylabel: "cross-entropy"
      });
      V.legend(lctx, [
        { color: p.accent, label: "train loss" }, { color: p.danger, label: "validation loss" }
      ], { x: lr.x + 8, y: lr.y + 7 }, { lh: 13 });
    }

    trainer = DL.trainer({
      steps: 1200, speed: 1,
      onStep: onStep,
      onFrame: function (step, done) {
        draw();
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
   * m0-04-init-explorer — ten layers, five initialization schemes
   * Exact: weights from DL.nn.init; histograms/stds computed from forward passes.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m0-04-init-explorer", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var hview = V.canvas(stage.canvasWrap, { w: 520, h: 250, label: "Layer-10 activation histogram" });
    var sview = V.canvas(stage.canvasWrap, { w: 520, h: 150, label: "Activation standard deviation by layer (log scale)" });

    var schemes = [
      { key: "zeros", label: "Zeros · W = 0", theory: 0 },
      { key: "naive01", label: "Naive σ = 0.01", theory: Math.sqrt(64 * 0.0001) },
      { key: "naive10", label: "Naive σ = 10", theory: Math.sqrt(64 * 100) },
      { key: "xavier", label: "Xavier · N(0, 2/128)", theory: Math.sqrt(64 * 2 / 128) },
      { key: "he", label: "He · N(0, 2/64)", theory: Math.sqrt(64 * 2 / 64) }
    ];
    var schemeSel = U.select({
      label: "Scheme", ariaLabel: "Initialization scheme",
      options: schemes.map(function (s) { return { value: s.key, label: s.label }; }),
      value: "he", onChange: draw
    });
    var actSel = U.select({
      label: "Activation", ariaLabel: "Activation for all ten layers",
      options: [
        { value: "relu", label: "ReLU" }, { value: "tanh", label: "Tanh" }, { value: "sigmoid", label: "Sigmoid" }
      ],
      value: "relu", onChange: draw
    });
    var reads = U.readouts(["std at layer 10", "theory std", "alive at layer 10", "std at layer 1"]);
    var table = U.table({
      columns: ["scheme", "std @ layer 10", "alive", "state"],
      rows: [],
      caption: "All five schemes, depth 10 · width 64"
    });
    stage.controls.appendChild(schemeSel.el);
    stage.controls.appendChild(actSel.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(table.el);

    function weight(scheme, rng, fin, fout) {
      if (scheme === "zeros") return 0;
      if (scheme === "naive01") return DL.randn(rng) * 0.01;
      if (scheme === "naive10") return DL.randn(rng) * 10;
      if (scheme === "xavier") return DL.nn.init.xavier(rng, fin, fout);
      return DL.nn.init.he(rng, fin);
    }

    function propagate(scheme, act) {
      var rng = DL.rng(2024), a = [], i, o;
      for (i = 0; i < 64; i++) a.push(DL.randn(rng));
      var stds = [DL.std(a)], zLast = [];
      for (var l = 1; l <= 10; l++) {
        var W = DL.tensor.zeros(64, 64);
        for (i = 0; i < 64; i++) {
          for (o = 0; o < 64; o++) W[i][o] = weight(scheme, rng, 64, 64);
        }
        var next = new Array(64), zz = new Array(64);
        for (o = 0; o < 64; o++) {
          var s = 0;
          for (i = 0; i < 64; i++) s += a[i] * W[i][o];
          zz[o] = s;
          next[o] = act.f(s);
        }
        a = next; zLast = zz;
        stds.push(DL.std(a));
      }
      var alive = a.filter(function (v) { return Math.abs(v) > 1e-12; }).length / a.length;
      var sat = zLast.filter(function (v) { return Math.abs(v) > 4; }).length / zLast.length;
      return { values: a, stds: stds, alive: alive, sat: sat, mean: DL.mean(a) };
    }

    function draw() {
      var p = V.palette();
      var act = DL.nn.act[actSel.value()];
      var results = {};
      schemes.forEach(function (s) { results[s.key] = propagate(s.key, act); });
      var chosen = schemeSel.value(), r = results[chosen];

      hview.clear(p.surface);
      V.histogram(hview.ctx, r.values, { x: 44, y: 12, w: hview.w - 60, h: hview.h - 48 }, {
        bins: 26, cmap: "accent"
      });
      V.text(hview.ctx, "layer 10 activations · " + act.name + " · " + schemeSel.value(),
        48, 22, { size: 10, mono: true, color: p.ink2 });

      sview.clear(p.surface);
      var bars = r.stds.slice(1).map(function (v) { return Math.log10(1 + Math.abs(v)); });
      V.bars(sview.ctx, bars, { x: 44, y: 10, w: sview.w - 60, h: sview.h - 44 }, {
        labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        values: false, cmap: "viridis"
      });
      V.text(sview.ctx, "log₁₀(1 + std) per layer", 48, 22,
        { size: 10, mono: true, color: p.ink2 });

      table.update(schemes.map(function (s) {
        var z = results[s.key];
        var state = z.alive < 0.05 ? "dead" : (z.std > 50 ? "exploding" : (z.std < 0.01 ? "vanishing" : "healthy"));
        return [s.label, DL.fmt(z.std, 4), DL.pct(z.alive, 1), state];
      }));

      var selectedScheme = schemes.filter(function (s) { return s.key === chosen; })[0];
      reads.set("std at layer 10", DL.fmt(r.std, 4));
      reads.set("theory std", DL.fmt(selectedScheme.theory, 4));
      reads.set("alive at layer 10", DL.pct(r.alive, 1));
      reads.set("std at layer 1", DL.fmt(r.stds[1], 4));
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () { schemeSel.set("he", true); actSel.set("relu", true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m0-05-shape-tracer — pick layers, see shapes and parameter counts
   * Exact: DL.tensor.outSize + DL.nn.convParams / fcParams.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m0-05-shape-tracer", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var nCtl = U.slider({ label: "Batch size N", min: 1, max: 8, step: 1, value: 2, digits: 0, onInput: draw });
    var cCtl = U.select({
      label: "Input channels C", ariaLabel: "Input channels",
      options: [1, 3, 16].map(function (v) { return { value: String(v), label: String(v) }; }),
      value: "3", onChange: draw
    });
    var hwCtl = U.select({
      label: "Input H = W", ariaLabel: "Input height and width",
      options: [8, 16, 32, 64].map(function (v) { return { value: String(v), label: String(v) }; }),
      value: "32", onChange: draw
    });
    var kindCtl = U.select({
      label: "Layer to add", ariaLabel: "Layer type to add",
      options: [
        { value: "conv", label: "Conv2d" }, { value: "relu", label: "ReLU" },
        { value: "pool", label: "Pool" }, { value: "flatten", label: "Flatten" },
        { value: "linear", label: "Linear / Dense" }
      ],
      value: "conv", onChange: sync
    });
    var coutCtl = U.slider({ label: "Conv out channels C_out", min: 2, max: 32, step: 2, value: 8, digits: 0, onInput: draw });
    var kCtl = U.select({
      label: "Kernel K", ariaLabel: "Kernel size",
      options: [1, 2, 3, 5].map(function (v) { return { value: String(v), label: String(v) }; }),
      value: "3", onChange: draw
    });
    var pCtl = U.slider({ label: "Padding P", min: 0, max: 2, step: 1, value: 1, digits: 0, onInput: draw });
    var sCtl = U.slider({ label: "Stride S", min: 1, max: 3, step: 1, value: 1, digits: 0, onInput: draw });
    var modeCtl = U.select({
      label: "Pool mode", ariaLabel: "Pooling mode",
      options: [{ value: "max", label: "max" }, { value: "avg", label: "avg" }],
      value: "max", onChange: draw
    });
    var outCtl = U.slider({ label: "Linear output D_out", min: 2, max: 64, step: 2, value: 10, digits: 0, onInput: draw });

    var addBtn = DL.el("button", {
      type: "button", class: "btn btn--accent", text: "Add layer",
      "aria-label": "Add the selected layer to the stack",
      on: { click: addLayer }
    });
    var clearBtn = DL.el("button", {
      type: "button", class: "btn", text: "Clear stack",
      "aria-label": "Remove all layers from the stack",
      on: { click: function () { stack = []; renderStack(); draw(); } }
    });
    var reads = U.readouts(["final shape", "total parameters"]);
    var formulaBox = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var chipWrap = DL.el("div", { class: "hstack", style: { flexWrap: "wrap", gap: "6px" } });
    var table = U.table({
      columns: ["#", "layer", "output shape", "parameters", "arithmetic"],
      rows: [], caption: "Forward pass, computed layer by layer"
    });

    stage.controls.appendChild(nCtl.el);
    stage.controls.appendChild(cCtl.el);
    stage.controls.appendChild(hwCtl.el);
    stage.controls.appendChild(kindCtl.el);
    stage.controls.appendChild(coutCtl.el);
    stage.controls.appendChild(kCtl.el);
    stage.controls.appendChild(pCtl.el);
    stage.controls.appendChild(sCtl.el);
    stage.controls.appendChild(modeCtl.el);
    stage.controls.appendChild(outCtl.el);
    stage.controls.appendChild(U.row(addBtn, clearBtn));
    stage.controls.appendChild(chipWrap);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(formulaBox);
    stage.controls.appendChild(table.el);

    var stack = [
      { kind: "conv", cout: 8, k: 3, p: 1, s: 1 },
      { kind: "relu" },
      { kind: "pool", k: 2, s: 2, mode: "max" },
      { kind: "flatten" },
      { kind: "linear", out: 10 }
    ];

    function sync() {
      var k = kindCtl.value();
      coutCtl.el.hidden = k !== "conv";
      pCtl.el.hidden = k !== "conv";
      kCtl.el.hidden = k === "relu" || k === "flatten" || k === "linear";
      sCtl.el.hidden = k !== "conv" && k !== "pool";
      modeCtl.el.hidden = k !== "pool";
      outCtl.el.hidden = k !== "linear";
      if (k === "pool") sCtl.set(2, true);
      if (k === "conv") sCtl.set(1, true);
    }

    function addLayer() {
      var k = kindCtl.value();
      if (k === "conv") {
        stack.push({ kind: "conv", cout: coutCtl.value(), k: parseInt(kCtl.value(), 10), p: pCtl.value(), s: sCtl.value() });
      } else if (k === "pool") {
        stack.push({ kind: "pool", k: parseInt(kCtl.value(), 10), s: sCtl.value(), mode: modeCtl.value() });
      } else if (k === "linear") {
        stack.push({ kind: "linear", out: outCtl.value() });
      } else {
        stack.push({ kind: k });
      }
      if (stack.length > 14) stack.shift();
      renderStack();
      draw();
    }

    function renderStack() {
      chipWrap.innerHTML = "";
      if (!stack.length) {
        chipWrap.appendChild(DL.el("span", { class: "ui__hint", text: "No layers yet — add one above." }));
        return;
      }
      stack.forEach(function (L, i) {
        var label = L.kind === "conv" ? "Conv2d " + L.cout + " k" + L.k + " p" + L.p + " s" + L.s
          : L.kind === "pool" ? L.mode + "Pool k" + L.k + " s" + L.s
            : L.kind === "linear" ? "Linear → " + L.out
              : L.kind.charAt(0).toUpperCase() + L.kind.slice(1);
        var btn = DL.el("button", {
          type: "button", class: "btn", title: "Remove this layer",
          "aria-label": "Remove layer " + (i + 1) + ": " + label,
          on: { click: function () { stack.splice(i, 1); renderStack(); draw(); } }
        }, [DL.el("span", { text: (i + 1) + " · " + label }), DL.el("span", { text: " ×", style: { color: "var(--danger)" } })]);
        chipWrap.appendChild(btn);
      });
    }

    function shapeStr(s) { return "(" + s.join(", ") + ")"; }

    function draw() {
      var shape = [nCtl.value(), parseInt(cCtl.value(), 10), parseInt(hwCtl.value(), 10), parseInt(hwCtl.value(), 10)];
      var rows = [], total = 0, formula = "", bad = false;

      stack.forEach(function (L, idx) {
        if (bad) return;
        var name = "", params = 0, out = shape, arith = "identity";
        if (L.kind === "conv") {
          var cin = shape[1];
          params = DL.nn.convParams(cin, L.cout, L.k, true);
          var ho = DL.tensor.outSize(shape[2], L.k, L.s, L.p, 1);
          var wo = DL.tensor.outSize(shape[3], L.k, L.s, L.p, 1);
          out = [shape[0], L.cout, ho, wo];
          arith = "H′=⌊(" + shape[2] + "+2·" + L.p + "−(" + L.k + "−1)−1)/" + L.s + "⌋+1=" + ho;
          name = "Conv2d " + cin + "→" + L.cout;
          formula = "Conv2d " + cin + "→" + L.cout + ": " + arith + ";  params = K²·C_in·C_out + C_out = "
            + L.k + "²·" + cin + "·" + L.cout + " + " + L.cout + " = " + params;
        } else if (L.kind === "relu") {
          name = "ReLU"; out = shape.slice(); arith = "no shape change";
        } else if (L.kind === "pool") {
          var ho2 = DL.tensor.outSize(shape[2], L.k, L.s, 0, 1);
          var wo2 = DL.tensor.outSize(shape[3], L.k, L.s, 0, 1);
          out = [shape[0], shape[1], ho2, wo2];
          arith = "H′=⌊(" + shape[2] + "+0−(" + L.k + "−1)−1)/" + L.s + "⌋+1=" + ho2;
          name = L.mode + "Pool k" + L.k + " s" + L.s;
          formula = name + ": " + arith;
        } else if (L.kind === "flatten") {
          if (shape.length === 4) {
            out = [shape[0], shape[1] * shape[2] * shape[3]];
            arith = "C·H·W = " + shape[1] + "·" + shape[2] + "·" + shape[3] + " = " + out[1];
            name = "Flatten";
          } else {
            name = "Flatten (already flat)"; arith = "no change";
          }
        } else if (L.kind === "linear") {
          if (shape.length !== 2) {
            rows.push([idx + 1, "Linear → " + L.out, "ERROR: expected (N,D)", "—", "Insert Flatten before Linear"]);
            bad = true;
            return;
          }
          params = DL.nn.fcParams(shape[1], L.out, true);
          out = [shape[0], L.out];
          arith = "(" + shape[0] + "×" + shape[1] + ")·(" + shape[1] + "×" + L.out + ")";
          name = "Linear " + shape[1] + "→" + L.out;
          formula = name + ": params = D_in·D_out + D_out = " + shape[1] + "·" + L.out + " + " + L.out + " = " + params;
        }
        rows.push([idx + 1, name, shapeStr(out), String(params), arith]);
        total += params;
        shape = out;
      });

      if (!bad) rows.push(["", "TOTAL", shapeStr(shape), DL.nn.formatCount(total), "sum of all layers"]);
      table.update(rows);
      reads.set("final shape", bad ? "shape error" : shapeStr(shape));
      reads.set("total parameters", bad ? "—" : DL.nn.formatCount(total));
      formulaBox.textContent = formula || "Add a Conv2d or Pool layer to see the substituted output-size formula.";
    }

    sync();
    renderStack();
    draw();
    return { reset: function () {
      nCtl.set(2, true); cCtl.set("3", true); hwCtl.set("32", true);
      stack = [
        { kind: "conv", cout: 8, k: 3, p: 1, s: 1 },
        { kind: "relu" }, { kind: "pool", k: 2, s: 2, mode: "max" },
        { kind: "flatten" }, { kind: "linear", out: 10 }
      ];
      kindCtl.set("conv", true); sync(); renderStack(); draw();
    } };
  });

})(window.DL);
