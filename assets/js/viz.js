/* ==========================================================================
   DeepLearn Lab — viz.js
   Canvas 2-D drawing helpers. Everything is procedural; colours follow the theme.
   Rects are plain objects: {x, y, w, h}.
   ========================================================================== */
(function (DL) {
  "use strict";

  var V = {};
  var paletteCache = null;

  V.dpr = function () { return Math.min(window.devicePixelRatio || 1, 2); };

  V.palette = function () {
    if (paletteCache) return paletteCache;
    var cs = getComputedStyle(document.documentElement);
    function v(name, fallback) {
      var s = cs.getPropertyValue(name);
      return (s && s.trim()) || fallback;
    }
    paletteCache = {
      ink: v("--ink-1", "#16151a"),
      ink2: v("--ink-2", "#45434f"),
      ink3: v("--ink-3", "#6f6c7d"),
      line: v("--line", "#e0ddd3"),
      lineStrong: v("--line-strong", "#c6c2b6"),
      accent: v("--accent", "#6d5efc"),
      accentStrong: v("--accent-strong", "#4b3ae0"),
      accentSoft: v("--accent-soft", "#ecebff"),
      surface: v("--surface", "#ffffff"),
      surface2: v("--surface-2", "#f4f2ec"),
      bg: v("--bg", "#f7f6f2"),
      ok: v("--ok", "#0f7b4f"),
      warn: v("--warn", "#8a5200"),
      danger: v("--danger", "#b3261e"),
      dark: document.documentElement.getAttribute("data-theme") === "dark"
    };
    return paletteCache;
  };

  document.addEventListener("dl:theme", function () { paletteCache = null; });

  /* ---------------------------------------------------------------- canvas */
  V.canvas = function (parent, opts) {
    opts = opts || {};
    var w = opts.w || 560, h = opts.h || 340;
    var dpr = V.dpr();
    var canvas = document.createElement("canvas");
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = "100%";
    canvas.style.aspectRatio = w + " / " + h;
    canvas.style.height = "auto";
    canvas.setAttribute("role", "img");
    if (opts.label) canvas.setAttribute("aria-label", opts.label);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (parent) parent.appendChild(canvas);
    return {
      canvas: canvas,
      ctx: ctx,
      w: w,
      h: h,
      clear: function (fill) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fillRect(0, 0, w, h);
        }
      },
      resize: function (nw, nh) {
        w = nw; h = nh;
        var d2 = V.dpr();
        canvas.width = Math.round(w * d2);
        canvas.height = Math.round(h * d2);
        canvas.style.aspectRatio = w + " / " + h;
        ctx.setTransform(d2, 0, 0, d2, 0, 0);
      }
    };
  };

  V.rect = function (x, y, w, h) { return { x: x, y: y, w: w, h: h }; };

  V.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r || 0, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  /* ------------------------------------------------------------- colormaps */
  function ramp(stops, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var n = stops.length - 1;
    var i = Math.min(n - 1, Math.floor(t * n));
    var f = t * n - i;
    var a = stops[i], b = stops[i + 1];
    return [
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f)
    ];
  }

  var CMAPS = {
    viridis: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]],
    magma: [[0, 0, 4], [80, 18, 123], [182, 54, 121], [251, 136, 97], [252, 253, 191]],
    inferno: [[0, 0, 4], [87, 15, 109], [187, 55, 84], [249, 142, 8], [252, 255, 164]],
    coolwarm: [[59, 76, 192], [221, 221, 221], [180, 4, 38]],
    div: [[33, 102, 172], [247, 247, 247], [178, 24, 43]],
    gray: [[20, 20, 20], [245, 245, 245]],
    ice: [[8, 12, 30], [30, 65, 130], [90, 170, 220], [240, 250, 255]],
    ember: [[20, 12, 10], [120, 30, 20], [220, 110, 30], [255, 230, 150]]
  };

  V.colormaps = {};
  Object.keys(CMAPS).forEach(function (name) {
    V.colormaps[name] = function (t) {
      var c = ramp(CMAPS[name], t);
      return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
    };
  });

  V.colormap = function (name) {
    if (name === "accent") {
      var p = V.palette();
      return function (t) {
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        if (p.dark) {
          return "rgb(" + [Math.round(24 + t * (120 - 24)), Math.round(22 + t * (100 - 22)), Math.round(34 + t * (200 - 34))].join(",") + ")";
        }
        return "rgb(" + [Math.round(252 - t * 210), Math.round(250 - t * 200), Math.round(255 - t * 140)].join(",") + ")";
      };
    }
    return V.colormaps[name] || V.colormaps.viridis;
  };

  V.colormapList = ["viridis", "magma", "inferno", "coolwarm", "div", "ice", "ember", "gray", "accent"];

  /* ---------------------------------------------------------------- text */
  V.text = function (ctx, str, x, y, opts) {
    opts = opts || {};
    var p = V.palette();
    ctx.save();
    ctx.fillStyle = opts.color || p.ink2;
    ctx.font = (opts.weight || "500") + " " + (opts.size || 11) + "px " +
      (opts.mono ? "ui-monospace, Consolas, monospace" : "ui-sans-serif, system-ui, sans-serif");
    ctx.textAlign = opts.align || "left";
    ctx.textBaseline = opts.baseline || "alphabetic";
    ctx.fillText(str, x, y);
    ctx.restore();
  };

  /* ---------------------------------------------------------------- axes */
  V.axes = function (ctx, r, opts) {
    opts = opts || {};
    var p = V.palette();
    var xmin = opts.xmin === undefined ? 0 : opts.xmin;
    var xmax = opts.xmax === undefined ? 1 : opts.xmax;
    var ymin = opts.ymin === undefined ? 0 : opts.ymin;
    var ymax = opts.ymax === undefined ? 1 : opts.ymax;
    var ticks = opts.ticks || 5;

    ctx.save();
    if (opts.grid !== false) {
      ctx.strokeStyle = p.line;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      for (var i = 0; i <= ticks; i++) {
        var gx = r.x + (r.w * i) / ticks;
        var gy = r.y + (r.h * i) / ticks;
        ctx.beginPath(); ctx.moveTo(gx, r.y); ctx.lineTo(gx, r.y + r.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r.x, gy); ctx.lineTo(r.x + r.w, gy); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = p.lineStrong;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);

    if (opts.tickLabels !== false) {
      ctx.fillStyle = p.ink3;
      ctx.font = "500 9.5px ui-monospace, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (var j = 0; j <= ticks; j++) {
        var tx = r.x + (r.w * j) / ticks;
        var xv = xmin + ((xmax - xmin) * j) / ticks;
        ctx.fillText(DL.fmt(xv, Math.abs(xmax - xmin) < 3 ? 1 : 0), tx, r.y + r.h + 4);
      }
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (var k = 0; k <= ticks; k++) {
        var ty = r.y + r.h - (r.h * k) / ticks;
        var yv = ymin + ((ymax - ymin) * k) / ticks;
        ctx.fillText(DL.fmt(yv, Math.abs(ymax - ymin) < 3 ? 1 : 0), r.x - 5, ty);
      }
    }
    if (opts.xlabel) V.text(ctx, opts.xlabel, r.x + r.w / 2, r.y + r.h + 18, { align: "center", size: 10, mono: true });
    if (opts.ylabel) {
      ctx.save();
      ctx.translate(r.x - 28, r.y + r.h / 2);
      ctx.rotate(-Math.PI / 2);
      V.text(ctx, opts.ylabel, 0, 0, { align: "center", size: 10, mono: true });
      ctx.restore();
    }
    ctx.restore();
  };

  /* ---------------------------------------------------------------- heatmap */
  V.heatmap = function (ctx, M, r, opts) {
    opts = opts || {};
    if (!M || !M.length) return;
    var rows = M.length, cols = M[0].length;
    var flat = [];
    for (var i = 0; i < rows; i++) for (var j = 0; j < cols; j++) flat.push(M[i][j]);
    var vmin = opts.vmin === undefined ? DL.minOf(flat) : opts.vmin;
    var vmax = opts.vmax === undefined ? DL.maxOf(flat) : opts.vmax;
    if (vmax === vmin) vmax = vmin + 1e-9;
    var cmap = V.colormap(opts.cmap || "viridis");
    var gap = opts.gap === undefined ? 0 : opts.gap;
    var cw = r.w / cols, ch = r.h / rows;

    ctx.save();
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var t = (M[y][x] - vmin) / (vmax - vmin);
        ctx.fillStyle = cmap(t);
        ctx.fillRect(r.x + x * cw + gap / 2, r.y + y * ch + gap / 2,
          Math.ceil(cw - gap), Math.ceil(ch - gap));
      }
    }
    if (opts.values && cw > 22 && ch > 14) {
      ctx.font = "500 " + Math.min(10, cw * 0.34) + "px ui-monospace, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (var yy = 0; yy < rows; yy++) {
        for (var xx = 0; xx < cols; xx++) {
          var t2 = (M[yy][xx] - vmin) / (vmax - vmin);
          ctx.fillStyle = t2 > 0.55 ? "rgba(0,0,0,.75)" : "rgba(255,255,255,.85)";
          ctx.fillText(opts.fmt ? opts.fmt(M[yy][xx]) : DL.fmt(M[yy][xx], 1),
            r.x + xx * cw + cw / 2, r.y + yy * ch + ch / 2);
        }
      }
    }
    if (opts.border !== false) {
      ctx.strokeStyle = V.palette().lineStrong;
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
    }
    ctx.restore();
    return { vmin: vmin, vmax: vmax };
  };

  /* ------------------------------------------------------------------ line */
  V.line = function (ctx, series, r, opts) {
    opts = opts || {};
    if (!Array.isArray(series)) series = [series];
    var all = [];
    var hasPts = series.length && series[0].pts;
    series.forEach(function (s) {
      if (s.pts) all = all.concat(s.pts);
      else {
        for (var i = 0; i < s.x.length; i++) all.push([s.x[i], s.y[i]]);
      }
    });
    if (!all.length) return;

    var xs = all.map(function (p) { return p[0]; });
    var ys = all.map(function (p) { return p[1]; });
    var xmin = opts.xmin === undefined ? DL.minOf(xs) : opts.xmin;
    var xmax = opts.xmax === undefined ? DL.maxOf(xs) : opts.xmax;
    var ymin = opts.ymin === undefined ? DL.minOf(ys) : opts.ymin;
    var ymax = opts.ymax === undefined ? DL.maxOf(ys) : opts.ymax;
    if (xmax === xmin) { xmax += 1; xmin -= 1; }
    if (ymax === ymin) { ymax += 1; ymin -= 1; }
    var padY = opts.padY === undefined ? 0.06 : opts.padY;
    if (opts.padY !== false) {
      var d = (ymax - ymin) * padY;
      ymin -= d; ymax += d;
    }
    var sx = function (x) { return r.x + ((x - xmin) / (xmax - xmin)) * r.w; };
    var sy = function (y) { return r.y + r.h - ((y - ymin) / (ymax - ymin)) * r.h; };

    if (opts.axes !== false) {
      V.axes(ctx, r, {
        xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax,
        grid: opts.grid !== false, tickLabels: opts.tickLabels !== false,
        xlabel: opts.xlabel, ylabel: opts.ylabel
      });
    }

    var p = V.palette();
    var palette = opts.colors || [p.accent, p.ink2, p.ink3, p.ok, p.warn, p.danger];
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    series.forEach(function (s, si) {
      ctx.strokeStyle = s.color || palette[si % palette.length];
      ctx.lineWidth = s.width || (opts.width || 1.8);
      if (s.dash) ctx.setLineDash(s.dash); else ctx.setLineDash([]);
      ctx.beginPath();
      if (s.pts) {
        s.pts.forEach(function (pt, i) {
          var px = sx(pt[0]), py = sy(pt[1]);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
      } else {
        for (var i = 0; i < s.x.length; i++) {
          var px2 = sx(s.x[i]), py2 = sy(s.y[i]);
          if (i === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
        }
      }
      ctx.stroke();
      if (s.fill) {
        ctx.lineTo(sx(s.pts ? s.pts[s.pts.length - 1][0] : s.x[s.x.length - 1]), r.y + r.h);
        ctx.lineTo(sx(s.pts ? s.pts[0][0] : s.x[0]), r.y + r.h);
        ctx.closePath();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = s.color || palette[si % palette.length];
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
    ctx.restore();
    return { xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax, sx: sx, sy: sy };
  };

  /* --------------------------------------------------------------- scatter */
  V.scatter = function (ctx, pts, r, opts) {
    opts = opts || {};
    var p = V.palette();
    var xs = pts.map(function (q) { return q.x; });
    var ys = pts.map(function (q) { return q.y; });
    var xmin = opts.xmin === undefined ? DL.minOf(xs) : opts.xmin;
    var xmax = opts.xmax === undefined ? DL.maxOf(xs) : opts.xmax;
    var ymin = opts.ymin === undefined ? DL.minOf(ys) : opts.ymin;
    var ymax = opts.ymax === undefined ? DL.maxOf(ys) : opts.ymax;
    if (xmax === xmin) { xmax += 1; xmin -= 1; }
    if (ymax === ymin) { ymax += 1; ymin -= 1; }
    var sx = function (x) { return r.x + ((x - xmin) / (xmax - xmin)) * r.w; };
    var sy = function (y) { return r.y + r.h - ((y - ymin) / (ymax - ymin)) * r.h; };
    if (opts.axes !== false) {
      V.axes(ctx, r, {
        xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax,
        grid: opts.grid !== false, tickLabels: opts.tickLabels !== false,
        xlabel: opts.xlabel, ylabel: opts.ylabel
      });
    }
    var palette = opts.colors || [p.accent, p.ink2, p.ink3, p.ok, p.warn];
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    pts.forEach(function (q) {
      ctx.beginPath();
      ctx.arc(sx(q.x), sy(q.y), q.r || 3.2, 0, Math.PI * 2);
      ctx.fillStyle = q.color || palette[(q.c || 0) % palette.length];
      ctx.globalAlpha = q.alpha === undefined ? 0.85 : q.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (q.stroke) { ctx.strokeStyle = q.stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
    });
    ctx.restore();
    return { sx: sx, sy: sy, xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax };
  };

  /* ----------------------------------------------------------------- bars */
  V.bars = function (ctx, values, r, opts) {
    opts = opts || {};
    var p = V.palette();
    var n = values.length;
    var vmax = opts.vmax === undefined ? Math.max(0.0001, DL.maxOf(values)) : opts.vmax;
    var bw = r.w / n;
    var cmap = opts.cmap ? V.colormap(opts.cmap) : null;
    ctx.save();
    for (var i = 0; i < n; i++) {
      var h = Math.max(0, (values[i] / vmax) * r.h);
      ctx.fillStyle = cmap ? cmap(i / Math.max(1, n - 1)) : (opts.colors ? opts.colors[i % opts.colors.length] : p.accent);
      ctx.fillRect(r.x + i * bw + bw * 0.12, r.y + r.h - h, bw * 0.76, h);
      if (opts.labels) {
        V.text(ctx, opts.labels[i], r.x + i * bw + bw / 2, r.y + r.h + 4,
          { align: "center", baseline: "top", size: 9, mono: true });
      }
      if (opts.values) {
        V.text(ctx, DL.fmt(values[i], opts.digits), r.x + i * bw + bw / 2, r.y + r.h - h - 3,
          { align: "center", baseline: "bottom", size: 9, mono: true });
      }
    }
    ctx.restore();
    return vmax;
  };

  /* ------------------------------------------------------------ histogram */
  V.histogram = function (ctx, values, r, opts) {
    opts = opts || {};
    var bins = opts.bins || 24;
    var xmin = opts.xmin === undefined ? DL.minOf(values) : opts.xmin;
    var xmax = opts.xmax === undefined ? DL.maxOf(values) : opts.xmax;
    if (xmax === xmin) { xmax = xmin + 1; }
    var counts = new Array(bins);
    for (var b = 0; b < bins; b++) counts[b] = 0;
    for (var i = 0; i < values.length; i++) {
      var t = (values[i] - xmin) / (xmax - xmin);
      var idx = Math.floor(t * bins);
      if (idx < 0) idx = 0; if (idx >= bins) idx = bins - 1;
      counts[idx]++;
    }
    var vmax = Math.max.apply(null, counts) || 1;
    var bw = r.w / bins;
    var cmap = V.colormap(opts.cmap || "accent");
    ctx.save();
    for (var k = 0; k < bins; k++) {
      var h = (counts[k] / vmax) * r.h;
      ctx.fillStyle = cmap(0.25 + 0.6 * (counts[k] / vmax));
      ctx.fillRect(r.x + k * bw, r.y + r.h - h, Math.max(1, bw - 1), h);
    }
    ctx.strokeStyle = V.palette().lineStrong;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
    ctx.restore();
    if (opts.labels !== false) {
      V.text(ctx, DL.fmt(xmin, 1), r.x, r.y + r.h + 4, { size: 9, mono: true, baseline: "top" });
      V.text(ctx, DL.fmt(xmax, 1), r.x + r.w, r.y + r.h + 4,
        { size: 9, mono: true, baseline: "top", align: "right" });
    }
    return counts;
  };

  /* ---------------------------------------------------------------- arrows */
  V.arrow = function (ctx, x1, y1, x2, y2, opts) {
    opts = opts || {};
    var p = V.palette();
    var color = opts.color || p.ink2;
    var head = opts.head === undefined ? 6 : opts.head;
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return;
    var ux = dx / len, uy = dy / len;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = opts.width || 1.6;
    if (opts.dash) ctx.setLineDash(opts.dash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - ux * head * 0.9, y2 - uy * head * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * head - uy * head * 0.45, y2 - uy * head + ux * head * 0.45);
    ctx.lineTo(x2 - ux * head + uy * head * 0.45, y2 - uy * head - ux * head * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  /* ---------------------------------------------------------------- legend */
  V.legend = function (ctx, items, r, opts) {
    opts = opts || {};
    var p = V.palette();
    ctx.save();
    ctx.font = "500 10px ui-monospace, Consolas, monospace";
    var lh = opts.lh || 14;
    items.forEach(function (it, i) {
      var y = r.y + i * lh;
      ctx.fillStyle = it.color || p.accent;
      ctx.fillRect(r.x, y + 3, 9, 9);
      ctx.fillStyle = p.ink2;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(it.label, r.x + 14, y + 8);
    });
    ctx.restore();
  };

  /* -------------------------------------------------------------- colorbar */
  V.colorbar = function (ctx, r, cmapName, opts) {
    opts = opts || {};
    var cmap = V.colormap(cmapName);
    var steps = opts.steps || 40;
    ctx.save();
    for (var i = 0; i < steps; i++) {
      ctx.fillStyle = cmap(i / (steps - 1));
      ctx.fillRect(r.x, r.y + (r.h * (steps - 1 - i)) / steps, r.w, r.h / steps + 1);
    }
    ctx.strokeStyle = V.palette().lineStrong;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
    ctx.restore();
    if (opts.labels !== false) {
      V.text(ctx, DL.fmt(opts.max === undefined ? 1 : opts.max, 1), r.x + r.w + 4, r.y + 4,
        { size: 9, mono: true, baseline: "top" });
      V.text(ctx, DL.fmt(opts.min === undefined ? 0 : opts.min, 1), r.x + r.w + 4, r.y + r.h,
        { size: 9, mono: true, baseline: "bottom" });
    }
  };

  /* ----------------------------------------------------------------- curve */
  V.curve = function (ctx, fn, r, opts) {
    opts = opts || {};
    var n = opts.samples || 220;
    var xmin = opts.xmin === undefined ? -3 : opts.xmin;
    var xmax = opts.xmax === undefined ? 3 : opts.xmax;
    var ymin = opts.ymin, ymax = opts.ymax;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var x = xmin + (xmax - xmin) * (i / n);
      pts.push([x, fn(x)]);
    }
    if (ymin === undefined) ymin = DL.minOf(pts.map(function (p) { return p[1]; }));
    if (ymax === undefined) ymax = DL.maxOf(pts.map(function (p) { return p[1]; }));
    return V.line(ctx, [{ pts: pts, color: opts.color, width: opts.width }], r, {
      xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax,
      axes: opts.axes, grid: opts.grid, xlabel: opts.xlabel, ylabel: opts.ylabel,
      tickLabels: opts.tickLabels
    });
  };

  /* -------------------------------------------------------------- helpers */
  V.dot = function (ctx, x, y, r, color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r || 3, 0, Math.PI * 2);
    ctx.fillStyle = color || V.palette().accent;
    ctx.fill();
    ctx.restore();
  };

  V.dashedLine = function (ctx, x1, y1, x2, y2, opts) {
    opts = opts || {};
    ctx.save();
    ctx.strokeStyle = opts.color || V.palette().lineStrong;
    ctx.lineWidth = opts.width || 1;
    ctx.setLineDash(opts.dash || [4, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  };

  V.zeroLine = function (ctx, r, opts) {
    opts = opts || {};
    if (opts.y0 !== undefined) {
      V.dashedLine(ctx, r.x, opts.y0, r.x + r.w, opts.y0, { color: opts.color, dash: [3, 3] });
    }
    if (opts.x0 !== undefined) {
      V.dashedLine(ctx, opts.x0, r.y, opts.x0, r.y + r.h, { color: opts.color, dash: [3, 3] });
    }
  };

  DL.viz = V;
})(window.DL);
