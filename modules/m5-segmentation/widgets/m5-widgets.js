/* ==========================================================================
   DeepLearn Lab — M5 widgets
   Registered ids must match docs/CONTENT_PLAN.md. Never rename an id.
   Values shown by "exact" widgets are computed in the browser from the
   displayed pixels / grids; "illustrative" widgets say so in their note.
   ========================================================================== */
(function (DL) {
  "use strict";

  var V = DL.viz, U = DL.ui, T = DL.tensor;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function f(x, d) { return DL.fmt(x, d === undefined ? 2 : d); }
  function shapeStr(s) { return "(" + s.join(", ") + ")"; }
  function small(text) { return DL.el("p", { class: "small muted", text: text }); }

  /* ------------------------------------------------------------------ *
   * m5-01-mask-painter — semantic / instance / panoptic views
   * Exact: connected components + pixel counts from the painted grid.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m5-01-mask-painter", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, {
      w: 560, h: 470, label: "Editable 20 by 20 semantic mask. Arrow keys move the cursor, Space paints."
    });
    var ctx = view.ctx;
    var N = 20, gx = 80, gy = 15, gw = 400, cw = gw / N;

    var mode = U.buttons({
      label: "View", ariaLabel: "Mask view",
      options: [
        { value: "semantic", label: "Semantic" },
        { value: "instance", label: "Instance" },
        { value: "panoptic", label: "Panoptic" }
      ], value: "semantic", onChange: draw
    });
    var cls = U.buttons({
      label: "Paint class", ariaLabel: "Class to paint",
      options: [
        { value: 1, label: "1 · thing A" },
        { value: 2, label: "2 · stuff" },
        { value: 3, label: "3 · thing B" }
      ], value: 1, onChange: draw
    });
    var brush = U.slider({ label: "Brush radius (cells)", min: 0, max: 3, step: 1, value: 0, digits: 0, onInput: draw });
    var resetBtn = DL.el("button", { type: "button", class: "btn", text: "Reset scene", "aria-label": "Reset the painted mask", on: { click: reset } });
    var clearBtn = DL.el("button", { type: "button", class: "btn", text: "Clear all", "aria-label": "Clear every painted cell", on: { click: clearAll } });
    var reads = U.readouts(["class 1 px", "class 2 px", "class 3 px", "instances", "background px"]);
    var tab = U.table({ columns: ["class", "pixels", "instances"], rows: [], caption: "Counts on the grid you painted" });

    stage.controls.appendChild(mode.el);
    stage.controls.appendChild(cls.el);
    stage.controls.appendChild(brush.el);
    stage.controls.appendChild(U.row(resetBtn, clearBtn));
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(tab.el);
    stage.controls.appendChild(small("Semantic: one colour per class. Instance: one colour per connected object. Panoptic: stuff stays class-coloured, things get instance colours."));

    var grid, cursor = { x: 5, y: 5 }, painting = false;

    function reset() {
      grid = new Array(N * N).fill(0);
      function fill(x0, y0, x1, y1, c) {
        for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) grid[y * N + x] = c;
      }
      fill(2, 3, 8, 8, 1);
      fill(11, 1, 16, 6, 1);
      fill(1, 11, 17, 15, 2);
      fill(4, 16, 8, 19, 3);
      cursor = { x: 5, y: 5 };
      draw();
    }
    function clearAll() { grid = new Array(N * N).fill(0); draw(); }

    function components() {
      var ids = new Array(N * N).fill(-1), comps = [], count = 0;
      for (var y = 0; y < N; y++) {
        for (var x = 0; x < N; x++) {
          var k = y * N + x;
          if (grid[k] === 0 || ids[k] >= 0) continue;
          var want = grid[k], queue = [k], cells = [];
          ids[k] = count;
          while (queue.length) {
            var p = queue.pop(), py = Math.floor(p / N), px = p % N;
            cells.push(p);
            var nb = [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]];
            for (var n = 0; n < 4; n++) {
              var ax = nb[n][0], ay = nb[n][1];
              if (ax < 0 || ay < 0 || ax >= N || ay >= N) continue;
              var q = ay * N + ax;
              if (grid[q] === want && ids[q] < 0) { ids[q] = count; queue.push(q); }
            }
          }
          comps.push({ cls: want, cells: cells.length });
          count++;
        }
      }
      return { ids: ids, comps: comps };
    }

    function paintAt(x, y) {
      var r = brush.value(), c = cls.value();
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          var ax = x + dx, ay = y + dy;
          if (ax < 0 || ay < 0 || ax >= N || ay >= N) continue;
          grid[ay * N + ax] = c;
        }
      }
      draw();
    }

    function pointerCell(e) {
      var r = view.canvas.getBoundingClientRect();
      var ix = (e.clientX - r.left) / r.width * view.w;
      var iy = (e.clientY - r.top) / r.height * view.h;
      return { x: clamp(Math.floor((ix - gx) / cw), 0, N - 1), y: clamp(Math.floor((iy - gy) / cw), 0, N - 1) };
    }
    view.canvas.style.cursor = "crosshair";
    view.canvas.setAttribute("tabindex", "0");
    view.canvas.setAttribute("role", "application");
    view.canvas.addEventListener("pointerdown", function (e) {
      var p = pointerCell(e);
      cursor = p; painting = true; paintAt(p.x, p.y);
      try { view.canvas.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    view.canvas.addEventListener("pointermove", function (e) {
      if (!painting) return;
      var p = pointerCell(e); cursor = p; paintAt(p.x, p.y);
    });
    ["pointerup", "pointercancel"].forEach(function (ev) {
      view.canvas.addEventListener(ev, function () { painting = false; });
    });
    view.canvas.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 3 : 1;
      if (e.key === "ArrowLeft") cursor.x -= step;
      else if (e.key === "ArrowRight") cursor.x += step;
      else if (e.key === "ArrowUp") cursor.y -= step;
      else if (e.key === "ArrowDown") cursor.y += step;
      else if (e.key === " " || e.key === "Enter") { paintAt(cursor.x, cursor.y); e.preventDefault(); return; }
      else return;
      cursor.x = clamp(cursor.x, 0, N - 1); cursor.y = clamp(cursor.y, 0, N - 1);
      e.preventDefault(); draw();
    });

    function draw() {
      if (!grid) return;
      var p = V.palette(), cc = components();
      var colors = [p.surface2, p.accent, p.ok, p.warn];
      var cmap = V.colormap("viridis");
      view.clear(p.surface);
      V.text(ctx, "View: " + mode.value() + " · painting class " + cls.value(), gx, 10, { size: 12, color: p.ink2 });
      for (var y = 0; y < N; y++) {
        for (var x = 0; x < N; x++) {
          var k = y * N + x, c = grid[k], inst = cc.ids[k], fillc;
          if (mode.value() === "semantic" || c === 0) fillc = colors[c];
          else fillc = cmap(((inst * 0.19) % 1));
          ctx.fillStyle = fillc;
          ctx.fillRect(gx + x * cw, gy + y * cw, cw - 0.5, cw - 0.5);
        }
      }
      ctx.strokeStyle = p.line; ctx.lineWidth = 0.5;
      for (var i = 0; i <= N; i++) {
        ctx.beginPath(); ctx.moveTo(gx + i * cw, gy); ctx.lineTo(gx + i * cw, gy + gw); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(gx, gy + i * cw); ctx.lineTo(gx + gw, gy + i * cw); ctx.stroke();
      }
      ctx.strokeStyle = p.ink; ctx.lineWidth = 2;
      ctx.strokeRect(gx + cursor.x * cw - 1, gy + cursor.y * cw - 1, cw + 1, cw + 1);
      var r = brush.value();
      if (r > 0) {
        ctx.strokeStyle = p.ink3; ctx.lineWidth = 1;
        ctx.strokeRect(gx + (cursor.x - r) * cw, gy + (cursor.y - r) * cw, (2 * r + 1) * cw, (2 * r + 1) * cw);
      }
      V.legend(ctx, [
        { color: colors[1], label: "class 1" }, { color: colors[2], label: "class 2" }, { color: colors[3], label: "class 3" }
      ], { x: gx, y: gy + gw + 8 }, { lh: 14 });

      var counts = [0, 0, 0, 0];
      for (var j = 0; j < grid.length; j++) counts[grid[j]]++;
      var byClass = [0, 0, 0, 0];
      cc.comps.forEach(function (comp) { byClass[comp.cls]++; });
      reads.set("class 1 px", String(counts[1]));
      reads.set("class 2 px", String(counts[2]));
      reads.set("class 3 px", String(counts[3]));
      reads.set("instances", String(cc.comps.length));
      reads.set("background px", String(counts[0]));
      tab.update([1, 2, 3].map(function (c) { return [String(c), String(counts[c]), String(byClass[c])]; }));
    }

    reset();
    return { reset: reset, destroy: function () { painting = false; } };
  });

  /* ------------------------------------------------------------------ *
   * m5-01-upsampling-comparer — three real 8×8 outputs from a 4×4 grid
   * Exact: DL.tensor upsample / convTranspose2d.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m5-01-upsampling-comparer", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, {
      w: 720, h: 290, label: "Nearest, bilinear and transposed-convolution outputs of the same 4×4 grid"
    });
    var ctx = view.ctx;

    var pattern = U.select({
      label: "4×4 source", ariaLabel: "Source pattern",
      options: [
        { value: "checker", label: "Checkerboard 0 / 9" },
        { value: "impulse", label: "Single impulse 9" },
        { value: "ramp", label: "Horizontal ramp" }
      ], value: "checker", onChange: draw
    });
    var kernel = U.select({
      label: "Transposed kernel", ariaLabel: "Transposed convolution kernel",
      options: [
        { value: "uneven", label: "[[1, .5], [.5, .25]] — checkerboard" },
        { value: "flat", label: "[[1, 1], [1, 1]] — flat" }
      ], value: "uneven", onChange: draw
    });
    var reads = U.readouts(["src (1,1)", "nearest (2,3)", "bilinear (2,3)", "convT (2,3)", "adjacent Δ convT"]);
    var tab = U.table({ columns: ["output (y,x)", "nearest", "bilinear", "convT"], rows: [], caption: "Actual cells of the three 8×8 outputs" });

    stage.controls.appendChild(pattern.el);
    stage.controls.appendChild(kernel.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(tab.el);
    stage.controls.appendChild(small("4×4 → 8×8, factor f=2. Nearest reads ⌊y/f⌋; bilinear reads (y+0.5)/f−0.5; transposed conv gives H′=(4−1)·2−2·0+1·(2−1)+0+1=8."));

    function source() {
      var A = T.zeros(4, 4);
      for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) {
        if (pattern.value() === "impulse") A[y][x] = (x === 1 && y === 1) ? 9 : 0;
        else if (pattern.value() === "ramp") A[y][x] = x * 3;
        else A[y][x] = ((x + y) % 2) ? 9 : 0;
      }
      return A;
    }

    function draw() {
      var p = V.palette();
      var A = source();
      var near = T.upsampleNearest(A, 2);
      var bil = T.upsampleBilinear(A, 2);
      var K = kernel.value() === "uneven" ? [[1, 0.5], [0.5, 0.25]] : [[1, 1], [1, 1]];
      var conv = T.convTranspose2d(A, K, { stride: 2, padding: 0, outputPadding: 0 });
      view.clear(p.surface);
      var panels = [
        { M: near, name: "nearest", x: 16 },
        { M: bil, name: "bilinear", x: 248 },
        { M: conv, name: "convTranspose2d", x: 480 }
      ];
      panels.forEach(function (q) {
        V.text(ctx, q.name, q.x, 18, { size: 13, weight: "600", color: p.ink });
        V.heatmap(ctx, q.M, { x: q.x, y: 28, w: 224, h: 224 }, {
          cmap: "viridis", vmin: 0, vmax: 9, values: true, fmt: function (v) { return f(v, 1); }
        });
      });
      V.text(ctx, "input (1,1) = " + f(A[1][1], 1), 16, 270, { size: 11, mono: true, color: p.ink2 });
      var maxv = 0, sumd = 0, cnt = 0;
      for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
        maxv = Math.max(maxv, conv[y][x]);
        if (x < 7) { sumd += Math.abs(conv[y][x + 1] - conv[y][x]); cnt++; }
      }
      var cellvmax = Math.max(1, maxv);
      var vmaxPanel = 9;
      reads.set("src (1,1)", f(A[1][1], 1));
      reads.set("nearest (2,3)", f(near[2][3], 2));
      reads.set("bilinear (2,3)", f(bil[2][3], 2));
      reads.set("convT (2,3)", f(conv[2][3], 2));
      reads.set("adjacent Δ convT", f(sumd / cnt, 3) + " (max " + f(cellvmax, 1) + ")");
      tab.update([[2, 3], [3, 2], [4, 4], [5, 5]].map(function (rc) {
        return ["(" + rc[0] + "," + rc[1] + ")", f(near[rc[0]][rc[1]], 2),
          f(bil[rc[0]][rc[1]], 2), f(conv[rc[0]][rc[1]], 2)];
      }));
    }

    draw();
    return { reset: function () { pattern.set("checker", true); kernel.set("uneven", true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m5-01-dilated-rf — Keff, dilated taps and coverage
   * Exact: DL.tensor.dilateKernel + conv2d on an impulse; RF via library.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m5-01-dilated-rf", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 560, h: 370, label: "Dilated kernel taps and receptive-field coverage" });
    var ctx = view.ctx;

    var rate = U.slider({ label: "Dilation D", min: 1, max: 6, step: 1, value: 2, digits: 0, onInput: draw });
    var ksel = U.buttons({
      label: "Kernel K", ariaLabel: "Kernel size",
      options: [{ value: 3, label: "3×3" }, { value: 5, label: "5×5" }], value: 3, onChange: draw
    });
    var dsel = U.buttons({
      label: "Plot", ariaLabel: "Plot dimension",
      options: [{ value: "1d", label: "1-D strip" }, { value: "2d", label: "2-D grid" }], value: "1d", onChange: draw
    });
    var reads = U.readouts(["Keff", "nonzero taps", "coverage %", "stack RF", "ASPP r=12"]);
    var tab = U.table({ columns: ["ASPP rate r", "Keff = r(K−1)+1", "patch area"], rows: [], caption: "Effective field for each ASPP branch at the chosen K" });

    stage.controls.appendChild(rate.el);
    stage.controls.appendChild(ksel.el);
    stage.controls.appendChild(dsel.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(tab.el);
    stage.controls.appendChild(small("Keff = D(K−1)+1. The kernel keeps K² weights but samples a Keff×Keff patch."));

    function draw() {
      var p = V.palette(), K = ksel.value(), D = rate.value(), Keff = D * (K - 1) + 1;
      var G = 21, pad = (Keff - 1) / 2;
      var impulse = T.zeros(G, G); impulse[10][10] = 1;
      var kern = T.ones(K, K);
      var dilated = T.dilateKernel(kern, D);
      var map = T.conv2d(impulse, dilated, { padding: pad });
      var taps = 0, nonzero = 0;
      for (var yy = 0; yy < dilated.length; yy++) for (var xx = 0; xx < dilated[0].length; xx++) if (dilated[yy][xx]) taps++;
      for (var y = 0; y < G; y++) for (var x = 0; x < G; x++) if (map[y][x] > 0) nonzero++;
      var cover = 100 * nonzero / (G * G);
      var rf = T.receptiveField([K, K, K], [1, 1, 1], [1, D, 1]);

      view.clear(p.surface);
      if (dsel.value() === "1d") {
        var row = map[10], x0 = 30, cw = (view.w - 60) / G;
        for (var i = 0; i < G; i++) {
          ctx.fillStyle = row[i] > 0 ? p.accent : p.surface2;
          ctx.fillRect(x0 + i * cw, 110, cw - 2, 70);
          if (row[i] > 0) V.text(ctx, "1", x0 + i * cw + cw / 2, 150, { size: 10, align: "center", mono: true, color: p.surface });
        }
        V.text(ctx, "1-D slice through the centre · " + G + " positions", x0, 90, { size: 12, color: p.ink2 });
        V.text(ctx, "sampled taps: " + taps + "  |  Keff = " + Keff, x0, 210, { size: 12, mono: true, color: p.ink });
        V.text(ctx, "D = " + D + " inserts " + (D - 1) + " zeros between each of the K = " + K + " taps", x0, 235, { size: 11, color: p.ink2 });
      } else {
        var rect = { x: 66, y: 18, w: 320, h: 320 }, cell = rect.w / G;
        V.heatmap(ctx, map, rect, { cmap: "accent", vmin: 0, vmax: 1, gap: 1 });
        V.text(ctx, "centre impulse convolved with the dilated kernel", rect.x, 350, { size: 11, color: p.ink2 });
      }
      reads.set("Keff", String(Keff));
      reads.set("nonzero taps", String(taps) + " of " + (K * K) + " weights");
      reads.set("coverage %", f(cover, 1));
      reads.set("stack RF", String(rf[rf.length - 1].rf));
      reads.set("ASPP r=12", String(12 * (K - 1) + 1));
      tab.update([1, 6, 12, 18].map(function (r) {
        var ke = r * (K - 1) + 1;
        return [String(r), String(ke), ke + "×" + ke + " = " + (ke * ke)];
      }));
    }

    draw();
    return { reset: function () { rate.set(2, true); ksel.set(3, true); dsel.set("1d", true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m5-02-unet-explorer — every shape and parameter count, live
   * Exact: DL.nn.convParams arithmetic on the user's architecture.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m5-02-unet-explorer", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 720, h: 250, label: "U-Net encoder, bottleneck, decoder and skip connections" });
    var ctx = view.ctx;

    var size = U.select({
      label: "Input H = W", ariaLabel: "Input size",
      options: [64, 100, 128, 256].map(function (v) { return { value: String(v), label: String(v) }; }),
      value: "64", onChange: draw
    });
    var levels = U.slider({ label: "Levels L", min: 1, max: 4, step: 1, value: 2, digits: 0, onInput: draw });
    var base = U.select({
      label: "Base channels B", ariaLabel: "Base channels",
      options: [8, 16, 32, 64].map(function (v) { return { value: String(v), label: String(v) }; }),
      value: "16", onChange: draw
    });
    var classes = U.select({
      label: "Output classes", ariaLabel: "Output classes",
      options: [{ value: "1", label: "1" }, { value: "2", label: "2" }], value: "1", onChange: draw
    });
    var skip = U.toggle({ label: "Use skip connections", checked: true, onChange: draw });
    var reads = U.readouts(["output shape", "total params", "blocks", "skips"]);
    var tab = U.table({ columns: ["#", "block", "output (N,C,H,W)", "params", "arithmetic"], rows: [], caption: "Forward pass, computed block by block" });
    var warn = DL.el("div", { class: "callout callout--warn", style: { margin: "0" } });

    stage.controls.appendChild(size.el);
    stage.controls.appendChild(levels.el);
    stage.controls.appendChild(base.el);
    stage.controls.appendChild(classes.el);
    stage.controls.appendChild(skip.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(warn);
    stage.controls.appendChild(tab.el);
    stage.controls.appendChild(small("Each 3×3 block: params = 9·C_in·C_out + C_out. Skips concatenate the saved encoder map on the channel axis; the decoder must match it spatially."));

    function compute() {
      var H = parseInt(size.value(), 10), L = levels.value(), B = parseInt(base.value(), 10);
      var K = parseInt(classes.value(), 10), useSkip = skip.checked();
      var rows = [], skips = [], issues = [], cin = 3, total = 0;
      function add(name, shape, params, arith) {
        rows.push({ name: name, shape: shape, params: params, arith: arith });
        total += params;
      }
      for (var i = 0; i < L; i++) {
        var cout = B * Math.pow(2, i);
        var p1 = DL.nn.convParams(cin, cout, 3, true), p2 = DL.nn.convParams(cout, cout, 3, true);
        add("enc" + i + " conv1 3×3", [1, cout, H, H], p1, "9·" + cin + "·" + cout + "+" + cout);
        add("enc" + i + " conv2 3×3", [1, cout, H, H], p2, "9·" + cout + "·" + cout + "+" + cout);
        skips.push({ level: i, H: H, C: cout });
        var hp = Math.floor(H / 2);
        add("pool" + i + " 2×2", [1, cout, hp, hp], 0, "H//2 = " + hp);
        H = hp; cin = cout;
      }
      var bc = B * Math.pow(2, L);
      add("bottleneck conv1", [1, bc, H, H], DL.nn.convParams(cin, bc, 3, true), "9·" + cin + "·" + bc + "+" + bc);
      add("bottleneck conv2", [1, bc, H, H], DL.nn.convParams(bc, bc, 3, true), "9·" + bc + "·" + bc + "+" + bc);
      cin = bc;
      for (var j = L - 1; j >= 0; j--) {
        var upH = H * 2;
        add("up" + j + " ×2", [1, cin, upH, upH], 0, "2·" + H + " = " + upH);
        H = upH;
        var s = skips[j], before = cin, cout2 = s.C;
        if (useSkip) {
          before = cin + s.C;
          if (H !== s.H) issues.push({ level: j, dec: H, skip: s.H });
        }
        add("dec" + j + " conv1" + (useSkip ? " + skip" : ""), [1, cout2, H, H],
          DL.nn.convParams(before, cout2, 3, true), "9·" + before + "·" + cout2 + "+" + cout2);
        add("dec" + j + " conv2", [1, cout2, H, H],
          DL.nn.convParams(cout2, cout2, 3, true), "9·" + cout2 + "·" + cout2 + "+" + cout2);
        cin = cout2;
      }
      add("head 1×1", [1, K, H, H], DL.nn.convParams(cin, K, 1, true), "1·" + cin + "·" + K + "+" + K);
      return { rows: rows, total: total, skips: skips, issues: issues, H: H, K: K };
    }

    function drawDiagram(z) {
      var p = V.palette();
      view.clear(p.surface);
      var levelsN = z.skips.length, nodes = [];
      var xL = 95, xR = 560, yTop = 26, stepY = levelsN ? 150 / levelsN : 40;
      for (var i = 0; i <= levelsN; i++) {
        var s = i < levelsN ? z.skips[i] : null;
        var label = s ? "C" + s.C + " · " + s.H + "²" : "bottleneck";
        nodes.push({ x: xL, y: yTop + i * stepY, label: label });
      }
      for (var j = levelsN; j >= 0; j--) {
        var t = j < levelsN ? z.skips[j] : null;
        nodes.push({ x: xR, y: yTop + j * stepY, label: t ? "dec" + j + " · " + t.C : "head · " + z.K });
      }
      for (var a = 0; a < nodes.length - 1; a++) {
        var f = nodes[a], g2 = nodes[a + 1];
        if (f.x === g2.x && f.y !== g2.y) V.arrow(ctx, f.x, f.y, g2.x, g2.y, { color: p.lineStrong, width: 1.4 });
      }
      if (skip.checked()) {
        for (var k = 0; k < levelsN; k++) {
          var e = nodes[k], d = nodes[levelsN + 1 + (levelsN - 1 - k)];
          V.arrow(ctx, e.x + 34, e.y, d.x - 34, d.y, { color: p.accent, width: 1.3 });
        }
      }
      nodes.forEach(function (n) {
        ctx.fillStyle = p.surface2; ctx.strokeStyle = p.accent; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.rect(n.x - 72, n.y - 14, 144, 28); ctx.fill(); ctx.stroke();
        V.text(ctx, n.label, n.x, n.y + 4, { size: 10, align: "center", mono: true, color: p.ink });
      });
      V.text(ctx, "encoder", xL, 228, { size: 12, align: "center", color: p.ink2 });
      V.text(ctx, skip.checked() ? "decoder + skips" : "decoder (no skips)", xR, 228, { size: 12, align: "center", color: p.ink2 });
    }

    function draw() {
      var z = compute();
      drawDiagram(z);
      var rows = z.rows.map(function (r, i) {
        return [String(i + 1), r.name, shapeStr(r.shape), r.params.toLocaleString("en-US"), r.arith];
      });
      rows.push(["", "TOTAL", shapeStr([1, z.K, z.H, z.H]), DL.nn.formatCount(z.total), "sum of all blocks"]);
      tab.update(rows);
      reads.set("output shape", shapeStr([1, z.K, z.H, z.H]));
      reads.set("total params", DL.nn.formatCount(z.total));
      reads.set("blocks", String(z.rows.length));
      reads.set("skips", skip.checked() ? String(z.skips.length) + " on" : "off");
      warn.innerHTML = "";
      if (z.issues.length) {
        var d = z.issues[0];
        warn.appendChild(DL.el("p", { class: "callout__title", text: "Real skip shape mismatch" }));
        warn.appendChild(DL.el("p", {
          text: "At level " + d.level + " the upsampled decoder map is " + d.dec + "×" + d.dec +
            " but the saved encoder skip is " + d.skip + "×" + d.skip + ". Concatenation would throw. " +
            "Crop or pad the skip, or choose H divisible by 2^L."
        }));
      } else {
        warn.className = "callout callout--tip";
        warn.appendChild(DL.el("p", { class: "callout__title", text: skip.checked() ? "All skip shapes align" : "Skips disabled" }));
        warn.appendChild(DL.el("p", {
          text: skip.checked()
            ? "Each decoder map matches its encoder twin in space; channels add on concatenation."
            : "The decoder receives only its own feature map, so conv1 has fewer input channels and no alignment constraint."
        }));
      }
    }

    draw();
    return { reset: function () {
      size.set("64", true); levels.set(2, true); base.set("16", true);
      classes.set("1", true); skip.set(true, true); draw();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m5-02-iou-dice — two draggable masks, real overlap statistics
   * Exact: set intersection, union and per-class scores.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m5-02-iou-dice", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var row = DL.el("div", { class: "hstack", style: { flexWrap: "wrap", gap: "10px", justifyContent: "center" } });
    stage.canvasWrap.appendChild(row);
    var wrapP = DL.el("div"), wrapG = DL.el("div"), wrapO = DL.el("div");
    row.appendChild(wrapP); row.appendChild(wrapG); row.appendChild(wrapO);
    var vp = V.canvas(wrapP, { w: 210, h: 210, label: "Predicted mask, drag to move" });
    var vg = V.canvas(wrapG, { w: 210, h: 210, label: "Ground-truth mask, drag to move" });
    var vo = V.canvas(wrapO, { w: 210, h: 210, label: "Overlay: green TP, red FP, amber FN" });

    var which = U.buttons({
      label: "Editing", ariaLabel: "Mask being edited",
      options: [{ value: "p", label: "Prediction" }, { value: "g", label: "Ground truth" }],
      value: "p", onChange: syncSliders
    });
    var cp = U.select({ label: "Prediction class", ariaLabel: "Prediction class", options: [{ value: "1", label: "class 1" }, { value: "2", label: "class 2" }], value: "1", onChange: draw });
    var cg = U.select({ label: "Truth class", ariaLabel: "Ground-truth class", options: [{ value: "1", label: "class 1" }, { value: "2", label: "class 2" }], value: "1", onChange: draw });
    var xr = U.slider({ label: "x", min: 0, max: 7, step: 1, value: 1, digits: 0, onInput: function (v) { cur().x = v; draw(); } });
    var yr = U.slider({ label: "y", min: 0, max: 7, step: 1, value: 1, digits: 0, onInput: function (v) { cur().y = v; draw(); } });
    var wr = U.slider({ label: "width", min: 1, max: 8, step: 1, value: 4, digits: 0, onInput: function (v) { cur().w = v; draw(); } });
    var hr = U.slider({ label: "height", min: 1, max: 8, step: 1, value: 4, digits: 0, onInput: function (v) { cur().h = v; draw(); } });
    var reads = U.readouts(["|P|", "|G|", "|P∩G|", "|P∪G|", "IoU", "Dice", "2IoU/(1+IoU)"]);
    var tab = U.table({ columns: ["class", "|P|", "|G|", "intersection", "IoU", "Dice"], rows: [], caption: "Per-class overlap on the 8×8 grid" });

    stage.controls.appendChild(which.el);
    stage.controls.appendChild(cp.el);
    stage.controls.appendChild(cg.el);
    stage.controls.appendChild(xr.el);
    stage.controls.appendChild(yr.el);
    stage.controls.appendChild(wr.el);
    stage.controls.appendChild(hr.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(tab.el);
    stage.controls.appendChild(small("Drag either mask, or focus a canvas and use arrow keys. IoU = |P∩G|/|P∪G|; Dice = 2|P∩G|/(|P|+|G|), smoothed with ε=1 per class."));

    var N = 8;
    var P = { x: 1, y: 1, w: 4, h: 4 }, G = { x: 3, y: 2, w: 4, h: 4 };
    var drag = null;

    function cur() { return which.value() === "p" ? P : G; }
    function syncSliders() {
      var c = cur();
      xr.set(c.x, true); yr.set(c.y, true); wr.set(c.w, true); hr.set(c.h, true);
    }
    function gridOf(rect, cls) {
      var M = [];
      for (var y = 0; y < N; y++) {
        var r = [];
        for (var x = 0; x < N; x++) r.push((x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) ? cls : 0);
        M.push(r);
      }
      return M;
    }
    function attach(viewObj, key) {
      var c = viewObj.canvas;
      c.style.cursor = "grab";
      c.setAttribute("tabindex", "0");
      c.setAttribute("role", "application");
      c.addEventListener("pointerdown", function (e) {
        var r = c.getBoundingClientRect();
        drag = {
          key: key,
          px: (e.clientX - r.left) / r.width * viewObj.w,
          py: (e.clientY - r.top) / r.height * viewObj.h,
          rect: key === "p" ? P : G
        };
        which.set(key, true); syncSliders();
        try { c.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });
      c.addEventListener("pointermove", function (e) {
        if (!drag || drag.key !== key) return;
        var r = c.getBoundingClientRect();
        var ix = (e.clientX - r.left) / r.width * viewObj.w;
        var iy = (e.clientY - r.top) / r.height * viewObj.h;
        var cell = viewObj.w / N;
        var nx = clamp(drag.rect.x + Math.round((ix - drag.px) / cell), 0, N - 1);
        var ny = clamp(drag.rect.y + Math.round((iy - drag.py) / cell), 0, N - 1);
        drag.rect.x = nx; drag.rect.y = ny;
        drag.px = ix; drag.py = iy;
        syncSliders(); draw();
      });
      ["pointerup", "pointercancel"].forEach(function (ev) { c.addEventListener(ev, function () { drag = null; }); });
      c.addEventListener("keydown", function (e) {
        which.set(key, true);
        var c2 = key === "p" ? P : G, step = e.shiftKey ? 2 : 1;
        if (e.key === "ArrowLeft") c2.x -= step;
        else if (e.key === "ArrowRight") c2.x += step;
        else if (e.key === "ArrowUp") c2.y -= step;
        else if (e.key === "ArrowDown") c2.y += step;
        else return;
        c2.x = clamp(c2.x, 0, N - 1); c2.y = clamp(c2.y, 0, N - 1);
        e.preventDefault(); syncSliders(); draw();
      });
    }
    attach(vp, "p"); attach(vg, "g");

    function drawGrid(viewObj, M, colors, title, outlineRect) {
      var p = V.palette(), cw = viewObj.w / N;
      viewObj.clear(p.surface);
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
        ctxFill(viewObj, colors[M[y][x]], x * cw, y * cw, cw - 0.5, cw - 0.5);
      }
      if (outlineRect) {
        viewObj.ctx.strokeStyle = p.ink; viewObj.ctx.lineWidth = 2;
        viewObj.ctx.strokeRect(outlineRect.x * cw, outlineRect.y * cw, outlineRect.w * cw, outlineRect.h * cw);
      }
      V.text(viewObj.ctx, title, 6, 14, { size: 11, color: p.ink });
    }
    function ctxFill(viewObj, color, x, y, w, h) {
      viewObj.ctx.fillStyle = color; viewObj.ctx.fillRect(x, y, w, h);
    }

    function stats(A, B) {
      var s = { Pc: [0, 0, 0], Gc: [0, 0, 0], inter: [0, 0, 0], union: [0, 0, 0] };
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
        var a = A[y][x], b = B[y][x];
        if (a) s.Pc[a - 1]++;
        if (b) s.Gc[b - 1]++;
        if (a && a === b) s.inter[a - 1]++;
      }
      for (var c = 0; c < 2; c++) s.union[c] = s.Pc[c] + s.Gc[c] - s.inter[c];
      s.P = s.Pc[0] + s.Pc[1]; s.G = s.Gc[0] + s.Gc[1];
      s.I = s.inter[0] + s.inter[1]; s.U = s.union[0] + s.union[1];
      return s;
    }

    function draw() {
      var p = V.palette();
      var A = gridOf(P, parseInt(cp.value(), 10)), B = gridOf(G, parseInt(cg.value(), 10));
      var cols = [p.surface2, p.accent, p.ok];
      drawGrid(vp, A, cols, "prediction", P);
      drawGrid(vg, B, cols, "ground truth", G);
      var overlay = [];
      for (var y = 0; y < N; y++) {
        var r = [];
        for (var x = 0; x < N; x++) {
          var a = A[y][x], b = B[y][x];
          r.push(a && b && a === b ? "tp" : (a ? "fp" : (b ? "fn" : "tn")));
        }
        overlay.push(r);
      }
      drawGrid(vo, overlay.map(function (row2) { return row2.map(function (v) {
        return v === "tp" ? 1 : v === "fp" ? 2 : v === "fn" ? 3 : 0;
      }); }), [p.surface2, p.ok, p.danger, p.warn], "overlay", null);

      var s = stats(A, B);
      var iou = s.U ? s.I / s.U : 1;
      var dice = (2 * s.I + 1) / (s.P + s.G + 1);
      reads.set("|P|", String(s.P)); reads.set("|G|", String(s.G));
      reads.set("|P∩G|", String(s.I)); reads.set("|P∪G|", String(s.U));
      reads.set("IoU", f(iou, 3)); reads.set("Dice", f(dice, 3));
      reads.set("2IoU/(1+IoU)", f(2 * iou / (1 + iou), 3));
      tab.update([1, 2].map(function (c) {
        var pc = s.Pc[c - 1], gc = s.Gc[c - 1], it = s.inter[c - 1], un = s.union[c - 1];
        var ic = un ? it / un : 1, dc = (2 * it + 1) / (pc + gc + 1);
        return ["class " + c, String(pc), String(gc), String(it), f(ic, 3), f(dc, 3)];
      }));
    }

    draw();
    return { reset: function () {
      P = { x: 1, y: 1, w: 4, h: 4 }; G = { x: 3, y: 2, w: 4, h: 4 };
      which.set("p", true); cp.set("1", true); cg.set("1", true); syncSliders(); draw();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m5-03-roi-align — fractional RoI, RoIPool vs RoIAlign
   * Exact: quantised bins and all 2×2 bilinear samples are computed.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m5-03-roi-align", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 640, h: 380, label: "8×8 feature grid with a draggable fractional RoI and its sample locations" });
    var ctx = view.ctx;

    var x1r = U.slider({ label: "RoI x₁", min: 0, max: 8, step: 0.1, value: 1.2, digits: 1, onInput: onRect });
    var y1r = U.slider({ label: "RoI y₁", min: 0, max: 8, step: 0.1, value: 1.1, digits: 1, onInput: onRect });
    var x2r = U.slider({ label: "RoI x₂", min: 0, max: 8, step: 0.1, value: 5.3, digits: 1, onInput: onRect });
    var y2r = U.slider({ label: "RoI y₂", min: 0, max: 8, step: 0.1, value: 4.8, digits: 1, onInput: onRect });
    var reads = U.readouts(["quantised RoI", "RoIPool max", "RoIAlign mean", "first sample value"]);
    var tab = U.table({ columns: ["output cell", "RoIPool (max)", "RoIAlign (bilinear)"], rows: [], caption: "2×2 outputs for the same fractional region" });
    var detail = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var outWrap = DL.el("div", { style: { display: "flex", gap: "18px", flexWrap: "wrap", justifyContent: "center" } });
    var outA = V.canvas(outWrap, { w: 150, h: 150, label: "RoIPool 2×2 output with values" });
    var outB = V.canvas(outWrap, { w: 150, h: 150, label: "RoIAlign 2×2 output with values" });

    stage.controls.appendChild(x1r.el);
    stage.controls.appendChild(y1r.el);
    stage.controls.appendChild(x2r.el);
    stage.controls.appendChild(y2r.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(detail);
    stage.controls.appendChild(outWrap);
    stage.controls.appendChild(tab.el);
    stage.controls.appendChild(small("RoIPool floors x₁,y₁ and ceils x₂,y₂, then max-pools integer cells. RoIAlign keeps the fractional box and averages 2×2 bilinear samples per output bin."));

    var G = 8, F = [];
    for (var y = 0; y < G; y++) {
      var r = [];
      for (var x = 0; x < G; x++) r.push(((x * 5 + y * 3) % 16) + 1);
      F.push(r);
    }
    var dragging = false, dragOff = { x: 0, y: 0 };

    function rect() { return { x1: x1r.value(), y1: y1r.value(), x2: x2r.value(), y2: y2r.value() }; }
    function onRect() {
      var q = rect();
      if (q.x2 <= q.x1 + 0.2) x2r.set(clamp(q.x1 + 0.2, 0, 8), true);
      if (q.y2 <= q.y1 + 0.2) y2r.set(clamp(q.y1 + 0.2, 0, 8), true);
      draw();
    }
    function pointerPos(e) {
      var r = view.canvas.getBoundingClientRect();
      var ix = (e.clientX - r.left) / r.width * view.w;
      var iy = (e.clientY - r.top) / r.height * view.h;
      return { x: clamp((ix - 50) / (view.w - 100) * G, 0, G), y: clamp((iy - 20) / 320 * G, 0, G) };
    }
    view.canvas.style.cursor = "grab";
    view.canvas.setAttribute("tabindex", "0");
    view.canvas.setAttribute("role", "application");
    view.canvas.addEventListener("pointerdown", function (e) {
      var pt = pointerPos(e), q = rect();
      dragging = true; dragOff = { x: pt.x - q.x1, y: pt.y - q.y1 };
      try { view.canvas.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    view.canvas.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var pt = pointerPos(e);
      var w = rect().x2 - rect().x1, h = rect().y2 - rect().y1;
      var nx = clamp(Math.round((pt.x - dragOff.x) * 10) / 10, 0, 8 - w);
      var ny = clamp(Math.round((pt.y - dragOff.y) * 10) / 10, 0, 8 - h);
      x1r.set(nx, true); y1r.set(ny, true);
      x2r.set(Math.round((nx + w) * 10) / 10, true); y2r.set(Math.round((ny + h) * 10) / 10, true);
      draw();
    });
    ["pointerup", "pointercancel"].forEach(function (ev) { view.canvas.addEventListener(ev, function () { dragging = false; }); });
    view.canvas.addEventListener("keydown", function (e) {
      var q = rect(), dx = 0, dy = 0, d = e.shiftKey ? 1 : 0.1;
      if (e.key === "ArrowLeft") dx = -d;
      else if (e.key === "ArrowRight") dx = d;
      else if (e.key === "ArrowUp") dy = -d;
      else if (e.key === "ArrowDown") dy = d;
      else return;
      e.preventDefault();
      var w = q.x2 - q.x1, h = q.y2 - q.y1;
      var nx = clamp(q.x1 + dx, 0, 8 - w), ny = clamp(q.y1 + dy, 0, 8 - h);
      x1r.set(Math.round(nx * 10) / 10, true); y1r.set(Math.round(ny * 10) / 10, true);
      x2r.set(Math.round((nx + w) * 10) / 10, true); y2r.set(Math.round((ny + h) * 10) / 10, true);
      draw();
    });

    function bilinear(x, y) {
      var sx = clamp(x - 0.5, 0, G - 1), sy = clamp(y - 0.5, 0, G - 1);
      var x0 = Math.floor(sx), y0 = Math.floor(sy);
      var x1 = Math.min(G - 1, x0 + 1), y1 = Math.min(G - 1, y0 + 1);
      var fx = sx - x0, fy = sy - y0;
      var w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy);
      var w01 = (1 - fx) * fy, w11 = fx * fy;
      var v = F[y0][x0] * w00 + F[y0][x1] * w10 + F[y1][x0] * w01 + F[y1][x1] * w11;
      return { v: v, w: [w00, w10, w01, w11], ij: [y0, x0, y0, x1, y1, x0, y1, x1], f: [fx, fy], xy: [x, y] };
    }

    function pool(q) {
      var x0 = Math.floor(q.x1), y0 = Math.floor(q.y1), xe = Math.ceil(q.x2), ye = Math.ceil(q.y2);
      var bw = (xe - x0) / 2, bh = (ye - y0) / 2, out = [];
      for (var oy = 0; oy < 2; oy++) {
        var row = [];
        for (var ox = 0; ox < 2; ox++) {
          var ax = clamp(Math.floor(x0 + ox * bw), 0, G - 1);
          var bx = clamp(Math.max(ax + 1, Math.ceil(x0 + (ox + 1) * bw)), 0, G);
          var ay = clamp(Math.floor(y0 + oy * bh), 0, G - 1);
          var by = clamp(Math.max(ay + 1, Math.ceil(y0 + (oy + 1) * bh)), 0, G);
          var m = -Infinity;
          for (var y = ay; y < by; y++) for (var x = ax; x < bx; x++) m = Math.max(m, F[y][x]);
          row.push(isFinite(m) ? m : F[clamp(ay, 0, G - 1)][clamp(ax, 0, G - 1)]);
        }
        out.push(row);
      }
      return { out: out, quant: [x0, y0, xe, ye] };
    }

    function align(q) {
      var bw = (q.x2 - q.x1) / 2, bh = (q.y2 - q.y1) / 2, out = [], samples = [];
      for (var oy = 0; oy < 2; oy++) {
        var row = [];
        for (var ox = 0; ox < 2; ox++) {
          var acc = 0, local = [];
          for (var sy = 0; sy < 2; sy++) for (var sx = 0; sx < 2; sx++) {
            var px = q.x1 + (ox + (sx + 0.5) / 2) * bw;
            var py = q.y1 + (oy + (sy + 0.5) / 2) * bh;
            var s = bilinear(px, py);
            acc += s.v; local.push(s);
          }
          row.push(acc / 4);
          if (oy === 0 && ox === 0) samples = local;
        }
        out.push(row);
      }
      return { out: out, samples: samples };
    }

    function drawMini(viewObj, M, title) {
      var p = V.palette();
      viewObj.clear(p.surface);
      V.text(viewObj.ctx, title, 6, 14, { size: 12, color: p.ink });
      V.heatmap(viewObj.ctx, M, { x: 22, y: 24, w: 106, h: 106 }, {
        cmap: "viridis", vmin: 1, vmax: 16, values: true, fmt: function (v) { return f(v, 1); }
      });
    }

    function draw() {
      var p = V.palette(), q = rect();
      var pooled = pool(q), aligned = align(q);
      view.clear(p.surface);
      var x0 = 50, y0 = 20, cs = 320 / G;
      for (var y = 0; y < G; y++) for (var x = 0; x < G; x++) {
        var heat = V.colormap("viridis")(clamp((F[y][x] - 1) / 15, 0, 1));
        ctx.fillStyle = heat;
        ctx.fillRect(x0 + x * cs, y0 + y * cs, cs - 1, cs - 1);
        V.text(ctx, String(F[y][x]), x0 + x * cs + cs / 2, y0 + y * cs + cs / 2,
          { size: 10, align: "center", baseline: "middle", color: "rgba(255,255,255,.85)", mono: true });
      }
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.5;
      ctx.strokeRect(x0 + pooled.quant[0] * cs, y0 + pooled.quant[1] * cs,
        (pooled.quant[2] - pooled.quant[0]) * cs, (pooled.quant[3] - pooled.quant[1]) * cs);
      ctx.strokeStyle = p.ink; ctx.lineWidth = 2.5;
      ctx.strokeRect(x0 + q.x1 * cs, y0 + q.y1 * cs, (q.x2 - q.x1) * cs, (q.y2 - q.y1) * cs);
      V.legend(ctx, [
        { color: p.ink, label: "fractional RoI (RoIAlign)" },
        { color: "rgba(255,255,255,.75)", label: "quantised RoI (RoIPool)" }
      ], { x: 392, y: 30 }, { lh: 16 });
      V.text(ctx, "bilinear samples in bin (0,0):", 392, 110, { size: 11, color: p.ink2 });
      aligned.samples.forEach(function (s, i) {
        V.dot(ctx, 400, 132 + i * 18, 3, p.accent);
        V.text(ctx, "(" + f(s.xy[0], 2) + ", " + f(s.xy[1], 2) + ") → " + f(s.v, 2),
          410, 136 + i * 18, { size: 10, mono: true, color: p.ink });
      });
      V.text(ctx, "RoIPool max: " + JSON.stringify(pooled.out) + "   RoIAlign: " +
        aligned.out.map(function (r2) { return r2.map(function (v) { return f(v, 2); }).join(", "); }).join(" | "),
        50, 360, { size: 11, mono: true, color: p.ink2 });

      drawMini(outA, pooled.out, "RoIPool · max");
      drawMini(outB, aligned.out, "RoIAlign · bilinear");
      var s0 = aligned.samples[0];
      detail.textContent = "First sample at (" + f(s0.xy[0], 4) + ", " + f(s0.xy[1], 4) +
        "): fx=" + f(s0.f[0], 4) + ", fy=" + f(s0.f[1], 4) +
        "; weights w00=" + f(s0.w[0], 4) + ", w10=" + f(s0.w[1], 4) +
        ", w01=" + f(s0.w[2], 4) + ", w11=" + f(s0.w[3], 4) +
        "; value = " + f(s0.v, 4) + ".";
      reads.set("quantised RoI", "(" + pooled.quant.join(", ") + ")");
      reads.set("RoIPool max", f(pooled.out[0][0], 2) + ", " + f(pooled.out[0][1], 2));
      reads.set("RoIAlign mean", f(aligned.out[0][0], 2) + ", " + f(aligned.out[0][1], 2));
      reads.set("first sample value", f(s0.v, 4));
      tab.update([0, 1].map(function (oy) {
        return [0, 1].map(function (ox) {
          return ["(" + oy + "," + ox + ")", f(pooled.out[oy][ox], 2), f(aligned.out[oy][ox], 2)];
        });
      }).reduce(function (a, b) { return a.concat(b); }, []));
    }

    draw();
    return { reset: function () {
      x1r.set(1.2, true); y1r.set(1.1, true); x2r.set(5.3, true); y2r.set(4.8, true); draw();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m5-04-leakage-sim — schematic duplicate data, real fold arithmetic
   * Illustrative: synthetic duplicate pattern + nearest-neighbour proxy.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m5-04-leakage-sim", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 520, h: 280, label: "Synthetic scan positions coloured by group and validation fold" });
    var ctx = view.ctx;

    var close = U.slider({ label: "Near-duplicate closeness", min: 0, max: 95, step: 5, value: 80, digits: 0, onInput: draw });
    var foldsCtl = U.slider({ label: "Number of folds", min: 3, max: 6, step: 1, value: 5, digits: 0, onInput: draw });
    var seedCtl = U.slider({ label: "Shuffle seed", min: 0, max: 30, step: 1, value: 4, digits: 0, onInput: draw });
    var reads = U.readouts(["random KFold", "GroupKFold", "optimistic gap", "leaked val rows"]);
    var barView = V.canvas(stage.canvasWrap, { w: 520, h: 120, label: "Random versus group fold accuracy bars" });
    var tab = U.table({ columns: ["fold", "random KFold", "GroupKFold"], rows: [], caption: "Fold scores from the same synthetic rows" });

    stage.controls.appendChild(close.el);
    stage.controls.appendChild(foldsCtl.el);
    stage.controls.appendChild(seedCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(tab.el);
    stage.controls.appendChild(small("Schematic: 12 synthetic patients, two scans each, and a 1-nearest-neighbour scorer. The direction of the gap is the lesson; the numbers are not a benchmark."));

    function data() {
      var rng = DL.rng(101), pts = [], GROUPS = 12;
      var centers = [];
      for (var g = 0; g < GROUPS; g++) centers.push({ x: 0.08 + 0.84 * ((g % 4) / 3), y: 0.1 + 0.8 * (Math.floor(g / 4) / 2), lab: g % 2 });
      centers.forEach(function (c, gi) {
        for (var s = 0; s < 2; s++) {
          var jitter = 0.16 * (1 - close.value() / 100) + 0.01;
          pts.push({
            x: clamp(c.x + (rng() - 0.5) * 2 * jitter, 0, 1),
            y: clamp(c.y + (rng() - 0.5) * 2 * jitter, 0, 1),
            g: gi, lab: c.lab
          });
        }
      });
      return pts;
    }

    function nnScore(pts, foldOf) {
      var correct = 0, total = 0, perFold = [], k = foldsCtl.value();
      for (var f = 0; f < k; f++) {
        var ok = 0, n = 0;
        for (var i = 0; i < pts.length; i++) {
          if (foldOf[i] !== f) continue;
          var best = -1, bd = Infinity;
          for (var j = 0; j < pts.length; j++) {
            if (foldOf[j] === f) continue;
            var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
            var d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = j; }
          }
          if (best >= 0) { ok += pts[best].lab === pts[i].lab ? 1 : 0; n++; }
        }
        perFold.push(n ? ok / n : 0);
        correct += ok; total += n;
      }
      return { acc: total ? correct / total : 0, per: perFold };
    }

    function draw() {
      var p = V.palette(), pts = data(), k = foldsCtl.value();
      var rng = DL.rng(seedCtl.value() + 7), order = DL.range(pts.length);
      for (var i = order.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1)), tmp = order[i]; order[i] = order[j]; order[j] = tmp;
      }
      var randomFold = new Array(pts.length);
      order.forEach(function (idx, t) { randomFold[idx] = t % k; });
      var gids = DL.range(12);
      for (var a = gids.length - 1; a > 0; a--) {
        var b = Math.floor(rng() * (a + 1)), t2 = gids[a]; gids[a] = gids[b]; gids[b] = t2;
      }
      var foldOfGroup = {};
      gids.forEach(function (g, t) { foldOfGroup[g] = t % k; });
      var groupFold = pts.map(function (q) { return foldOfGroup[q.g]; });

      var randRes = nnScore(pts, randomFold), groupRes = nnScore(pts, groupFold);
      var leaked = 0;
      for (var m = 0; m < pts.length; m++) {
        for (var n = 0; n < pts.length; n++) {
          if (randomFold[m] === randomFold[n] || pts[m].g !== pts[n].g) continue;
          leaked++; break;
        }
      }
      view.clear(p.surface);
      var r = { x: 44, y: 16, w: 430, h: 220 };
      V.axes(ctx, r, { xmin: 0, xmax: 1, ymin: 0, ymax: 1, grid: true, ticks: 4, xlabel: "feature 1", ylabel: "feature 2" });
      pts.forEach(function (q) {
        var col = q.lab ? p.accent : p.ok;
        V.dot(ctx, r.x + q.x * r.w, r.y + r.h - q.y * r.h, randomFold[q] === 0 ? 6 : 4, col);
      });
      V.text(ctx, "large dot = first random fold; two dots per patient sit close together", r.x, 250, { size: 10, color: p.ink2 });
      barView.clear(p.surface);
      V.bars(barView.ctx, [randRes.acc, groupRes.acc], { x: 90, y: 12, w: 380, h: 80 }, {
        labels: ["random KFold", "GroupKFold"], values: true, cmap: "accent", vmin: 0, vmax: 1
      });
      reads.set("random KFold", f(randRes.acc, 3));
      reads.set("GroupKFold", f(groupRes.acc, 3));
      reads.set("optimistic gap", "+" + f(randRes.acc - groupRes.acc, 3));
      reads.set("leaked val rows", String(leaked) + " / " + pts.length);
      tab.update(DL.range(k).map(function (fold) {
        return ["fold " + (fold + 1), f(randRes.per[fold], 3), f(groupRes.per[fold], 3)];
      }));
    }

    draw();
    return { reset: function () { close.set(80, true); foldsCtl.set(5, true); seedCtl.set(4, true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m5-04-ensemble-tta — synthetic model tables, real averaging maths
   * Illustrative: five fixed pseudo-random probability tables.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m5-04-ensemble-tta", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);
    var view = V.canvas(stage.canvasWrap, { w: 520, h: 230, label: "Per-model probabilities for one test item and the ensemble rule" });
    var ctx = view.ctx;

    var method = U.select({
      label: "Combination", ariaLabel: "Ensemble combination",
      options: [
        { value: "single", label: "Single model #1" },
        { value: "mean", label: "Probability mean" },
        { value: "majority", label: "Majority vote" },
        { value: "tta", label: "TTA average + mean" }
      ], value: "mean", onChange: draw
    });
    var models = U.slider({ label: "Models m", min: 1, max: 5, step: 1, value: 5, digits: 0, onInput: draw });
    var viewsCtl = U.slider({ label: "TTA views T", min: 1, max: 4, step: 1, value: 4, digits: 0, onInput: draw });
    var item = U.slider({ label: "Focus test item", min: 0, max: 7, step: 1, value: 0, digits: 0, onInput: draw });
    var reads = U.readouts(["rule accuracy", "single accuracy", "σ² (m models)", "σ²/m", "focus prediction"]);
    var tab = U.table({ columns: ["model", "p(item)", "correct?"], rows: [], caption: "Focus item, current model count" });

    stage.controls.appendChild(method.el);
    stage.controls.appendChild(models.el);
    stage.controls.appendChild(viewsCtl.el);
    stage.controls.appendChild(item.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(tab.el);
    stage.controls.appendChild(small("Illustrative: five fixed synthetic probability tables. σ² is the population variance of the m model probabilities on the focus item; σ²/m assumes independent errors."));

    var truth = [1, 0, 1, 1, 0, 0, 1, 0], probs = [], ttas = [];
    var rng = DL.rng(7);
    for (var m = 0; m < 5; m++) {
      var row = [], trow = [];
      for (var i = 0; i < 8; i++) {
        var base = clamp((truth[i] ? 0.72 : 0.28) + (rng() - 0.5) * 0.5 + m * 0.008, 0.03, 0.97);
        row.push(base);
        var vs = [base];
        for (var t = 1; t < 4; t++) vs.push(clamp(base + (rng() - 0.5) * 0.28, 0.03, 0.97));
        trow.push(vs);
      }
      probs.push(row); ttas.push(trow);
    }

    function predict(i) {
      var m = models.value(), kind = method.value(), s = 0, votes = 0;
      if (kind === "single") return probs[0][i];
      if (kind === "majority") {
        for (var j = 0; j < m; j++) votes += probs[j][i] > 0.5 ? 1 : 0;
        return votes / m;
      }
      if (kind === "tta") {
        var T2 = viewsCtl.value();
        for (var a = 0; a < m; a++) for (var b = 0; b < T2; b++) s += ttas[a][i][b];
        return s / (m * T2);
      }
      for (var c = 0; c < m; c++) s += probs[c][i];
      return s / m;
    }

    function draw() {
      var p = V.palette(), m = models.value(), it = item.value();
      var acc = 0, single = 0;
      for (var i = 0; i < 8; i++) {
        acc += (predict(i) > 0.5 ? 1 : 0) === truth[i] ? 1 : 0;
        single += (probs[0][i] > 0.5 ? 1 : 0) === truth[i] ? 1 : 0;
      }
      var vals = probs.slice(0, m).map(function (r) { return r[it]; });
      var mu = DL.mean(vals);
      var variance = DL.mean(vals.map(function (v) { return (v - mu) * (v - mu); }));
      var pred = predict(it);
      view.clear(p.surface);
      var rect = { x: 52, y: 18, w: 430, h: 160 };
      V.bars(ctx, vals, rect, {
        labels: vals.map(function (_, k) { return "m" + (k + 1); }),
        values: true, cmap: "viridis", vmin: 0, vmax: 1
      });
      var yTruth = rect.y + rect.h - truth[it] * rect.h;
      V.dashedLine(ctx, rect.x, yTruth, rect.x + rect.w, yTruth, { color: p.danger, dash: [5, 4], width: 1.5 });
      V.text(ctx, "focus item " + it + " · truth " + truth[it] + " · rule = " + method.value(), 52, 208, { size: 11, mono: true, color: p.ink2 });
      reads.set("rule accuracy", acc + " / 8");
      reads.set("single accuracy", single + " / 8");
      reads.set("σ² (m models)", f(variance, 4));
      reads.set("σ²/m", f(variance / m, 4));
      reads.set("focus prediction", f(pred, 3) + " → " + (pred > 0.5 ? 1 : 0));
      tab.update(vals.map(function (v, k) {
        return ["model " + (k + 1), f(v, 3), ((v > 0.5 ? 1 : 0) === truth[it]) ? "yes" : "no"];
      }));
    }

    draw();
    return { reset: function () {
      method.set("mean", true); models.set(5, true); viewsCtl.set(4, true); item.set(0, true); draw();
    } };
  });

  /* ------------------------------------------------------------------ *
   * m5-04-checklist — saved state, keyboard native, progress + reset
   * Exact: state is DL.store / localStorage and meter is counted from it.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m5-04-checklist", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);
    var items = [
      "Data description read: known group, id and time columns identified",
      "Duplicate / near-duplicate scan checked (hashes + nearest neighbours)",
      "One validation scheme chosen to match the test mechanism (group / time / stratified)",
      "All learned preprocessing moved inside the fold pipeline",
      "Seed fixed for Python, NumPy, torch and the data loader",
      "Sensible baseline trained and its local fold score recorded",
      "OOF predictions saved before fitting any stacker",
      "Ensemble and TTA rules applied to probabilities, with transforms inverted",
      "Pseudo-labels (if any) kept out of the held-out fold",
      "Submission checked: row count, id coverage, column order, finite values"
    ];
    var KEY = "checklist.m5-04";
    var saved = DL.store.get(KEY, {}) || {};
    var state = {};
    items.forEach(function (s, i) { state[i] = !!saved[i]; });

    var list = DL.el("div", { class: "hstack", style: { flexDirection: "column", gap: "6px", alignItems: "stretch" } });
    stage.canvasWrap.appendChild(list);
    var meter = DL.el("div", {
      role: "progressbar", "aria-label": "Checklist progress", "aria-valuemin": "0", "aria-valuemax": "10", "aria-valuenow": "0",
      style: { height: "12px", borderRadius: "999px", background: "var(--surface-2)", overflow: "hidden", border: "1px solid var(--line)" }
    });
    var fillBar = DL.el("div", { style: { height: "100%", width: "0%", background: "var(--accent)", transition: "width .2s" } });
    meter.appendChild(fillBar);
    stage.canvasWrap.appendChild(meter);
    var resetBtn = DL.el("button", {
      type: "button", class: "btn", text: "Reset checklist",
      "aria-label": "Clear all checklist items and saved progress", on: { click: reset }
    });
    var reads = U.readouts(["completed", "percent", "storage"]);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(resetBtn);
    stage.controls.appendChild(small("Your ticks are saved locally with DL.store. Native checkboxes work with Tab and Space; the meter is counted from the saved state."));

    var boxes = [];
    items.forEach(function (text, i) {
      var id = DL.uid("chk");
      var input = DL.el("input", { type: "checkbox", id: id, "aria-label": text });
      input.checked = state[i];
      var label = DL.el("label", { for: id, text: text, style: { display: "flex", gap: "8px", alignItems: "flex-start", cursor: "pointer" } }, []);
      label.insertBefore(input, label.firstChild);
      input.addEventListener("change", function () { state[i] = input.checked; persist(); render(); });
      boxes.push(input);
      list.appendChild(label);
    });

    function persist() { DL.store.set(KEY, state); }
    function render() {
      var n = 0;
      items.forEach(function (_, i) { if (state[i]) n++; });
      boxes.forEach(function (b, i) { b.checked = !!state[i]; });
      var pctv = Math.round(100 * n / items.length);
      fillBar.style.width = pctv + "%";
      meter.setAttribute("aria-valuenow", String(n));
      meter.setAttribute("aria-valuetext", n + " of " + items.length + " complete");
      reads.set("completed", n + " / " + items.length);
      reads.set("percent", pctv + "%");
      reads.set("storage", DL.store.available() ? "saved locally" : "local storage unavailable");
    }
    function reset() {
      state = {};
      items.forEach(function (_, i) { state[i] = false; });
      DL.store.remove(KEY);
      render();
    }
    render();
    return { reset: reset };
  });

})(window.DL);
