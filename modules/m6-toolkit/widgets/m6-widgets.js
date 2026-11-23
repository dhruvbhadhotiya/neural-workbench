/* ==========================================================================
   DeepLearn Lab — M6 widgets
   Registered ids must match docs/CONTENT_PLAN.md. Never rename an id.
   Badges are promises: "exact" widgets compute what they display.
   ========================================================================== */
(function (DL) {
  "use strict";

  var V = DL.viz, U = DL.ui;

  function hex32(n) {
    var s = (n >>> 0).toString(16).toUpperCase();
    while (s.length < 8) s = "0" + s;
    return s;
  }

  /* ------------------------------------------------------------------ *
   * m6-01-seed-lab — stated distribution + exact determinism audit
   * ------------------------------------------------------------------ */
  DL.widgets.register("m6-01-seed-lab", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, {
      w: 470, h: 250,
      label: "Histogram of final accuracies sampled from the stated normal distribution"
    });
    var ctx = view.ctx;

    var seedCtl = U.slider({
      label: "Seed", min: 0, max: 999, step: 1, value: 42, digits: 0,
      hint: "Same seed → same sampled values.", onInput: draw
    });
    var sCtl = U.slider({
      label: "Number of seeds S", min: 3, max: 30, step: 1, value: 9, digits: 0,
      onInput: draw
    });

    var configId = DL.uid("cfg");
    var configInput = DL.el("input", {
      type: "text", class: "ui__select", id: configId,
      value: '{"lr":0.001,"arch":"mlp-256"}',
      "aria-label": "Canonical configuration string to hash"
    });
    configInput.addEventListener("input", draw);
    var configWrap = DL.el("div", { class: "ui" }, [
      DL.el("label", { class: "ui__label", for: configId }, [
        DL.el("span", { text: "Config string (sort keys to canonicalise)" })
      ]),
      configInput,
      DL.el("span", { class: "ui__hint", text: "Change one character: the hash must change." })
    ]);

    var checks = [
      "Python random.seed(s)",
      "NumPy np.random.seed(s)",
      "torch.manual_seed(s)",
      "torch.cuda.manual_seed_all(s)",
      "DataLoader worker_init_fn + generator",
      "cudnn.benchmark = False",
      "torch.use_deterministic_algorithms(True)",
      "Data order + library versions logged"
    ];
    var saved = DL.store.get("m6-01-checklist", null);
    var flags = Array.isArray(saved) && saved.length === checks.length
      ? saved.map(Boolean) : checks.map(function () { return false; });

    var checkWrap = DL.el("div", { class: "lab__group" }, [
      DL.el("p", { class: "lab__group-title", text: "Determinism checklist (click or press Space)" })
    ]);
    var toggles = checks.map(function (name, i) {
      var t = U.toggle({
        label: name, checked: flags[i],
        onChange: function (b) { flags[i] = b; DL.store.set("m6-01-checklist", flags); updateChecks(); }
      });
      checkWrap.appendChild(t.el);
      return t;
    });

    var reads = U.readouts(["mean ā", "sample s_a", "SE = s_a/√S", "min / max", "config hash", "replay digest", "replay"]);
    var checkRead = U.readout("checklist");

    function sample(seed, n) {
      var rng = DL.rng(seed), out = [];
      for (var i = 0; i < n; i++) out.push(0.85 + 0.02 * DL.randn(rng));
      return out;
    }

    function digest(values, seed, cfg) {
      var parts = [String(seed), cfg];
      for (var i = 0; i < values.length; i++) parts.push(values[i].toFixed(6));
      return hex32(DL.hash(parts.join("|")));
    }

    function updateChecks() {
      var n = flags.filter(Boolean).length;
      checkRead.set(n + " / " + checks.length + " pinned");
      checkRead.el.style.color = n === checks.length ? "var(--ok)" : "var(--warn)";
    }

    function draw() {
      var p = V.palette();
      var seed = seedCtl.value(), S = sCtl.value(), cfg = configInput.value;
      var vals = sample(seed, S);
      var mean = DL.mean(vals);
      var ss = 0;
      for (var i = 0; i < vals.length; i++) ss += (vals[i] - mean) * (vals[i] - mean);
      var sd = Math.sqrt(ss / (S - 1));
      var se = sd / Math.sqrt(S);
      var d1 = digest(vals, seed, cfg);
      var d2 = digest(sample(seed, S), seed, cfg);

      view.clear(p.surface);
      V.histogram(ctx, vals, { x: 48, y: 12, w: view.w - 64, h: view.h - 52 }, {
        bins: 18, cmap: "accent", xmin: 0.78, xmax: 0.92
      });
      V.text(ctx, "stated distribution: N(0.85, 0.02²) · " + S + " seeds · seed " + seed,
        48, 22, { size: 10, mono: true, color: p.ink2 });

      reads.set("mean ā", DL.fmt(mean, 4));
      reads.set("sample s_a", DL.fmt(sd, 4));
      reads.set("SE = s_a/√S", DL.fmt(se, 4));
      reads.set("min / max", DL.fmt(DL.minOf(vals), 4) + " / " + DL.fmt(DL.maxOf(vals), 4));
      reads.set("config hash", hex32(DL.hash(cfg)));
      reads.set("replay digest", d1);
      reads.set("replay", d1 === d2 ? "PASS · identical" : "FAIL · differs");
      reads.get("replay").el.style.color = d1 === d2 ? "var(--ok)" : "var(--danger)";
      updateChecks();
    }

    stage.controls.appendChild(seedCtl.el);
    stage.controls.appendChild(sCtl.el);
    stage.controls.appendChild(configWrap);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(checkRead.el);
    stage.controls.appendChild(checkWrap);

    var resetBtn = DL.el("button", {
      type: "button", class: "btn", text: "Reset checklist and seed",
      "aria-label": "Reset seed, config and all checklist items",
      on: { click: function () {
        seedCtl.set(42, true); sCtl.set(9, true);
        configInput.value = '{"lr":0.001,"arch":"mlp-256"}';
        flags = checks.map(function () { return false; });
        toggles.forEach(function (t) { t.set(false, true); });
        DL.store.set("m6-01-checklist", flags);
        draw();
      } }
    });
    stage.controls.appendChild(resetBtn);

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () { resetBtn.click(); } };
  });

  /* ------------------------------------------------------------------ *
   * m6-02-memory-budget — activations, effective batch, AMP, all-reduce
   * Exact: every displayed number is computed from the controls.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m6-02-memory-budget", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, {
      w: 470, h: 230, label: "Activation bytes per live feature map"
    });
    var ctx = view.ctx;

    var presets = {
      cnn: { label: "Small CNN · (64,32,32),(128,16,16),(256,8,8)",
             layers: [[64, 32, 32], [128, 16, 16], [256, 8, 8]] },
      mlp: { label: "Tiny MLP · (128,1,1),(256,1,1)",
             layers: [[128, 1, 1], [256, 1, 1]] },
      deep: { label: "Deeper CNN · four maps",
              layers: [[32, 64, 64], [64, 32, 32], [128, 16, 16], [256, 8, 8]] }
    };
    var presetCtl = U.select({
      label: "Live feature maps (C, H, W)", ariaLabel: "Network preset",
      options: Object.keys(presets).map(function (k) { return { value: k, label: presets[k].label }; }),
      value: "cnn", onChange: draw
    });
    var nCtl = U.slider({ label: "Micro-batch B per device", min: 1, max: 64, step: 1, value: 8, digits: 0, onInput: draw });
    var dtypeCtl = U.select({
      label: "Activation dtype", ariaLabel: "Bytes per activation value",
      options: [{ value: "4", label: "fp32 · 4 bytes" }, { value: "2", label: "fp16/bf16 · 2 bytes" }],
      value: "2", onChange: draw
    });
    var aCtl = U.slider({ label: "Accumulation A", min: 1, max: 16, step: 1, value: 4, digits: 0, onInput: draw });
    var wCtl = U.slider({ label: "Workers W", min: 1, max: 8, step: 1, value: 2, digits: 0, onInput: draw });
    var budgetCtl = U.slider({ label: "Activation budget (MiB)", min: 1, max: 128, step: 1, value: 8, digits: 0, onInput: draw });
    var scaleCtl = U.select({
      label: "Loss scale S", ariaLabel: "AMP loss scale",
      options: [256, 1024, 4096, 65536].map(function (v) {
        return { value: String(v), label: String(v) };
      }),
      value: "65536", onChange: draw
    });
    var gradCtl = U.select({
      label: "Example true gradient g", ariaLabel: "Example true gradient",
      options: [
        { value: "1e-8", label: "1e-8 (tiny)" },
        { value: "1e-6", label: "1e-6 (small)" },
        { value: "0.01", label: "0.01 (normal)" },
        { value: "100", label: "100 (large)" }
      ],
      value: "1e-8", onChange: draw
    });

    var reads = U.readouts([
      "activation bytes", "in MiB", "B·A·W", "budget",
      "scaled g·S", "unscaled (g·S)/S", "fp16 status"
    ]);
    var reduceRead = U.readout("all-reduce mean ḡ");
    var table = U.table({
      columns: ["map", "shape (C,H,W)", "elements", "bytes", "arithmetic"],
      rows: [], caption: "Activation memory, computed layer by layer"
    });
    var reduceTable = U.table({
      columns: ["rank", "local gradient g_w"], rows: [],
      caption: "One parameter's gradient on each worker (seeded example values)"
    });
    var ampNote = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });

    stage.controls.appendChild(presetCtl.el);
    stage.controls.appendChild(nCtl.el);
    stage.controls.appendChild(dtypeCtl.el);
    stage.controls.appendChild(aCtl.el);
    stage.controls.appendChild(wCtl.el);
    stage.controls.appendChild(budgetCtl.el);
    stage.controls.appendChild(scaleCtl.el);
    stage.controls.appendChild(gradCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(reduceRead.el);
    stage.controls.appendChild(ampNote);
    stage.controls.appendChild(table.el);
    stage.controls.appendChild(reduceTable.el);

    function draw() {
      var p = V.palette();
      var layers = presets[presetCtl.value()].layers;
      var N = nCtl.value(), bytes = parseFloat(dtypeCtl.value());
      var A = aCtl.value(), W = wCtl.value(), budget = budgetCtl.value();
      var S = parseFloat(scaleCtl.value()), g = parseFloat(gradCtl.value());

      var rows = [], values = [], total = 0;
      layers.forEach(function (L, i) {
        var elems = L[0] * L[1] * L[2], use = N * bytes * elems;
        total += use;
        values.push(use / 1024);
        rows.push(["L" + (i + 1), "(" + L.join(", ") + ")", elems, use,
          N + " × " + bytes + " × " + elems + " = " + use]);
      });
      rows.push(["TOTAL", "—", "—", total, "sum of live maps"]);
      table.update(rows);

      var mib = total / (1024 * 1024);
      reads.set("activation bytes", total.toLocaleString("en-US"));
      reads.set("in MiB", DL.fmt(mib, 3));
      reads.set("B·A·W", String(N * A * W));
      reads.set("budget", mib <= budget ? "OK · " + DL.fmt(budget - mib, 2) + " MiB spare" : "OVER by " + DL.fmt(mib - budget, 2) + " MiB");
      reads.get("budget").el.style.color = mib <= budget ? "var(--ok)" : "var(--danger)";

      view.clear(p.surface);
      var r = { x: 46, y: 12, w: view.w - 62, h: view.h - 48 };
      V.bars(ctx, values, r, {
        labels: layers.map(function (_, i) { return "L" + (i + 1); }),
        values: true, digits: 1, cmap: "viridis"
      });
      V.text(ctx, "activation bytes per map, KiB · fp" + (bytes * 8) + ", B=" + N,
        r.x, 22, { size: 10, mono: true, color: p.ink2 });

      var scaled = g * S, back = scaled / S;
      var status;
      if (scaled > 65504) status = "overflow · step skipped";
      else if (scaled > 0 && scaled < 6.1e-5) status = "underflow risk · raise S";
      else status = "representable in fp16";
      reads.set("scaled g·S", DL.sci(scaled, 2));
      reads.set("unscaled (g·S)/S", DL.sci(back, 2));
      reads.set("fp16 status", status);
      reads.get("fp16 status").el.style.color = status === "representable in fp16" ? "var(--ok)" : "var(--warn)";
      ampNote.textContent = "g = " + DL.sci(g, 2) + ", S = " + S + "  →  g·S = "+
        DL.sci(scaled, 2) + "  →  (g·S)/S = " + DL.sci(back, 2) +
        ". fp16 normal range: about 6.1e-5 to 65504.";

      var rng = DL.rng(7), local = [], sum = 0;
      for (var k = 0; k < W; k++) {
        var v = Math.round((rng() - 0.5) * 2000) / 1000;
        local.push(v); sum += v;
      }
      var avg = sum / W;
      reduceTable.update(local.map(function (v, i) { return ["rank " + i, DL.fmt(v, 3)]; }));
      reduceRead.set(DL.fmt(sum, 3) + " / " + W + " = " + DL.fmt(avg, 4));
      reduceRead.el.style.color = "var(--accent)";
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () {
      presetCtl.set("cnn", true); nCtl.set(8, true); dtypeCtl.set("2", true);
      aCtl.set(4, true); wCtl.set(2, true); budgetCtl.set(8, true);
      scaleCtl.set("65536", true); gradCtl.set("1e-8", true); draw();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m6-03-saliency — real forward/backward on the widget's own scorer
   * Exact: the heatmap cells ARE the backpropagated gradients.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m6-03-saliency", function (el) {
    var N = 6, K = 8;
    var stage = U.stage();
    el.appendChild(stage.el);

    var imgView = V.canvas(stage.canvasWrap, { w: 420, h: 290, label: "Editable 6 by 6 greyscale image" });
    var heatView = V.canvas(stage.canvasWrap, { w: 420, h: 290, label: "Saliency heatmap computed from gradients" });
    var ictx = imgView.ctx, hctx = heatView.ctx;

    var scorerCtl = U.buttons({
      label: "Scorer", ariaLabel: "Scorer type",
      options: [
        { value: "conv", label: "Conv + ReLU", hint: "3×3 kernel over four by four patches" },
        { value: "linear", label: "Linear", hint: "One weight per pixel" }
      ],
      value: "conv", onChange: draw
    });
    var modeCtl = U.buttons({
      label: "Map", ariaLabel: "Saliency display mode",
      options: [
        { value: "abs", label: "|gradient|" },
        { value: "signed", label: "signed" },
        { value: "smooth", label: "SmoothGrad" }
      ],
      value: "abs", onChange: draw
    });
    var sigmaCtl = U.slider({
      label: "SmoothGrad σ", min: 0.01, max: 0.4, step: 0.01, value: 0.15, digits: 2,
      hint: "Fixed-seed noise: the same image always gives the same map.", onInput: draw
    });
    var reads = U.readouts(["score y", "∂y/∂x at cursor", "sum |grad|", "max |grad|", "samples K", "σ", "cursor (i,j)"]);

    var weightBtn = DL.el("button", {
      type: "button", class: "btn", text: "New weights",
      "aria-label": "Draw a new set of seeded scorer weights",
      on: { click: function () { weightSeed++; makeWeights(); draw(); } }
    });
    var resetBtn = DL.el("button", {
      type: "button", class: "btn", text: "Reset image and weights",
      "aria-label": "Reset image and scorer weights",
      on: { click: function () { reset(); } }
    });
    var help = DL.el("p", {
      class: "ui__hint",
      text: "Click the image to raise a pixel by 0.1 (wraps to 0 at 1). Focus it and use arrows to move, +/− or Home/End to change brightness."
    });

    stage.controls.appendChild(scorerCtl.el);
    stage.controls.appendChild(modeCtl.el);
    stage.controls.appendChild(sigmaCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(U.row(weightBtn, resetBtn));
    stage.controls.appendChild(help);

    var image, Wlin, kern, weightSeed = 0, cursor = { i: 2, j: 2 };

    function zeros() {
      var m = [];
      for (var i = 0; i < N; i++) { m.push([]); for (var j = 0; j < N; j++) m[i].push(0); }
      return m;
    }
    function makeWeights() {
      var r = DL.rng(11 + weightSeed * 101), i, j;
      Wlin = zeros(); kern = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (i = 0; i < N; i++) for (j = 0; j < N; j++) Wlin[i][j] = DL.round((r() - 0.5) * 2, 3);
      for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) kern[i][j] = DL.round((r() - 0.5) * 2, 3);
    }
    function resetImage() {
      image = zeros();
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
        image[i][j] = (i >= 2 && i <= 3 && j >= 2 && j <= 3) ? 0.9 : 0.15;
      }
      cursor = { i: 2, j: 2 };
    }

    // Forward pass and analytic backward pass through this widget's weights.
    function forwardBackward(img) {
      var grad = zeros(), y = 0, i, j, u, v;
      if (scorerCtl.value() === "linear") {
        y = 0.1;
        for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
          y += Wlin[i][j] * img[i][j];
          grad[i][j] = Wlin[i][j];
        }
      } else {
        for (var p = 0; p < N - 2; p++) for (var q = 0; q < N - 2; q++) {
          var z = 0.1;
          for (u = 0; u < 3; u++) for (v = 0; v < 3; v++) z += kern[u][v] * img[p + u][q + v];
          if (z > 0) {                      // ReLU derivative is 1 here
            y += z;
            for (u = 0; u < 3; u++) for (v = 0; v < 3; v++) grad[p + u][q + v] += kern[u][v];
          }
        }
      }
      return { y: y, grad: grad };
    }

    function compute() {
      var clean = forwardBackward(image), i, j;
      var map = zeros(), mode = modeCtl.value();
      if (mode === "smooth") {
        var rng = DL.rng(12345);
        for (var k = 0; k < K; k++) {
          for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
            var noisy = [];
            for (var a = 0; a < N; a++) {
              var row = [];
              for (var b = 0; b < N; b++) row.push(DL.clamp(image[a][b] + sigmaCtl.value() * DL.randn(rng), 0, 1));
              noisy.push(row);
            }
            var g = forwardBackward(noisy).grad;
            map[i][j] += Math.abs(g[i][j]) / K;
          }
        }
      } else {
        for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
          map[i][j] = mode === "abs" ? Math.abs(clean.grad[i][j]) : clean.grad[i][j];
        }
      }
      return { y: clean.y, grad: clean.grad, map: map, mode: mode };
    }

    function cellRect(view) { return { x: 46, y: 16, w: view.w - 62, h: view.h - 46 }; }

    function drawImage(p) {
      imgView.clear(p.surface);
      var r = cellRect(imgView), cw = r.w / N, ch = r.h / N;
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
        var v = image[i][j], g = Math.round(24 + 205 * v);
        ctxFill("rgb(" + g + "," + g + "," + g + ")");
        ictx.fillRect(r.x + j * cw, r.y + i * ch, cw - 1, ch - 1);
        V.text(ictx, v.toFixed(1), r.x + j * cw + cw / 2, r.y + i * ch + ch / 2,
          { align: "center", baseline: "middle", size: 11, mono: true, color: v > 0.55 ? "#111" : "#eee" });
      }
      function ctxFill(c) { ictx.fillStyle = c; }
      ictx.strokeStyle = p.accent;
      ictx.lineWidth = 3;
      ictx.strokeRect(r.x + cursor.j * cw + 1, r.y + cursor.i * ch + 1, cw - 3, ch - 3);
      V.text(ictx, "editable image · click to edit", r.x, 10, { size: 10, mono: true, color: p.ink2 });
    }

    function draw() {
      var p = V.palette();
      var out = compute();
      drawImage(p);

      heatView.clear(p.surface);
      var r = cellRect(heatView);
      var flat = [], i, j;
      for (i = 0; i < N; i++) for (j = 0; j < N; j++) flat.push(out.map[i][j]);
      var mx = DL.maxOf(flat.map(Math.abs));
      var signed = out.mode === "signed";
      V.heatmap(hctx, out.map, r, {
        cmap: signed ? "coolwarm" : "magma",
        vmin: signed ? -mx : 0, vmax: signed ? mx : Math.max(mx, 1e-9),
        values: true, fmt: function (v) { return DL.fmt(v, 2); }
      });
      V.text(hctx, out.mode + " · scorer " + scorerCtl.value(), r.x, 10,
        { size: 10, mono: true, color: p.ink2 });

      var sum = 0, mxg = 0;
      for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
        sum += Math.abs(out.grad[i][j]);
        mxg = Math.max(mxg, Math.abs(out.grad[i][j]));
      }
      reads.set("score y", DL.fmt(out.y, 3));
      reads.set("∂y/∂x at cursor", DL.fmt(out.grad[cursor.i][cursor.j], 3));
      reads.set("sum |grad|", DL.fmt(sum, 3));
      reads.set("max |grad|", DL.fmt(mxg, 3));
      reads.set("samples K", out.mode === "smooth" ? String(K) : "1 (clean)");
      reads.set("σ", DL.fmt(sigmaCtl.value(), 2));
      reads.set("cursor (i,j)", cursor.i + "," + cursor.j);
      sigmaCtl.el.hidden = out.mode !== "smooth";
    }

    imgView.canvas.style.cursor = "crosshair";
    imgView.canvas.setAttribute("tabindex", "0");
    imgView.canvas.setAttribute("role", "application");
    imgView.canvas.addEventListener("click", function (e) {
      var r0 = imgView.canvas.getBoundingClientRect(), r = cellRect(imgView);
      var j = Math.floor(((e.clientX - r0.left) / r0.width * imgView.w - r.x) / (r.w / N));
      var i = Math.floor(((e.clientY - r0.top) / r0.height * imgView.h - r.y) / (r.h / N));
      if (i >= 0 && i < N && j >= 0 && j < N) {
        cursor = { i: i, j: j };
        image[i][j] = DL.round(((image[i][j] + 0.1) % 1.001), 3);
        draw();
      }
    });
    imgView.canvas.addEventListener("keydown", function (e) {
      var step = 0.1, used = true;
      if (e.key === "ArrowLeft") cursor.j = Math.max(0, cursor.j - 1);
      else if (e.key === "ArrowRight") cursor.j = Math.min(N - 1, cursor.j + 1);
      else if (e.key === "ArrowUp") cursor.i = Math.max(0, cursor.i - 1);
      else if (e.key === "ArrowDown") cursor.i = Math.min(N - 1, cursor.i + 1);
      else if (e.key === "+" || e.key === "=") image[cursor.i][cursor.j] = DL.round(Math.min(1, image[cursor.i][cursor.j] + step), 3);
      else if (e.key === "-" || e.key === "_") image[cursor.i][cursor.j] = DL.round(Math.max(0, image[cursor.i][cursor.j] - step), 3);
      else if (e.key === "Home") image[cursor.i][cursor.j] = 0;
      else if (e.key === "End") image[cursor.i][cursor.j] = 1;
      else used = false;
      if (used) { e.preventDefault(); draw(); }
    });

    function reset() {
      weightSeed = 0; makeWeights(); resetImage();
      scorerCtl.set("conv", true); modeCtl.set("abs", true); sigmaCtl.set(0.15, true); draw();
    }
    document.addEventListener("dl:theme", draw);
    reset();
    return { reset: reset };
  });

  /* ------------------------------------------------------------------ *
   * m6-04-quant-error — affine quantisation of an editable weight vector
   * Exact: every q, reconstruction, error and byte count is computed live.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m6-04-quant-error", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, { w: 460, h: 210, label: "Original weights versus dequantised reconstruction" });
    var errView = V.canvas(stage.canvasWrap, { w: 460, h: 150, label: "Absolute quantisation error per weight" });
    var ctx = view.ctx, ectx = errView.ctx;

    var bitsCtl = U.select({
      label: "Bit width b", ariaLabel: "Quantisation bit width",
      options: [{ value: "2", label: "2 bits" }, { value: "4", label: "4 bits" }, { value: "8", label: "8 bits" }],
      value: "8", onChange: draw
    });
    var scaleCtl = U.slider({
      label: "Scale s", min: 0.005, max: 0.2, step: 0.005, value: 0.02, digits: 3, onInput: draw
    });
    var zCtl = U.slider({
      label: "Zero point z", min: -128, max: 127, step: 1, value: -128, digits: 0, onInput: draw
    });
    var weightsCtl = [0, 1, 2].map(function (i) {
      return U.number({
        label: "weight x" + (i + 1), min: -4, max: 4, step: 0.01,
        value: [1.37, 0.61, -0.42][i], onChange: draw
      });
    });
    var reads = U.readouts([
      "max |error|", "mean |error|", "bound s/2", "clipped",
      "fp32 bytes", "quant bytes", "compression"
    ]);
    var table = U.table({
      columns: ["x", "x/s", "round(x/s)+z", "q used", "x̂", "error x−x̂", "clipped?"],
      rows: [], caption: "Affine quantisation, row by row"
    });
    var formulaBox = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });

    stage.controls.appendChild(bitsCtl.el);
    stage.controls.appendChild(scaleCtl.el);
    stage.controls.appendChild(zCtl.el);
    weightsCtl.forEach(function (w) { stage.controls.appendChild(w.el); });
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(formulaBox);
    stage.controls.appendChild(table.el);

    var presetBtn = DL.el("button", {
      type: "button", class: "btn btn--accent", text: "Load worked example (x = 1.37)",
      "aria-label": "Load the worked example values",
      on: { click: function () {
        bitsCtl.set("8", true); scaleCtl.set(0.02, true); zCtl.set(-128, true);
        weightsCtl.forEach(function (w, i) { w.set([1.37, 0.61, -0.42][i]); });
        draw();
      } }
    });
    var clipBtn = DL.el("button", {
      type: "button", class: "btn", text: "Load clipping demo",
      "aria-label": "Load values that demonstrate clipping error",
      on: { click: function () {
        bitsCtl.set("4", true); scaleCtl.set(0.02, true); zCtl.set(-128, true);
        weightsCtl.forEach(function (w, i) { w.set([1.37, -2.9, 0.61][i]); });
        draw();
      } }
    });
    stage.controls.appendChild(U.row(presetBtn, clipBtn));

    function draw() {
      var p = V.palette();
      var b = parseInt(bitsCtl.value(), 10), s = scaleCtl.value(), z = zCtl.value();
      var qmin = -Math.pow(2, b - 1), qmax = Math.pow(2, b - 1) - 1;
      var xs = weightsCtl.map(function (w) { return w.value(); });
      var rows = [], errors = [], rec = [], clipped = 0;
      xs.forEach(function (x, i) {
        var raw = Math.round(x / s) + z;
        var q = DL.clamp(raw, qmin, qmax);
        var xhat = s * (q - z), err = x - xhat;
        if (raw !== q) clipped++;
        errors.push(Math.abs(err)); rec.push(xhat);
        rows.push([DL.fmt(x, 3), DL.fmt(x / s, 3), String(raw), String(q),
          DL.fmt(xhat, 4), DL.fmt(err, 4), raw !== q ? "yes" : "no"]);
      });

      var maxErr = DL.maxOf(errors), meanErr = DL.mean(errors);
      var fp32 = xs.length * 4, quant = xs.length * b / 8;
      reads.set("max |error|", DL.fmt(maxErr, 4));
      reads.set("mean |error|", DL.fmt(meanErr, 4));
      reads.set("bound s/2", DL.fmt(s / 2, 4));
      reads.set("clipped", clipped + " / " + xs.length);
      reads.get("clipped").el.style.color = clipped ? "var(--danger)" : "var(--ok)";
      reads.set("fp32 bytes", DL.fmt(fp32, 2));
      reads.set("quant bytes", DL.fmt(quant, 2));
      reads.set("compression", DL.fmt(fp32 / quant, 1) + "×");
      table.update(rows);
      formulaBox.textContent = "q = clip(round(x/" + DL.fmt(s, 3) + ") + " + z + ", " +
        qmin + ", " + qmax + ");  x̂ = " + DL.fmt(s, 3) + "·(q − " + z + ").  " +
        (clipped ? "Clipping is active: the s/2 bound does not apply to clipped rows."
                 : "No clipping: |x − x̂| ≤ s/2 = " + DL.fmt(s / 2, 4) + ".");

      view.clear(p.surface);
      var r = { x: 42, y: 12, w: view.w - 56, h: view.h - 46 };
      var pts = xs.map(function (_, i) { return i + 1; });
      V.line(ctx, [
        { pts: pts.map(function (v, i) { return [v, xs[i]]; }), color: p.accent, width: 2.2 },
        { pts: pts.map(function (v, i) { return [v, rec[i]]; }), color: p.danger, width: 2.2, dash: [5, 3] }
      ], r, { xmin: 1, xmax: xs.length, grid: true, xlabel: "weight index", ylabel: "value" });
      V.legend(ctx, [{ color: p.accent, label: "original x" }, { color: p.danger, label: "dequantised x̂" }],
        { x: r.x + 8, y: r.y + 6 }, {});

      errView.clear(p.surface);
      var r2 = { x: 42, y: 10, w: errView.w - 56, h: errView.h - 42 };
      V.bars(ectx, errors, r2, {
        labels: xs.map(function (_, i) { return "w" + (i + 1); }),
        values: true, digits: 4, cmap: "ember"
      });
      V.text(ectx, "absolute error per weight", r2.x, 20, { size: 10, mono: true, color: p.ink2 });
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () { presetBtn.click(); } };
  });

  /* ------------------------------------------------------------------ *
   * m6-05-lr-range — stored schematic sweep with computed markers
   * Illustrative: the curve is stored, not measured here.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m6-05-lr-range", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, {
      w: 470, h: 290, label: "Stored schematic loss versus log10 learning rate"
    });
    var ctx = view.ctx;

    // Stored points (log10 eta, loss) — a schematic teaching curve, not a benchmark.
    var sweep = [
      [-6, 2.302], [-5.5, 2.302], [-5, 2.299], [-4.5, 2.285], [-4, 2.240],
      [-3.5, 2.010], [-3, 1.620], [-2.5, 1.120], [-2, 0.810], [-1.5, 0.930],
      [-1, 1.140], [-0.5, 2.100], [0, 3.400]
    ];
    var showCtl = U.toggle({
      label: "Show region annotations", checked: true, onChange: draw
    });
    var reads = U.readouts(["loss at min", "η at min", "recommended η", "steepest decade"]);
    var note = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    stage.controls.appendChild(showCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(note);

    function draw() {
      var p = V.palette();
      view.clear(p.surface);
      var r = { x: 48, y: 14, w: view.w - 64, h: view.h - 50 };
      var minPt = sweep[0], steep = { x: 0, drop: 0 };
      for (var i = 1; i < sweep.length; i++) {
        if (sweep[i][1] < minPt[1]) minPt = sweep[i];
        var drop = sweep[i - 1][1] - sweep[i][1];
        if (drop > steep.drop) steep = { x: (sweep[i][0] + sweep[i - 1][0]) / 2, drop: drop };
      }
      var recX = minPt[0] - 1;

      var fit = V.line(ctx, [{
        pts: sweep, color: p.accent, width: 2.6, label: "stored sweep"
      }], r, {
        xmin: -6, xmax: 0, ymin: 0.6, ymax: 3.6, grid: true,
        xlabel: "log₁₀ η", ylabel: "loss", tickLabels: true
      });
      if (!fit) return;

      function marker(x, color, text) {
        if (x < -6 || x > 0) return;
        V.dashedLine(ctx, fit.sx(x), r.y, fit.sx(x), r.y + r.h,
          { color: color, dash: [4, 3], width: 1.6 });
        V.text(ctx, text, fit.sx(x) + 4, r.y + 12, { size: 9, mono: true, color: color });
      }
      marker(recX, p.ok, "recommended");
      marker(minPt[0], p.danger, "minimum");

      if (showCtl.checked()) {
        V.text(ctx, "too small · flat", r.x + 8, r.y + r.h - 8, { size: 9, mono: true, color: p.ink3 });
        V.text(ctx, "diverging", r.x + r.w - 58, r.y + 12, { size: 9, mono: true, color: p.danger });
      }
      V.legend(ctx, [
        { color: p.accent, label: "stored schematic sweep" },
        { color: p.ok, label: "recommended (1 decade before min)" },
        { color: p.danger, label: "minimum" }
      ], { x: r.x + 6, y: r.y + 2 }, { lh: 13 });

      reads.set("loss at min", DL.fmt(minPt[1], 3));
      reads.set("η at min", "10^" + DL.fmt(minPt[0], 1) + " = " + DL.sci(Math.pow(10, minPt[0]), 1));
      reads.set("recommended η", recX >= -6 ? "10^" + DL.fmt(recX, 1) + " = " + DL.sci(Math.pow(10, recX), 1) : "below sweep");
      reads.set("steepest decade", "10^" + DL.fmt(steep.x, 1));
      note.textContent = "Reading: flat at log₁₀η = −6 (loss " + DL.fmt(sweep[0][1], 3) +
        " ≈ ln 10), falling through −3 to −2, then rising past −1. The minimum is at log₁₀η = " +
        DL.fmt(minPt[0], 1) + "; one decade below is the recommended starting point.";
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () { showCtl.set(true, true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m6-05-ladder — saved keyboard-operable debugging decision checklist
   * Exact: progress and next action are derived from the saved answers.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m6-05-ladder", function (el) {
    var items = [
      { q: "A baseline is recorded (majority class + a small known model).",
        advice: "Write down the majority-class accuracy and one tiny model's score before changing anything." },
      { q: "A previously working checkpoint still trains.",
        advice: "Reload a known-good checkpoint. If it fails too, suspect data or environment, not your new code." },
      { q: "Loss at init is close to ln C for the actual class count.",
        advice: "Print C, label range and logit shape. ln 2 = 0.693, ln 10 = 2.303." },
      { q: "Batch shapes, dtypes and label range were printed.",
        advice: "Check (N,C,H,W), logits (N,C), integer labels in [0,C-1], and x.dtype vs model dtype." },
      { q: "The model overfits one batch of 8 examples to near-zero loss.",
        advice: "If it cannot memorise 8 examples, the bug is in the model, loss or optimiser." },
      { q: "Gradients are finite and non-zero after backward.",
        advice: "Print grad norms; check requires_grad, detached tensors and a non-zero learning rate." },
      { q: "An LR range test shows a falling region.",
        advice: "Sweep log₁₀ η from −6 to 0 and pick a rate one decade before the loss minimum." },
      { q: "The split has no leakage (no group or time overlap).",
        advice: "Group splits for repeated entities; time splits for chronological data." },
      { q: "Only one setting changed since the last run.",
        advice: "Revert to the baseline and reintroduce changes one at a time." }
    ];
    var KEY = "m6-05-ladder";
    var saved = DL.store.get(KEY, null);
    var answers = Array.isArray(saved) && saved.length === items.length ? saved : items.map(function () { return null; });

    var wrap = DL.el("div", { class: "lab__group" });
    el.appendChild(wrap);
    var bar = DL.el("div", { style: { height: "10px", borderRadius: "999px", background: "var(--surface-2)", overflow: "hidden", border: "1px solid var(--line)" } });
    var fill = DL.el("div", { style: { height: "100%", width: "0%", background: "var(--accent)", transition: "width .2s" } });
    bar.appendChild(fill);
    wrap.appendChild(bar);
    var reads = U.readouts(["answered", "passed", "next action"]);
    wrap.appendChild(reads.el);
    var advice = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    wrap.appendChild(advice);

    var rowEls = [];
    items.forEach(function (item, i) {
      var yes = DL.el("button", {
        type: "button", class: "btn", text: "Yes",
        "aria-label": "Mark check " + (i + 1) + " as passed",
        on: { click: function () { answers[i] = true; persist(); render(); } }
      });
      var no = DL.el("button", {
        type: "button", class: "btn", text: "No",
        "aria-label": "Mark check " + (i + 1) + " as failed",
        on: { click: function () { answers[i] = false; persist(); render(); } }
      });
      var clear = DL.el("button", {
        type: "button", class: "btn btn--ghost", text: "Clear",
        "aria-label": "Clear the answer for check " + (i + 1),
        on: { click: function () { answers[i] = null; persist(); render(); } }
      });
      var row = DL.el("div", {
        style: { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center",
                 padding: "6px 0", borderBottom: "1px solid var(--line)" }
      }, [
        DL.el("span", { text: (i + 1) + ".", style: { fontFamily: "var(--font-mono)", minWidth: "20px" } }),
        DL.el("span", { text: item.q, style: { flex: "1 1 260px", minWidth: "0" } }),
        DL.el("span", { style: { display: "flex", gap: "4px" } }, [yes, no, clear])
      ]);
      wrap.appendChild(row);
      rowEls.push({ yes: yes, no: no, row: row });
    });
    var resetBtn = DL.el("button", {
      type: "button", class: "btn", text: "Reset all answers",
      "aria-label": "Clear all saved checklist answers",
      on: { click: function () { answers = items.map(function () { return null; }); persist(); render(); } }
    });
    wrap.appendChild(resetBtn);

    function persist() { DL.store.set(KEY, answers); }
    function render() {
      var answered = 0, passed = 0, next = -1, failed = -1;
      answers.forEach(function (a, i) {
        if (a !== null) answered++;
        if (a === true) passed++;
        if (a === null && next < 0) next = i;
        if (a === false && failed < 0) failed = i;
      });
      rowEls.forEach(function (r, i) {
        r.yes.setAttribute("aria-pressed", String(answers[i] === true));
        r.no.setAttribute("aria-pressed", String(answers[i] === false));
        r.yes.style.borderColor = answers[i] === true ? "var(--ok)" : "";
        r.no.style.borderColor = answers[i] === false ? "var(--danger)" : "";
      });
      var pctDone = Math.round(100 * answered / items.length);
      fill.style.width = pctDone + "%";
      reads.set("answered", answered + " / " + items.length + " (" + pctDone + "%)");
      reads.set("passed", passed + " / " + items.length);
      var target = next >= 0 ? next : failed;
      reads.set("next action", target < 0 ? "All checks passed — tune hyperparameters" : "Check " + (target + 1));
      advice.textContent = target < 0
        ? "Every check passes. Now change one hyperparameter at a time, starting with the learning rate."
        : (next >= 0 ? "Next: " + items[next].advice : "Failing check " + (failed + 1) + ": " + items[failed].advice);
    }

    render();
    return { reset: function () { resetBtn.click(); } };
  });

  /* ------------------------------------------------------------------ *
   * m6-06-jacobian — composition of small 2-D maps, exact J product
   * ------------------------------------------------------------------ */
  DL.widgets.register("m6-06-jacobian", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, {
      w: 470, h: 340, label: "Unit square, its linearised image and the true transformed boundary"
    });
    var ctx = view.ctx;

    var gCtl = U.select({
      label: "Inner map g", ariaLabel: "Inner map",
      options: [
        { value: "scale", label: "scale · (2x, 0.5y)" },
        { value: "shear", label: "shear · (x+y, y)" },
        { value: "rotate", label: "rotate by θ" },
        { value: "square", label: "square · (x², y²)" }
      ],
      value: "shear", onChange: draw
    });
    var fCtl = U.select({
      label: "Outer map f", ariaLabel: "Outer map",
      options: [
        { value: "sumdiff", label: "sum & difference · (u+v, u−v)" },
        { value: "square", label: "square · (u², v²)" },
        { value: "swap", label: "swap · (v, u)" },
        { value: "relu", label: "ReLU · (max(0,u), max(0,v))" }
      ],
      value: "sumdiff", onChange: draw
    });
    var xCtl = U.slider({ label: "x", min: -2, max: 2, step: 0.1, value: 1, digits: 1, onInput: draw });
    var yCtl = U.slider({ label: "y", min: -2, max: 2, step: 0.1, value: 2, digits: 1, onInput: draw });
    var thetaCtl = U.slider({
      label: "θ (degrees)", min: 0, max: 90, step: 5, value: 45, digits: 0, onInput: draw
    });
    var reads = U.readouts(["g(x,y)", "det J", "area scale |det J|", "f(g(x,y))"]);
    var table = U.table({
      columns: ["quantity", "matrix / value"], rows: [],
      caption: "Jacobians evaluated at the chosen point"
    });
    var legendBox = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });

    stage.controls.appendChild(gCtl.el);
    stage.controls.appendChild(fCtl.el);
    stage.controls.appendChild(xCtl.el);
    stage.controls.appendChild(yCtl.el);
    stage.controls.appendChild(thetaCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(legendBox);
    stage.controls.appendChild(table.el);

    function mul(A, B) {
      return [
        [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
        [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]
      ];
    }
    function mat(M) { return "[[ " + DL.fmt(M[0][0], 2) + ", " + DL.fmt(M[0][1], 2) + " ], [ " +
      DL.fmt(M[1][0], 2) + ", " + DL.fmt(M[1][1], 2) + " ]]"; }

    function gfun(x, y) {
      var k = gCtl.value();
      if (k === "scale") return [2 * x, 0.5 * y];
      if (k === "shear") return [x + y, y];
      if (k === "square") return [x * x, y * y];
      var a = thetaCtl.value() * Math.PI / 180;
      return [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y];
    }
    function gJac(x, y) {
      var k = gCtl.value();
      if (k === "scale") return [[2, 0], [0, 0.5]];
      if (k === "shear") return [[1, 1], [0, 1]];
      if (k === "square") return [[2 * x, 0], [0, 2 * y]];
      var a = thetaCtl.value() * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      return [[c, -s], [s, c]];
    }
    function ffun(u, v) {
      var k = fCtl.value();
      if (k === "sumdiff") return [u + v, u - v];
      if (k === "square") return [u * u, v * v];
      if (k === "swap") return [v, u];
      return [Math.max(0, u), Math.max(0, v)];
    }
    function fJac(u, v) {
      var k = fCtl.value();
      if (k === "sumdiff") return [[1, 1], [1, -1]];
      if (k === "square") return [[2 * u, 0], [0, 2 * v]];
      if (k === "swap") return [[0, 1], [1, 0]];
      return [[u > 0 ? 1 : 0, 0], [0, v > 0 ? 1 : 0]];
    }

    function draw() {
      var p = V.palette();
      var x = xCtl.value(), y = yCtl.value();
      var gy = gfun(x, y), Jg = gJac(x, y), Jf = fJac(gy[0], gy[1]);
      var J = mul(Jf, Jg), det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      thetaCtl.el.hidden = gCtl.value() !== "rotate";

      table.update([
        ["g(" + DL.fmt(x, 1) + ", " + DL.fmt(y, 1) + ")", "(" + DL.fmt(gy[0], 3) + ", " + DL.fmt(gy[1], 3) + ")"],
        ["Jg at (x,y)", mat(Jg)],
        ["Jf at g(x,y)", mat(Jf)],
        ["J = Jf · Jg", mat(J)],
        ["det J", DL.fmt(det, 3)],
        ["f(g(x,y))", "(" + DL.fmt(ffun(gy[0], gy[1])[0], 3) + ", " + DL.fmt(ffun(gy[0], gy[1])[1], 3) + ")"]
      ]);
      reads.set("g(x,y)", "(" + DL.fmt(gy[0], 2) + ", " + DL.fmt(gy[1], 2) + ")");
      reads.set("det J", DL.fmt(det, 3));
      reads.set("area scale |det J|", DL.fmt(Math.abs(det), 3));
      reads.set("f(g(x,y))", "(" + DL.fmt(ffun(gy[0], gy[1])[0], 2) + ", " + DL.fmt(ffun(gy[0], gy[1])[1], 2) + ")");

      view.clear(p.surface);
      var r = { x: 46, y: 14, w: view.w - 62, h: view.h - 48 };
      V.axes(ctx, r, { xmin: -5, xmax: 5, ymin: -5, ymax: 5, grid: true, ticks: 5, xlabel: "u₁", ylabel: "u₂" });
      var sx = function (v) { return r.x + ((v + 5) / 10) * r.w; };
      var sy = function (v) { return r.y + r.h - ((v + 5) / 10) * r.h; };

      // original unit square
      var corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
      function poly(points, color, width, dash) {
        ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
        ctx.beginPath();
        points.forEach(function (q, i) { if (i === 0) ctx.moveTo(sx(q[0]), sy(q[1])); else ctx.lineTo(sx(q[0]), sy(q[1])); });
        ctx.closePath(); ctx.strokeStyle = color; ctx.lineWidth = width || 2;
        if (dash) ctx.setLineDash(dash);
        ctx.stroke(); ctx.restore();
      }
      poly(corners, p.ink3, 1.5, [4, 3]);
      var linear = corners.map(function (q) {
        return [J[0][0] * q[0] + J[0][1] * q[1], J[1][0] * q[0] + J[1][1] * q[1]];
      });
      poly(linear, p.accent, 2.6);
      var boundary = [];
      for (var i = 0; i <= 40; i++) {
        var t = i / 40; boundary.push(gfun(t, 0));
      }
      for (i = 1; i <= 40; i++) { t = i / 40; boundary.push(gfun(1, t)); }
      for (i = 1; i <= 40; i++) { t = i / 40; boundary.push(gfun(1 - t, 1)); }
      for (i = 1; i < 40; i++) { t = i / 40; boundary.push(gfun(0, 1 - t)); }
      poly(boundary.map(function (q) { return ffun(q[0], q[1]); }), p.danger, 1.8, [3, 3]);

      var px = gy[0], py = gy[1];
      V.dot(ctx, sx(x), sy(y), 4, p.ink);
      V.dot(ctx, sx(px), sy(py), 4, p.ok);
      V.text(ctx, "x=(" + DL.fmt(x, 1) + "," + DL.fmt(y, 1) + ")", sx(x) + 6, sy(y) - 6,
        { size: 9, mono: true, color: p.ink2 });
      V.legend(ctx, [
        { color: p.ink3, label: "original unit square" },
        { color: p.accent, label: "J · unit square (linearised)" },
        { color: p.danger, label: "true f(g(boundary))" }
      ], { x: r.x + 6, y: r.y + 4 }, { lh: 13 });

      legendBox.textContent = "J = Jf(g(x)) · Jg(x) = " + mat(J) + ". A unit square (area 1) becomes a" +
        " parallelogram of area |det J| = " + DL.fmt(Math.abs(det), 3) +
        (det < 0 ? "; the negative determinant means orientation flips." : ".");
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () {
      gCtl.set("shear", true); fCtl.set("sumdiff", true);
      xCtl.set(1, true); yCtl.set(2, true); thetaCtl.set(45, true); draw();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m6-07-glossary — filterable index built from DL.GLOSSARY only
   * Exact: definitions and both counts come from the shared data file.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m6-07-glossary", function (el) {
    var G = DL.glossary || {};
    // Categories group the existing keys; no definition is duplicated here.
    var groups = [
      { key: "foundations", label: "Foundations", terms: ["activation", "autograd", "bias", "bottleneck", "convolution", "dilation", "GELU", "gradient", "kernel", "layer normalization", "leaky ReLU", "logits", "one-hot", "padding", "parameter", "pooling", "receptive field", "residual connection", "skip connection", "softmax", "stride", "temperature", "tensor", "transpose convolution", "weight sharing"] },
      { key: "training", label: "Training", terms: ["Adam", "AdamW", "batch normalization", "checkpoint", "data augmentation", "dropout", "epoch", "fine-tuning", "hyperparameter", "learning rate", "momentum", "overfitting", "pretrained", "transfer learning", "underfitting", "weight decay"] },
      { key: "vision", label: "CNN & vision", terms: ["convolution", "dilation", "kernel", "padding", "pooling", "receptive field", "residual connection", "skip connection", "stride", "transpose convolution"] },
      { key: "sequences", label: "Sequences", terms: ["attention", "BPTT", "embedding", "GRU", "LSTM", "multi-head attention", "negative sampling", "positional encoding", "self-attention", "token", "tokenization"] },
      { key: "generative", label: "Generative", terms: ["ELBO", "FID", "GAN", "latent space", "mode collapse", "reparameterization trick", "temperature", "VAE"] },
      { key: "metrics", label: "Segmentation & metrics", terms: ["Dice", "FID", "IoU", "panoptic segmentation", "perplexity", "precision", "recall", "semantic segmentation"] },
      { key: "practice", label: "Practice", terms: ["checkpoint", "data augmentation", "fine-tuning", "overfitting", "pretrained", "transfer learning", "underfitting", "weight decay"] }
    ];

    var stage = DL.el("div", { class: "lab__group", style: { gap: "var(--s3)" } });
    el.appendChild(stage);

    var searchId = DL.uid("gl");
    var input = DL.el("input", {
      type: "search", id: searchId, class: "ui__select",
      placeholder: "Search terms and definitions…", "aria-label": "Search the glossary"
    });
    stage.appendChild(DL.el("label", { class: "ui__label", for: searchId }, [
      DL.el("span", { text: "Search the glossary" })
    ]));
    stage.appendChild(input);

    var chipWrap = DL.el("div", { role: "group", "aria-label": "Glossary category filters",
      style: { display: "flex", flexWrap: "wrap", gap: "6px" } });
    stage.appendChild(chipWrap);
    var reads = U.readouts(["matching terms", "coverage"]);
    stage.appendChild(reads.el);
    var list = DL.el("dl", { style: { margin: "0", display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: "10px" } });
    stage.appendChild(list);

    var category = "all";
    var chips = [];
    function makeChip(value, label) {
      var b = DL.el("button", {
        type: "button", class: "btn btn--ghost", text: label,
        "aria-label": "Filter glossary by " + label,
        "aria-pressed": String(value === category),
        on: { click: function () { category = value; render(); } }
      });
      chips.push({ value: value, btn: b });
      chipWrap.appendChild(b);
    }
    makeChip("all", "All terms");
    groups.forEach(function (g) { makeChip(g.key, g.label); });

    function inGroup(term, key) {
      if (key === "all") return true;
      for (var i = 0; i < groups.length; i++) {
        if (groups[i].key === key && groups[i].terms.indexOf(term) >= 0) return true;
      }
      // Terms not named in a chip remain reachable under "All terms".
      return false;
    }

    function render() {
      var q = input.value.trim().toLowerCase();
      var all = Object.keys(G).sort();
      var hits = all.filter(function (t) {
        var text = (t + " " + G[t]).toLowerCase();
        return inGroup(t, category) && (q === "" || text.indexOf(q) >= 0);
      });
      chips.forEach(function (c) {
        c.btn.setAttribute("aria-pressed", String(c.value === category));
        c.btn.style.borderColor = c.value === category ? "var(--accent)" : "";
      });
      list.innerHTML = "";
      if (!hits.length) {
        list.appendChild(DL.el("p", { class: "ui__hint", text: "No terms match this filter. Try another word or choose All terms." }));
      }
      hits.forEach(function (t) {
        list.appendChild(DL.el("div", { style: { paddingBottom: "6px", borderBottom: "1px solid var(--line)" } }, [
          DL.el("dt", { text: t, style: { fontWeight: "700", color: "var(--ink-1)" } }),
          DL.el("dd", { text: G[t], style: { margin: "2px 0 0", color: "var(--ink-2)", fontSize: "var(--fs-2)" } })
        ]));
      });
      reads.set("matching terms", hits.length + " / " + all.length);
      reads.set("coverage", all.length ? DL.pct(hits.length / all.length, 1) : "0%");
    }

    input.addEventListener("input", render);
    render();
    return { reset: function () { input.value = ""; category = "all"; render(); } };
  });

})(window.DL);
