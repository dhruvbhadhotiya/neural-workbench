/* ==========================================================================
   DeepLearn Lab — nn.js
   Activations, Dense, MLP, losses, optimizers, numerical gradient check,
   parameter counting, 2-D toy datasets.
   Gradients are accumulated; call zeroGrad() before a batch.
   ========================================================================== */
(function (DL) {
  "use strict";

  var T = DL.tensor;
  var NN = {};

  /* ================================================================== *
   * Activations: {name, f(x), df(x, y)}
   * ================================================================== */
  function sig(x) { return 1 / (1 + Math.exp(-x)); }

  var act = {
    linear: {
      name: "Linear", f: function (x) { return x; }, df: function () { return 1; }
    },
    relu: {
      name: "ReLU",
      f: function (x) { return x > 0 ? x : 0; },
      df: function (x) { return x > 0 ? 1 : 0; }
    },
    leakyRelu: {
      name: "LeakyReLU",
      f: function (x) { return x > 0 ? x : 0.01 * x; },
      df: function (x) { return x > 0 ? 1 : 0.01; }
    },
    sigmoid: {
      name: "Sigmoid",
      f: sig,
      df: function (x) { var s = sig(x); return s * (1 - s); }
    },
    tanh: {
      name: "Tanh",
      f: function (x) { return Math.tanh(x); },
      df: function (x) { var t = Math.tanh(x); return 1 - t * t; }
    },
    gelu: {
      name: "GELU (tanh approx)",
      f: function (x) {
        return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
      },
      df: function (x) {
        var c = Math.sqrt(2 / Math.PI);
        var u = c * (x + 0.044715 * x * x * x);
        var t = Math.tanh(u);
        var du = c * (1 + 3 * 0.044715 * x * x);
        return 0.5 * (1 + t) + 0.5 * x * (1 - t * t) * du;
      }
    },
    swish: {
      name: "Swish",
      f: function (x) { return x * sig(x); },
      df: function (x) { var s = sig(x); return s + x * s * (1 - s); }
    },
    softplus: {
      name: "Softplus",
      f: function (x) { return Math.log(1 + Math.exp(x)); },
      df: function (x) { return sig(x); }
    }
  };

  NN.act = act;
  NN.actList = ["linear", "relu", "leakyRelu", "sigmoid", "tanh", "gelu", "swish"];

  function resolveAct(a) {
    if (!a) return act.linear;
    if (typeof a === "string") return act[a] || act.linear;
    return a;
  }

  function setZero(arr) {
    if (!Array.isArray(arr)) return;
    for (var i = 0; i < arr.length; i++) {
      if (Array.isArray(arr[i])) setZero(arr[i]);
      else arr[i] = 0;
    }
  }

  /* ================================================================== *
   * Initialisation
   * ================================================================== */
  var init = {
    zeros: function (rng, fanIn, fanOut) {
      if (fanIn === undefined) return 0;
      return 0;
    },
    uniform: function (rng, fanIn) {
      var b = Math.sqrt(6 / fanIn);
      return DL.uniform(rng, -b, b);
    },
    xavier: function (rng, fanIn, fanOut) {
      var s = Math.sqrt(2 / (fanIn + fanOut));
      return DL.randn(rng) * s;
    },
    he: function (rng, fanIn) {
      return DL.randn(rng) * Math.sqrt(2 / fanIn);
    },
    normal: function (rng, fanIn, fanOut, std) {
      return DL.randn(rng) * (std || 1 / Math.sqrt(fanIn));
    },
    naive: function (rng) { // deliberately unscaled — used by the init lab
      return DL.randn(rng);
    }
  };
  NN.init = init;
  NN.initList = ["xavier", "he", "uniform", "naive", "zeros"];

  function initMatrix(kind, rng, fanIn, fanOut) {
    var fn = init[kind] || init.he;
    var W = T.zeros(fanIn, fanOut);
    for (var i = 0; i < fanIn; i++) {
      for (var j = 0; j < fanOut; j++) W[i][j] = fn(rng, fanIn, fanOut);
    }
    return W;
  }

  /* ================================================================== *
   * Dense
   * ================================================================== */
  NN.Dense = function (inDim, outDim, opts) {
    opts = opts || {};
    var rng = opts.rng || DL.rng(1);
    var actFn = resolveAct(opts.activation);
    var W = initMatrix(opts.init || "he", rng, inDim, outDim);
    var b = T.zeros(outDim);
    var dW = T.zeros(inDim, outDim);
    var db = T.zeros(outDim);
    var lastX = null, lastZ = null;

    var api = {
      inDim: inDim, outDim: outDim, activation: actFn,
      W: W, b: b,

      forward: function (x) {
        if (x.length !== inDim) {
          throw new Error("Dense: expected input of length " + inDim + ", got " + x.length);
        }
        lastX = x;
        var z = new Array(outDim), o, i;
        for (o = 0; o < outDim; o++) {
          var s = b[o];
          for (i = 0; i < inDim; i++) s += x[i] * W[i][o];
          z[o] = s;
        }
        lastZ = z;
        return actFn.f ? z.map(actFn.f) : z;
      },

      /* gradY is dL/d(activation output) */
      backward: function (gradY) {
        var gz = new Array(outDim), o, i;
        if (actFn.df) {
          for (o = 0; o < outDim; o++) gz[o] = gradY[o] * actFn.df(lastZ[o], gradY[o]);
        } else {
          for (o = 0; o < outDim; o++) gz[o] = gradY[o];
        }
        for (o = 0; o < outDim; o++) { db[o] += gz[o]; }
        for (i = 0; i < inDim; i++) {
          var xi = lastX[i];
          if (xi === 0) continue;
          for (o = 0; o < outDim; o++) { dW[i][o] += xi * gz[o]; }
        }
        var gradX = new Array(inDim);
        for (i = 0; i < inDim; i++) {
          var s = 0;
          for (o = 0; o < outDim; o++) s += W[i][o] * gz[o];
          gradX[i] = s;
        }
        return gradX;
      },

      zeroGrad: function () {
        setZero(dW);
        setZero(db);
      },

      params: function () {
        return [
          { v: W, g: dW, name: "W" },
          { v: b, g: db, name: "b" }
        ];
      },

      paramCount: function () { return inDim * outDim + outDim; }
    };
    return api;
  };

  /* ================================================================== *
   * MLP
   * ================================================================== */
  NN.MLP = function (sizes, opts) {
    opts = opts || {};
    if (!sizes || sizes.length < 2) throw new Error("MLP needs at least 2 sizes");
    var hidden = opts.activation || "relu";
    var lossName = opts.loss || "ce";
    var rng = opts.rng || DL.rng(opts.seed === undefined ? 1 : opts.seed);
    var layers = [];
    for (var i = 0; i < sizes.length - 1; i++) {
      var last = i === sizes.length - 2;
      layers.push(NN.Dense(sizes[i], sizes[i + 1], {
        rng: rng,
        init: opts.init || "he",
        activation: last ? (opts.out || "linear") : hidden
      }));
    }

    var lastHs = null;

    var api = {
      sizes: sizes,
      layers: layers,
      lossName: lossName,

      forward: function (x) {
        var a = x, hs = [];
        for (var l = 0; l < layers.length; l++) {
          a = layers[l].forward(a);
          hs.push(a);
        }
        lastHs = hs;
        return { out: a, hs: hs };
      },

      predict: function (x) {
        var o = api.forward(x).out;
        return lossName === "mse" ? o : DL.argmax(o);
      },

      proba: function (x) {
        var o = api.forward(x).out;
        if (lossName === "ce") return T.softmax(o);
        if (lossName === "bce") return o.map(sig);
        return o;
      },

      /* returns {loss, gradOut} and leaves caches for backward() */
      lossAndGrad: function (x, y) {
        var res = api.forward(x);
        var out = res.out;
        var loss, grad;
        var n = out.length, i;

        if (lossName === "ce") {
          var p = T.softmax(out);
          var idx = typeof y === "number" ? y : DL.argmax(y);
          loss = -Math.log(Math.max(p[idx], 1e-12));
          grad = new Array(n);
          for (i = 0; i < n; i++) grad[i] = p[i] - (i === idx ? 1 : 0);
        } else if (lossName === "bce") {
          // out are logits; bce-with-logits
          var t = typeof y === "number" ? y : y[0];
          loss = 0;
          grad = new Array(n);
          for (i = 0; i < n; i++) {
            var z = out[i];
            loss += Math.max(z, 0) - z * t + Math.log(1 + Math.exp(-Math.abs(z)));
            grad[i] = sig(z) - t;
          }
          loss /= n;
          for (i = 0; i < n; i++) grad[i] /= n;
        } else {
          // mse
          var target = Array.isArray(y) ? y : [y];
          loss = 0;
          grad = new Array(n);
          for (i = 0; i < n; i++) {
            var d = out[i] - target[i];
            loss += d * d;
            grad[i] = 2 * d / n;
          }
          loss /= n;
        }
        return { loss: loss, gradOut: grad };
      },

      backward: function (gradOut) {
        var g = gradOut;
        for (var l = layers.length - 1; l >= 0; l--) {
          g = layers[l].backward(g);
        }
        return g;
      },

      zeroGrad: function () {
        for (var l = 0; l < layers.length; l++) layers[l].zeroGrad();
      },

      params: function () {
        var out = [];
        for (var l = 0; l < layers.length; l++) out = out.concat(layers[l].params());
        return out;
      },

      /* one full pass over a batch: accumulate grads, return mean loss */
      fitBatch: function (X, Y) {
        api.zeroGrad();
        var total = 0;
        for (var i = 0; i < X.length; i++) {
          var r = api.lossAndGrad(X[i], Y[i]);
          total += r.loss;
          api.backward(r.gradOut);
        }
        var inv = 1 / X.length;
        var ps = api.params();
        for (var q = 0; q < ps.length; q++) scaleInPlace(ps[q].g, inv);
        return total / X.length;
      },

      /* evaluate mean loss + accuracy on a dataset */
      evaluate: function (X, Y) {
        var loss = 0, correct = 0;
        for (var i = 0; i < X.length; i++) {
          var r = api.lossAndGrad(X[i], Y[i]);
          loss += r.loss;
          if (lossName === "mse") {
            correct += 1;
          } else {
            var pred = DL.argmax(api.forward(X[i]).out);
            if (pred === Y[i]) correct += 1;
          }
        }
        return {
          loss: loss / X.length,
          acc: lossName === "mse" ? 0 : correct / X.length
        };
      },

      countParams: function () {
        var n = 0;
        for (var l = 0; l < layers.length; l++) n += layers[l].paramCount();
        return n;
      },

      lastHs: function () { return lastHs; }
    };
    return api;
  };

  function scaleInPlace(arr, s) {
    if (!Array.isArray(arr)) return;
    for (var i = 0; i < arr.length; i++) {
      if (Array.isArray(arr[i])) scaleInPlace(arr[i], s);
      else arr[i] *= s;
    }
  }

  /* ================================================================== *
   * Losses (standalone)
   * ================================================================== */
  NN.loss = {
    mse: {
      name: "MSE",
      f: function (p, t) {
        var a = Array.isArray(p) ? p : [p], b = Array.isArray(t) ? t : [t], s = 0;
        for (var i = 0; i < a.length; i++) s += (a[i] - b[i]) * (a[i] - b[i]);
        return s / a.length;
      },
      df: function (p, t) {
        var a = Array.isArray(p) ? p : [p], b = Array.isArray(t) ? t : [t];
        var n = a.length;
        return a.map(function (v, i) { return 2 * (v - b[i]) / n; });
      }
    },
    bce: {
      name: "BCE",
      f: function (p, t) {
        var e = 1e-12;
        return -(t * Math.log(Math.max(p, e)) + (1 - t) * Math.log(Math.max(1 - p, e)));
      },
      df: function (p, t) {
        var e = 1e-12;
        return -(t / Math.max(p, e) - (1 - t) / Math.max(1 - p, e));
      }
    },
    ce: {
      name: "Cross-entropy",
      f: function (logits, idx) {
        var p = T.softmax(logits);
        return -Math.log(Math.max(p[idx], 1e-12));
      },
      df: function (logits, idx) {
        var p = T.softmax(logits);
        return p.map(function (v, i) { return v - (i === idx ? 1 : 0); });
      }
    },
    hinge: {
      name: "Hinge",
      f: function (p, t) { return Math.max(0, 1 - t * p); },
      df: function (p, t) { return t * p < 1 ? -t : 0; }
    }
  };
  NN.lossList = ["ce", "mse", "bce"];

  /* ================================================================== *
   * Optimizers
   * ================================================================== */
  function zerosLike(arr) {
    if (!Array.isArray(arr)) return 0;
    var out = new Array(arr.length);
    for (var i = 0; i < arr.length; i++) out[i] = zerosLike(arr[i]);
    return out;
  }

  /* Walk v and g together (same nested shape) and mutate v[i] through fn.
     fn(V, i, grad, momBuf, velBuf) where momBuf/velBuf have the same shape. */
  function walkInPlace(v, g, a, b, fn) {
    if (!Array.isArray(v)) return;
    for (var i = 0; i < v.length; i++) {
      if (Array.isArray(v[i])) walkInPlace(v[i], g[i], a[i], b[i], fn);
      else fn(v, i, g[i], a, b);
    }
  }

  function makeOpt(name, lr, update) {
    var t = 0;
    var state = [];
    function ensure(params) {
      while (state.length < params.length) {
        var p = params[state.length];
        state.push({ m: zerosLike(p.v), v: zerosLike(p.v) });
      }
    }
    var api = {
      name: name,
      lr: lr,
      cfg: { lr: lr },
      reset: function () { t = 0; state = []; },
      step: function (params) {
        ensure(params);
        t += 1;
        for (var i = 0; i < params.length; i++) {
          var p = params[i];
          if (!p.g) continue;
          update(p.v, p.g, state[i].m, state[i].v, t, lr);
        }
        return t;
      }
    };
    Object.defineProperty(api, "t", { get: function () { return t; } });
    Object.defineProperty(api, "bias1", { value: 0.9, writable: true });
    return api;
  }

  NN.opt = {
    SGD: function (o) {
      o = o || {};
      var lr = o.lr === undefined ? 0.1 : o.lr;
      var mom = o.momentum || 0;
      return makeOpt("SGD" + (mom ? " + momentum" : ""), lr, function (v, g, m, s, t, lr) {
        walkInPlace(v, g, m, s, function (V, i, gv, mb) {
          var d = gv;
          if (mom > 0) { mb[i] = mom * mb[i] + gv; d = mb[i]; }
          V[i] -= lr * d;
        });
      });
    },

    Momentum: function (o) {
      o = o || {};
      var lr = o.lr === undefined ? 0.01 : o.lr;
      var beta = o.momentum === undefined ? 0.9 : o.momentum;
      return makeOpt("Momentum", lr, function (v, g, m, s, t, lr) {
        walkInPlace(v, g, m, s, function (V, i, gv, mb) {
          mb[i] = beta * mb[i] + gv;
          V[i] -= lr * mb[i];
        });
      });
    },

    RMSProp: function (o) {
      o = o || {};
      var lr = o.lr === undefined ? 0.001 : o.lr;
      var rho = o.rho === undefined ? 0.9 : o.rho;
      var eps = o.eps || 1e-8;
      return makeOpt("RMSProp", lr, function (v, g, m, s, t, lr) {
        walkInPlace(v, g, m, s, function (V, i, gv, mb, sb) {
          sb[i] = rho * sb[i] + (1 - rho) * gv * gv;
          V[i] -= lr * gv / (Math.sqrt(sb[i]) + eps);
        });
      });
    },

    Adam: function (o) {
      o = o || {};
      var lr = o.lr === undefined ? 0.001 : o.lr;
      var b1 = o.b1 === undefined ? 0.9 : o.b1;
      var b2 = o.b2 === undefined ? 0.999 : o.b2;
      var eps = o.eps || 1e-8;
      return makeOpt("Adam", lr, function (v, g, m, s, t, lr) {
        walkInPlace(v, g, m, s, function (V, i, gv, mb, sb) {
          mb[i] = b1 * mb[i] + (1 - b1) * gv;
          sb[i] = b2 * sb[i] + (1 - b2) * gv * gv;
          var mh = mb[i] / (1 - Math.pow(b1, t));
          var vh = sb[i] / (1 - Math.pow(b2, t));
          V[i] -= lr * mh / (Math.sqrt(vh) + eps);
        });
      });
    },

    AdamW: function (o) {
      o = o || {};
      var lr = o.lr === undefined ? 0.001 : o.lr;
      var b1 = o.b1 === undefined ? 0.9 : o.b1;
      var b2 = o.b2 === undefined ? 0.999 : o.b2;
      var eps = o.eps || 1e-8;
      var wd = o.weightDecay === undefined ? 0.01 : o.weightDecay;
      return makeOpt("AdamW", lr, function (v, g, m, s, t, lr) {
        walkInPlace(v, g, m, s, function (V, i, gv, mb, sb) {
          mb[i] = b1 * mb[i] + (1 - b1) * gv;
          sb[i] = b2 * sb[i] + (1 - b2) * gv * gv;
          var mh = mb[i] / (1 - Math.pow(b1, t));
          var vh = sb[i] / (1 - Math.pow(b2, t));
          var update = mh / (Math.sqrt(vh) + eps);
          V[i] -= lr * (update + wd * V[i]);
        });
      });
    },

    Nadam: function (o) {
      o = o || {};
      var lr = o.lr === undefined ? 0.002 : o.lr;
      var b1 = o.b1 === undefined ? 0.9 : o.b1;
      var b2 = o.b2 === undefined ? 0.999 : o.b2;
      var eps = o.eps || 1e-8;
      return makeOpt("Nadam", lr, function (v, g, m, s, t, lr) {
        walkInPlace(v, g, m, s, function (V, i, gv, mb, sb) {
          mb[i] = b1 * mb[i] + (1 - b1) * gv;
          sb[i] = b2 * sb[i] + (1 - b2) * gv * gv;
          var mh = mb[i] / (1 - Math.pow(b1, t));
          var vh = sb[i] / (1 - Math.pow(b2, t));
          var mNest = b1 * mh + (1 - b1) * gv / (1 - Math.pow(b1, t));
          V[i] -= lr * mNest / (Math.sqrt(vh) + eps);
        });
      });
    }
  };

  /* ================================================================== *
   * Numerical gradient check
   * ================================================================== */
  NN.gradCheck = function (fn, params, opts) {
    opts = opts || {};
    var eps = opts.eps || 1e-5;
    var zero = opts.zeroGrad || function () {};
    zero();
    var loss0 = fn();
    var analytic = [], numeric = [];
    for (var p = 0; p < params.length; p++) {
      var g = params[p].g;
      collectLeaves(g, analytic);
    }
    var count = 0;
    for (var q = 0; q < params.length; q++) {
      var v = params[q].v;
      perturb(v, function (leaf) {
        var orig = leaf.get();
        leaf.set(orig + eps);
        var lp = fn();
        leaf.set(orig - eps);
        var lm = fn();
        leaf.set(orig);
        numeric.push((lp - lm) / (2 * eps));
        count++;
      });
    }
    var maxRel = 0;
    for (var i = 0; i < analytic.length; i++) {
      var a = analytic[i], n = numeric[i];
      var rel = Math.abs(a - n) / Math.max(1e-8, Math.abs(a) + Math.abs(n));
      if (rel > maxRel) maxRel = rel;
    }
    return {
      analytic: analytic,
      numeric: numeric,
      loss: loss0,
      maxRelError: maxRel,
      pass: maxRel < (opts.tol || 1e-5)
    };
  };

  function collectLeaves(arr, out) {
    if (!Array.isArray(arr)) { out.push(arr); return; }
    for (var i = 0; i < arr.length; i++) collectLeaves(arr[i], out);
  }
  function perturb(arr, fn) {
    if (!Array.isArray(arr)) return fn(arr);
    for (var i = 0; i < arr.length; i++) {
      if (Array.isArray(arr[i])) perturb(arr[i], fn);
      else {
        (function (a, idx) {
          fn({ get: function () { return a[idx]; }, set: function (x) { a[idx] = x; } });
        })(arr, i);
      }
    }
  }

  /* ================================================================== *
   * Parameter counting
   * ================================================================== */
  NN.convParams = function (cin, cout, k, bias) {
    bias = bias === undefined ? true : bias;
    return k * k * cin * cout + (bias ? cout : 0);
  };
  NN.fcParams = function (inDim, outDim, bias) {
    bias = bias === undefined ? true : bias;
    return inDim * outDim + (bias ? outDim : 0);
  };
  NN.countParams = function (layers) {
    var total = 0;
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];
      if (L.type === "conv") total += NN.convParams(L.cin, L.cout, L.k, L.bias);
      else if (L.type === "dwconv") total += NN.convParams(L.cin, L.cin, L.k, L.bias) + L.cin; // depthwise + pointwise handled separately
      else if (L.type === "fc") total += NN.fcParams(L["in"], L.out, L.bias);
      else if (L.type === "bn") total += 2 * L.c;
      else if (L.type === "embedding") total += L.vocab * L.dim;
      else if (L.type === "lstm") total += 4 * (L["in"] * L.h + L.h * L.h + L.h);
      else if (L.type === "gru") total += 3 * (L["in"] * L.h + L.h * L.h + L.h);
      else if (L.type === "param") total += L.n;
    }
    return total;
  };
  NN.formatCount = function (n) {
    var s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    var short = n >= 1e6 ? (n / 1e6).toFixed(2) + "M"
      : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n);
    return s + " (" + short + ")";
  };

  /* ================================================================== *
   * 2-D toy datasets
   * ================================================================== */
  var datasets = {
    blobs: function (n, rng, opts) {
      opts = opts || {};
      var out = { X: [], y: [], name: "Two blobs", classes: 2 };
      var cx = [[-1.2, -0.9], [1.2, 0.9]];
      for (var i = 0; i < n; i++) {
        var c = i % 2;
        out.X.push([cx[c][0] + DL.randn(rng) * 0.55, cx[c][1] + DL.randn(rng) * 0.55]);
        out.y.push(c);
      }
      return out;
    },
    moons: function (n, rng) {
      var out = { X: [], y: [], name: "Two moons", classes: 2 };
      for (var i = 0; i < n; i++) {
        var c = i % 2, t = rng() * Math.PI;
        if (c === 0) out.X.push([Math.cos(t) * 1.15 - 0.4, Math.sin(t) * 1.15 - 0.35]);
        else out.X.push([Math.cos(t + Math.PI) * 1.15 + 0.4, Math.sin(t + Math.PI) * 1.15 + 0.35]);
        out.y.push(c);
      }
      return out;
    },
    spiral: function (n, rng) {
      var out = { X: [], y: [], name: "Spiral", classes: 3 };
      var per = Math.max(1, Math.floor(n / 3));
      for (var c = 0; c < 3; c++) {
        for (var i = 0; i < per; i++) {
          var r = 0.15 + 1.15 * (i / per);
          var a = c * 2 * Math.PI / 3 + r * 2.6 + DL.randn(rng) * 0.04;
          out.X.push([r * Math.cos(a) + DL.randn(rng) * 0.05, r * Math.sin(a) + DL.randn(rng) * 0.05]);
          out.y.push(c);
        }
      }
      return out;
    },
    xor: function (n, rng) {
      var out = { X: [], y: [], name: "XOR", classes: 2 };
      for (var i = 0; i < n; i++) {
        var x = rng() * 2 - 1, y = rng() * 2 - 1;
        out.X.push([x, y]);
        out.y.push((x > 0) !== (y > 0) ? 1 : 0);
      }
      return out;
    },
    circles: function (n, rng) {
      var out = { X: [], y: [], name: "Circles", classes: 2 };
      for (var i = 0; i < n; i++) {
        var c = i % 2, a = rng() * Math.PI * 2;
        var r = c === 0 ? 0.42 + DL.randn(rng) * 0.06 : 1.0 + DL.randn(rng) * 0.06;
        out.X.push([r * Math.cos(a), r * Math.sin(a)]);
        out.y.push(c);
      }
      return out;
    }
  };
  NN.datasets = datasets;
  NN.datasetList = ["blobs", "moons", "spiral", "xor", "circles"];

  /* ================================================================== *
   * Grid prediction for decision surfaces
   * ================================================================== */
  NN.gridPredict = function (model, rect, res) {
    // rect = {xmin,xmax,ymin,ymax}; returns {values: res×res of class prob / value,
    //                                          classes: res×res of argmax}
    var out = { values: [], classes: [] };
    var xmin = rect.xmin, xmax = rect.xmax, ymin = rect.ymin, ymax = rect.ymax;
    for (var j = 0; j < res; j++) {
      var rowV = [], rowC = [];
      var y = ymax - (j + 0.5) * (ymax - ymin) / res;
      for (var i = 0; i < res; i++) {
        var x = xmin + (i + 0.5) * (xmax - xmin) / res;
        var o = model.forward([x, y]).out;
        if (o.length === 1) {
          rowV.push(sig(o[0])); rowC.push(o[0] > 0 ? 1 : 0);
        } else if (model.lossName === "mse") {
          rowV.push(o[0]); rowC.push(0);
        } else {
          var p = T.softmax(o);
          rowV.push(p[1] === undefined ? p[0] : p[1]);
          rowC.push(DL.argmax(o));
        }
      }
      out.values.push(rowV);
      out.classes.push(rowC);
    }
    return out;
  };

  /* ================================================================== *
   * Misc helpers used by several widgets
   * ================================================================== */
  NN.sigmoid = sig;
  NN.softmax = function (v, opts) { return T.softmax(v, opts); };
  NN.oneHot = function (idx, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(i === idx ? 1 : 0);
    return out;
  };

  // simple parameter-count helper for arbitrary layer lists (convenience)
  NN.paramTable = function (layers) {
    var rows = [], total = 0;
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i], n = 0, kind = L.type;
      if (kind === "conv") n = NN.convParams(L.cin, L.cout, L.k, L.bias);
      else if (kind === "fc") n = NN.fcParams(L["in"], L.out, L.bias);
      else if (kind === "bn") n = 2 * L.c;
      total += n;
      rows.push({ layer: L.name || (kind + " " + i), params: n });
    }
    return { rows: rows, total: total };
  };

  DL.nn = NN;
})(window.DL);
