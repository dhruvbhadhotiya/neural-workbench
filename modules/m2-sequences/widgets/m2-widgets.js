/* ==========================================================================
   DeepLearn Lab — M2 widgets (sequences & NLP)
   Registered ids must match docs/CONTENT_PLAN.md. Never rename an id.
   Every numeric readout is computed in the browser; badges say what is real.
   ========================================================================== */
(function (DL) {
  "use strict";

  var V = DL.viz, U = DL.ui, T = DL.tensor;

  function vstr(v, d) {
    return "[" + v.map(function (x) { return DL.fmt(x, d === undefined ? 3 : d); }).join(", ") + "]";
  }
  function mstr(M, d) {
    return "[" + M.map(function (r) { return vstr(r, d); }).join(", ") + "]";
  }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
  function cosSim(a, b) {
    var dot = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  }

  /* ------------------------------------------------------------------ *
   * m2-01-rnn-unroll — step through a 3-token unrolled RNN
   * Exact: h_t = tanh(x_t W_xh + h_{t-1} W_hh + b_h), computed with DL.tensor.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m2-01-rnn-unroll", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);

    var X = [[1, 0], [0, 1], [1, 1]];
    var Wxh = [[0.5, -0.2], [0.3, 0.4]];   // (D_in, H_hidden) = (2, 2)
    var Whh = [[0.6, 0.1], [-0.1, 0.5]];   // (H_hidden, H_hidden) = (2, 2)
    var bh = [0.1, -0.1];                  // (H_hidden)

    var stepCtl = U.slider({
      label: "Unroll step t", min: 0, max: 3, step: 1, value: 1, digits: 0,
      hint: "Drag or use arrow keys; step 0 is h₀ = 0.", onInput: render
    });
    var nextBtn = DL.el("button", {
      type: "button", class: "btn", text: "Next step →", "aria-label": "Advance one unroll step",
      on: { click: function () { stepCtl.set(Math.min(3, stepCtl.value() + 1)); } }
    });
    var prevBtn = DL.el("button", {
      type: "button", class: "btn", text: "← Previous", "aria-label": "Go back one unroll step",
      on: { click: function () { stepCtl.set(Math.max(0, stepCtl.value() - 1)); } }
    });
    var chain = DL.el("div", { class: "hstack", style: { flexWrap: "wrap", gap: "6px" } });
    var reads = U.readouts(["h_t", "z_t", "parameters"]);
    var detail = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var table = U.table({
      columns: ["t", "x_t", "x_t·W_xh", "h_{t−1}·W_hh", "z_t", "h_t"],
      caption: "Every step of the unroll, computed from the two shared matrices"
    });

    stage.controls.appendChild(stepCtl.el);
    stage.controls.appendChild(U.row(prevBtn, nextBtn));
    stage.controls.appendChild(chain);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(detail);
    stage.controls.appendChild(table.el);

    var states = (function () {
      var h = [0, 0];
      var out = [{ t: 0, x: null, a: [0, 0], b: [0, 0], z: [0, 0], h: [0, 0] }];
      X.forEach(function (x, i) {
        var a = T.matmul([x], Wxh)[0];
        var b = T.matmul([h], Whh)[0];
        var z = [a[0] + b[0] + bh[0], a[1] + b[1] + bh[1]];
        h = z.map(Math.tanh);
        out.push({ t: i + 1, x: x, a: a, b: b, z: z, h: h.slice() });
      });
      return out;
    })();

    function render() {
      var t = stepCtl.value(), s = states[t];
      chain.innerHTML = "";
      states.forEach(function (q) {
        var btn = DL.el("button", {
          type: "button",
          class: "btn",
          "aria-label": "Inspect hidden state at step " + q.t,
          "aria-pressed": String(q.t === t),
          style: { borderColor: q.t === t ? "var(--accent)" : "" },
          on: { click: function () { stepCtl.set(q.t); } }
        }, [DL.el("span", { text: "h" + q.t }), DL.el("span", { class: "ui__hint", text: " " + vstr(q.h, 2) })]);
        chain.appendChild(btn);
      });

      table.update(states.map(function (q) {
        return [q.t, q.x ? vstr(q.x, 1) : "—", vstr(q.a), vstr(q.b), vstr(q.z), vstr(q.h)];
      }));

      if (t === 0) {
        detail.textContent = "Step 0 is the seed: h₀ = [0, 0]. No weights have been used yet.";
      } else {
        detail.textContent =
          "h" + t + " = tanh(x" + t + "·W_xh + h" + (t - 1) + "·W_hh + b_h) = tanh(" +
          vstr(s.a) + " + " + vstr(s.b) + " + " + vstr(bh, 1) + ") = tanh(" + vstr(s.z) + ") = " + vstr(s.h);
      }
      reads.set("h_t", vstr(s.h, 3));
      reads.set("z_t", vstr(s.z, 3));
      reads.set("parameters", (2 * 2 + 2 * 2 + 2) + " = D·H + H² + H");
      prevBtn.disabled = t === 0;
      nextBtn.disabled = t === 3;
    }

    render();
    return { reset: function () { stepCtl.set(1, true); render(); } };
  });

  /* ------------------------------------------------------------------ *
   * m2-02-grad-norm-explorer — repeated-Jacobian product on a log axis
   * Exact: every point is |J|^t with J = weight scale * phi'(0), recomputed live.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m2-02-grad-norm-explorer", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, {
      w: 540, h: 320, label: "Log10 gradient norm versus backpropagation steps"
    });
    var ctx = view.ctx;

    var scaleCtl = U.slider({
      label: "Weight scale s", min: 0.2, max: 1.8, step: 0.05, value: 0.5, digits: 2, onInput: draw
    });
    var lenCtl = U.slider({
      label: "Sequence length T", min: 1, max: 30, step: 1, value: 20, digits: 0, onInput: draw
    });
    var actCtl = U.select({
      label: "Activation", ariaLabel: "Activation whose Jacobian factor is used",
      options: [
        { value: "tanh", label: "tanh · φ′(0) = 1" },
        { value: "relu", label: "ReLU (active branch) · φ′ = 1" },
        { value: "sigmoid", label: "sigmoid · φ′(0) = 0.25" }
      ],
      value: "tanh", onChange: draw
    });
    var reads = U.readouts(["Jacobian factor J", "T", "‖∂L/∂h₁‖", "regime"]);
    var detail = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var table = U.table({
      columns: ["steps back k", "‖∂L/∂h₁‖ after k", "log₁₀"],
      caption: "The same product evaluated at selected depths"
    });

    stage.controls.appendChild(scaleCtl.el);
    stage.controls.appendChild(lenCtl.el);
    stage.controls.appendChild(actCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(detail);
    stage.controls.appendChild(table.el);

    var phiPrime = { tanh: 1, relu: 1, sigmoid: 0.25 };

    function draw() {
      var p = V.palette();
      var s = scaleCtl.value(), T = lenCtl.value(), act = actCtl.value();
      var J = Math.abs(s * phiPrime[act]);
      var logJ = J === 0 ? -Infinity : Math.log10(J);
      var end = J === 0 ? -Infinity : T * logJ;
      var norm = J === 0 ? 0 : Math.exp(T * Math.log(J));

      view.clear(p.surface);
      var r = { x: 52, y: 14, w: view.w - 70, h: view.h - 54 };
      var pts = [];
      for (var t = 1; t <= T; t++) {
        var lg = DL.clamp(t * logJ, -16, 6);
        pts.push([t, lg]);
      }
      V.line(ctx, [{ pts: pts, color: p.accent, width: 2.4 }], r, {
        xmin: 1, xmax: Math.max(2, T), ymin: -16, ymax: 4,
        grid: true, padY: false, xlabel: "backprop steps k", ylabel: "log₁₀ ‖gradient‖"
      });
      // reference lines for no attenuation (1) and the vanishing threshold (1e-3)
      var sx = function (t) { return r.x + ((t - 1) / (Math.max(2, T) - 1)) * r.w; };
      var sy = function (y) { return r.y + r.h - ((y + 16) / 20) * r.h; };
      V.dashedLine(ctx, r.x, sy(0), r.x + r.w, sy(0), { color: p.warn, dash: [5, 4], width: 1.4 });
      V.dashedLine(ctx, r.x, sy(-3), r.x + r.w, sy(-3), { color: p.danger, dash: [3, 4], width: 1.2 });
      V.text(ctx, "‖g‖ = 1", r.x + 6, sy(0) - 5, { size: 9, mono: true, color: p.warn });
      V.text(ctx, "‖g‖ = 10⁻³", r.x + 6, sy(-3) - 5, { size: 9, mono: true, color: p.danger });
      if (pts.length) V.dot(ctx, sx(T), sy(pts[pts.length - 1][1]), 4, p.accent);

      var regime = end < -3 ? "vanishing" : end > 0.3 ? "exploding" : "usable";
      reads.set("Jacobian factor J", DL.fmt(J, 4));
      reads.set("T", String(T));
      reads.set("‖∂L/∂h₁‖", DL.sci(norm, 3));
      reads.set("regime", regime);

      detail.textContent = "‖∂L/∂h₁‖ = |J|^T = |" + DL.fmt(s, 2) + " · " + DL.fmt(phiPrime[act], 2) +
        "|^" + T + " = " + DL.fmt(J, 4) + "^" + T + " = " + DL.sci(norm, 3) +
        ". log₁₀ = T·log₁₀(J) = " + DL.fmt(end, 3) + ".";

      var ks = [1, 5, 10, 15, 20, 25, 30].filter(function (k) { return k <= T; });
      if (ks.indexOf(T) < 0) ks.push(T);
      ks.sort(function (a, b) { return a - b; });
      table.update(ks.map(function (k) {
        return [k, DL.sci(J === 0 ? 0 : Math.exp(k * Math.log(J)), 3), DL.fmt(k * logJ, 3)];
      }));
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () { scaleCtl.set(0.5, true); lenCtl.set(20, true); actCtl.set("tanh", true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m2-03-gate-dashboard — LSTM and GRU gates from the same numbers
   * Exact: gates, c_t, h_t and the gradient path are computed from the sliders.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m2-03-gate-dashboard", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var gview = V.canvas(stage.canvasWrap, {
      w: 540, h: 320, label: "Gate values and recurrent gradient path"
    });
    var ctx = gview.ctx;

    function pre(label, value) {
      return U.slider({ label: label, min: -4, max: 4, step: 0.1, value: value, digits: 1, onInput: compute });
    }
    var af = pre("a_f · forget pre-activation", 2.0);
    var ai = pre("a_i · input pre-activation", 1.0);
    var ao = pre("a_o · output pre-activation", 1.5);
    var ag = pre("a_g · candidate pre-activation", 0.8);
    var cp = U.slider({ label: "c_{t−1} · previous cell", min: -3, max: 3, step: 0.1, value: 1.0, digits: 1, onInput: compute });
    var hp = U.slider({ label: "h_{t−1} · previous hidden (GRU)", min: -3, max: 3, step: 0.1, value: 0.5, digits: 1, onInput: compute });

    var reads = U.readouts(["f_t", "i_t", "o_t", "ĉ_t", "c_t", "h_t (LSTM)", "h_t (GRU)"]);
    var detail = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var table = U.table({
      columns: ["quantity", "formula", "value"],
      caption: "All gate values are σ(a) or tanh(a) of the displayed pre-activations"
    });

    [af, ai, ao, ag, cp, hp].forEach(function (c) { stage.controls.appendChild(c.el); });
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(detail);
    stage.controls.appendChild(table.el);

    function compute() {
      var pf = af.value(), pi = ai.value(), po = ao.value(), pg = ag.value();
      var prevC = cp.value(), prevH = hp.value();
      var f = sigmoid(pf), i = sigmoid(pi), o = sigmoid(po), g = Math.tanh(pg);
      var c = f * prevC + i * g;
      var h = o * Math.tanh(c);
      // Same displayed numbers mapped to GRU pre-activations:
      var z = sigmoid(pf), r = sigmoid(pi), ht = Math.tanh(pg + r * prevH);
      var hG = (1 - z) * prevH + z * ht;
      var pathF = f;                                   // ∂c_t/∂c_{t−1}
      var pathH = o * (1 - Math.tanh(c) * Math.tanh(c)); // ∂h_t/∂c_t

      var p = V.palette();
      gview.clear(p.surface);
      var r0 = { x: 48, y: 14, w: gview.w - 64, h: gview.h - 140 };
      V.bars(gview.ctx, [f, i, o, Math.abs(g)], r0, {
        labels: ["f", "i", "o", "|ĉ|"], values: true, digits: 2,
        vmax: 1, cmap: "viridis"
      });
      V.text(gview.ctx, "gate values in (0,1) · |ĉ| ≤ 1", r0.x, r0.y - 3,
        { size: 10, mono: true, color: p.ink2 });

      // Gradient paths: additive cell path (width ∝ f) vs hidden path (width ∝ o·(1−tanh²c)).
      var y1 = r0.y + r0.h + 34, y2 = y1 + 18;
      V.text(gview.ctx, "gradient path (line width ∝ derivative)", r0.x, y1 - 8,
        { size: 9, mono: true, color: p.ink2 });
      V.dashedLine(gview.ctx, r0.x, y1, r0.x + r0.w, y1, { color: p.line, width: 1.5, dash: [2, 3] });
      V.dashedLine(gview.ctx, r0.x, y2, r0.x + r0.w, y2, { color: p.line, width: 1.5, dash: [2, 3] });
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 1 + 13 * pathF;
      ctx.beginPath(); ctx.moveTo(r0.x, y1); ctx.lineTo(r0.x + r0.w, y1); ctx.stroke();
      ctx.strokeStyle = p.danger;
      ctx.lineWidth = 1 + 13 * pathH;
      ctx.beginPath(); ctx.moveTo(r0.x, y2); ctx.lineTo(r0.x + r0.w, y2); ctx.stroke();
      V.text(gview.ctx, "cell: f = " + DL.fmt(f, 3), r0.x + r0.w - 136, y1 + 4, { size: 9, mono: true, color: p.accent });
      V.text(gview.ctx, "hidden: o(1−tanh²c) = " + DL.fmt(pathH, 3), r0.x + r0.w - 136, y2 + 4,
        { size: 9, mono: true, color: p.danger });

      reads.set("f_t", DL.fmt(f, 3));
      reads.set("i_t", DL.fmt(i, 3));
      reads.set("o_t", DL.fmt(o, 3));
      reads.set("ĉ_t", DL.fmt(g, 3));
      reads.set("c_t", DL.fmt(c, 3));
      reads.set("h_t (LSTM)", DL.fmt(h, 3));
      reads.set("h_t (GRU)", DL.fmt(hG, 3));

      detail.textContent =
        "f = σ(" + DL.fmt(pf, 1) + ") = " + DL.fmt(f, 3) + ";  i = σ(" + DL.fmt(pi, 1) + ") = " + DL.fmt(i, 3) +
        ";  o = σ(" + DL.fmt(po, 1) + ") = " + DL.fmt(o, 3) + ";  ĉ = tanh(" + DL.fmt(pg, 1) + ") = " + DL.fmt(g, 3) +
        ".  c = " + DL.fmt(f, 3) + "·(" + DL.fmt(prevC, 1) + ") + " + DL.fmt(i, 3) + "·(" + DL.fmt(g, 3) + ") = " + DL.fmt(c, 3) +
        ";  h = " + DL.fmt(o, 3) + "·tanh(" + DL.fmt(c, 3) + ") = " + DL.fmt(h, 3) + ".";

      table.update([
        ["forget gate f_t", "σ(a_f)", DL.fmt(f, 4)],
        ["input gate i_t", "σ(a_i)", DL.fmt(i, 4)],
        ["output gate o_t", "σ(a_o)", DL.fmt(o, 4)],
        ["candidate ĉ_t", "tanh(a_g)", DL.fmt(g, 4)],
        ["cell state c_t", "f·c_{t−1} + i·ĉ", DL.fmt(c, 4)],
        ["hidden h_t (LSTM)", "o·tanh(c_t)", DL.fmt(h, 4)],
        ["cell gradient path", "∂c_t/∂c_{t−1} = f", DL.fmt(pathF, 4)],
        ["GRU update z", "σ(a_f)", DL.fmt(z, 4)],
        ["GRU reset r", "σ(a_i)", DL.fmt(r, 4)],
        ["GRU candidate h̃", "tanh(a_g + r·h_{t−1})", DL.fmt(ht, 4)],
        ["hidden h_t (GRU)", "(1−z)·h_{t−1} + z·h̃", DL.fmt(hG, 4)]
      ]);
    }

    document.addEventListener("dl:theme", compute);
    compute();
    return {
      reset: function () {
        af.set(2.0, true); ai.set(1.0, true); ao.set(1.5, true); ag.set(0.8, true);
        cp.set(1.0, true); hp.set(0.5, true);
        compute();
      }
    };
  });

  /* ------------------------------------------------------------------ *
   * m2-04-bpe-trainer — a real tiny BPE trainer on the displayed corpus
   * Exact: pair counts, merge choice, vocabulary and encodings are computed live.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m2-04-bpe-trainer", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);

    var DEFAULT = "low lower lowest";
    var EOW = "</w>";

    var corpusInput = DL.el("input", {
      type: "text", value: DEFAULT, "aria-label": "BPE training corpus (space-separated words)"
    });
    var applyBtn = DL.el("button", {
      type: "button", class: "btn", text: "Train on this corpus",
      "aria-label": "Recompute all BPE merges for the typed corpus",
      on: { click: function () { rebuild(corpusInput.value); } }
    });
    var wordInput = DL.el("input", {
      type: "text", value: "lowest", "aria-label": "Word to encode with the learned merges"
    });
    var stepCtl = U.slider({
      label: "Merge step", min: 0, max: 4, step: 1, value: 4, digits: 0,
      hint: "Step 0 is the character vocabulary; each step adds one merge.", onInput: render
    });
    var reads = U.readouts(["vocab size", "tokens left", "compression", "last merge"]);
    var detail = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var segWrap = DL.el("div", { class: "hstack", style: { flexWrap: "wrap", gap: "6px" } });
    var vocabWrap = DL.el("div", { class: "hstack", style: { flexWrap: "wrap", gap: "6px" } });
    var encodeWrap = DL.el("div", { class: "hstack", style: { flexWrap: "wrap", gap: "6px" } });
    var pairTable = U.table({
      columns: ["pair", "frequency", "merge into"],
      caption: "Adjacent-symbol counts at the selected step (highest first)"
    });
    var histTable = U.table({
      columns: ["step", "merged pair", "count", "new symbol", "vocab size"],
      caption: "The exact merge history — deterministic ties go to the smaller string"
    });

    stage.controls.appendChild(DL.el("div", { class: "ui__row" }, [corpusInput, applyBtn]));
    stage.controls.appendChild(stepCtl.el);
    stage.controls.appendChild(U.row(wordInput));
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(detail);
    stage.controls.appendChild(DL.el("p", { class: "ui__hint", text: "Current segmentation" }));
    stage.controls.appendChild(segWrap);
    stage.controls.appendChild(DL.el("p", { class: "ui__hint", text: "Vocabulary" }));
    stage.controls.appendChild(vocabWrap);
    stage.controls.appendChild(DL.el("p", { class: "ui__hint", text: "Encoded word (pipeline of merges)" }));
    stage.controls.appendChild(encodeWrap);
    stage.controls.appendChild(pairTable.el);
    stage.controls.appendChild(histTable.el);

    var steps = [], initialTokens = 0;

    function seqOf(word) { return word.split("").concat([EOW]); }

    function countPairs(words) {
      var map = {};
      words.forEach(function (seq) {
        for (var i = 0; i < seq.length - 1; i++) {
          var key = seq[i] + "\u0000" + seq[i + 1];
          if (!map[key]) map[key] = { a: seq[i], b: seq[i + 1], count: 0 };
          map[key].count++;
        }
      });
      return Object.keys(map).map(function (k) { return map[k]; }).sort(function (x, y) {
        var sx = x.a + x.b, sy = y.a + y.b;
        return y.count - x.count || (sx < sy ? -1 : sx > sy ? 1 : 0);
      });
    }

    function applyMerge(words, a, b) {
      return words.map(function (seq) {
        var out = [];
        for (var i = 0; i < seq.length;) {
          if (i + 1 < seq.length && seq[i] === a && seq[i + 1] === b) {
            out.push(a + b); i += 2;
          } else { out.push(seq[i]); i++; }
        }
        return out;
      });
    }

    function rebuild(text) {
      var words = String(text || "").trim().split(/\s+/).filter(Boolean).slice(0, 12).map(seqOf);
      initialTokens = words.reduce(function (n, w) { return n + w.length; }, 0);
      var vocab = [];
      words.forEach(function (seq) {
        seq.forEach(function (sym) { if (vocab.indexOf(sym) < 0) vocab.push(sym); });
      });
      vocab.sort();
      steps = [{ words: words, vocab: vocab.slice(), merge: null, counts: countPairs(words) }];
      for (var k = 0; k < 16 && steps.length < 17; k++) {
        var cur = steps[steps.length - 1], counts = cur.counts;
        if (!counts.length) break;
        var best = counts[0], symbol = best.a + best.b;
        var nextWords = applyMerge(cur.words, best.a, best.b);
        var nextVocab = cur.vocab.slice();
        if (nextVocab.indexOf(symbol) < 0) nextVocab.push(symbol);
        steps.push({
          words: nextWords, vocab: nextVocab,
          merge: { a: best.a, b: best.b, count: best.count, symbol: symbol },
          counts: countPairs(nextWords)
        });
      }
      stepCtl.setMax(steps.length - 1);
      stepCtl.set(steps.length - 1, true);
      render();
    }

    function chip(text, color) {
      return DL.el("span", {
        class: "badge", text: text,
        style: { background: color || "var(--accent-soft)", color: "var(--ink-1)", fontFamily: "var(--font-mono)" }
      });
    }

    function render() {
      var k = Math.min(stepCtl.value(), steps.length - 1), st = steps[k];
      segWrap.innerHTML = ""; vocabWrap.innerHTML = ""; encodeWrap.innerHTML = "";
      st.words.forEach(function (seq) {
        segWrap.appendChild(chip(seq.join(" "), "var(--surface-2)"));
      });
      st.vocab.forEach(function (sym) { vocabWrap.appendChild(chip(sym)); });

      var enc = seqOf(wordInput.value.trim() || "lowest");
      for (var j = 1; j <= k; j++) {
        var m = steps[j].merge;
        enc = applyMerge([enc], m.a, m.b)[0];
      }
      enc.forEach(function (sym) { encodeWrap.appendChild(chip(sym)); });

      var tokensLeft = st.words.reduce(function (n, w) { return n + w.length; }, 0);
      reads.set("vocab size", String(st.vocab.length));
      reads.set("tokens left", String(tokensLeft));
      reads.set("compression", DL.fmt(initialTokens / (tokensLeft || 1), 3) + "×");
      reads.set("last merge", st.merge ? st.merge.a + " + " + st.merge.b + " → " + st.merge.symbol : "—");
      detail.textContent = st.merge
        ? "Step " + k + ": pair (“" + st.merge.a + "”, “" + st.merge.b + "”) occurs " + st.merge.count +
          " times — the highest frequency (ties broken by the smaller concatenated string). Merge into “" +
          st.merge.symbol + "”; vocabulary grows from " + steps[k - 1].vocab.length + " to " + st.vocab.length + "."
        : "Step 0: vocabulary = every unique character plus the end-of-word marker " + EOW +
          ". No merges have been applied yet.";

      pairTable.update(st.counts.slice(0, 6).map(function (c) {
        return [c.a + " | " + c.b, c.count, c.a + c.b];
      }));
      histTable.update(steps.slice(1).map(function (s, idx) {
        return [idx + 1, s.merge.a + " | " + s.merge.b, s.merge.count, s.merge.symbol, s.vocab.length];
      }));
    }

    wordInput.addEventListener("change", render);
    corpusInput.addEventListener("change", function () { rebuild(corpusInput.value); });
    rebuild(DEFAULT);

    return { reset: function () { corpusInput.value = DEFAULT; wordInput.value = "lowest"; rebuild(DEFAULT); } };
  });

  /* ------------------------------------------------------------------ *
   * m2-05-embedding-explorer — hand-built 2-D embeddings + analogies
   * Illustrative: the vectors are hand-built; the arithmetic and cosine are real.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m2-05-embedding-explorer", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, {
      w: 560, h: 380, label: "Two-dimensional hand-built word vectors with an analogy probe"
    });
    var ctx = view.ctx;

    var words = {
      king: [3.0, 1.0], queen: [2.8, 2.6], prince: [2.4, 0.9], princess: [2.3, 2.2],
      man: [1.0, 0.0], woman: [0.8, 1.6], boy: [0.4, -0.2], girl: [0.3, 1.4],
      father: [1.6, 0.4], mother: [1.5, 1.9],
      dog: [-1.8, -0.6], cat: [-1.7, 0.5], puppy: [-1.5, -0.9], kitten: [-1.5, 0.9],
      car: [0.5, -2.2], bus: [1.2, -2.4], bike: [-0.4, -2.1],
      apple: [-2.2, 1.8], banana: [-2.4, 1.4], water: [-2.0, -1.8]
    };
    var names = Object.keys(words);
    function opts(value) { return names.map(function (n) { return { value: n, label: n }; }); }
    var aSel = U.select({ label: "A (king)", ariaLabel: "Analogy word A", options: opts(), value: "king", onChange: draw });
    var bSel = U.select({ label: "B (man)", ariaLabel: "Analogy word B", options: opts(), value: "man", onChange: draw });
    var cSel = U.select({ label: "C (woman)", ariaLabel: "Analogy word C", options: opts(), value: "woman", onChange: draw });

    var reads = U.readouts(["A − B + C", "nearest neighbour", "cosine to nearest", "cos(king, queen)"]);
    var detail = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var table = U.table({ columns: ["rank", "word", "cosine"], caption: "Nearest neighbours computed by cosine similarity" });

    [aSel, bSel, cSel].forEach(function (s) { stage.controls.appendChild(s.el); });
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(detail);
    stage.controls.appendChild(table.el);

    function draw() {
      var p = V.palette();
      var A = words[aSel.value()], B = words[bSel.value()], C = words[cSel.value()];
      var res = [A[0] - B[0] + C[0], A[1] - B[1] + C[1]];
      var ranked = names.map(function (n) { return { n: n, c: cosSim(res, words[n]) }; })
        .sort(function (x, y) { return y.c - x.c; });

      view.clear(p.surface);
      var r = { x: 46, y: 14, w: view.w - 62, h: view.h - 50 };
      var sc = V.scatter(ctx, names.map(function (n) {
        return { x: words[n][0], y: words[n][1], r: 3.6, c: 0 };
      }), r, { xmin: -3, xmax: 3.5, ymin: -3, ymax: 3, grid: true, xlabel: "dimension 1", ylabel: "dimension 2" });
      names.forEach(function (n) {
        V.text(ctx, n, sc.sx(words[n][0]) + 5, sc.sy(words[n][1]) - 4,
          { size: 9, mono: true, color: p.ink2 });
      });
      [aSel.value(), bSel.value(), cSel.value()].forEach(function (n) {
        V.dot(ctx, sc.sx(words[n][0]), sc.sy(words[n][1]), 6, p.warn);
      });
      V.dot(ctx, sc.sx(res[0]), sc.sy(res[1]), 8, p.danger);
      V.text(ctx, "result", sc.sx(res[0]) + 9, sc.sy(res[1]) + 4,
        { size: 10, mono: true, color: p.danger });

      reads.set("A − B + C", vstr(res, 2));
      reads.set("nearest neighbour", ranked[0].n);
      reads.set("cosine to nearest", DL.fmt(ranked[0].c, 4));
      reads.set("cos(king, queen)", DL.fmt(cosSim(words.king, words.queen), 4));
      detail.textContent = "v(" + aSel.value() + ") = " + vstr(A, 2) + "; v(" + bSel.value() + ") = " +
        vstr(B, 2) + "; v(" + cSel.value() + ") = " + vstr(C, 2) +
        ".  Result = " + vstr(A, 1) + " − " + vstr(B, 1) + " + " + vstr(C, 1) + " = " + vstr(res, 2) +
        ".  cosine(result, " + ranked[0].n + ") = (result·v)/ (|result||v|) = " + DL.fmt(ranked[0].c, 4) + ".";
      table.update(ranked.slice(0, 5).map(function (q, i) { return [i + 1, q.n, DL.fmt(q.c, 4)]; }));
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return {
      reset: function () { aSel.set("king", true); bSel.set("man", true); cSel.set("woman", true); draw(); }
    };
  });

  /* ------------------------------------------------------------------ *
   * m2-05-skipgram-window — exact (centre, context) pair enumeration
   * ------------------------------------------------------------------ */
  DL.widgets.register("m2-05-skipgram-window", function (el) {
    var stage = U.stage();
    el.appendChild(stage.el);

    var DEFAULT = "the quick brown fox jumps over the lazy dog";
    var textInput = DL.el("input", { type: "text", value: DEFAULT, "aria-label": "Sentence to window over" });
    var applyBtn = DL.el("button", {
      type: "button", class: "btn", text: "Set sentence",
      "aria-label": "Recompute the skip-gram pairs for the typed sentence",
      on: { click: function () { recompute(textInput.value); } }
    });
    var radiusCtl = U.slider({ label: "Window radius r", min: 1, max: 3, step: 1, value: 2, digits: 0, onInput: recomputeFromControls });
    var strideCtl = U.slider({ label: "Centre stride", min: 1, max: 3, step: 1, value: 1, digits: 0, onInput: recomputeFromControls });
    var pairCtl = U.slider({ label: "Inspect pair", min: 0, max: 10, step: 1, value: 0, digits: 0, onInput: render });
    var reads = U.readouts(["tokens", "centres used", "pairs", "pairs per centre"]);
    var detail = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var ribbon = DL.el("div", { class: "hstack", style: { flexWrap: "wrap", gap: "5px" } });
    var table = U.table({ columns: ["#", "centre", "context", "positions"], caption: "Every (centre, context) training pair" });

    stage.controls.appendChild(DL.el("div", { class: "ui__row" }, [textInput, applyBtn]));
    stage.controls.appendChild(radiusCtl.el);
    stage.controls.appendChild(strideCtl.el);
    stage.controls.appendChild(pairCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(ribbon);
    stage.controls.appendChild(detail);
    stage.controls.appendChild(table.el);

    var tokens = [], pairs = [];

    function recomputeFromControls() { recompute(textInput.value); }

    function recompute(text) {
      tokens = String(text || "").trim().split(/\s+/).filter(Boolean).slice(0, 14);
      pairs = [];
      var r = radiusCtl.value(), stride = strideCtl.value();
      for (var i = 0; i < tokens.length; i++) {
        if (i % stride !== 0) continue;
        for (var j = Math.max(0, i - r); j <= Math.min(tokens.length - 1, i + r); j++) {
          if (j !== i) pairs.push({ i: i, j: j });
        }
      }
      pairCtl.setMax(Math.max(0, pairs.length - 1));
      pairCtl.set(0, true);
      render();
    }

    function render() {
      var k = Math.min(pairCtl.value(), Math.max(0, pairs.length - 1));
      var sel = pairs[k];
      ribbon.innerHTML = "";
      tokens.forEach(function (t, idx) {
        var role = sel ? (idx === sel.i ? "centre" : idx === sel.j ? "context" : "") : "";
        var bg = role === "centre" ? "var(--accent-soft)" : role === "context" ? "var(--surface-2)" : "transparent";
        ribbon.appendChild(DL.el("span", {
          class: "badge", text: idx + ":" + t, title: role || "outside window",
          style: { background: bg, color: role ? "var(--ink-1)" : "var(--ink-3)" }
        }));
      });
      var r = radiusCtl.value();
      reads.set("tokens", String(tokens.length));
      reads.set("centres used", String(tokens.filter(function (_, i) { return i % strideCtl.value() === 0; }).length));
      reads.set("pairs", String(pairs.length));
      reads.set("pairs per centre", "up to " + (2 * r));
      detail.textContent = sel
        ? "Pair " + (k + 1) + " of " + pairs.length + ": centre “" + tokens[sel.i] + "” (position " + sel.i +
          "), context “" + tokens[sel.j] + "” (position " + sel.j + "). Positions within radius " + r +
          " of centres spaced " + strideCtl.value() + " apart are enumerated; edges have fewer contexts."
        : "No pairs — the sentence needs at least two tokens.";
      table.update(pairs.map(function (q, idx) {
        return [idx + 1, tokens[q.i], tokens[q.j], q.i + " → " + q.j];
      }));
    }

    textInput.addEventListener("change", function () { recompute(textInput.value); });
    recompute(DEFAULT);
    return {
      reset: function () {
        textInput.value = DEFAULT; radiusCtl.set(2, true); strideCtl.set(1, true);
        recompute(DEFAULT);
      }
    };
  });

  /* ------------------------------------------------------------------ *
   * m2-06-sentiment-trace — hand-built pooling weights, exact arithmetic
   * Illustrative: the per-token weights/scores are hand-built, not trained.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m2-06-sentiment-trace", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, {
      w: 540, h: 220, label: "Per-token contributions to a sentiment logit"
    });
    var ctx = view.ctx;

    var examples = {
      positive: {
        label: "i love this film",
        tokens: ["i", "love", "this", "film"],
        a: [0.05, 0.55, 0.15, 0.25],
        s: [0.0, 1.0, 0.3, 0.7]
      },
      mixed: {
        label: "not a good film",
        tokens: ["not", "a", "good", "film"],
        a: [0.40, 0.05, 0.35, 0.20],
        s: [-0.6, 0.0, 0.8, 0.5]
      },
      negative: {
        label: "the plot was dull",
        tokens: ["the", "plot", "was", "dull"],
        a: [0.05, 0.20, 0.10, 0.65],
        s: [0.0, 0.2, 0.1, -0.9]
      }
    };
    var W = 2.5, b = -0.3;   // hand-built linear head

    var exSel = U.select({
      label: "Toy sentence", ariaLabel: "Toy sentence for the sentiment trace",
      options: Object.keys(examples).map(function (k) { return { value: k, label: examples[k].label }; }),
      value: "positive", onChange: draw
    });
    var lastCtl = U.slider({
      label: "λ · weight on final token", min: 0, max: 1, step: 0.05, value: 0, digits: 2,
      hint: "λ = 0 is mean-style pooling; λ = 1 uses only the last token.", onInput: draw
    });
    var reads = U.readouts(["pooled score", "logit", "probability", "predicted class"]);
    var detail = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var table = U.table({ columns: ["token", "α (pool weight)", "s (token score)", "α·s"], caption: "Hand-built weights and the exactly computed contributions" });

    stage.controls.appendChild(exSel.el);
    stage.controls.appendChild(lastCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(detail);
    stage.controls.appendChild(table.el);

    function draw() {
      var p = V.palette();
      var ex = examples[exSel.value()], lam = lastCtl.value();
      var sumA = DL.sum(ex.a);
      var n = ex.tokens.length;
      var alpha = ex.a.map(function (v, i) {
        var mean = v / sumA;
        return (1 - lam) * mean + (lam && i === n - 1 ? 1 : 0);
      });
      var contrib = alpha.map(function (v, i) { return v * ex.s[i]; });
      var pooled = DL.sum(contrib);
      var logit = b + W * pooled;
      var prob = sigmoid(logit);

      view.clear(p.surface);
      var r = { x: 46, y: 12, w: view.w - 62, h: view.h - 52 };
      var bw = r.w / n;
      V.dashedLine(ctx, r.x, r.y + r.h / 2, r.x + r.w, r.y + r.h / 2, { color: p.lineStrong, dash: [3, 3] });
      contrib.forEach(function (v, i) {
        var h = Math.abs(v) / 1.2 * (r.h / 2);
        ctx.fillStyle = v >= 0 ? p.accent : p.danger;
        ctx.fillRect(r.x + i * bw + bw * 0.2, v >= 0 ? r.y + r.h / 2 - h : r.y + r.h / 2,
          bw * 0.6, Math.max(1, h));
        V.text(ctx, ex.tokens[i], r.x + i * bw + bw / 2, r.y + r.h + 14,
          { align: "center", size: 10, mono: true, color: p.ink2 });
        V.text(ctx, DL.fmt(v, 2), r.x + i * bw + bw / 2, v >= 0 ? r.y + r.h / 2 - h - 4 : r.y + r.h / 2 + h + 11,
          { align: "center", size: 9, mono: true, color: p.ink2 });
      });
      V.text(ctx, "contribution α_t·s_t (hand-built weights)", r.x, r.y + 10,
        { size: 10, mono: true, color: p.ink2 });

      reads.set("pooled score", DL.fmt(pooled, 4));
      reads.set("logit", DL.fmt(logit, 4));
      reads.set("probability", DL.fmt(prob, 4));
      reads.set("predicted class", prob >= 0.5 ? "positive" : "negative");
      detail.textContent = "pooled = Σ α_t·s_t = " +
        alpha.map(function (v, i) { return DL.fmt(v, 3) + "·" + DL.fmt(ex.s[i], 2); }).join(" + ") +
        " = " + DL.fmt(pooled, 4) + ";  logit = " + DL.fmt(b, 1) + " + " + DL.fmt(W, 1) + "·" +
        DL.fmt(pooled, 4) + " = " + DL.fmt(logit, 4) + ";  p = σ(logit) = " + DL.fmt(prob, 4) + ".";
      table.update(ex.tokens.map(function (t, i) { return [t, DL.fmt(alpha[i], 3), DL.fmt(ex.s[i], 2), DL.fmt(contrib[i], 4)]; }));
    }

    draw();
    return { reset: function () { exSel.set("positive", true); lastCtl.set(0, true); draw(); } };
  });

  /* ------------------------------------------------------------------ *
   * m2-07-attention-heatmap — hash-derived Q/K/V, real scores and softmax
   * Exact: QKᵀ/√d_k, row softmax (optional causal mask) and AV use DL.tensor.
   * ------------------------------------------------------------------ */
  DL.widgets.register("m2-07-attention-heatmap", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var sview = V.canvas(stage.canvasWrap, { w: 540, h: 270, label: "Scaled dot-product attention scores" });
    var wview = V.canvas(stage.canvasWrap, { w: 540, h: 270, label: "Attention weights after row-wise softmax" });
    var sctx = sview.ctx, wctx = wview.ctx;

    var textInput = DL.el("input", { type: "text", value: "the cat sat on mat", "aria-label": "Sentence (up to eight tokens)" });
    var applyBtn = DL.el("button", {
      type: "button", class: "btn", text: "Set tokens",
      "aria-label": "Recompute attention from the typed tokens", on: { click: function () { draw(); } }
    });
    var headCtl = U.select({
      label: "Head", ariaLabel: "Attention head",
      options: [{ value: "0", label: "head 1" }, { value: "1", label: "head 2" }],
      value: "0", onChange: draw
    });
    var scaleCtl = U.toggle({ label: "Divide scores by √d_k", checked: true, onChange: draw });
    var causalCtl = U.toggle({ label: "Causal mask (no future tokens)", checked: false, onChange: draw });
    var reads = U.readouts(["tokens T", "d_k", "scale", "max weight"]);
    var detail = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var table = U.table({ columns: ["query", "attention weights over keys", "sum"], caption: "Each row is a full softmax over the keys" });

    stage.controls.appendChild(DL.el("div", { class: "ui__row" }, [textInput, applyBtn]));
    stage.controls.appendChild(headCtl.el);
    stage.controls.appendChild(scaleCtl.el);
    stage.controls.appendChild(causalCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(detail);
    stage.controls.appendChild(table.el);

    var Wq0 = [[1, 0.3, -0.2, 0.4], [0.2, 1, 0.3, -0.1], [-0.3, 0.2, 1, 0.5], [0.1, -0.4, 0.2, 1]];
    var Wk0 = [[0.8, -0.2, 0.1, 0.3], [0.3, 0.9, -0.3, 0.2], [-0.1, 0.4, 0.7, -0.2], [0.2, 0.1, 0.4, 0.8]];
    var Wv0 = [[0.5, 0.2, -0.1, 0.3], [-0.2, 0.6, 0.4, 0.1], [0.3, -0.1, 0.8, -0.2], [0.1, 0.3, 0.2, 0.7]];
    var Wq1 = [[0.7, -0.4, 0.2, 0.1], [-0.3, 0.8, 0.5, -0.2], [0.4, 0.1, -0.9, 0.3], [0.2, 0.3, -0.1, 0.6]];
    var Wk1 = [[-0.6, 0.3, 0.2, 0.5], [0.4, 0.7, -0.1, 0.2], [0.2, -0.3, 0.9, -0.4], [0.1, 0.5, 0.3, 0.7]];

    function embed(token, salt) {
      var h = DL.hash(token + "#" + salt);
      var v = [];
      for (var d = 0; d < 4; d++) v.push(((h >>> (d * 5)) & 31) / 15.5 - 1);
      return v;
    }

    function draw() {
      var p = V.palette();
      var toks = String(textInput.value).trim().split(/\s+/).filter(Boolean).slice(0, 8);
      if (!toks.length) toks = ["empty"];
      var nTok = toks.length, dk = 4;
      var X = toks.map(function (t) { return embed(t, 0); });
      var head = parseInt(headCtl.value(), 10);
      var Q = T.matmul(X, head === 0 ? Wq0 : Wq1);
      var K = T.matmul(X, head === 0 ? Wk0 : Wk1);
      var Vmat = T.matmul(X, Wv0);
      var denom = scaleCtl.checked() ? Math.sqrt(dk) : 1;

      var scores = [];
      for (var i = 0; i < nTok; i++) {
        var row = [];
        for (var j = 0; j < nTok; j++) {
          var dot = 0;
          for (var d = 0; d < dk; d++) dot += Q[i][d] * K[j][d];
          row.push(dot / denom);
        }
        scores.push(row);
      }
      var weights = causalCtl.checked()
        ? scores.map(function (row, t) {
            return T.softmax(row, { mask: row.map(function (_, j) { return j > t; }) });
          })
        : T.softmaxRows(scores);
      var context = T.matmul(weights, Vmat);

      var sr = { x: 44, y: 12, w: sview.w - 60, h: sview.h - 46 };
      sview.clear(p.surface);
      var smax = Math.max(0.001, Math.max.apply(null, scores.map(function (r0) { return Math.max.apply(null, r0.map(Math.abs)); })));
      V.heatmap(sctx, scores, sr, { cmap: "coolwarm", vmin: -smax, vmax: smax, gap: 2, values: T <= 6, fmt: function (v) { return DL.fmt(v, 1); } });
      V.text(sctx, "scores  S = QKᵀ" + (scaleCtl.checked() ? "/√" + dk : "") + (causalCtl.checked() ? "  · causal mask" : ""),
        sr.x, sr.y - 2, { size: 10, mono: true, color: p.ink2 });

      var wr = { x: 44, y: 12, w: wview.w - 60, h: wview.h - 46 };
      wview.clear(p.surface);
      V.heatmap(wctx, weights, wr, { cmap: "viridis", vmin: 0, vmax: 1, gap: 2, values: T <= 6, fmt: function (v) { return DL.fmt(v, 2); } });
      V.text(wctx, "weights  A = softmax(S) per row  ·  context = A·V",
        wr.x, wr.y - 2, { size: 10, mono: true, color: p.ink2 });

      var flat = [], mx = 0;
      weights.forEach(function (row) {
        row.forEach(function (v) { flat.push(v); if (v > mx) mx = v; });
      });
      reads.set("tokens T", String(nTok));
      reads.set("d_k", String(dk));
      reads.set("scale", scaleCtl.checked() ? "√4 = 2" : "none");
      reads.set("max weight", DL.fmt(mx, 3));
      detail.textContent = "Query " + toks[0] + ": Q₁ = " + vstr(Q[0], 2) + ", key K₁ = " + vstr(K[0], 2) +
        ", dot(Q₁,K₁) = " + DL.fmt(scores[0][0] * denom, 3) +
        (scaleCtl.checked() ? " → divided by √4 = 2 → " + DL.fmt(scores[0][0], 3) : "") +
        ". Row 1 softmax = " + vstr(weights[0], 3) + " (sums to " + DL.fmt(DL.sum(weights[0]), 3) +
        "); context row 1 = " + vstr(context[0], 3) + ".";
      table.update(weights.map(function (row, t) {
        return [toks[t], row.map(function (v) { return DL.fmt(v, 2); }).join("  "), DL.fmt(DL.sum(row), 3)];
      }));
    }

    textInput.addEventListener("change", draw);
    draw();
    return {
      reset: function () {
        textInput.value = "the cat sat on mat"; headCtl.set("0", true);
        scaleCtl.set(true, true); causalCtl.set(false, true); draw();
      }
    };
  });

  /* ------------------------------------------------------------------ *
   * m2-07-positional-encoding — exact sin/cos PE plus the offset identity
   * ------------------------------------------------------------------ */
  DL.widgets.register("m2-07-positional-encoding", function (el) {
    var stage = U.stage(true);
    el.appendChild(stage.el);

    var view = V.canvas(stage.canvasWrap, { w: 540, h: 330, label: "Sinusoidal positional encoding heatmap" });
    var ctx = view.ctx;

    var tCtl = U.slider({ label: "Sequence length T", min: 4, max: 12, step: 1, value: 8, digits: 0, onInput: draw });
    var dCtl = U.select({
      label: "Embedding width D", ariaLabel: "Embedding width D",
      options: [4, 8, 16].map(function (v) { return { value: String(v), label: String(v) }; }),
      value: "8", onChange: draw
    });
    var reads = U.readouts(["T × D", "ω at i=0", "PE(2,0:1)", "PE(5,0:1)"]);
    var detail = DL.el("div", { class: "callout callout--math", style: { margin: "0" } });
    var table = U.table({ columns: ["position p", "dot(PE(p), PE(p+3)) on pair i=0"], caption: "The dot product depends only on the offset 3, not on p" });

    stage.controls.appendChild(tCtl.el);
    stage.controls.appendChild(dCtl.el);
    stage.controls.appendChild(reads.el);
    stage.controls.appendChild(detail);
    stage.controls.appendChild(table.el);

    function pe(pos, i, D) { return Math.pow(10000, -2 * i / D); }

    function draw() {
      var p = V.palette();
      var T = tCtl.value(), D = parseInt(dCtl.value(), 10);
      var M = [];
      for (var pos = 0; pos < T; pos++) {
        var row = [];
        for (var d = 0; d < D; d++) {
          var i = Math.floor(d / 2), w = pe(pos, i, D);
          row.push(d % 2 === 0 ? Math.sin(pos * w) : Math.cos(pos * w));
        }
        M.push(row);
      }

      view.clear(p.surface);
      var r = { x: 46, y: 12, w: view.w - 62, h: view.h - 52 };
      V.heatmap(ctx, M, r, { cmap: "coolwarm", vmin: -1, vmax: 1, gap: 2, values: D <= 8 && T <= 10,
        fmt: function (v) { return DL.fmt(v, 1); } });
      V.text(ctx, "PE(pos, 2i)=sin(pos/10000^(2i/D)),  PE(pos, 2i+1)=cos(…)",
        r.x, r.y - 2, { size: 10, mono: true, color: p.ink2 });
      V.text(ctx, "row = position, column = dimension", r.x, r.y + r.h + 28,
        { size: 10, mono: true, color: p.ink2 });

      // i = 0 has omega = 1 for every D; show the rotation identity for offset k = 3.
      var s2 = Math.sin(2), c2 = Math.cos(2), s3 = Math.sin(3), c3 = Math.cos(3);
      var rot = [c3 * s2 + s3 * c2, -s3 * s2 + c3 * c2];  // [cos3 sin3; -sin3 cos3] · (sin2, cos2)
      var direct = [Math.sin(5), Math.cos(5)];
      var dots = [0, 1, 2, 3, 4].map(function (q) {
        return Math.sin(q) * Math.sin(q + 3) + Math.cos(q) * Math.cos(q + 3);
      });

      reads.set("T × D", T + " × " + D);
      reads.set("ω at i=0", DL.fmt(pe(0, 0, D), 2));
      reads.set("PE(2,0:1)", "(" + DL.fmt(s2, 3) + ", " + DL.fmt(c2, 3) + ")");
      reads.set("PE(5,0:1)", "(" + DL.fmt(direct[0], 3) + ", " + DL.fmt(direct[1], 3) + ")");
      detail.textContent = "With ω₀ = 1 and offset k = 3, R(kω)·PE(2) = (" + DL.fmt(c3, 3) + "·" +
        DL.fmt(s2, 3) + " + " + DL.fmt(s3, 3) + "·" + DL.fmt(c2, 3) + ", −" + DL.fmt(s3, 3) + "·" +
        DL.fmt(s2, 3) + " + " + DL.fmt(c3, 3) + "·" + DL.fmt(c2, 3) + ") = (" + DL.fmt(rot[0], 3) +
        ", " + DL.fmt(rot[1], 3) + ") = PE(5, 0:1) = (" + DL.fmt(direct[0], 3) + ", " + DL.fmt(direct[1], 3) + ").";
      table.update(dots.map(function (v, q) { return [q, DL.fmt(v, 4)]; }));
    }

    document.addEventListener("dl:theme", draw);
    draw();
    return { reset: function () { tCtl.set(8, true); dCtl.set("8", true); draw(); } };
  });

})(window.DL);
