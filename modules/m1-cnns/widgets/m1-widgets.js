/* ==========================================================================
   DeepLearn Lab — M1 widgets
   Registered ids follow docs/CONTENT_PLAN.md and the module brief. Never rename.
   ========================================================================== */
(function (DL) {
  "use strict";

  var V = DL.viz, U = DL.ui, T = DL.tensor, NN = DL.nn;

  /* ------------------------------------------------------------------ *
   * helpers
   * ------------------------------------------------------------------ */
  function small(text) {
    return DL.el("p", { class: "small muted", text: text });
  }
  function mathBox(title, text) {
    var box = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    if (title) box.appendChild(DL.el("p", { class: "callout__title", text: title }));
    box.appendChild(DL.el("p", { text: text }));
    return box;
  }
  function clone(A) { return A.map(function (r) { return r.slice(); }); }
  function argmax2(M) {
    var best = -Infinity, at = [0, 0];
    for (var i = 0; i < M.length; i++) {
      for (var j = 0; j < M[0].length; j++) {
        if (M[i][j] > best) { best = M[i][j]; at = [i, j]; }
      }
    }
    return at;
  }
  function norm(M, lo, hi) {
    var mn = Infinity, mx = -Infinity;
    M.forEach(function (row) { row.forEach(function (v) { if (v < mn) mn = v; if (v > mx) mx = v; }); });
    if (!isFinite(mn)) return clone(M);
    if (mx === mn) mx = mn + 1e-9;
    return M.map(function (row) { return row.map(function (v) { return lo + (v - mn) / (mx - mn) * (hi - lo); }); });
  }
  function cellGrid(rows, cols, values, onCell, caption) {
    var wrap = DL.el("div", { class: "hstack", style: { flexWrap: "wrap", gap: "10px", alignItems: "flex-start" } });
    wrap.appendChild(DL.el("span", { class: "ui__hint", text: caption }));
    var g = DL.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(" + cols + ", 26px)", gap: "2px" } });
    var cells = [];
    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++) {
        (function (r, c) {
          var b = DL.el("button", {
            type: "button",
            class: "btn",
            style: { width: "26px", height: "26px", minWidth: "26px", padding: "0", fontSize: "11px", fontFamily: "var(--font-mono)" },
            "aria-label": "Cell row " + (r + 1) + " column " + (c + 1) + ", value " + values[r][c] + ". Click to change."
          });
          b.textContent = String(values[r][c]);
          b.addEventListener("click", function () { onCell(r, c); });
          g.appendChild(b);
          cells.push(b);
        })(i, j);
      }
    }
    wrap.appendChild(g);
    return { el: wrap, cells: cells };
  }

  /* ------------------------------------------------------------------ *
   * m1-01-param-calculator — locality + FC/conv parameter calculator
   * Exact: counts use DL.nn.convParams / DL.nn.fcParams.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-01-param-calculator", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 520, h: 260, label: "Local patch on a feature map and log-scale parameter comparison" });
    var ctx = view.ctx;

    var hctl = U.slider({ label: "Input H", min: 16, max: 224, step: 1, value: 224, digits: 0, onInput: draw });
    var wctl = U.slider({ label: "Input W", min: 16, max: 224, step: 1, value: 224, digits: 0, onInput: draw });
    var cctl = U.select({ label: "Input channels C", options: [1, 3, 16].map(function (v) { return { value: String(v), label: String(v) }; }), value: "3", onChange: draw });
    var kctl = U.select({ label: "Kernel K", options: [1, 3, 5].map(function (v) { return { value: String(v), label: String(v) }; }), value: "3", onChange: draw });
    var dctl = U.slider({ label: "FC hidden units D", min: 8, max: 128, step: 8, value: 64, digits: 0, onInput: draw });
    var octl = U.slider({ label: "Conv filters C_out", min: 8, max: 128, step: 8, value: 64, digits: 0, onInput: draw });
    var reads = U.readouts(["FC parameters", "Conv parameters", "ratio", "patch pixels"]);
    var box = mathBox("Substitution", "");
    var table = U.table({
      columns: ["layer", "formula", "parameters", "connections per output"],
      rows: [], caption: "Computed from the sliders — same input, different prior"
    });
    [hctl, wctl, cctl, kctl, dctl, octl, reads.el, box, table.el].forEach(function (x) { stage.controls.appendChild(x.el || x); });

    function draw() {
      var p = V.palette();
      var H = hctl.value(), W = wctl.value(), C = parseInt(cctl.value(), 10), K = parseInt(kctl.value(), 10);
      var D = dctl.value(), Co = octl.value();
      var fc = NN.fcParams(C * H * W, D, true);
      var conv = NN.convParams(C, Co, K, true);
      view.clear(p.surface);
      var left = { x: 24, y: 20, w: 210, h: 210 };
      var cell = Math.min(left.w, left.h) / 12;
      ctx.strokeStyle = p.lineStrong; ctx.lineWidth = 1;
      for (var i = 0; i <= 12; i++) {
        ctx.beginPath(); ctx.moveTo(left.x + i * cell, left.y); ctx.lineTo(left.x + i * cell, left.y + 12 * cell); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(left.x, left.y + i * cell); ctx.lineTo(left.x + 12 * cell, left.y + i * cell); ctx.stroke();
      }
      var span = Math.max(1, Math.min(12, K));
      ctx.fillStyle = p.accentSoft;
      ctx.fillRect(left.x + 4 * cell, left.y + 4 * cell, span * cell, span * cell);
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2.5;
      ctx.strokeRect(left.x + 4 * cell, left.y + 4 * cell, span * cell, span * cell);
      V.text(ctx, "one K×K patch (" + K + "×" + K + ")", left.x, 14, { size: 11, mono: true, color: p.ink2 });
      V.text(ctx, "H×W = " + H + "×" + W, left.x, left.y + 12 * cell + 16, { size: 10, mono: true, color: p.ink3 });

      var right = { x: 260, y: 34, w: view.w - 284, h: 150 };
      V.bars(ctx, [Math.log10(Math.max(1, fc)), Math.log10(Math.max(1, conv))], right, {
        labels: ["FC", "conv"], colors: [p.danger, p.accent], values: false
      });
      V.text(ctx, "log10(parameters)", right.x, 20, { size: 10, mono: true, color: p.ink3 });
      V.text(ctx, DL.nn.formatCount(fc), right.x + 4, right.y + 26, { size: 11, mono: true, color: p.danger });
      V.text(ctx, DL.nn.formatCount(conv), right.x + 4, right.y + 46, { size: 11, mono: true, color: p.accent });

      reads.set("FC parameters", NN.formatCount(fc));
      reads.set("Conv parameters", NN.formatCount(conv));
      reads.set("ratio", (fc / conv).toFixed(1) + "×");
      reads.set("patch pixels", K + "×" + K + "×" + C + " = " + (K * K * C));
      box.textContent = "FC: " + C + "·" + H + "·" + W + "·" + D + " + " + D + " = " + NN.formatCount(fc) +
        ".  Conv: " + Co + "·" + C + "·" + K + "² + " + Co + " = " + NN.formatCount(conv) + ".";
      table.update([
        ["FC → " + D, "C·H·W·D + D", NN.formatCount(fc), H * W * C],
        ["Conv " + Co + "×" + K + "×" + K, "C_out·C_in·K² + C_out", NN.formatCount(conv), K * K * C],
        ["TOTAL (stack)", "FC + conv", NN.formatCount(fc + conv), "—"]
      ]);
    }
    draw();
    return { reset: function () {
      hctl.set(224, true); wctl.set(224, true); cctl.set("3", true);
      kctl.set("3", true); dctl.set(64, true); octl.set(64, true); draw();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m1-02-conv-explorer — flagship editable kernel
   * Exact: DL.tensor.conv2d + DL.tensor.outSize, all arithmetic shown.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-02-conv-explorer", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 540, h: 250, label: "Input patch, kernel and computed output map" });
    var ctx = view.ctx;
    var presets = {
      identity: [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
      edge: [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]],
      blur: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], // unnormalised box blur; divide output by 9 yourself
      sharpen: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
      sobel: [[1, 0, -1], [2, 0, -2], [1, 0, -1]]
    };
    var inputPatterns = {
      worked: [[1, 2, 3, 4, 5], [6, 7, 8, 9, 1], [2, 3, 4, 5, 6], [7, 8, 9, 1, 2], [3, 4, 5, 6, 7]],
      block: [[0, 0, 0, 0, 0], [0, 3, 3, 3, 0], [0, 3, 3, 3, 0], [0, 3, 3, 3, 0], [0, 0, 0, 0, 0]],
      ramp: [[0, 1, 2, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4]],
      checker: [[0, 1, 0, 1, 0], [1, 0, 1, 0, 1], [0, 1, 0, 1, 0], [1, 0, 1, 0, 1], [0, 1, 0, 1, 0]]
    };
    var kernel = clone(presets.sobel);
    var vals = [0, 1, -1, 2, -2];
    var input = clone(inputPatterns.worked);
    var presetCtl = U.select({
      label: "Kernel preset", options: Object.keys(presets).map(function (k) { return { value: k, label: k }; }),
      value: "sobel", onChange: function (v) { kernel = clone(presets[v]); rebuildCells(); compute(); }
    });
    var patternCtl = U.select({
      label: "Input pattern", options: Object.keys(inputPatterns).map(function (k) { return { value: k, label: k }; }),
      value: "worked", onChange: function (v) { input = clone(inputPatterns[v]); rebuildInputCells(); compute(); }
    });
    var strideCtl = U.slider({ label: "Stride S", min: 1, max: 3, step: 1, value: 2, digits: 0, onInput: compute });
    var paddingCtl = U.slider({ label: "Padding P", min: 0, max: 2, step: 1, value: 1, digits: 0, onInput: compute });
    var dilationCtl = U.slider({ label: "Dilation D", min: 1, max: 3, step: 1, value: 1, digits: 0, onInput: compute });
    var reads = U.readouts(["output size", "MACs", "kernel span", "top-left value"]);
    var box = mathBox("Top-left output, term by term", "");
    [presetCtl, patternCtl, strideCtl, paddingCtl, dilationCtl, reads.el, box].forEach(function (x) { stage.controls.appendChild(x.el || x); });
    var kGrid = cellGrid(3, 3, kernel, function (r, c) {
      var i = vals.indexOf(kernel[r][c]);
      kernel[r][c] = vals[(i + 1) % vals.length];
      rebuildCells(); compute();
    }, "3×3 kernel — click a cell: 0 → 1 → −1 → 2 → −2");
    var iGrid = cellGrid(5, 5, input, function () {}, "5×5 input (fixed pattern)");
    stage.controls.appendChild(iGrid.el);
    stage.controls.appendChild(kGrid.el);

    function rebuildCells() {
      kGrid.cells.forEach(function (b, idx) {
        var r = Math.floor(idx / 3), c = idx % 3;
        var text = Math.round(kernel[r][c] * 100) / 100;
        b.textContent = String(text);
        b.setAttribute("aria-label", "Kernel row " + (r + 1) + " column " + (c + 1) + ", value " + text + ". Click to change.");
      });
    }
    function rebuildInputCells() {
      iGrid.cells.forEach(function (b, idx) {
        var r = Math.floor(idx / 5), c = idx % 5;
        b.textContent = String(input[r][c]);
        b.setAttribute("aria-label", "Input row " + (r + 1) + " column " + (c + 1) + ", value " + input[r][c]);
      });
    }
    var out;
    function compute() {
      var S = strideCtl.value(), P = paddingCtl.value(), D = dilationCtl.value();
      var OH = T.outSize(5, 3, S, P, D), OW = T.outSize(5, 3, S, P, D);
      if (OH <= 0 || OW <= 0) return;
      try {
        out = T.conv2d(input, kernel, { stride: S, padding: P, dilation: D });
      } catch (e) { out = [[0]]; }
      var terms = [], total = 0;
      for (var u = 0; u < 3; u++) {
        for (var v = 0; v < 3; v++) {
          var iy = -P + u * D, ix = -P + v * D;
          var xv = (iy >= 0 && iy < 5 && ix >= 0 && ix < 5) ? input[iy][ix] : 0;
          var prod = xv * kernel[u][v];
          total += prod;
          terms.push(String(xv) + "·" + (Math.round(kernel[u][v] * 100) / 100) + "=" + (Math.round(prod * 100) / 100));
        }
      }
      reads.set("output size", OH + "×" + OW + " (from (5+2·" + P + "−" + D + "·2−1)/" + S + ")");
      reads.set("MACs", OH + "·" + OW + "·9 = " + (OH * OW * 9));
      reads.set("kernel span", "D(K−1)+1 = " + (D * 2 + 1));
      reads.set("top-left value", String(total));
      box.textContent = terms.join(" + ") + " = " + (Math.round(total * 1000) / 1000);
      draw();
    }
    function panel(M, x, y, w, h, title, values) {
      var r = { x: x, y: y, w: w, h: h };
      V.heatmap(ctx, M, r, { cmap: "div", gap: 1, values: values, fmt: function (v) { return String(Math.round(v * 10) / 10); } });
      V.text(ctx, title, x, y - 6, { size: 10, mono: true, color: V.palette().ink2 });
    }
    function draw() {
      var p = V.palette();
      view.clear(p.surface);
      panel(input, 18, 42, 150, 150, "input 5×5", true);
      panel(kernel, 190, 78, 108, 108, "kernel 3×3", true);
      if (out) panel(out, 330, 42, 190, 150, "output " + out.length + "×" + (out[0] ? out[0].length : 0), out.length <= 5);
      V.text(ctx, "cross-correlation: no kernel flip (PyTorch Conv2d convention)", 18, 14,
        { size: 10, color: p.ink3 });
    }
    rebuildCells(); rebuildInputCells(); compute();
    return { reset: function () {
      presetCtl.set("sobel", true); patternCtl.set("worked", true);
      strideCtl.set(2, true); paddingCtl.set(1, true); dilationCtl.set(1, true);
      kernel = clone(presets.sobel); input = clone(inputPatterns.worked);
      rebuildCells(); rebuildInputCells(); compute();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m1-04-shape-param-calculator — exact output-size and parameter chain
   * Exact: DL.tensor.outSize + DL.nn.convParams / fcParams / BN = 2C.
   * ------------------------------------------------------------------ */
    DL.widgets.register("m1-04-shape-param-calculator", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 560, h: 190, label: "Parameters per stage, computed from the selected architecture" });
    var ctx = view.ctx;
    var archCtl = U.select({
      label: "Architecture", options: [
        { value: "custom", label: "Custom single conv" },
        { value: "lenet", label: "LeNet-like (28×28, 1ch)" },
        { value: "alexnet", label: "AlexNet-lite (32×32, 3ch)" },
        { value: "vgg", label: "VGG-style 3×3 block stack" },
        { value: "resnet", label: "ResNet basic block" },
        { value: "inception", label: "Inception module" }
      ], value: "lenet", onChange: draw
    });
    var hwCtl = U.slider({ label: "H = W (custom)", min: 8, max: 96, step: 8, value: 32, digits: 0, onInput: draw });
    var cCtl = U.select({ label: "C_in (custom)", options: [1, 3, 16, 64].map(function (v) { return { value: String(v), label: String(v) }; }), value: "3", onChange: draw });
    var kCtl = U.select({ label: "Kernel K (custom)", options: [1, 2, 3, 5].map(function (v) { return { value: String(v), label: String(v) }; }), value: "3", onChange: draw });
    var sCtl = U.slider({ label: "Stride S (custom)", min: 1, max: 3, step: 1, value: 1, digits: 0, onInput: draw });
    var pCtl = U.slider({ label: "Padding P (custom)", min: 0, max: 3, step: 1, value: 1, digits: 0, onInput: draw });
    var dCtl = U.slider({ label: "Dilation D (custom)", min: 1, max: 3, step: 1, value: 1, digits: 0, onInput: draw });
    var oCtl = U.slider({ label: "Conv filters (custom)", min: 4, max: 128, step: 4, value: 16, digits: 0, onInput: draw });
    var reads = U.readouts(["input shape", "final shape", "total params", "conv stages"]);
    var box = mathBox("Substitution for the first conv", "");
    var table = U.table({
      columns: ["layer", "output (N,C,H,W)", "params", "arithmetic"],
      rows: [], caption: "Forward pass, N = 1 — every row recomputed in the browser"
    });
    stage.controls.insertBefore(archCtl.el, stage.controls.firstChild);
    [hwCtl, cCtl, kCtl, sCtl, pCtl, dCtl, oCtl, reads.el, box, table.el].forEach(function (x) { stage.controls.appendChild(x.el || x); });
    stage.controls.appendChild(small("Totals are computed from layer shapes; tools/params.py gives LeNet-5 61,706 and ResNet-18 11,689,512 for the full reference models."));

    function conv(cin, cout, k, s, p, d, bias, name) {
      return { type: "conv", cin: cin, cout: cout, k: k, s: s || 1, p: p || 0, d: d || 1,
        bias: bias === undefined ? true : bias, name: name || ("conv " + k + "x" + k + " " + cin + "->" + cout) };
    }
    function bn(c) { return { type: "bn", c: c, name: "BatchNorm2d(" + c + ")" }; }
    function pool(k, s, p, name) { return { type: "pool", k: k, s: s || k, p: p || 0, name: name || ("pool " + k + "x" + k + "/s" + (s || k)) }; }
    function flatten() { return { type: "flatten", name: "Flatten" }; }
    function fc(i, o) { return { type: "fc", i: i, o: o, name: "Linear " + i + "->" + o }; }

    function buildSpec() {
      var a = archCtl.value();
      if (a === "custom") {
        var H = hwCtl.value(), C = parseInt(cCtl.value(), 10), K = parseInt(kCtl.value(), 10);
        var S = sCtl.value(), P = pCtl.value(), D = dCtl.value(), Co = oCtl.value();
        var h1 = T.outSize(H, K, S, P, D);
        var h2 = T.outSize(Math.max(1, h1), 2, 2, 0, 1);
        return { H: H, C: C, layers: [conv(C, Co, K, S, P, D, true),
          pool(2, 2, 0), flatten(), fc(Co * h2 * h2, 10)] };
      }
      if (a === "lenet") {
        return { H: 28, C: 1, layers: [conv(1, 6, 5), pool(2, 2), conv(6, 16, 5), pool(2, 2),
          flatten(), fc(400, 120), fc(120, 84), fc(84, 10)] };
      }
      if (a === "alexnet") {
        return { H: 32, C: 3, layers: [conv(3, 32, 5), pool(2, 2), conv(32, 64, 5), pool(2, 2),
          flatten(), fc(64 * 8 * 8, 128), fc(128, 10)] };
      }
      if (a === "vgg") {
        return { H: 32, C: 3, layers: [conv(3, 64, 3, 1, 1), conv(64, 64, 3, 1, 1), bn(64), pool(2, 2),
          conv(64, 128, 3, 1, 1), conv(128, 128, 3, 1, 1), bn(128), pool(2, 2),
          flatten(), fc(128 * 8 * 8, 128), fc(128, 10)] };
      }
      if (a === "resnet") {
        return { H: 56, C: 64, layers: [
          { type: "resblock", cin: 64, cout: 64, k: 3, s: 1, p: 1, proj: false, name: "BasicBlock 64->64" }] };
      }
      return { H: 28, C: 64, layers: [
        { type: "branches", name: "Inception concat", branches: [
          [conv(64, 64, 1)],
          [conv(64, 96, 1), conv(96, 128, 3, 1, 1)],
          [conv(64, 16, 1), conv(16, 32, 5, 1, 2)],
          [pool(3, 1, 1, "pool3 s1 p1"), conv(64, 32, 1)]
        ] }, flatten(), fc(256 * 28 * 28, 10)] };
    }

    function step(op, shape) {
      var name = op.name, params = 0, arith = "";
      if (op.type === "conv") {
        params = NN.convParams(op.cin, op.cout, op.k, op.bias);
        var h = T.outSize(shape[2], op.k, op.s, op.p, op.d);
        var w = T.outSize(shape[3], op.k, op.s, op.p, op.d);
        arith = "H'=((" + shape[2] + "+2*" + op.p + "-" + op.d + "*(" + op.k + "-1)-1)/" + op.s + " floor)+1=" + h +
          "; params=" + op.k + "^2*" + op.cin + "*" + op.cout + (op.bias ? "+" + op.cout : "") + "=" + params;
        shape = [1, op.cout, h, w];
      } else if (op.type === "bn") {
        params = 2 * op.c; arith = "2C = 2*" + op.c;
      } else if (op.type === "pool") {
        var ph = T.outSize(shape[2], op.k, op.s, op.p, 1);
        var pw = T.outSize(shape[3], op.k, op.s, op.p, 1);
        arith = "((" + shape[2] + "+2*" + op.p + "-" + op.k + "-1)/" + op.s + " floor)+1=" + ph;
        shape = [1, shape[1], ph, pw];
      } else if (op.type === "flatten") {
        arith = "C*H*W = " + shape[1] + "*" + shape[2] + "*" + shape[3] + " = " + (shape[1] * shape[2] * shape[3]);
        shape = [1, shape[1] * shape[2] * shape[3]];
      } else if (op.type === "fc") {
        params = NN.fcParams(op.i, op.o, true);
        arith = op.i + "*" + op.o + "+" + op.o + "=" + params;
        shape = [1, op.o];
      } else if (op.type === "resblock") {
        var c1 = NN.convParams(op.cin, op.cout, op.k, false), c2 = NN.convParams(op.cout, op.cout, op.k, false);
        var proj = op.proj ? NN.convParams(op.cin, op.cout, 1, false) : 0;
        params = c1 + 2 * op.cout + c2 + 2 * op.cout + proj + (op.proj ? 2 * op.cout : 0);
        var rh = T.outSize(shape[2], op.k, op.s, op.p, 1);
        arith = "2*(" + op.k + "^2*" + op.cin + "*" + op.cout + ") + 4C + skip " + proj +
          " = " + params + ";  y = x + F(x)";
        shape = [1, op.cout, rh, rh];
      } else if (op.type === "branches") {
        var outs = [], chans = 0;
        op.branches.forEach(function (branch, bi) {
          var bs = shape.slice(), bp = 0;
          branch.forEach(function (bop) {
            var r0 = step(bop, bs);
            bs = r0.shape; bp += r0.params;
          });
          outs.push(bs); chans += bs[1]; params += bp;
          arith += (bi ? " | " : "") + "branch" + (bi + 1) + ": " + chans + "ch, " + NN.formatCount(bp);
        });
        shape = [1, chans, outs[0][2], outs[0][3]];
        arith += " => concat " + chans + " channels";
      }
      return { name: name, shape: shape, params: params, arith: arith };
    }

    function draw() {
      var spec = buildSpec();
      var shape = [1, spec.C, spec.H, spec.H], rows = [], total = 0, stages = [], first = null;
      spec.layers.forEach(function (op) {
        var r = step(op, shape);
        shape = r.shape; total += r.params;
        rows.push([r.name, "(" + r.shape.join(", ") + ")", NN.formatCount(r.params), r.arith]);
        if (op.type === "conv" || op.type === "resblock" || op.type === "branches") {
          stages.push(r.params);
          if (!first) first = { arith: r.arith, params: r.params };
        }
      });
      rows.push(["TOTAL", "(" + shape.join(", ") + ")", NN.formatCount(total), "sum of all layers"]);
      table.update(rows);
      reads.set("input shape", "(" + spec.C + ", " + spec.H + ", " + spec.H + ")");
      reads.set("final shape", "(" + shape.join(", ") + ")");
      reads.set("total params", NN.formatCount(total));
      reads.set("conv stages", String(stages.length));
      box.textContent = first ? first.arith : "Add a conv layer to see the substitution.";
      var p = V.palette();
      view.clear(p.surface);
      var r = { x: 42, y: 22, w: view.w - 60, h: view.h - 60 };
      V.bars(ctx, stages.map(function (v) { return Math.max(v, 1); }), r, {
        labels: stages.map(function (_, i) { return "S" + (i + 1); }),
        cmap: "viridis", values: false
      });
      V.text(ctx, "parameters per conv stage (bar height is proportional), total " + NN.formatCount(total),
        r.x, 14, { size: 10, mono: true, color: p.ink2 });
    }
    draw();
    return { reset: function () {
      archCtl.set("lenet", true); hwCtl.set(32, true); cCtl.set("3", true); kCtl.set("3", true);
      sCtl.set(1, true); pCtl.set(1, true); dCtl.set(1, true); oCtl.set(16, true); draw();
    } };
  });

