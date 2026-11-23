/* ==========================================================================
   DeepLearn Lab — tensor.js
   Plain nested-array tensors. 2-D is [[..],[..]], 1-D is [..], 3-D is [C][H][W].
   Convention: images are NCHW in prose; here helpers take a single CxHxW sample.
   ========================================================================== */
(function (DL) {
  "use strict";

  function isNum(v) { return typeof v === "number" && isFinite(v); }

  var T = {};

  /* ---------------------------------------------------------------- shape */
  T.shape = function (t) {
    var s = [], x = t;
    while (Array.isArray(x)) { s.push(x.length); x = x[0]; }
    return s;
  };

  T.assert2D = function (t, name) {
    if (!Array.isArray(t) || !Array.isArray(t[0])) {
      throw new Error((name || "tensor") + " must be a 2-D array");
    }
    return t;
  };

  /* ------------------------------------------------------------- creation */
  T.zeros = function () {
    var dims = Array.prototype.slice.call(arguments);
    function build(d) {
      if (d === dims.length - 1) {
        var row = new Array(dims[d]);
        for (var i = 0; i < row.length; i++) row[i] = 0;
        return row;
      }
      var out = new Array(dims[d]);
      for (var j = 0; j < out.length; j++) out[j] = build(d + 1);
      return out;
    }
    return build(0);
  };

  T.ones = function () {
    var dims = Array.prototype.slice.call(arguments);
    var z = T.zeros.apply(null, dims);
    return T.map(z, function () { return 1; });
  };

  T.randn = function (rng) {
    var dims = Array.prototype.slice.call(arguments, 1);
    var z = T.zeros.apply(null, dims);
    return T.map(z, function () { return DL.randn(rng); });
  };

  T.uniform = function (rng, lo, hi) {
    return lo + (hi - lo) * rng();
  };

  T.from2D = function (a) {
    T.assert2D(a, "input");
    var out = [], w = a[0].length;
    for (var i = 0; i < a.length; i++) {
      if (a[i].length !== w) throw new Error("ragged 2-D array at row " + i);
      out.push(a[i].slice());
    }
    return out;
  };

  T.copy = function (t) {
    return T.map(t, function (v) { return v; });
  };

  T.toFlat = function (t) {
    var out = [];
    (function walk(x) {
      if (Array.isArray(x)) { for (var i = 0; i < x.length; i++) walk(x[i]); }
      else out.push(x);
    })(t);
    return out;
  };

  T.fromFlat = function (flat, dims) {
    var idx = 0;
    function build(d) {
      if (d === dims.length - 1) {
        var row = new Array(dims[d]);
        for (var i = 0; i < row.length; i++) row[i] = flat[idx++];
        return row;
      }
      var out = new Array(dims[d]);
      for (var j = 0; j < out.length; j++) out[j] = build(d + 1);
      return out;
    }
    return build(0);
  };

  T.get = function (t, i, j) { return (j === undefined) ? t[i] : t[i][j]; };
  T.set = function (t, i, j, v) {
    if (v === undefined) { t[i] = j; } else { t[i][j] = v; }
    return t;
  };

  /* ---------------------------------------------------------- elementwise */
  function ew(fn) {
    return function (A, B) {
      return T.zip(A, B, fn);
    };
  }
  T.add = ew(function (a, b) { return a + b; });
  T.sub = ew(function (a, b) { return a - b; });
  T.mul = ew(function (a, b) { return a * b; });
  T.div = ew(function (a, b) { return b === 0 ? 0 : a / b; });
  T.maximum = ew(function (a, b) { return a > b ? a : b; });

  T.scale = function (A, s) { return T.map(A, function (v) { return v * s; }); };
  T.shift = function (A, s) { return T.map(A, function (v) { return v + s; }); };

  T.map = function (A, fn) {
    if (!Array.isArray(A)) return fn(A);
    var out = new Array(A.length);
    for (var i = 0; i < A.length; i++) out[i] = T.map(A[i], fn);
    return out;
  };

  T.mapIndexed = function (A, fn) {
    function walk(x, idx) {
      if (Array.isArray(x)) {
        var out = new Array(x.length);
        for (var i = 0; i < x.length; i++) out[i] = walk(x[i], idx.concat([i]));
        return out;
      }
      return fn(x, idx);
    }
    return walk(A, []);
  };

  T.zip = function (A, B, fn) {
    if (!Array.isArray(A)) return fn(A, B);
    var out = new Array(A.length);
    for (var i = 0; i < A.length; i++) out[i] = T.zip(A[i], B[i], fn);
    return out;
  };

  T.forEach = function (A, fn) {
    function walk(x, idx) {
      if (Array.isArray(x)) {
        for (var i = 0; i < x.length; i++) walk(x[i], idx.concat([i]));
      } else fn(x, idx);
    }
    walk(A, []);
  };

  /* ------------------------------------------------------------- linalg */
  T.matmul = function (A, B) {
    var m = A.length, k = A[0].length, n = B[0].length;
    if (B.length !== k) {
      throw new Error("matmul: (" + m + "×" + k + ") × (" + B.length + "×" + n + ")");
    }
    var out = T.zeros(m, n);
    for (var i = 0; i < m; i++) {
      for (var j = 0; j < n; j++) {
        var s = 0;
        for (var p = 0; p < k; p++) s += A[i][p] * B[p][j];
        out[i][j] = s;
      }
    }
    return out;
  };

  T.matvec = function (A, v) {
    var out = new Array(A.length);
    for (var i = 0; i < A.length; i++) {
      var s = 0;
      for (var j = 0; j < v.length; j++) s += A[i][j] * v[j];
      out[i] = s;
    }
    return out;
  };

  T.transpose = function (A) {
    var m = A.length, n = A[0].length, out = T.zeros(n, m);
    for (var i = 0; i < m; i++) for (var j = 0; j < n; j++) out[j][i] = A[i][j];
    return out;
  };

  T.outer = function (a, b) {
    var out = T.zeros(a.length, b.length);
    for (var i = 0; i < a.length; i++) for (var j = 0; j < b.length; j++) out[i][j] = a[i] * b[j];
    return out;
  };

  T.eye = function (n) {
    var out = T.zeros(n, n);
    for (var i = 0; i < n; i++) out[i][i] = 1;
    return out;
  };

  /* ------------------------------------------------------------ reductions */
  T.sum = function (A) { return DL.sum(T.toFlat(A)); };
  T.mean = function (A) {
    var f = T.toFlat(A);
    return f.length ? DL.sum(f) / f.length : 0;
  };
  T.maxOf = function (A) { return DL.maxOf(T.toFlat(A)); };
  T.minOf = function (A) { return DL.minOf(T.toFlat(A)); };
  T.argmax = function (A) {
    var f = T.toFlat(A), idx = DL.argmax(f);
    if (T.shape(A).length === 2) {
      var w = A[0].length;
      return [Math.floor(idx / w), idx % w];
    }
    return idx;
  };

  /* ---------------------------------------------------------------- softmax */
  T.softmax = function (v, opts) {
    opts = opts || {};
    var temp = opts.temperature === undefined ? 1 : opts.temperature;
    if (temp <= 0) temp = 1e-6;
    var mask = opts.mask || null;
    var i, n = v.length, m = -Infinity;
    for (i = 0; i < n; i++) {
      if (mask && mask[i]) continue;
      var z = v[i] / temp;
      if (z > m) m = z;
    }
    if (m === -Infinity) return v.map(function () { return 0; });
    var out = new Array(n), s = 0;
    for (i = 0; i < n; i++) {
      if (mask && mask[i]) { out[i] = 0; continue; }
      var e = Math.exp(v[i] / temp - m);
      out[i] = e; s += e;
    }
    if (s > 0) for (i = 0; i < n; i++) out[i] /= s;
    return out;
  };

  T.softmaxRows = function (A, opts) {
    return A.map(function (row) { return T.softmax(row, opts); });
  };

  T.logSoftmax = function (v) {
    var p = T.softmax(v);
    return p.map(function (x) { return Math.log(Math.max(x, 1e-12)); });
  };

  /* ------------------------------------------------------------ convolution */
  T.outSize = function (inSize, k, stride, padding, dilation) {
    stride = stride || 1;
    padding = padding || 0;
    dilation = dilation || 1;
    return Math.floor((inSize + 2 * padding - dilation * (k - 1) - 1) / stride) + 1;
  };

  /* 2-D cross-correlation (what PyTorch calls Conv2d) */
  T.conv2d = function (input, kernel, opts) {
    opts = opts || {};
    var stride = opts.stride || 1;
    var padding = opts.padding || 0;
    var dilation = opts.dilation || 1;
    T.assert2D(input, "input");
    T.assert2D(kernel, "kernel");
    var H = input.length, W = input[0].length;
    var K = kernel.length, KL = kernel[0].length;
    var OH = T.outSize(H, K, stride, padding, dilation);
    var OW = T.outSize(W, KL, stride, padding, dilation);
    if (OH <= 0 || OW <= 0) throw new Error("conv2d: empty output (" + OH + "×" + OW + ")");
    var out = T.zeros(OH, OW);
    for (var oy = 0; oy < OH; oy++) {
      for (var ox = 0; ox < OW; ox++) {
        var acc = 0;
        for (var ky = 0; ky < K; ky++) {
          var iy = oy * stride - padding + ky * dilation;
          if (iy < 0 || iy >= H) continue;
          for (var kx = 0; kx < KL; kx++) {
            var ix = ox * stride - padding + kx * dilation;
            if (ix < 0 || ix >= W) continue;
            acc += input[iy][ix] * kernel[ky][kx];
          }
        }
        out[oy][ox] = acc;
      }
    }
    return out;
  };

  /* CxHxW input, Cout × C × Kh × Kw kernels -> Cout × H' × W' */
  T.conv2dMulti = function (input, kernels, opts) {
    if (!Array.isArray(input) || !Array.isArray(input[0]) || !Array.isArray(input[0][0])) {
      throw new Error("conv2dMulti: input must be C×H×W");
    }
    var Cout = kernels.length;
    var out = new Array(Cout);
    var H = input[0].length, W = input[0][0].length;
    var s = opts && opts.stride || 1, p = opts && opts.padding || 0, dil = opts && opts.dilation || 1;
    var KH = kernels[0][0].length, KW = kernels[0][0][0].length;
    var OH = T.outSize(H, KH, s, p, dil), OW = T.outSize(W, KW, s, p, dil);
    for (var o = 0; o < Cout; o++) {
      var acc = T.zeros(OH, OW);
      for (var c = 0; c < input.length; c++) {
        var m = T.conv2d(input[c], kernels[o][c], opts);
        acc = T.add(acc, m);
      }
      out[o] = acc;
    }
    return out;
  };

  /* Dimitri's "dilate a kernel" view: insert d-1 zeros between taps */
  T.dilateKernel = function (k, d) {
    d = d || 1;
    if (d === 1) return T.copy(k);
    var H = k.length, W = k[0].length;
    var out = T.zeros((H - 1) * d + 1, (W - 1) * d + 1);
    for (var i = 0; i < H; i++) for (var j = 0; j < W; j++) out[i * d][j * d] = k[i][j];
    return out;
  };

  /* ---------------------------------------------------------------- pooling */
  T.pool2d = function (input, opts) {
    opts = opts || {};
    var mode = opts.mode || "max";
    var size = opts.size || 2;
    var stride = opts.stride || size;
    var padding = opts.padding || 0;
    T.assert2D(input, "input");
    var H = input.length, W = input[0].length;
    var OH = T.outSize(H, size, stride, padding, 1);
    var OW = T.outSize(W, size, stride, padding, 1);
    var out = T.zeros(OH, OW);
    for (var oy = 0; oy < OH; oy++) {
      for (var ox = 0; ox < OW; ox++) {
        var acc = mode === "max" ? -Infinity : 0, cnt = 0;
        for (var ky = 0; ky < size; ky++) {
          var iy = oy * stride - padding + ky;
          for (var kx = 0; kx < size; kx++) {
            var ix = ox * stride - padding + kx;
            if (iy < 0 || iy >= H || ix < 0 || ix >= W) continue;
            cnt++;
            if (mode === "max") { if (input[iy][ix] > acc) acc = input[iy][ix]; }
            else acc += input[iy][ix];
          }
        }
        out[oy][ox] = mode === "max" ? (cnt ? acc : 0) : (cnt ? acc / cnt : 0);
      }
    }
    return out;
  };

  T.gap = function (input) {
    // CxHxW -> C  (global average pooling)
    return input.map(function (ch) { return T.mean(ch); });
  };

  /* -------------------------------------------------------------- resampling */
  T.upsampleNearest = function (input, factor) {
    var H = input.length, W = input[0].length;
    var out = T.zeros(H * factor, W * factor);
    for (var y = 0; y < out.length; y++) {
      for (var x = 0; x < out[0].length; x++) {
        out[y][x] = input[Math.floor(y / factor)][Math.floor(x / factor)];
      }
    }
    return out;
  };

  T.upsampleBilinear = function (input, factor) {
    var H = input.length, W = input[0].length;
    var OH = H * factor, OW = W * factor;
    var out = T.zeros(OH, OW);
    for (var y = 0; y < OH; y++) {
      var sy = (y + 0.5) / factor - 0.5;
      sy = Math.max(0, Math.min(H - 1, sy));
      var y0 = Math.floor(sy), y1 = Math.min(H - 1, y0 + 1), fy = sy - y0;
      for (var x = 0; x < OW; x++) {
        var sx = (x + 0.5) / factor - 0.5;
        sx = Math.max(0, Math.min(W - 1, sx));
        var x0 = Math.floor(sx), x1 = Math.min(W - 1, x0 + 1), fx = sx - x0;
        var top = input[y0][x0] * (1 - fx) + input[y0][x1] * fx;
        var bot = input[y1][x0] * (1 - fx) + input[y1][x1] * fx;
        out[y][x] = top * (1 - fy) + bot * fy;
      }
    }
    return out;
  };

  /* transposed conv, stride s, no padding (visual helper) */
  T.convTranspose2d = function (input, kernel, opts) {
    opts = opts || {};
    var stride = opts.stride || 1;
    var padding = opts.padding || 0;
    var outputPadding = opts.outputPadding || 0;
    var H = input.length, W = input[0].length;
    var K = kernel.length;
    var OH = (H - 1) * stride - 2 * padding + K + outputPadding;
    var OW = (W - 1) * stride - 2 * padding + kernel[0].length + outputPadding;
    var out = T.zeros(OH, OW);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var v = input[y][x];
        if (v === 0) continue;
        for (var ky = 0; ky < K; ky++) {
          for (var kx = 0; kx < kernel[0].length; kx++) {
            var oy = y * stride - padding + ky;
            var ox = x * stride - padding + kx;
            if (oy >= 0 && oy < OH && ox >= 0 && ox < OW) out[oy][ox] += v * kernel[ky][kx];
          }
        }
      }
    }
    return out;
  };

  /* -------------------------------------------------------- receptive field */
  T.receptiveField = function (ks, strides, dils) {
    // returns array of {k,s,d,rf,jump} for each layer
    var rf = 1, jump = 1, out = [];
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i], s = (strides && strides[i]) || 1, dd = (dils && dils[i]) || 1;
      rf = rf + (dd * (k - 1)) * jump;
      out.push({ k: k, s: s, d: dd, rf: rf, jump: jump });
      jump *= s;
    }
    return out;
  };

  /* ------------------------------------------------------------- utilities */
  T.argmaxRows = function (A) {
    return A.map(function (row) { return DL.argmax(row); });
  };

  T.clip = function (A, lo, hi) {
    return T.map(A, function (v) { return v < lo ? lo : v > hi ? hi : v; });
  };

  T.normalize = function (A) {
    // map to 0..1 for display
    var mn = T.minOf(A), mx = T.maxOf(A);
    var d = mx - mn;
    if (d === 0) return T.map(A, function () { return 0; });
    return T.map(A, function (v) { return (v - mn) / d; });
  };

  T.eq = function (A, B, tol) {
    tol = tol === undefined ? 1e-9 : tol;
    var fa = T.toFlat(A), fb = T.toFlat(B);
    if (fa.length !== fb.length) return false;
    for (var i = 0; i < fa.length; i++) {
      if (Math.abs(fa[i] - fb[i]) > tol * Math.max(1, Math.abs(fa[i]), Math.abs(fb[i]))) return false;
    }
    return true;
  };

  T.toString = function (A, dg) {
    return JSON.stringify(T.map(A, function (v) {
      return typeof v === "number" ? Number(DL.round(v, dg === undefined ? 2 : dg)) : v;
    }));
  };

  DL.tensor = T;
})(window.DL);
