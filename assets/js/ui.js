/* ==========================================================================
   DeepLearn Lab — ui.js
   Labelled, keyboard-operable controls. Every factory returns {el, ...api}.
   ========================================================================== */
(function (DL) {
  "use strict";

  var U = {};

  function pct(v, min, max) {
    if (max === min) return 50;
    return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  }

  /* ------------------------------------------------------------------ slider */
  U.slider = function (o) {
    o = o || {};
    var id = DL.uid("sl");
    var min = o.min === undefined ? 0 : o.min;
    var max = o.max === undefined ? 1 : o.max;
    var step = o.step === undefined ? 0.01 : o.step;
    var value = o.value === undefined ? min : o.value;
    var digits = o.digits === undefined ? (step < 1 ? 2 : 0) : o.digits;

    var out = DL.el("output", { class: "ui__value", "for": id });
    var input = DL.el("input", {
      type: "range", class: "ui__range", id: id,
      min: min, max: max, step: step, value: value,
      "aria-label": o.ariaLabel || o.label || "slider"
    });

    function paint() {
      var v = parseFloat(input.value);
      input.style.setProperty("--pct", pct(v, min, max) + "%");
      out.textContent = DL.fmt(v, digits) + (o.unit ? " " + o.unit : "");
    }

    var el = DL.el("div", { class: "ui" }, [
      DL.el("label", { class: "ui__label", for: id }, [
        DL.el("span", { text: o.label || "Value" }), out
      ]),
      input,
      o.hint ? DL.el("span", { class: "ui__hint", text: o.hint }) : null
    ]);

    input.addEventListener("input", function () {
      paint();
      if (o.onInput) o.onInput(parseFloat(input.value), input.value);
    });
    paint();

    return {
      el: el, input: input,
      value: function () { return parseFloat(input.value); },
      set: function (v, silent) {
        input.value = v;
        paint();
        if (!silent && o.onInput) o.onInput(parseFloat(input.value));
      },
      setRange: function (lo, hi) {
        input.min = lo; input.max = hi; paint();
      },
      setMax: function (m) { max = m; input.max = m; paint(); }
    };
  };

  /* ------------------------------------------------------------------ toggle */
  U.toggle = function (o) {
    o = o || {};
    var id = DL.uid("tg");
    var input = DL.el("input", {
      type: "checkbox", id: id,
      "aria-label": o.ariaLabel || o.label || "toggle"
    });
    input.checked = !!o.checked;
    var el = DL.el("label", { class: "ui__toggle", for: id }, [
      input,
      DL.el("span", { class: "ui__track", "aria-hidden": "true" }),
      DL.el("span", { class: "ui__toggle-text", text: o.label || "Toggle" })
    ]);
    input.addEventListener("change", function () {
      if (o.onChange) o.onChange(input.checked);
    });
    return {
      el: el, input: input,
      checked: function () { return input.checked; },
      set: function (b, silent) {
        input.checked = !!b;
        if (!silent && o.onChange) o.onChange(!!b);
      }
    };
  };

  /* ------------------------------------------------------------------ select */
  U.select = function (o) {
    o = o || {};
    var id = DL.uid("se");
    var opts = o.options || [];
    var sel = DL.el("select", { class: "ui__select", id: id, "aria-label": o.ariaLabel || o.label || "select" });
    opts.forEach(function (op) {
      var el = DL.el("option", { value: op.value, text: op.label });
      if (String(op.value) === String(o.value)) el.selected = true;
      sel.appendChild(el);
    });
    var el = DL.el("div", { class: "ui" }, [
      DL.el("label", { class: "ui__label", for: id }, [DL.el("span", { text: o.label || "Option" })]),
      sel,
      o.hint ? DL.el("span", { class: "ui__hint", text: o.hint }) : null
    ]);
    sel.addEventListener("change", function () {
      if (o.onChange) o.onChange(sel.value);
    });
    return {
      el: el, select: sel,
      value: function () { return sel.value; },
      set: function (v, silent) {
        sel.value = v;
        if (!silent && o.onChange) o.onChange(sel.value);
      }
    };
  };

  /* --------------------------------------------------------------- buttons */
  U.buttons = function (o) {
    o = o || {};
    var opts = o.options || [];
    var group = DL.el("div", {
      class: "ui__seg", role: "radiogroup",
      "aria-label": o.ariaLabel || o.label || "choice"
    });
    var buttons = [];
    var current = o.value;

    function select(v, silent) {
      current = v;
      buttons.forEach(function (b) {
        b.btn.setAttribute("aria-checked", String(b.value === v));
        b.btn.tabIndex = b.value === v ? 0 : -1;
      });
      if (!silent && o.onChange) o.onChange(v);
    }

    opts.forEach(function (op) {
      var btn = DL.el("button", {
        type: "button", class: "ui__seg-btn", role: "radio",
        "aria-checked": String(op.value === o.value), tabindex: op.value === o.value ? 0 : -1,
        text: op.label, title: op.hint || ""
      });
      btn.addEventListener("click", function () { select(op.value); });
      btn.addEventListener("keydown", function (e) {
        var idx = buttons.indexOf(b);
        var next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % buttons.length;
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + buttons.length) % buttons.length;
        if (next !== null) {
          e.preventDefault();
          buttons[next].btn.focus();
          select(buttons[next].value);
        }
      });
      var b = { value: op.value, btn: btn };
      buttons.push(b);
      group.appendChild(btn);
    });

    var el = DL.el("div", { class: "ui" }, [
      o.label ? DL.el("span", { class: "ui__label" }, [DL.el("span", { text: o.label })]) : null,
      group,
      o.hint ? DL.el("span", { class: "ui__hint", text: o.hint }) : null
    ]);

    return {
      el: el, group: group,
      value: function () { return current; },
      set: function (v, silent) { select(v, silent); }
    };
  };

  /* ----------------------------------------------------------------- number */
  U.number = function (o) {
    o = o || {};
    var id = DL.uid("nu");
    var input = DL.el("input", {
      type: "number", class: "ui__number", id: id,
      min: o.min, max: o.max, step: o.step || 1, value: o.value,
      "aria-label": o.ariaLabel || o.label || "number"
    });
    var el = DL.el("div", { class: "ui" }, [
      DL.el("label", { class: "ui__label", for: id }, [DL.el("span", { text: o.label || "Value" })]),
      input,
      o.hint ? DL.el("span", { class: "ui__hint", text: o.hint }) : null
    ]);
    input.addEventListener("change", function () {
      if (o.onChange) o.onChange(parseFloat(input.value));
    });
    return {
      el: el, input: input,
      value: function () { return parseFloat(input.value); },
      set: function (v) { input.value = v; }
    };
  };

  /* --------------------------------------------------------------- readouts */
  U.readout = function (label) {
    var v = DL.el("span", { class: "ui__readout-value", text: "—" });
    var el = DL.el("div", { class: "ui__readout" }, [
      DL.el("span", { class: "ui__readout-label", text: label }), v
    ]);
    return {
      el: el,
      set: function (text) { v.textContent = text; },
      value: function () { return v.textContent; }
    };
  };

  U.readouts = function (labels) {
    var wrap = DL.el("div", { class: "ui__readouts" });
    var map = {};
    labels.forEach(function (l) {
      var r = U.readout(l);
      map[l] = r;
      wrap.appendChild(r.el);
    });
    return {
      el: wrap,
      set: function (label, text) { if (map[label]) map[label].set(text); },
      get: function (label) { return map[label]; }
    };
  };

  /* ------------------------------------------------------------------ table */
  U.table = function (o) {
    o = o || {};
    var tbody = DL.el("tbody");
    var thead = DL.el("thead", {}, [
      DL.el("tr", {}, (o.columns || []).map(function (c) {
        return DL.el("th", { text: c, class: c.charAt(0) === "#" ? "num" : "" });
      }))
    ]);
    function fill(rows) {
      tbody.innerHTML = "";
      (rows || []).forEach(function (row) {
        tbody.appendChild(DL.el("tr", {}, row.map(function (cell, i) {
          var numeric = typeof cell === "number";
          return DL.el("td", {
            text: numeric ? DL.fmt(cell, o.digits === undefined ? 0 : o.digits) : String(cell),
            class: numeric ? "num" : ""
          });
        })));
      });
    }
    fill(o.rows);
    var table = DL.el("table", { class: o.className || "" }, [thead, tbody]);
    if (o.caption) table.insertBefore(DL.el("caption", { text: o.caption }), thead);
    var el = DL.el("div", { class: "table-wrap" }, [table]);
    return { el: el, table: table, update: fill };
  };

  /* --------------------------------------------------------------- playback */
  U.playback = function (o) {
    o = o || {};
    var speeds = o.speeds || [1, 4, 12, 40];
    var running = !!o.started;
    var speedIdx = 0;
    var playBtn = DL.el("button", { type: "button", class: "btn btn--accent" });
    var resetBtn = DL.el("button", { type: "button", class: "btn", text: "Reset" });
    var speedSel = DL.el("select", { class: "ui__select", "aria-label": "Animation speed", style: { width: "auto" } });
    speeds.forEach(function (s, i) {
      speedSel.appendChild(DL.el("option", { value: String(s), text: "×" + s }));
    });
    speedSel.value = String(speeds[o.speedIndex || 0]);

    function label() {
      playBtn.textContent = running ? "Pause" : "Run";
      playBtn.setAttribute("aria-pressed", String(running));
    }
    playBtn.addEventListener("click", function () {
      running = !running;
      label();
      if (o.onToggle) o.onToggle(running);
    });
    resetBtn.addEventListener("click", function () {
      running = false;
      label();
      if (o.onReset) o.onReset();
    });
    speedSel.addEventListener("change", function () {
      if (o.onSpeed) o.onSpeed(parseInt(speedSel.value, 10));
    });
    label();

    var el = DL.el("div", { class: "lab__actions" }, [
      playBtn, resetBtn,
      DL.el("label", { class: "hstack", style: { gap: "6px" } }, [
        DL.el("span", { class: "ui__hint", text: "Speed" }), speedSel
      ]),
      o.extra || null
    ]);

    return {
      el: el,
      setRunning: function (b) { running = b; label(); },
      isRunning: function () { return running; },
      setSpeed: function (s) { speedSel.value = String(s); },
      playBtn: playBtn,
      resetBtn: resetBtn
    };
  };

  /* ------------------------------------------------------------------ misc */
  U.row = function () {
    var el = DL.el("div", { class: "ui__row" });
    for (var i = 0; i < arguments.length; i++) {
      var c = arguments[i];
      if (c) el.appendChild(c.el || c);
    }
    return el;
  };

  U.group = function (title, children) {
    var el = DL.el("div", { class: "lab__group" }, [
      title ? DL.el("p", { class: "lab__group-title", text: title }) : null
    ]);
    children.forEach(function (c) { if (c) el.appendChild(c.el || c); });
    return el;
  };

  U.kbd = function (s) { return DL.el("kbd", { text: s }); };

  U.tooltip = function (el, text) {
    var id = DL.uid("tip");
    var pop = DL.el("span", { class: "term__pop", id: id, hidden: "", text: text });
    el.setAttribute("aria-describedby", id);
    el.setAttribute("tabindex", "0");
    el.appendChild(pop);
    function show() { pop.hidden = false; }
    function hide() { pop.hidden = true; }
    el.addEventListener("focus", show);
    el.addEventListener("blur", hide);
    el.addEventListener("mouseenter", show);
    el.addEventListener("mouseleave", hide);
    return el;
  };

  /* canvas wrapper used by labs */
  U.stage = function (wide) {
    var canvasWrap = DL.el("div", { class: "lab__canvas-wrap" });
    var controls = DL.el("div", { class: "lab__controls" });
    var stage = DL.el("div", { class: "lab__stage" + (wide ? " lab__stage--wide" : "") },
      [canvasWrap, controls]);
    return { el: stage, canvasWrap: canvasWrap, controls: controls };
  };

  DL.ui = U;
})(window.DL);