/* ------------------------------------------------------------------ *
   * m1-03-feature-map-drawer — draw pixels, see real conv feature maps
   * Exact: DL.tensor.conv2d / conv2dMulti on the drawn pixels.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-03-feature-map-drawer", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 620, h: 470, label: "Drawn input, eight first-layer feature maps and four second-layer maps" });
    var ctx = view.ctx;
    var N = 12;
    var pixels = T.zeros(N, N);
    var kernels = [
      [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]],
      [[-1, -1, -1], [0, 0, 0], [1, 1, 1]],
      [[0, 1, 0], [1, -4, 1], [0, 1, 0]],
      [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
      [[1, 0, -1], [2, 0, -2], [1, 0, -1]],
      [[0, -1, 0], [-1, 4, -1], [0, -1, 0]],
      [[1, -1, 1], [-1, 1, -1], [1, -1, 1]],
      [[0, 0, 0], [0, 1, 0], [0, 0, 0]]
    ];
    var names = ["vertical edge", "horizontal edge", "laplacian", "box blur", "sobel-x", "spot", "checker", "identity"];
    var reads = U.readouts(["drawn pixels", "selected map max", "selected map mean", "layer-2 maps"]);
    var select = U.select({
      label: "Inspect map", options: kernels.map(function (_, i) { return { value: String(i), label: (i + 1) + " · " + names[i] }; }),
      value: "4", onChange: draw
    });
    var clearBtn = DL.el("button", { type: "button", class: "btn", text: "Clear canvas", "aria-label": "Clear the drawn image",
      on: { click: function () { pixels = T.zeros(N, N); compute(); } } });
    var squareBtn = DL.el("button", { type: "button", class: "btn", text: "Square", "aria-label": "Draw a bright square",
      on: { click: function () { pattern("square"); } } });
    var crossBtn = DL.el("button", { type: "button", class: "btn", text: "Cross", "aria-label": "Draw a bright cross",
      on: { click: function () { pattern("cross"); } } });
    stage.controls.appendChild(select.el);
    stage.controls.appendChild(U.row(clearBtn, squareBtn, crossBtn));
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(small("Click or drag the left canvas to draw. Focus it and use arrow keys + Space for keyboard drawing."));
    stage.controls.appendChild(mathBox("What you see", "Layer 1: 8 filters × 3×3 on a 12×12 input → 8 maps of 12×12. Layer 2: 4 filters over all 8 maps → 4 maps of 12×12."));

    function pattern(kind) {
      pixels = T.zeros(N, N);
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
        if (kind === "square" && i >= 3 && i <= 8 && j >= 3 && j <= 8) pixels[i][j] = 9;
        if (kind === "cross" && (Math.abs(i - 5) <= 1 || Math.abs(j - 6) <= 1)) pixels[i][j] = 9;
      }
      compute();
    }
    var inRect = { x: 20, y: 34, w: 176, h: 176 };
    var cursor = [5, 5];
    function pointer(e, paint) {
      var r = view.canvas.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width * view.w;
      var py = (e.clientY - r.top) / r.height * view.h;
      var i = Math.floor((py - inRect.y) / inRect.h * N), j = Math.floor((px - inRect.x) / inRect.w * N);
      if (i < 0 || i >= N || j < 0 || j >= N) return;
      cursor = [i, j];
      if (paint) pixels[i][j] = pixels[i][j] > 0 ? 0 : 9;
      compute();
    }
    var painting = false;
    view.canvas.addEventListener("pointerdown", function (e) { painting = true; pointer(e, true); view.canvas.setPointerCapture(e.pointerId); });
    view.canvas.addEventListener("pointermove", function (e) { if (painting) pointer(e, true); });
    view.canvas.addEventListener("pointerup", function () { painting = false; });
    view.canvas.style.cursor = "crosshair";
    view.canvas.setAttribute("tabindex", "0");
    view.canvas.setAttribute("aria-label", "Draw input pixels: arrow keys move the cursor, Space toggles the pixel");
    view.canvas.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") cursor[1] = Math.max(0, cursor[1] - 1);
      else if (e.key === "ArrowRight") cursor[1] = Math.min(N - 1, cursor[1] + 1);
      else if (e.key === "ArrowUp") cursor[0] = Math.max(0, cursor[0] - 1);
      else if (e.key === "ArrowDown") cursor[0] = Math.min(N - 1, cursor[0] + 1);
      else if (e.key === " " || e.key === "Enter") pixels[cursor[0]][cursor[1]] = pixels[cursor[0]][cursor[1]] > 0 ? 0 : 9;
      else return;
      e.preventDefault(); compute();
    });

    var layer1, layer2;
    function secondKernel(o, c) {
      var s = ((o * 3 + c * 5) % 2) ? 1 : -1;
      return [[0, s, 0], [s, -2 * s, s], [0, s, 0]];
    }
    function compute() {
      layer1 = kernels.map(function (k) { return T.conv2d(pixels, k, { padding: 1 }); });
      var bank = [];
      for (var o = 0; o < 4; o++) {
        var ks = [];
        for (var c = 0; c < 8; c++) ks.push(secondKernel(o, c));
        bank.push(ks);
      }
      layer2 = T.conv2dMulti(layer1, bank, { padding: 1 });
      var chosen = layer1[parseInt(select.value(), 10)];
      reads.set("drawn pixels", pixels.reduce(function (a, r) { return a + r.filter(function (v) { return v > 0; }).length; }, 0));
      reads.set("selected map max", T.maxOf(chosen));
      reads.set("selected map mean", DL.fmt(T.mean(chosen), 3));
      reads.set("layer-2 maps", layer2.length + " × " + layer2[0].length + "×" + layer2[0][0].length);
      draw();
    }
    function panel(M, x, y, w, h, title, opts) {
      var r = { x: x, y: y, w: w, h: h };
      opts = opts || {};
      V.heatmap(ctx, M, r, { cmap: opts.cmap || "div", vmin: opts.vmin === undefined ? -18 : opts.vmin,
        vmax: opts.vmax === undefined ? 18 : opts.vmax, gap: 1 });
      V.text(ctx, title, x, y - 5, { size: 9, mono: true, color: V.palette().ink2 });
    }
    function draw() {
      var p = V.palette();
      view.clear(p.surface);
      panel(pixels, inRect.x, inRect.y, inRect.w, inRect.h, "drawn 12×12 input", { cmap: "gray", vmin: 0, vmax: 9 });
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      ctx.strokeRect(inRect.x + cursor[1] * inRect.w / N, inRect.y + cursor[0] * inRect.h / N, inRect.w / N, inRect.h / N);
      for (var k = 0; k < 8; k++) {
        panel(layer1[k], 225 + (k % 4) * 98, 34 + Math.floor(k / 4) * 118, 90, 90,
          (k + 1) + " " + names[k]);
      }
      V.text(ctx, "layer 1 · feature maps (12×12 each)", 225, 18, { size: 10, mono: true, color: p.ink2 });
      for (var q = 0; q < 4; q++) {
        panel(layer2[q], 225 + q * 98, 290, 90, 90, "L2 filter " + (q + 1), { vmin: -36, vmax: 36, cmap: "div" });
      }
      V.text(ctx, "layer 2 · each filter mixes all 8 maps", 225, 274, { size: 10, mono: true, color: p.ink2 });
      V.text(ctx, "values are cross-correlations with padding=1, no biases", 20, 230, { size: 9, color: p.ink3 });
    }
    pattern("square");
    return { reset: function () { select.set("4", true); pattern("square"); } };
  });

  /* ------------------------------------------------------------------ *
   * m1-03-pooling-comparer — max / avg / GAP on an editable 4×4 map
   * Exact: DL.tensor.pool2d and DL.tensor.gap.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-03-pooling-comparer", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 580, h: 250, label: "Input map, max-pooled map and average-pooled map" });
    var ctx = view.ctx;
    var maps = [
      [[1, 5, 2, 8], [3, 4, 7, 6], [9, 2, 1, 5], [0, 3, 8, 4]],
      [[7, 1, 4, 2], [2, 9, 3, 5], [6, 0, 8, 1], [4, 2, 7, 3]]
    ];
    var active = 0;
    var values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    var chanCtl = U.buttons({ label: "Channel", options: [{ value: 0, label: "A" }, { value: 1, label: "B" }],
      value: 0, onChange: function (v) { active = parseInt(v, 10); rebuild(); } });
    var sizeCtl = U.select({ label: "Pool window K", options: [2, 4].map(function (v) { return { value: String(v), label: String(v) }; }),
      value: "2", onChange: draw });
    var reads = U.readouts(["output size", "GAP channel A", "GAP channel B", "pool parameters"]);
    var box = mathBox("Worked window", "");
    stage.controls.appendChild(chanCtl.el);
    stage.controls.appendChild(sizeCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(box);
    var grid = cellGrid(4, 4, maps[0], function (r, c) {
      var i = values.indexOf(maps[active][r][c]);
      maps[active][r][c] = values[(i + 1) % values.length];
      rebuild();
    }, "4×4 input — click a cell: 0 → 1 → … → 9 → 0");
    stage.controls.appendChild(grid.el);

    var mx, av;
    function rebuild() {
      grid.cells.forEach(function (b, idx) {
        var r = Math.floor(idx / 4), c = idx % 4;
        b.textContent = String(maps[active][r][c]);
        b.setAttribute("aria-label", "Channel " + (active + 1) + " row " + (r + 1) + " column " + (c + 1) + ", value " + maps[active][r][c] + ". Click to change.");
      });
      draw();
    }
    function draw() {
      var K = parseInt(sizeCtl.value(), 10);
      mx = T.pool2d(maps[active], { mode: "max", size: K, stride: K });
      av = T.pool2d(maps[active], { mode: "avg", size: K, stride: K });
      var gaps = T.gap(maps);
      var p = V.palette();
      view.clear(p.surface);
      function pan(M, x, title, fmt) {
        var r = { x: x, y: 34, w: 160, h: 160 };
        V.heatmap(ctx, M, r, { cmap: "ice", vmin: 0, vmax: 9, gap: 2, values: true, fmt: fmt });
        V.text(ctx, title, x, 20, { size: 10, mono: true, color: p.ink2 });
      }
      pan(maps[active], 20, "input · 4×4", function (v) { return String(v); });
      pan(mx, 208, "max · " + mx.length + "×" + mx.length, function (v) { return String(v); });
      pan(av, 396, "average · " + av.length + "×" + av.length, function (v) { return DL.fmt(v, 2); });
      var top = "window rows 0–" + (K - 1) + ", cols 0–" + (K - 1) + ": ";
      var cells = [];
      for (var i = 0; i < K; i++) for (var j = 0; j < K; j++) cells.push(maps[active][i][j]);
      box.textContent = top + cells.join(" , ") + " → max = " + mx[0][0] + ", avg = " +
        DL.fmt(av[0][0], 3) + " = (" + cells.join("+") + ")/" + cells.length + ".";
      reads.set("output size", mx.length + "×" + mx[0].length);
      reads.set("GAP channel A", DL.fmt(gaps[0], 3));
      reads.set("GAP channel B", DL.fmt(gaps[1], 3));
      reads.set("pool parameters", "0 (fixed operation)");
    }
    rebuild();
    return { reset: function () {
      maps = [[[1, 5, 2, 8], [3, 4, 7, 6], [9, 2, 1, 5], [0, 3, 8, 4]],
        [[7, 1, 4, 2], [2, 9, 3, 5], [6, 0, 8, 1], [4, 2, 7, 3]]];
      active = 0; chanCtl.set(0, true); sizeCtl.set("2", true); rebuild();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m1-04-receptive-field — grow a stack, watch RF expand
   * Exact: DL.tensor.receptiveField.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-04-receptive-field", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 560, h: 290, label: "Receptive field on the input grid and RF versus depth" });
    var ctx = view.ctx;
    var kinds = [
      { value: "c3s1", label: "conv 3×3, stride 1", k: 3, s: 1, d: 1 },
      { value: "c3s2", label: "conv 3×3, stride 2", k: 3, s: 2, d: 1 },
      { value: "c5s1", label: "conv 5×5, stride 1", k: 5, s: 1, d: 1 },
      { value: "d3d2", label: "dilated conv 3×3, d=2", k: 3, s: 1, d: 2 },
      { value: "p2s2", label: "max pool 2×2, stride 2", k: 2, s: 2, d: 1 }
    ];
    var kindCtl = U.select({ label: "Layer to add", options: kinds.map(function (q) { return { value: q.value, label: q.label }; }),
      value: "c3s1", onChange: function () {} });
    var addBtn = DL.el("button", { type: "button", class: "btn btn--accent", text: "Add layer",
      "aria-label": "Add the selected layer to the stack", on: { click: add } });
    var clearBtn = DL.el("button", { type: "button", class: "btn", text: "Clear stack",
      "aria-label": "Remove all layers", on: { click: function () { stack = []; recompute(); } } });
    var chips = DL.el("div", { class: "hstack", style: { flexWrap: "wrap", gap: "6px" } });
    var reads = U.readouts(["final RF", "stride jump", "layers", "input area seen"]);
    var table = U.table({ columns: ["#", "layer", "k", "s", "d", "jump", "RF"], rows: [], caption: "Cumulative receptive field from DL.tensor.receptiveField" });
    stage.controls.appendChild(kindCtl.el);
    stage.controls.appendChild(U.row(addBtn, clearBtn));
    stage.controls.appendChild(chips);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(table.el);
    stage.controls.appendChild(small("Worked reference: five 3×3 convs with strides (1,2,1,2,1) reach RF 21, not 3."));

    var stack = [
      { k: 3, s: 1, d: 1, name: "conv3 s1" },
      { k: 3, s: 2, d: 1, name: "conv3 s2" },
      { k: 3, s: 1, d: 1, name: "conv3 s1" }
    ];
    var seq;
    function add() {
      var q = kinds.filter(function (z) { return z.value === kindCtl.value(); })[0];
      stack.push({ k: q.k, s: q.s, d: q.d, name: q.label });
      if (stack.length > 12) stack.shift();
      recompute();
    }
    function recompute() {
      seq = T.receptiveField(stack.map(function (q) { return q.k; }),
        stack.map(function (q) { return q.s; }), stack.map(function (q) { return q.d; }));
      chips.innerHTML = "";
      stack.forEach(function (q, i) {
        var b = DL.el("button", { type: "button", class: "btn", title: "Remove this layer",
          "aria-label": "Remove layer " + (i + 1) + ", " + q.name,
          on: { click: function () { stack.splice(i, 1); recompute(); } } });
        b.textContent = (i + 1) + " · " + q.name + " ×";
        chips.appendChild(b);
      });
      var last = seq[seq.length - 1];
      var jump = last ? last.jump * last.s : 1;
      var rf = last ? last.rf : 1;
      reads.set("final RF", rf + "×" + rf);
      reads.set("stride jump", String(jump));
      reads.set("layers", String(stack.length));
      reads.set("input area seen", rf + "² = " + (rf * rf) + " pixels");
      table.update(seq.map(function (v, i) {
        return [i + 1, stack[i].name, v.k, v.s, v.d, v.jump, v.rf + "×" + v.rf];
      }));
      draw();
    }
    function draw() {
      var p = V.palette();
      view.clear(p.surface);
      var r = { x: 24, y: 24, w: 220, h: 220 };
      var cell = r.w / 20;
      var rf = seq.length ? seq[seq.length - 1].rf : 1;
      var span = Math.min(20, rf);
      for (var i = 0; i < 20; i++) for (var j = 0; j < 20; j++) {
        ctx.fillStyle = (i < span && j < span) ? p.accentSoft : p.surface2;
        ctx.fillRect(r.x + j * cell, r.y + i * cell, cell - 0.6, cell - 0.6);
      }
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, span * cell, span * cell);
      V.text(ctx, "input grid: highlighted = RF " + rf + "×" + rf + (rf > 20 ? " (clipped at 20)" : ""), 24, 14,
        { size: 10, mono: true, color: p.ink2 });
      var lr = { x: 286, y: 24, w: view.w - 310, h: 220 };
      if (seq.length) {
        V.line(ctx, [{ pts: seq.map(function (v, i) { return [i + 1, v.rf]; }), color: p.accent, width: 2.4 }], lr,
          { xmin: 1, xmax: Math.max(2, seq.length), ymin: 0, ymax: Math.max(4, rf * 1.1), grid: true,
            xlabel: "layer", ylabel: "RF (pixels)" });
      }
    }
    recompute();
    return { reset: function () {
      stack = [{ k: 3, s: 1, d: 1, name: "conv3 s1" }, { k: 3, s: 2, d: 1, name: "conv3 s2" },
        { k: 3, s: 1, d: 1, name: "conv3 s1" }];
      kindCtl.set("c3s1", true); recompute();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m1-04-residual-gradient — repeated multiplication, plain vs skip
   * Exact: every point is gain^depth or (1+gain)^depth.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-04-residual-gradient", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 560, h: 280, label: "Gradient gain versus depth, plain stack and residual stack" });
    var ctx = view.ctx;
    var depthCtl = U.slider({ label: "Depth (layers)", min: 1, max: 50, step: 1, value: 20, digits: 0, onInput: draw });
    var gainCtl = U.slider({ label: "Branch gain per layer", min: 0.05, max: 1.2, step: 0.05, value: 0.1, digits: 2, onInput: draw });
    var reads = U.readouts(["plain at depth", "residual at depth", "plain ×10⁻²⁰ check", "formula"]);
    var box = mathBox("Worked arithmetic", "");
    stage.controls.appendChild(depthCtl.el);
    stage.controls.appendChild(gainCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(box);
    stage.controls.appendChild(small("Gain is the local Jacobian factor: ∂F/∂x = 0.1 in the default setting. Skip adds 1 to it at every layer."));

    function draw() {
      var D = depthCtl.value(), g = gainCtl.value();
      var p = V.palette();
      view.clear(p.surface);
      var plain = [], resid = [];
      var pv = 1, rv = 1;
      for (var d = 1; d <= D; d++) {
        pv *= g; rv *= (1 + g);
        plain.push([d, Math.min(pv, 1e8)]);
        resid.push([d, Math.min(rv, 1e8)]);
      }
      var r = { x: 48, y: 18, w: view.w - 66, h: view.h - 62 };
      V.line(ctx, [
        { pts: plain, color: p.danger, width: 2.2 },
        { pts: resid, color: p.accent, width: 2.2 }
      ], r, { xmin: 1, xmax: D, ymin: 0, ymax: Math.max(2, Math.min(rv * 1.05, 1e8)), grid: true,
        xlabel: "depth", ylabel: "gradient gain (clipped at 10⁸)" });
      V.legend(ctx, [{ color: p.danger, label: "plain: g^D" }, { color: p.accent, label: "residual: (1+g)^D" }],
        { x: r.x + 10, y: r.y + 8 }, {});
      reads.set("plain at depth", DL.sci(pv, 2));
      reads.set("residual at depth", DL.fmt(rv, 2));
      reads.set("plain ×10⁻²⁰ check", D === 20 && Math.abs(g - 0.1) < 1e-9 ? "1.0e-20" : "—");
      reads.set("formula", "∂y/∂x = I + ∂F/∂x");
      box.textContent = "At depth " + D + " with g = " + g + ": plain = " + g + "^" + D + " = " + DL.sci(pv, 3) +
        "; residual = (1+" + g + ")^" + D + " = " + DL.fmt(rv, 3) + ".";
    }
    draw();
    return { reset: function () { depthCtl.set(20, true); gainCtl.set(0.1, true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m1-05-bn-histogram — batch normalisation on a live batch
   * Exact: mean/variance/normalisation computed from the displayed values.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-05-bn-histogram", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 580, h: 260, label: "Activation histograms before and after BatchNorm" });
    var ctx = view.ctx;
    var shiftCtl = U.slider({ label: "Input mean shift", min: -4, max: 4, step: 0.1, value: 2, digits: 1, onInput: compute });
    var scaleCtl = U.slider({ label: "Input std", min: 0.2, max: 3, step: 0.1, value: 1.5, digits: 1, onInput: compute });
    var gammaCtl = U.slider({ label: "γ (learned scale)", min: 0.2, max: 3, step: 0.1, value: 1.4, digits: 1, onInput: compute });
    var betaCtl = U.slider({ label: "β (learned shift)", min: -2, max: 2, step: 0.1, value: 0.3, digits: 1, onInput: compute });
    var stepCtl = U.slider({ label: "Training step (drift)", min: 0, max: 20, step: 1, value: 0, digits: 0, onInput: compute });
    var bnCtl = U.toggle({ label: "BatchNorm enabled", checked: true, onChange: compute });
    var reads = U.readouts(["batch mean μ_B", "batch variance", "mean after BN", "std after BN"]);
    var box = mathBox("Worked substitution", "");
    [shiftCtl, scaleCtl, gammaCtl, betaCtl, stepCtl, bnCtl.el, reads.el, box].forEach(function (x) { stage.controls.appendChild(x.el || x); });
    var rng = DL.rng(42);
    var z = [];
    for (var i = 0; i < 128; i++) z.push(DL.randn(rng));

    function compute() {
      var shift = shiftCtl.value(), sc = scaleCtl.value(), g = gammaCtl.value(), b = betaCtl.value();
      var drift = stepCtl.value() / 20;
      var x = z.map(function (v) { return shift + drift + sc * v; });
      var mu = DL.mean(x);
      var varr = DL.mean(x.map(function (v) { return (v - mu) * (v - mu); }));
      var eps = 1e-5;
      var denom = Math.sqrt(varr + eps);
      var hat = x.map(function (v) { return (v - mu) / denom; });
      var on = bnCtl.checked();
      var y = on ? hat.map(function (v) { return g * v + b; }) : x.slice();
      var my = DL.mean(y), vy = DL.mean(y.map(function (v) { return (v - my) * (v - my); }));
      var p = V.palette();
      view.clear(p.surface);
      V.histogram(ctx, x, { x: 44, y: 18, w: view.w - 66, h: 96 }, { bins: 26, cmap: "ember" });
      V.histogram(ctx, y, { x: 44, y: 148, w: view.w - 66, h: 96 }, { bins: 26, cmap: on ? "accent" : "ember" });
      V.text(ctx, "before: μ = " + DL.fmt(mu, 2) + ", σ = " + DL.fmt(Math.sqrt(varr), 2), 44, 14, { size: 10, mono: true });
      V.text(ctx, "after " + (on ? "BN (γ=" + g + ", β=" + b + ")" : "no BN"), 44, 144, { size: 10, mono: true });
      reads.set("batch mean μ_B", DL.fmt(mu, 3));
      reads.set("batch variance", DL.fmt(varr, 3));
      reads.set("mean after BN", DL.fmt(my, 3));
      reads.set("std after BN", DL.fmt(Math.sqrt(vy), 3));
      box.textContent = "x̂=(x−" + DL.fmt(mu, 3) + ")/√(" + DL.fmt(varr, 3) + "+1e−5); y=γx̂+β" +
        (on ? " → mean " + DL.fmt(my, 3) + ", std " + DL.fmt(Math.sqrt(vy), 3) : " — BN off, y = x.");
    }
    compute();
    return { reset: function () {
      shiftCtl.set(2, true); scaleCtl.set(1.5, true); gammaCtl.set(1.4, true);
      betaCtl.set(0.3, true); stepCtl.set(0, true); bnCtl.set(true, true); compute();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m1-05-reg-geometry — L1 / L2 constraint regions and loss contours
   * Exact: contours and analytic optima are computed for the displayed lambda.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-05-reg-geometry", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 520, h: 360, label: "Loss contours with L1 diamond or L2 disc constraint" });
    var ctx = view.ctx;
    var lamCtl = U.slider({ label: "λ (regularisation strength)", min: 0, max: 2, step: 0.05, value: 0.5, digits: 2, onInput: draw });
    var kindCtl = U.buttons({ label: "Penalty", options: [{ value: "l2", label: "L2 (ridge)" }, { value: "l1", label: "L1 (lasso)" }],
      value: "l2", onChange: draw });
    var reads = U.readouts(["unconstrained optimum", "regularised optimum", "constraint radius", "objective there"]);
    var box = mathBox("Analytic solution", "");
    stage.controls.appendChild(kindCtl.el);
    stage.controls.appendChild(lamCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(box);

    function soft(v, l) { return v > l / 2 ? v - l / 2 : (v < -l / 2 ? v + l / 2 : 0); }
    function loss(a, b, lam, kind) {
      var base = (a - 2) * (a - 2) + (b - 1) * (b - 1);
      return base + lam * (kind === "l2" ? a * a + b * b : Math.abs(a) + Math.abs(b));
    }
    function draw() {
      var lam = lamCtl.value(), kind = kindCtl.value();
      var opt = kind === "l2" ? [2 / (1 + lam), 1 / (1 + lam)] : [soft(2, lam), soft(1, lam)];
      var radius = lam > 0 ? Math.sqrt(1 / lam) : 99;
      var p = V.palette();
      view.clear(p.surface);
      var r = { x: 44, y: 16, w: view.w - 62, h: view.h - 60 };
      var M = [];
      for (var iy = 0; iy < 40; iy++) {
        var row = [];
        for (var ix = 0; ix < 40; ix++) {
          var x = -4 + 8 * ix / 39, y = -4 + 8 * iy / 39;
          row.push(Math.log1p(Math.max(0, (x - 2) ** 2 + (y - 1) ** 2)));
        }
        M.push(row);
      }
      V.heatmap(ctx, M, r, { cmap: "viridis", vmin: 0, vmax: Math.log1p(32), border: true });
      var sx = function (v) { return r.x + (v + 4) / 8 * r.w; };
      var sy = function (v) { return r.y + r.h - (v + 4) / 8 * r.h; };
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      // constraint boundary, budget t = 1
      ctx.beginPath();
      if (kind === "l2") {
        ctx.arc(sx(0), sy(0), radius / 8 * r.w, 0, Math.PI * 2);
      } else {
        var d = 1 / lam;
        ctx.moveTo(sx(-d), sy(0)); ctx.lineTo(sx(0), sy(d));
        ctx.lineTo(sx(d), sy(0)); ctx.lineTo(sx(0), sy(-d)); ctx.closePath();
      }
      ctx.strokeStyle = p.danger; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.globalAlpha = 0.14; ctx.fillStyle = p.danger; ctx.fill(); ctx.globalAlpha = 1;
      V.dot(ctx, sx(2), sy(1), 5, p.ink);
      V.dot(ctx, sx(opt[0]), sy(opt[1]), 6, p.accent);
      ctx.restore();
      V.axes(ctx, r, { xmin: -4, xmax: 4, ymin: -4, ymax: 4, grid: false, ticks: 4, xlabel: "θ₁", ylabel: "θ₂" });
      V.legend(ctx, [{ color: p.ink, label: "unconstrained (2,1)" }, { color: p.accent, label: "regularised" },
        { color: p.danger, label: kind + " constraint, t=1" }], { x: r.x + 6, y: r.y + 6 }, {});
      reads.set("unconstrained optimum", "(2, 1)");
      reads.set("regularised optimum", "(" + DL.fmt(opt[0], 3) + ", " + DL.fmt(opt[1], 3) + ")");
      reads.set("constraint radius", kind === "l2" ? DL.fmt(radius, 3) : "diamond |θ₁|+|θ₂|=" + DL.fmt(1 / lam, 3));
      reads.set("objective there", DL.fmt(loss(opt[0], opt[1], lam, kind), 4));
      box.textContent = kind === "l2"
        ? "minimise (θ₁−2)²+(θ₂−1)² + λ(θ₁²+θ₂²) → θ = (2,1)/(1+λ) = (" + DL.fmt(opt[0], 3) + ", " + DL.fmt(opt[1], 3) + ")."
        : "Soft-threshold: θᵢ = sign(vᵢ)·max(|vᵢ|−λ/2, 0), v=(2,1) → (" + DL.fmt(opt[0], 3) + ", " + DL.fmt(opt[1], 3) + ").";
    }
    draw();
    return { reset: function () { lamCtl.set(0.5, true); kindCtl.set("l2", true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m1-05-lr-schedule-plotter — step / cosine / one-cycle / warmup+cosine
   * Exact: every eta(t) is evaluated and the area uses trapezoids.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-05-lr-schedule-plotter", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 560, h: 300, label: "Learning rate versus training step for four schedules" });
    var ctx = view.ctx;
    var kindCtl = U.select({ label: "Schedule", options: [
      { value: "cosine", label: "cosine" }, { value: "step", label: "step decay" },
      { value: "onecycle", label: "one-cycle" }, { value: "warmcos", label: "warmup + cosine" }
    ], value: "warmcos", onChange: draw });
    var hiCtl = U.slider({ label: "η_max", min: 0.01, max: 0.5, step: 0.01, value: 0.1, digits: 2, onInput: draw });
    var loCtl = U.slider({ label: "η_min", min: 0, max: 0.05, step: 0.001, value: 0.001, digits: 3, onInput: draw });
    var tCtl = U.slider({ label: "Total steps T", min: 50, max: 500, step: 10, value: 200, digits: 0, onInput: draw });
    var warmCtl = U.slider({ label: "Warmup steps t_w", min: 0, max: 60, step: 1, value: 20, digits: 0, onInput: draw });
    var probeCtl = U.slider({ label: "Probe step t", min: 0, max: 200, step: 1, value: 50, digits: 0, onInput: draw });
    var reads = U.readouts(["η at probe step", "integrated LR area", "mean LR", "η_max", "η_min"]);
    var box = mathBox("Formula at the probe step", "");
    [kindCtl, hiCtl, loCtl, tCtl, warmCtl, probeCtl, reads.el, box].forEach(function (x) { stage.controls.appendChild(x.el || x); });

    function eta(t, kind, hi, lo, T, tw) {
      if (T <= 0) return lo;
      if (kind === "step") return hi * Math.pow(0.1, Math.floor(3 * t / T));
      if (kind === "onecycle") {
        var f = t < T / 2 ? t / (T / 2) : (T - t) / (T / 2);
        return lo + (hi - lo) * Math.max(0, f);
      }
      if (kind === "cosine") return lo + 0.5 * (hi - lo) * (1 + Math.cos(Math.PI * t / T));
      var tc = Math.min(T, tw);
      if (t < tc) return lo + (hi - lo) * (t + 1) / (tc + 1);
      var u = (t - tc) / Math.max(1, T - tc);
      return lo + 0.5 * (hi - lo) * (1 + Math.cos(Math.PI * u));
    }
    function draw() {
      var T = tCtl.value(), hi = hiCtl.value(), lo = Math.min(loCtl.value(), hi), tw = warmCtl.value(), kind = kindCtl.value();
      probeCtl.setMax(T);
      var pt = Math.min(probeCtl.value(), T);
      var pts = [], area = 0;
      for (var t = 0; t <= T; t++) {
        var v = eta(t, kind, hi, lo, T, tw);
        pts.push([t, v]);
        if (t > 0) area += 0.5 * (v + eta(t - 1, kind, hi, lo, T, tw));
      }
      var p = V.palette();
      view.clear(p.surface);
      var r = { x: 48, y: 16, w: view.w - 66, h: view.h - 60 };
      V.line(ctx, [{ pts: pts, color: p.accent, width: 2.4 }], r,
        { xmin: 0, xmax: T, ymin: 0, ymax: hi * 1.1, grid: true, xlabel: "step t", ylabel: "learning rate η" });
      var sx = function (v) { return r.x + v / T * r.w; };
      var sy = function (v) { return r.y + r.h - v / (hi * 1.1) * r.h; };
      V.dashedLine(ctx, sx(pt), r.y, sx(pt), r.y + r.h, { color: p.danger, dash: [4, 4] });
      V.dot(ctx, sx(pt), sy(eta(pt, kind, hi, lo, T, tw)), 5, p.danger);
      reads.set("η at probe step", DL.fmt(eta(pt, kind, hi, lo, T, tw), 5));
      reads.set("integrated LR area", DL.fmt(area, 3));
      reads.set("mean LR", DL.fmt(area / (T + 1), 5));
      reads.set("η_max", DL.fmt(hi, 4));
      reads.set("η_min", DL.fmt(lo, 4));
      box.textContent = kind === "warmcos"
        ? "t=" + pt + ": warmup for t<t_w=" + tw + ", then η=η_min+½(η_max−η_min)(1+cos(π(t−t_w)/(T−t_w))) = " + DL.fmt(eta(pt, kind, hi, lo, T, tw), 5) + "."
        : kind + " at t=" + pt + " gives η=" + DL.fmt(eta(pt, kind, hi, lo, T, tw), 5) + "; area by trapezoids = " + DL.fmt(area, 3) + ".";
    }
    draw();
    return { reset: function () {
      kindCtl.set("warmcos", true); hiCtl.set(0.1, true); loCtl.set(0.001, true);
      tCtl.set(200, true); warmCtl.set(20, true); probeCtl.set(50, true); draw();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m1-05-optimizer-surfaces — time-sliced race using DL.nn.opt
   * Exact: gradients/optimizer states are computed live by DL.nn.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-05-optimizer-surfaces", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 540, h: 330, label: "Ravine loss surface with optimizer trajectories" });
    var ctx = view.ctx;
    var lossCtl = U.select({ label: "Surface", options: [
      { value: "ravine", label: "Ravine ½(θ₁²+100θ₂²)" },
      { value: "saddle", label: "Saddle ½(θ₁²−θ₂²)" }
    ], value: "ravine", onChange: reset });
    var reads = U.readouts(["step", "SGD loss", "AdamW loss", "SGD θ", "AdamW θ"]);
    stage.controls.appendChild(lossCtl.el);
    stage.controls.appendChild(reads.el);
    var play = U.playback({
      started: false, speeds: [1, 4, 12, 30],
      onToggle: function (on) { if (on) trainer.start(); else trainer.pause(); },
      onReset: function () { reset(); },
      onSpeed: function (v) { trainer.setSpeed(v); }
    });
    stage.controls.insertBefore(play.el, stage.controls.firstChild);

    var racers, trainer;
    function surface(a, b) {
      return lossCtl.value() === "ravine" ? 0.5 * (a * a + 100 * b * b) : 0.5 * (a * a - b * b);
    }
    function grad(a, b) {
      return lossCtl.value() === "ravine" ? [a, 100 * b] : [a, -b];
    }
    function reset() {
      if (trainer) trainer.pause().reset();
      var start = lossCtl.value() === "ravine" ? [1.6, 0.22] : [1.4, 0.18];
      racers = [
        { name: "SGD", color: V.palette().danger, opt: DL.nn.opt.SGD({ lr: 0.002 }), v: start.slice(), path: [start.slice()] },
        { name: "AdamW", color: V.palette().accent, opt: DL.nn.opt.AdamW({ lr: 0.02, weightDecay: 0.001 }), v: start.slice(), path: [start.slice()] }
      ];
      reads.set("step", "0");
      racers.forEach(function (r) { reads.set(r.name + " loss", DL.fmt(surface(r.v[0], r.v[1]), 4)); reads.set(r.name + " θ", "(" + DL.fmt(r.v[0], 2) + "," + DL.fmt(r.v[1], 2) + ")"); });
      play.setRunning(false);
      draw();
    }
    function onStep(step) {
      racers.forEach(function (r) {
        var g = grad(r.v[0], r.v[1]);
        var params = [{ v: r.v.slice(), g: g }];
        r.opt.step(params);
        r.v = params[0].v;
        r.path.push(r.v.slice());
        if (r.path.length > 600) r.path.shift();
      });
      reads.set("step", String(step));
      racers.forEach(function (r) {
        reads.set(r.name + " loss", DL.fmt(surface(r.v[0], r.v[1]), 4));
        reads.set(r.name + " θ", "(" + DL.fmt(r.v[0], 2) + "," + DL.fmt(r.v[1], 2) + ")");
      });
    }
    function draw() {
      var p = V.palette();
      view.clear(p.surface);
      var r = { x: 48, y: 14, w: view.w - 64, h: view.h - 54 };
      var rav = lossCtl.value() === "ravine";
      var xmin = -2, xmax = 2, ymin = rav ? -0.3 : -1.5, ymax = rav ? 0.3 : 1.5;
      var M = [];
      for (var iy = 0; iy < 36; iy++) {
        var row = [];
        for (var ix = 0; ix < 46; ix++) {
          var x = xmin + (xmax - xmin) * ix / 45;
          var y = ymin + (ymax - ymin) * iy / 35;
          row.push(Math.log1p(Math.max(0, surface(x, y))));
        }
        M.push(row);
      }
      V.heatmap(ctx, M, r, { cmap: "viridis", vmin: 0, vmax: rav ? 3.5 : 1.4, border: false });
      V.axes(ctx, r, { xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax, grid: false, ticks: 4, xlabel: "θ₁", ylabel: "θ₂" });
      var sx = function (v) { return r.x + (v - xmin) / (xmax - xmin) * r.w; };
      var sy = function (v) { return r.y + r.h - (v - ymin) / (ymax - ymin) * r.h; };
      ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      racers.forEach(function (q) {
        if (q.path.length < 2) return;
        ctx.beginPath();
        q.path.forEach(function (pt, i) {
          var px = sx(DL.clamp(pt[0], xmin, xmax)), py = sy(DL.clamp(pt[1], ymin, ymax));
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = q.color; ctx.lineWidth = 2.2; ctx.stroke();
        var last = q.path[q.path.length - 1];
        V.dot(ctx, sx(DL.clamp(last[0], xmin, xmax)), sy(DL.clamp(last[1], ymin, ymax)), 4, q.color);
      });
      ctx.restore();
      V.legend(ctx, racers.map(function (q) { return { color: q.color, label: q.name }; }), { x: r.x + 8, y: r.y + 8 }, {});
    }
    trainer = DL.trainer({ steps: 600, speed: 1, onStep: onStep,
      onFrame: function (step, done) { draw(); if (done) play.setRunning(false); } });
    reset();
    return { reset: function () { reset(); }, pause: function () { trainer.pause(); play.setRunning(false); } };
  });

  /* ------------------------------------------------------------------ *
   * m1-06-search-demo — grid vs random under the same trial budget
   * Exact: objective evaluated at every sampled point; counts are literal.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-06-search-demo", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 540, h: 330, label: "Two-dimensional search objective with sampled trials" });
    var ctx = view.ctx;
    var budgetCtl = U.slider({ label: "Trial budget n", min: 10, max: 100, step: 10, value: 30, digits: 0, onInput: draw });
    var seedCtl = U.slider({ label: "Random seed", min: 1, max: 20, step: 1, value: 1, digits: 0, onInput: draw });
    var methodCtl = U.buttons({ label: "Sampler", options: [{ value: "grid", label: "Grid" }, { value: "random", label: "Random" }],
      value: "random", onChange: draw });
    var reads = U.readouts(["trials", "best x", "best objective", "hits near optimum"]);
    var box = mathBox("Coverage arithmetic", "");
    stage.controls.appendChild(methodCtl.el);
    stage.controls.appendChild(budgetCtl.el);
    stage.controls.appendChild(seedCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(box);

    function objective(x, y) { return (x - 0.7) ** 2 + 0.05 * y * y; }
    function draw() {
      var n = budgetCtl.value(), rng = DL.rng(seedCtl.value() * 37), pts = [];
      if (methodCtl.value() === "grid") {
        var g = Math.max(2, Math.floor(Math.sqrt(n)));
        for (var i = 0; i < g; i++) for (var j = 0; j < g; j++) pts.push([i / (g - 1), j / (g - 1)]);
      } else {
        for (var k = 0; k < n; k++) pts.push([rng(), rng()]);
      }
      var best = pts[0], bv = objective(best[0], best[1]);
      var hits = 0;
      pts.forEach(function (q) {
        var v = objective(q[0], q[1]);
        if (v < bv) { bv = v; best = q; }
        if (Math.abs(q[0] - 0.7) < 0.1) hits++;
      });
      var p = V.palette();
      view.clear(p.surface);
      var r = { x: 48, y: 14, w: view.w - 64, h: view.h - 54 };
      var M = [];
      for (var iy = 0; iy < 40; iy++) {
        var row = [];
        for (var ix = 0; ix < 40; ix++) row.push(objective(ix / 39, iy / 39));
        M.push(row);
      }
      V.heatmap(ctx, M, r, { cmap: "viridis", vmin: 0, vmax: 0.5, border: false });
      V.axes(ctx, r, { xmin: 0, xmax: 1, ymin: 0, ymax: 1, grid: false, ticks: 4, xlabel: "important x (η)", ylabel: "unimportant y" });
      V.scatter(ctx, pts.map(function (q) { return { x: q[0], y: q[1], c: 0, r: 3, color: p.surface }; }),
        r, { xmin: 0, xmax: 1, ymin: 0, ymax: 1, axes: false });
      V.dot(ctx, r.x + best[0] * r.w, r.y + r.h - best[1] * r.h, 6, p.danger);
      V.dot(ctx, r.x + 0.7 * r.w, r.y + r.h, 6, p.accent);
      reads.set("trials", String(pts.length));
      reads.set("best x", DL.fmt(best[0], 3));
      reads.set("best objective", DL.fmt(bv, 5));
      reads.set("hits near optimum", hits + " / " + pts.length);
      box.textContent = methodCtl.value() === "random"
        ? "Random: predicted P(|x−0.7|<0.1 in ≥1 of " + pts.length + ") = 1−(1−0.2)^" + pts.length + " = " + DL.fmt(1 - Math.pow(0.8, pts.length), 4) + "; observed " + hits + " hits."
        : "Grid: g=" + Math.max(2, Math.floor(Math.sqrt(n))) + " gives " + pts.length + " trials and only " + Math.max(2, Math.floor(Math.sqrt(n))) + " distinct x values; observed " + hits + " near x=0.7.";
    }
    draw();
    return { reset: function () { budgetCtl.set(30, true); seedCtl.set(1, true); methodCtl.set("random", true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m1-06-augmentation-studio — pixel-level transforms and toy TTA
   * Exact: every pixel transform and classifier average is computed live.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-06-augmentation-studio", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 560, h: 300, label: "Original and augmented procedural image with toy predictions" });
    var ctx = view.ctx;
    var transforms = ["none", "crop", "flipH", "flipV", "colour jitter", "cutout", "mixup", "CutMix"];
    var tfCtl = U.select({ label: "Transform", options: transforms.map(function (t) { return { value: t, label: t }; }),
      value: "flipH", onChange: compute });
    var cropCtl = U.slider({ label: "Crop fraction", min: 0.5, max: 1, step: 0.05, value: 0.8, digits: 2, onInput: compute });
    var jitCtl = U.slider({ label: "Colour jitter", min: 0, max: 0.5, step: 0.05, value: 0.2, digits: 2, onInput: compute });
    var cutCtl = U.slider({ label: "Cutout size (pixels)", min: 2, max: 16, step: 1, value: 8, digits: 0, onInput: compute });
    var lamCtl = U.slider({ label: "Mix λ", min: 0.1, max: 0.9, step: 0.05, value: 0.6, digits: 2, onInput: compute });
    var ttaCtl = U.toggle({ label: "TTA (average 3 views)", checked: false, onChange: compute });
    var reads = U.readouts(["mean RGB", "p(class A)", "p with TTA", "changed pixels"]);
    var box = mathBox("Transform arithmetic", "");
    [tfCtl, cropCtl, jitCtl, cutCtl, lamCtl, ttaCtl.el, reads.el, box].forEach(function (x) { stage.controls.appendChild(x.el || x); });

    var S = 32;
    function base(second) {
      var im = [];
      for (var i = 0; i < S; i++) {
        var row = [];
        for (var c = 0; c < 3; c++) {
          var v = [];
          for (var j = 0; j < S; j++) {
            var px = 0.15 + 0.08 * Math.sin(i / 4);
            if (i >= 8 && i <= 22 && j >= 6 && j <= 18) px = second ? 0.2 : 0.85;
            if ((i - 24) ** 2 + (j - 24) ** 2 < 36) px = second ? 0.75 : 0.25;
            v.push(DL.clamp(px + c * 0.05, 0, 1));
          }
          row.push(v);
        }
        im.push(row);
      }
      return im; // S x C x W
    }
    var original = base(false), other = base(true);
    function clone(im) { return im.map(function (row) { return row.map(function (ch) { return ch.slice(); }); }); }
    function flipH(im) { return im.map(function (row) { return row.map(function (ch) { return ch.slice().reverse(); }); }); }
    function flipV(im) { return im.slice().reverse(); }
    function crop(im, f) {
      var k = Math.round(S * f), o = Math.floor((S - k) / 2);
      var out = [];
      for (var i = o; i < o + k; i++) {
        var row = [];
        for (var c = 0; c < 3; c++) {
          var v = [];
          for (var j = o; j < o + k; j++) v.push(im[i][c][j]);
          while (v.length < S) v.push(0.1);
          row.push(v);
        }
        while (row.length < 3) row.push(new Array(S).fill(0.1));
        out.push(row);
      }
      while (out.length < S) out.push([new Array(S).fill(0.1), new Array(S).fill(0.1), new Array(S).fill(0.1)]);
      return out;
    }
    function predict(im) {
      var m = [0, 0, 0];
      for (var c = 0; c < 3; c++) m[c] = DL.mean(im.reduce(function (a, row) { return a.concat(row[c]); }, []));
      var z = 1.2 * m[0] - 0.9 * m[1] + 0.3 * m[2] - 0.25;
      return 1 / (1 + Math.exp(-z));
    }
    var out, changed = 0, labels = "";
    function compute() {
      var tf = tfCtl.value(), lam = lamCtl.value();
      out = clone(original);
      if (tf === "crop") out = crop(out, cropCtl.value());
      if (tf === "flipH") out = flipH(out);
      if (tf === "flipV") out = flipV(out);
      if (tf === "colour jitter") {
        var jv = jitCtl.value();
        out = out.map(function (row, i) { return row.map(function (ch, c) { return ch.map(function (v, j) {
          return DL.clamp(v + jv * Math.sin(i * 0.7 + j * 0.3 + c), 0, 1);
        }); }); });
      }
      if (tf === "cutout") {
        var k = cutCtl.value(), x0 = 8, y0 = 8;
        for (var i = x0; i < x0 + k; i++) for (var j = y0; j < y0 + k; j++) if (i < S && j < S) out[i].forEach(function (ch) { ch[j] = 0.1; });
      }
      if (tf === "mixup" || tf === "CutMix") {
        var mix = clone(original);
        if (tf === "CutMix") {
          var kk = cutCtl.value();
          for (var a = 6; a < 6 + kk; a++) for (var b = 6; b < 6 + kk; b++) if (a < S && b < S) mix[a].forEach(function (ch, ci) { ch[b] = other[a][ci][b]; });
          lam = 1 - (kk * kk) / (S * S);
          for (var a2 = 6; a2 < 6 + kk; a2++) for (var b2 = 6; b2 < 6 + kk; b2++) if (a2 < S && b2 < S) out[a2].forEach(function (ch, ci2) { ch[b2] = other[a2][ci2][b2]; });
        } else {
          out = out.map(function (row, i) { return row.map(function (ch, c) { return ch.map(function (v, j) {
            return lam * v + (1 - lam) * other[i][c][j];
          }); }); });
        }
        labels = "label mix: λ=" + DL.fmt(lam, 2) + " A + " + DL.fmt(1 - lam, 2) + " B";
      } else labels = "label unchanged (class A)";
      changed = 0;
      for (var y = 0; y < S; y++) for (var c2 = 0; c2 < 3; c2++) for (var x = 0; x < S; x++)
        if (Math.abs(out[y][c2][x] - original[y][c2][x]) > 1e-6) changed++;
      var baseP = predict(original), augP = predict(out);
      var ttaP = augP;
      if (ttaCtl.checked()) ttaP = (augP + predict(flipH(out)) + predict(crop(out, 0.9))) / 3;
      var means = [0, 0, 0];
      for (var cc = 0; cc < 3; cc++) means[cc] = DL.mean(out.reduce(function (a, row) { return a.concat(row[cc]); }, []));
      reads.set("mean RGB", means.map(function (v) { return DL.fmt(v, 2); }).join(", "));
      reads.set("p(class A)", DL.fmt(augP, 3));
      reads.set("p with TTA", ttaCtl.checked() ? DL.fmt(ttaP, 3) : "off");
      reads.set("changed pixels", changed + " / " + (S * S * 3));
      box.textContent = tf + ": " + labels + ". Toy classifier p=σ(1.2R−0.9G+0.3B−0.25); original p=" + DL.fmt(baseP, 3) + "." +
        (ttaCtl.checked() ? " TTA average over 3 label-preserving views = " + DL.fmt(ttaP, 3) + "." : "");
      draw(baseP, augP);
    }
    function paint(im, x, y, size, title) {
      var cell = size / S;
      for (var i = 0; i < S; i++) for (var j = 0; j < S; j++) {
        ctx.fillStyle = "rgb(" + [0, 1, 2].map(function (c) { return Math.round(im[i][c][j] * 255); }).join(",") + ")";
        ctx.fillRect(x + j * cell, y + i * cell, Math.ceil(cell), Math.ceil(cell));
      }
      ctx.strokeStyle = V.palette().lineStrong; ctx.lineWidth = 1; ctx.strokeRect(x, y, size, size);
      V.text(ctx, title, x, y - 6, { size: 10, mono: true, color: V.palette().ink2 });
    }
    function draw(baseP, augP) {
      var p = V.palette();
      view.clear(p.surface);
      paint(original, 20, 38, 200, "original (3 channels)");
      paint(out, 290, 38, 200, "after " + tfCtl.value());
      V.text(ctx, "toy p(A): " + DL.fmt(baseP, 3) + " → " + DL.fmt(augP, 3), 20, 262,
        { size: 11, mono: true, color: p.ink2 });
      V.text(ctx, "procedural data only — no external images", 290, 262, { size: 10, color: p.ink3 });
    }
    compute();
    return { reset: function () {
      tfCtl.set("flipH", true); cropCtl.set(0.8, true); jitCtl.set(0.2, true);
      cutCtl.set(8, true); lamCtl.set(0.6, true); ttaCtl.set(false, true); compute();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m1-08-gradcam — tiny conv bank + GAP head, real Grad-CAM gradients
   * Exact: maps from DL.tensor.conv2d / conv2dMulti; alpha from the
   *        analytic gradient of the displayed GAP head; ReLU/normalisation live.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-08-gradcam", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 600, h: 260, label: "Drawn shape, selected feature map and Grad-CAM heatmap" });
    var ctx = view.ctx;
    var N = 12;
    var pixels = T.zeros(N, N);
    var bank1 = [
      [[0, 1, 0], [1, -4, 1], [0, 1, 0]],
      [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
      [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
      [[1, 0, -1], [2, 0, -2], [1, 0, -1]]
    ];
    var weights = {
      A: [1.2, -0.8, 2.0, 0.5],
      B: [-1.0, 0.4, 0.3, 2.2]
    };
    function bank2(o, c) {
      var s = ((o + 2 * c) % 3) - 1;
      return [[0, s, 0], [s, s === 0 ? 1 : -2 * s, s], [0, s, 0]];
    }
    var classCtl = U.buttons({ label: "Class c", options: [{ value: "A", label: "A" }, { value: "B", label: "B" }],
      value: "A", onChange: compute });
    var layerCtl = U.select({ label: "Target layer", options: [
      { value: "l1", label: "layer 1 · 4 maps from input" },
      { value: "l2", label: "layer 2 · 4 maps from layer 1" }
    ], value: "l1", onChange: compute });
    var reluCtl = U.toggle({ label: "Apply ReLU to CAM", checked: true, onChange: compute });
    var normCtl = U.toggle({ label: "Normalise CAM to [0,1]", checked: true, onChange: compute });
    var chanCtl = U.slider({ label: "Inspect feature channel k", min: 0, max: 3, step: 1, value: 2, digits: 0, onInput: compute });
    var squareBtn = DL.el("button", { type: "button", class: "btn", text: "Draw square",
      "aria-label": "Draw a bright square", on: { click: function () { preset("square"); } } });
    var crossBtn = DL.el("button", { type: "button", class: "btn", text: "Draw cross",
      "aria-label": "Draw a bright cross", on: { click: function () { preset("cross"); } } });
    var clearBtn = DL.el("button", { type: "button", class: "btn", text: "Clear",
      "aria-label": "Clear the drawn image", on: { click: function () { preset("clear"); } } });
    var reads = U.readouts(["logit y^c", "CAM argmax", "α₁ (channel 1)", "CAM max before norm"]);
    var box = mathBox("Grad-CAM arithmetic", "");
    [classCtl, layerCtl, reluCtl.el, normCtl.el, chanCtl, U.row(squareBtn, crossBtn, clearBtn), reads.el, box].forEach(function (x) {
      stage.controls.appendChild(x.el || x);
    });
    stage.controls.appendChild(small("Head: y^c = Σ_k w_k · mean(A^k) + b. Its gradient is exact: ∂y^c/∂A^k_ij = w_k/(H′W′), so α_k is the channel mean of that gradient."));

    function preset(kind) {
      pixels = T.zeros(N, N);
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
        if (kind === "square" && i >= 3 && i <= 8 && j >= 3 && j <= 8) pixels[i][j] = 9;
        if (kind === "cross" && (Math.abs(i - 5) <= 1 || Math.abs(j - 6) <= 1)) pixels[i][j] = 9;
      }
      compute();
    }
    var inRect = { x: 18, y: 32, w: 160, h: 160 };
    view.canvas.style.cursor = "crosshair";
    view.canvas.setAttribute("tabindex", "0");
    view.canvas.setAttribute("aria-label", "Draw input: click or drag; arrow keys move the cursor, Space toggles a pixel");
    var cursor = [5, 5], painting = false;
    function pointer(e, paint) {
      var r = view.canvas.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width * view.w, py = (e.clientY - r.top) / r.height * view.h;
      var i = Math.floor((py - inRect.y) / inRect.h * N), j = Math.floor((px - inRect.x) / inRect.w * N);
      if (i < 0 || i >= N || j < 0 || j >= N) return;
      cursor = [i, j];
      if (paint) pixels[i][j] = pixels[i][j] > 0 ? 0 : 9;
      compute();
    }
    view.canvas.addEventListener("pointerdown", function (e) { painting = true; pointer(e, true); view.canvas.setPointerCapture(e.pointerId); });
    view.canvas.addEventListener("pointermove", function (e) { if (painting) pointer(e, true); });
    view.canvas.addEventListener("pointerup", function () { painting = false; });
    view.canvas.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") cursor[1] = Math.max(0, cursor[1] - 1);
      else if (e.key === "ArrowRight") cursor[1] = Math.min(N - 1, cursor[1] + 1);
      else if (e.key === "ArrowUp") cursor[0] = Math.max(0, cursor[0] - 1);
      else if (e.key === "ArrowDown") cursor[0] = Math.min(N - 1, cursor[0] + 1);
      else if (e.key === " " || e.key === "Enter") pixels[cursor[0]][cursor[1]] = pixels[cursor[0]][cursor[1]] > 0 ? 0 : 9;
      else return;
      e.preventDefault(); compute();
    });

    var maps, alphas, cam, rawMax, yc;
    function compute() {
      var l1 = bank1.map(function (k) { return T.conv2d(pixels, k, { padding: 1 }); });
      var bank = [];
      for (var o = 0; o < 4; o++) {
        var per = [];
        for (var c = 0; c < 4; c++) per.push(bank2(o, c));
        bank.push(per);
      }
      var l2 = T.conv2dMulti(l1, bank, { padding: 1 });
      maps = layerCtl.value() === "l1" ? l1 : l2;
      var w = weights[classCtl.value()];
      var H = maps[0].length, W = maps[0][0].length, Z = H * W;
      alphas = w.map(function (v) { return v / Z; }); // exact mean gradient of the GAP head
      yc = 0;
      cam = T.zeros(H, W);
      for (var k = 0; k < maps.length; k++) {
        var g = alphas[k];
        var meanK = T.mean(maps[k]);
        yc += w[k] * meanK;
        for (var i = 0; i < H; i++) for (var j = 0; j < W; j++) cam[i][j] += g * maps[k][i][j];
      }
      rawMax = T.maxOf(cam);
      if (reluCtl.checked()) cam = T.map(cam, function (v) { return Math.max(0, v); });
      if (normCtl.checked()) {
        var mx = T.maxOf(cam);
        if (mx > 1e-9) cam = T.map(cam, function (v) { return v / mx; });
      }
      var peak = argmax2(cam);
      reads.set("logit y^c", DL.fmt(yc, 3));
      reads.set("CAM argmax", "(" + peak[0] + ", " + peak[1] + ")");
      reads.set("α₁ (channel 1)", DL.fmt(alphas[0], 4));
      reads.set("CAM max before norm", DL.fmt(rawMax, 3));
      box.textContent = "Layer " + (layerCtl.value() === "l1" ? "1" : "2") + ": Z=" + Z +
        ", α = [" + alphas.map(function (v) { return DL.fmt(v, 3); }).join(", ") + "]; Σ α_k A^k max = " +
        DL.fmt(rawMax, 3) + (reluCtl.checked() ? " → ReLU" : " (no ReLU)") + (normCtl.checked() ? " → ÷max" : "") + ".";
      draw();
    }
    function panel(M, x, y, w, h, title, opts) {
      opts = opts || {};
      var r = { x: x, y: y, w: w, h: h };
      V.heatmap(ctx, M, r, { cmap: opts.cmap || "div", vmin: opts.vmin === undefined ? -10 : opts.vmin,
        vmax: opts.vmax === undefined ? 10 : opts.vmax, gap: 1 });
      V.text(ctx, title, x, y - 5, { size: 10, mono: true, color: V.palette().ink2 });
    }
    function draw() {
      var p = V.palette();
      view.clear(p.surface);
      panel(pixels, inRect.x, inRect.y, inRect.w, inRect.h, "drawn input 12×12", { cmap: "gray", vmin: 0, vmax: 9 });
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      ctx.strokeRect(inRect.x + cursor[1] * inRect.w / N, inRect.y + cursor[0] * inRect.h / N, inRect.w / N, inRect.h / N);
      var k = chanCtl.value();
      panel(maps[k], 208, 32, 160, 160, "feature map A^" + (k + 1), { vmin: -30, vmax: 30, cmap: "div" });
      panel(cam, 400, 32, 160, 160, "Grad-CAM class " + classCtl.value(),
        { cmap: "ember", vmin: 0, vmax: normCtl.checked() ? 1 : Math.max(1, rawMax) });
      V.text(ctx, "logit " + DL.fmt(yc, 3) + " · argmax at " + argmax2(cam).join(","), 208, 218,
        { size: 10, mono: true, color: p.ink2 });
      V.text(ctx, "β=0 not shown; head uses GAP over the selected maps", 400, 218,
        { size: 9, color: p.ink3 });
    }
    preset("square");
    return { reset: function () {
      classCtl.set("A", true); layerCtl.set("l1", true); reluCtl.set(true, true);
      normCtl.set(true, true); chanCtl.set(2, true); preset("square");
    } };
  });

  /* ------------------------------------------------------------------ *
   * m1-07-iou-nms — drag boxes, see IoU matrix, NMS and toy AP
   * Exact: IoU, NMS decisions and AP are computed from the displayed boxes.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-07-iou-nms", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 560, h: 330, label: "Scored boxes with NMS decisions and ground truth" });
    var ctx = view.ctx;
    var boxes = [
      { x: 10, y: 10, w: 40, h: 40, s: 0.9, c: "A" },
      { x: 14, y: 14, w: 40, h: 40, s: 0.8, c: "A" },
      { x: 90, y: 20, w: 40, h: 40, s: 0.7, c: "A" },
      { x: 96, y: 26, w: 40, h: 40, s: 0.6, c: "A" },
      { x: 40, y: 105, w: 40, h: 40, s: 0.5, c: "B" }
    ];
    var gt = [
      { x: 10, y: 10, w: 40, h: 40, c: "A" },
      { x: 90, y: 20, w: 40, h: 40, c: "A" }
    ];
    var thrCtl = U.slider({ label: "NMS IoU threshold τ", min: 0.05, max: 0.9, step: 0.05, value: 0.3, digits: 2, onInput: compute });
    var selCtl = U.slider({ label: "Selected box", min: 1, max: 5, step: 1, value: 1, digits: 0, onInput: draw });
    var reads = U.readouts(["selected IoU with box 1", "kept after NMS", "AP@0.5 class A", "recall"]);
    var ioTable = U.table({ columns: ["pair", "IoU", "suppressed at τ?"], rows: [], caption: "All pairwise IoUs of the five displayed boxes" });
    stage.controls.appendChild(thrCtl.el);
    stage.controls.appendChild(selCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(ioTable.el);
    stage.controls.appendChild(small("Click a box then use arrow keys to move it, Shift+arrows to resize. Selection is also a slider for keyboard users."));

    function inter(a, b) {
      var x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
      var x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
      var iw = Math.max(0, x2 - x1), ih = Math.max(0, y2 - y1);
      return iw * ih;
    }
    function iou(a, b) {
      var u = a.w * a.h + b.w * b.h - inter(a, b);
      return u > 0 ? inter(a, b) / u : 0;
    }
    var kept = [], ap = 0, recall = 0;
    function compute() {
      var tau = thrCtl.value();
      kept = [];
      ["A", "B"].forEach(function (cl) {
        var order = boxes.map(function (b, i) { return { i: i, b: b }; }).filter(function (q) { return q.b.c === cl; })
          .sort(function (p, q) { return q.b.s - p.b.s; });
        while (order.length) {
          var top = order.shift();
          kept.push(top.i);
          order = order.filter(function (q) { return iou(top.b, q.b) <= tau; });
        }
      });
      // Toy AP for class A with 2 ground-truth boxes and IoU >= 0.5 match
      var dets = boxes.map(function (b, i) { return { i: i, b: b }; })
        .filter(function (q) { return q.b.c === "A" && kept.indexOf(q.i) >= 0; })
        .sort(function (p, q) { return q.b.s - p.b.s; });
      var used = {}, tp = [], fp = [];
      dets.forEach(function (q) {
        var best = -1, bv = 0.5;
        gt.forEach(function (g, gi) {
          if (used[gi]) return;
          var v = iou(q.b, g);
          if (v > bv) { bv = v; best = gi; }
        });
        if (best >= 0) { used[best] = true; tp.push(1); fp.push(0); }
        else { tp.push(0); fp.push(1); }
      });
      var cTP = 0, cFP = 0, prec = [], rec = [];
      tp.forEach(function (t, i) {
        cTP += t; cFP += fp[i];
        prec.push(cTP / (cTP + cFP)); rec.push(cTP / gt.length);
      });
      recall = cTP / gt.length;
      var levels = [0, 0.5, 1], ps = levels.map(function (L) {
        var m = 0;
        prec.forEach(function (pv, i) { if (rec[i] >= L - 1e-9) m = Math.max(m, pv); });
        return m;
      });
      ap = ps.reduce(function (a, b) { return a + b; }, 0) / levels.length;
      var rows = [];
      for (var i = 0; i < boxes.length; i++) for (var j = i + 1; j < boxes.length; j++) {
        var v = iou(boxes[i], boxes[j]);
        var sup = kept.indexOf(i) >= 0 && kept.indexOf(j) >= 0 ? "no" : (v > tau ? "yes" : "no");
        rows.push([(i + 1) + "–" + (j + 1), DL.fmt(v, 3), sup]);
      }
      ioTable.update(rows);
      var sel = boxes[selCtl.value() - 1];
      reads.set("selected IoU with box 1", selCtl.value() === 1 ? "—" : DL.fmt(iou(sel, boxes[0]), 3));
      reads.set("kept after NMS", kept.map(function (i) { return i + 1; }).join(", "));
      reads.set("AP@0.5 class A", DL.fmt(ap, 3));
      reads.set("recall", DL.fmt(recall, 3));
      draw();
    }
    function rect(b, r, color, fill) {
      var x = r.x + b.x / 160 * r.w, y = r.y + b.y / 160 * r.h;
      var w = b.w / 160 * r.w, h = b.h / 160 * r.h;
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      if (fill) { ctx.globalAlpha = 0.1; ctx.fillStyle = color; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
      if (b.s !== undefined) V.text(ctx, "s=" + b.s.toFixed(1) + " " + b.c, x + 2, y - 4, { size: 9, mono: true, color: color });
    }
    function draw() {
      var p = V.palette();
      view.clear(p.surface);
      var r = { x: 24, y: 24, w: view.w - 48, h: view.h - 48 };
      ctx.fillStyle = p.surface2; ctx.fillRect(r.x, r.y, r.w, r.h);
      gt.forEach(function (g) { rect(g, r, p.ink3, false); });
      boxes.forEach(function (b, i) {
        var on = kept.indexOf(i) >= 0;
        rect(b, r, on ? (b.c === "A" ? p.accent : p.warn) : p.lineStrong, on);
      });
      var sel = boxes[selCtl.value() - 1];
      ctx.strokeStyle = p.danger; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.strokeRect(r.x + (sel.x - 2) / 160 * r.w, r.y + (sel.y - 2) / 160 * r.h,
        (sel.w + 4) / 160 * r.w, (sel.h + 4) / 160 * r.h); ctx.setLineDash([]);
      V.text(ctx, "dashed grey = ground truth · grey boxes suppressed · τ=" + thrCtl.value(), r.x, 14,
        { size: 10, mono: true, color: p.ink2 });
    }
    view.canvas.addEventListener("click", function (e) {
      var r0 = view.canvas.getBoundingClientRect();
      var px = (e.clientX - r0.left) / r0.width * view.w, py = (e.clientY - r0.top) / r0.height * view.h;
      var r = { x: 24, y: 24, w: view.w - 48, h: view.h - 48 };
      var wx = (px - r.x) / r.w * 160, wy = (py - r.y) / r.h * 160;
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) { selCtl.set(i + 1, true); draw(); return; }
      }
    });
    view.canvas.setAttribute("tabindex", "0");
    view.canvas.setAttribute("aria-label", "Box canvas: select a box with the slider or click, then arrow keys move it");
    view.canvas.addEventListener("keydown", function (e) {
      var b = boxes[selCtl.value() - 1], st = e.shiftKey;
      if (e.key === "ArrowLeft") { if (st) { b.w = Math.max(4, b.w - 2); } else b.x = Math.max(0, b.x - 2); }
      else if (e.key === "ArrowRight") { if (st) b.w += 2; else b.x += 2; }
      else if (e.key === "ArrowUp") { if (st) { b.h = Math.max(4, b.h - 2); } else b.y = Math.max(0, b.y - 2); }
      else if (e.key === "ArrowDown") { if (st) b.h += 2; else b.y += 2; }
      else return;
      e.preventDefault(); compute();
    });
    compute();
    return { reset: function () {
      boxes = [
        { x: 10, y: 10, w: 40, h: 40, s: 0.9, c: "A" }, { x: 14, y: 14, w: 40, h: 40, s: 0.8, c: "A" },
        { x: 90, y: 20, w: 40, h: 40, s: 0.7, c: "A" }, { x: 96, y: 26, w: 40, h: 40, s: 0.6, c: "A" },
        { x: 40, y: 105, w: 40, h: 40, s: 0.5, c: "B" }
      ];
      thrCtl.set(0.3, true); selCtl.set(1, true); compute();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m1-07-window-to-grid — sliding windows versus grid + anchors
   * Exact: all counts come from the displayed sizes, stride and grid.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m1-07-window-to-grid", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 560, h: 280, label: "Sliding windows (left) versus detector grid with anchors (right)" });
    var ctx = view.ctx;
    var hCtl = U.slider({ label: "Image H = W", min: 64, max: 512, step: 32, value: 224, digits: 0, onInput: draw });
    var kCtl = U.slider({ label: "Window size K", min: 16, max: 96, step: 16, value: 32, digits: 0, onInput: draw });
    var sCtl = U.slider({ label: "Sliding stride S", min: 8, max: 96, step: 8, value: 32, digits: 0, onInput: draw });
    var gCtl = U.slider({ label: "Detector grid G×G", min: 4, max: 16, step: 1, value: 7, digits: 0, onInput: draw });
    var aCtl = U.select({ label: "Anchors per cell", options: [3, 6, 9].map(function (v) { return { value: String(v), label: String(v) }; }),
      value: "3", onChange: draw });
    var reads = U.readouts(["windows per axis", "total windows", "grid cells", "total anchors"]);
    var box = mathBox("Window arithmetic", "");
    var table = U.table({ columns: ["quantity", "formula", "value"], rows: [], caption: "Counts for one image" });
    [hCtl, kCtl, sCtl, gCtl, aCtl, reads.el, box, table.el].forEach(function (x) { stage.controls.appendChild(x.el || x); });

    function draw() {
      var H = hCtl.value(), K = kCtl.value(), S = sCtl.value(), G = gCtl.value(), A = parseInt(aCtl.value(), 10);
      var per = T.outSize(H, K, S, 0, 1);
      var total = per * per, cells = G * G, anchors = cells * A;
      var p = V.palette();
      view.clear(p.surface);
      var L = { x: 24, y: 32, w: 220, h: 220 };
      ctx.fillStyle = p.surface2; ctx.fillRect(L.x, L.y, L.w, L.h);
      var step = L.w / (per - 1 + 1e-9);
      ctx.strokeStyle = p.accent; ctx.lineWidth = 1;
      var shown = Math.min(per, 8);
      for (var i = 0; i < shown; i++) for (var j = 0; j < shown; j++) {
        var xx = L.x + (i * S / H) * L.w, yy = L.y + (j * S / H) * L.h;
        var ww = Math.max(2, (K / H) * L.w);
        ctx.strokeRect(xx, yy, ww, ww);
      }
      V.text(ctx, "sliding windows (first " + shown + "×" + shown + " shown)", L.x, 20, { size: 10, mono: true, color: p.ink2 });
      var R = { x: 300, y: 32, w: 220, h: 220 };
      ctx.fillStyle = p.surface2; ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.strokeStyle = p.lineStrong; ctx.lineWidth = 1;
      for (var a = 0; a <= G; a++) {
        ctx.beginPath(); ctx.moveTo(R.x + a * R.w / G, R.y); ctx.lineTo(R.x + a * R.w / G, R.y + R.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(R.x, R.y + a * R.h / G); ctx.lineTo(R.x + R.w, R.y + a * R.h / G); ctx.stroke();
      }
      ctx.strokeStyle = p.danger; ctx.lineWidth = 1.2;
      var cell = R.w / G;
      for (var gy = 0; gy < Math.min(G, 8); gy++) for (var gx = 0; gx < Math.min(G, 8); gx++) {
        ctx.strokeRect(R.x + gx * cell + cell * 0.25, R.y + gy * cell + cell * 0.25, cell * 0.5, cell * 0.5);
      }
      V.text(ctx, "YOLO/SSD grid " + G + "×" + G + ", " + A + " anchors/cell", R.x, 20, { size: 10, mono: true, color: p.ink2 });
      reads.set("windows per axis", String(per));
      reads.set("total windows", NN.formatCount(total));
      reads.set("grid cells", String(cells));
      reads.set("total anchors", NN.formatCount(anchors));
      box.textContent = "⌊(" + H + "−" + K + ")/" + S + "⌋+1 = " + per + " per axis ⇒ " + per + "² = " + total +
        " windows; grid: " + G + "²·" + A + " = " + anchors + " anchors (" + DL.fmt(anchors / Math.max(1, total), 2) + "× the window count).";
      table.update([["windows / axis", "⌊(H−K)/S⌋+1", String(per)],
        ["total windows", "per²", NN.formatCount(total)],
        ["grid cells", "G²", String(cells)],
        ["anchors", "G²·A", NN.formatCount(anchors)]]);
    }
    draw();
    return { reset: function () {
      hCtl.set(224, true); kCtl.set(32, true); sCtl.set(32, true); gCtl.set(7, true);
      aCtl.set("3", true); draw();
    } };
  });

  /* PLUGIN_MARKER */

})(window.DL);
