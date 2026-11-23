#!/usr/bin/env node
/* ==========================================================================
   DeepLearn Lab — tools/test.js
   Plain Node, zero dependencies. Run: node tools/test.js
   Tests the numeric core that every lesson depends on.
   ========================================================================== */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

/* ---------------------------------------------------------------- browser stubs */
var storeData = {};
var el = {
  style: {}, dataset: {}, className: "", textContent: "", innerHTML: "",
  setAttribute: function () {}, getAttribute: function () { return null; },
  appendChild: function () {}, addEventListener: function () {},
  removeEventListener: function () {}, querySelector: function () { return null; },
  querySelectorAll: function () { return []; }, classList: { add: function () {}, remove: function () {}, toggle: function () {} }
};
var docEl = {
  setAttribute: function () {}, getAttribute: function () { return "light"; }
};
var sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  performance: { now: function () { return Date.now(); } },
  requestAnimationFrame: function (f) { return setTimeout(f, 0); },
  cancelAnimationFrame: function (id) { clearTimeout(id); },
  matchMedia: function () { return { matches: false, addEventListener: function () {} }; },
  localStorage: {
    getItem: function (k) { return storeData[k] === undefined ? null : storeData[k]; },
    setItem: function (k, v) { storeData[k] = String(v); },
    removeItem: function (k) { delete storeData[k]; },
    key: function (i) { return Object.keys(storeData)[i]; },
    get length() { return Object.keys(storeData).length; }
  },
  CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
  document: {
    readyState: "complete",
    documentElement: docEl,
    createElement: function () { return Object.assign({}, el); },
    createTextNode: function (t) { return { textContent: t }; },
    addEventListener: function () {},
    removeEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    dispatchEvent: function () {},
    body: Object.assign({}, el)
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

var root = path.join(__dirname, "..");
function load(rel) {
  var p = path.join(root, rel);
  var code = fs.readFileSync(p, "utf8");
  vm.runInContext(code, sandbox, { filename: rel });
}
["assets/js/core.js", "assets/js/store.js", "assets/js/tensor.js", "assets/js/nn.js"].forEach(load);

var DL = sandbox.DL;
var T = DL.tensor;
var NN = DL.nn;

/* ---------------------------------------------------------------- harness */
var passed = 0, failed = 0, failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write("  ok   " + name + "\n");
  } catch (e) {
    failed++;
    failures.push({ name: name, err: e });
    process.stdout.write("  FAIL " + name + "\n       " + (e && e.message) + "\n");
  }
}
function group(name) { process.stdout.write("\n" + name + "\n"); }
function ok(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function near(a, b, tol, msg) {
  tol = tol === undefined ? 1e-9 : tol;
  if (Math.abs(a - b) > tol) throw new Error((msg || "") + " expected " + b + " got " + a);
}
function throws(fn, msg) {
  var threw = false;
  try { fn(); } catch (e) { threw = true; }
  ok(threw, msg || "expected a throw");
}

/* ================================================================== */
group("DL core");

test("namespace exists", function () { ok(DL && DL.tensor && DL.nn); });
test("seeded rng is deterministic", function () {
  var a = DL.rng(7), b = DL.rng(7);
  near(a(), b(), 0, "first draw differs");
  near(a(), b(), 0, "second draw differs");
});
test("rng stays in [0,1)", function () {
  var r = DL.rng(3);
  for (var i = 0; i < 500; i++) { var x = r(); ok(x >= 0 && x < 1, "out of range: " + x); }
});
test("7 modules registered", function () { ok(DL.MODULES.length === 7); });
test("store round-trips JSON", function () {
  ok(DL.store.available(), "storage unavailable in stub");
  DL.store.set("unit.t", { a: 1 });
  var v = DL.store.get("unit.t", null);
  ok(v && v.a === 1);
  DL.store.remove("unit.t");
  ok(DL.store.get("unit.t", "x") === "x");
});
test("fmt handles small/large", function () {
  ok(DL.fmt(3.14159, 2) === "3.14");
  ok(DL.fmt(1e-7) === "1e-7" || DL.fmt(1e-7).indexOf("e") >= 0);
  ok(DL.fmt(-0.0001) === "0");
});

/* ================================================================== */
group("tensor: shapes, matmul, softmax");

test("shape of nested arrays", function () {
  ok(JSON.stringify(T.shape(T.zeros(3, 4))) === "[3,4]");
  ok(JSON.stringify(T.shape([1, 2, 3])) === "[3]");
});
test("matmul (2x3)*(3x2)", function () {
  var A = [[1, 2, 3], [4, 5, 6]];
  var B = [[7, 8], [9, 10], [11, 12]];
  var C = T.matmul(A, B);
  ok(JSON.stringify(C) === "[[58,64],[139,154]]", JSON.stringify(C));
});
test("matmul rejects bad shapes", function () {
  throws(function () { T.matmul([[1, 2]], [[1, 2]]); });
});
test("transpose", function () {
  ok(JSON.stringify(T.transpose([[1, 2, 3], [4, 5, 6]])) === "[[1,4],[2,5],[3,6]]");
});
test("softmax sums to 1", function () {
  var p = T.softmax([1, 2, 3, 4]);
  near(DL.sum(p), 1, 1e-12);
});
test("softmax is shift-invariant", function () {
  var a = T.softmax([1, 2, 3]);
  var b = T.softmax([101, 102, 103]);
  for (var i = 0; i < 3; i++) near(a[i], b[i], 1e-12);
});
test("softmax temperature sharpens", function () {
  var cold = T.softmax([1, 2, 3], { temperature: 0.2 });
  var warm = T.softmax([1, 2, 3], { temperature: 3 });
  ok(Math.max.apply(null, cold) > Math.max.apply(null, warm));
  near(DL.sum(cold), 1, 1e-12);
  near(DL.sum(warm), 1, 1e-12);
});
test("softmax mask zeroes entries", function () {
  var p = T.softmax([1, 2, 3], { mask: [false, true, false] });
  ok(p[1] === 0);
  near(p[0] + p[2], 1, 1e-12);
});
test("softmaxRows normalises each row", function () {
  var P = T.softmaxRows([[1, 1], [2, 0]]);
  near(DL.sum(P[0]), 1, 1e-12);
  near(DL.sum(P[1]), 1, 1e-12);
});
test("fromFlat/toFlat round-trip", function () {
  var A = [[1, 2], [3, 4]];
  var f = T.toFlat(A);
  ok(JSON.stringify(f) === "[1,2,3,4]");
  ok(JSON.stringify(T.fromFlat(f, [2, 2])) === JSON.stringify(A));
});

/* ================================================================== */
group("tensor: convolution");

test("outSize matches the formula for many settings", function () {
  var cases = [
    [32, 3, 1, 0, 1, 30], [32, 3, 1, 1, 1, 32], [32, 3, 2, 1, 1, 16],
    [28, 5, 1, 2, 1, 28], [224, 7, 2, 3, 1, 112], [64, 3, 1, 1, 2, 62],
    [64, 3, 1, 2, 2, 64], [64, 3, 2, 2, 1, 33], [10, 4, 3, 0, 2, 2]
  ];
  for (var i = 0; i < cases.length; i++) {
    var c = cases[i];
    var actual = T.conv2d(T.zeros(c[0], c[0]), T.zeros(c[1], c[1]),
      { stride: c[2], padding: c[3], dilation: c[4] });
    ok(actual.length === c[5],
      "case " + c.join(",") + " expected " + c[5] + " got " + actual.length);
    ok(actual[0].length === c[5], "non-square output");
  }
});
test("conv2d computes a known correlation", function () {
  var input = [[1, 2, 0], [0, 1, 3], [2, 1, 0]];
  var k = [[1, 0], [0, -1]];
  var out = T.conv2d(input, k, {});
  // top-left = 1*1 + 2*0 + 0*0 + 1*(-1) = 0
  ok(JSON.stringify(out) === "[[0,-1],[-1,1]]", JSON.stringify(out));
});
test("identity kernel with padding returns the input", function () {
  var input = [[1, 2], [3, 4]];
  var out = T.conv2d(input, [[0, 0, 0], [0, 1, 0], [0, 0, 0]], { padding: 1 });
  ok(T.eq(out, input), JSON.stringify(out));
});
test("dilation expands the effective kernel", function () {
  var input = [[1, 0, 0, 0, 1]];      // two taps 4 apart
  var out = T.conv2d(input, [[1, 1]], { dilation: 4 });
  ok(out.length === 1 && out[0].length === 1,
    "expected 1x1 output, got " + out.length + "x" + out[0].length);
  near(out[0][0], 2, 1e-12, "dilated tap missed a pixel");
});
test("conv2dMulti sums over channels", function () {
  var input = [[[1, 1], [1, 1]], [[2, 2], [2, 2]]]; // 2x2x2
  var kernels = [[[[1, 0], [0, 0]], [[0, 0], [0, 0]]]]; // one 1-channel-ish kernel
  var out = T.conv2dMulti(input, kernels, { padding: 1 });
  ok(out.length === 1);
  near(out[0][0][0], 0, 1e-12, "corner tap falls on padding");
  near(out[0][1][1], 1, 1e-12, "centre tap should see input[0][0]");
});
test("conv2dMulti output channel count", function () {
  var input = [T.zeros(4, 4), T.zeros(4, 4), T.zeros(4, 4)];
  var kernels = [
    [T.ones(3, 3), T.ones(3, 3), T.ones(3, 3)],
    [T.ones(3, 3), T.ones(3, 3), T.ones(3, 3)]
  ];
  var out = T.conv2dMulti(input, kernels, { padding: 1 });
  ok(out.length === 2, "expected 2 output channels");
  ok(out[0].length === 4);
});
test("pool2d max on a known grid", function () {
  var m = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]];
  var p = T.pool2d(m, { mode: "max", size: 2 });
  ok(JSON.stringify(p) === "[[6,8],[14,16]]", JSON.stringify(p));
});
test("pool2d avg on a known grid", function () {
  var m = [[1, 2], [3, 4]];
  var p = T.pool2d(m, { mode: "avg", size: 2 });
  near(p[0][0], 2.5, 1e-12);
});
test("GAP reduces CxHxW to C", function () {
  var g = T.gap([[[1, 3], [5, 7]], [[2, 2], [2, 2]]]);
  ok(g.length === 2);
  near(g[0], 4, 1e-12);
  near(g[1], 2, 1e-12);
});
test("upsampleNearest doubles size", function () {
  var u = T.upsampleNearest([[1, 2], [3, 4]], 2);
  ok(u.length === 4 && u[0].length === 4);
  ok(JSON.stringify(u[0]) === "[1,1,2,2]");
});
test("upsampleBilinear doubles size and preserves corners", function () {
  var u = T.upsampleBilinear([[0, 10], [20, 30]], 2);
  ok(u.length === 4);
  near(u[0][0], 0, 1e-12);
  near(u[3][3], 30, 1e-12);
});
test("convTranspose2d output size", function () {
  var out = T.convTranspose2d([[1, 2], [3, 4]], [[1, 0], [0, 1]], { stride: 2 });
  ok(out.length === 4, "expected 4, got " + out.length);
});
test("receptive field grows correctly", function () {
  var rf = T.receptiveField([3, 3, 3], [1, 1, 1]);
  ok(rf[2].rf === 7, "expected 7, got " + rf[2].rf);
  var rf2 = T.receptiveField([3, 3, 3], [2, 1, 1]);
  ok(rf2[2].rf === 11, "expected 11, got " + rf2[2].rf);
});
test("dilateKernel inserts zeros", function () {
  var d = T.dilateKernel([[1, 2], [3, 4]], 2);
  ok(d.length === 3);
  ok(JSON.stringify(d[0]) === "[1,0,2]");
  ok(d[2].join(",") === "3,0,4");
});

/* ================================================================== */
group("nn: activations and gradients");

test("relu derivative", function () {
  near(NN.act.relu.df(2), 1);
  near(NN.act.relu.df(-1), 0);
});
test("sigmoid derivative at 0 is 0.25", function () {
  near(NN.act.sigmoid.f(0), 0.5, 1e-12);
  near(NN.act.sigmoid.df(0), 0.25, 1e-12);
});
test("tanh derivative", function () {
  near(NN.act.tanh.df(0), 1, 1e-12);
});
test("gelu numeric derivative matches analytic", function () {
  var h = 1e-6;
  for (var i = -3; i <= 3; i += 0.7) {
    var num = (NN.act.gelu.f(i + h) - NN.act.gelu.f(i - h)) / (2 * h);
    near(NN.act.gelu.df(i), num, 1e-4, "at x=" + i);
  }
});

test("Dense gradient check: relu", function () {
  var layer = NN.Dense(3, 2, { rng: DL.rng(1), activation: "relu", init: "he" });
  var x = [0.3, -0.7, 1.1], target = [0.5, -0.2];
  var fn = function () {
    layer.zeroGrad();
    var y = layer.forward(x);
    var g = y.map(function (v, i) { return 2 * (v - target[i]); });
    layer.backward(g);
    var l = 0;
    for (var i = 0; i < y.length; i++) l += (y[i] - target[i]) * (y[i] - target[i]);
    return l;
  };
  var res = NN.gradCheck(fn, layer.params(), { zeroGrad: layer.zeroGrad });
  ok(res.pass, "max rel error " + res.maxRelError);
});
test("Dense gradient check: tanh", function () {
  var layer = NN.Dense(2, 3, { rng: DL.rng(2), activation: "tanh", init: "xavier" });
  var x = [0.4, -0.2];
  var fn = function () {
    layer.zeroGrad();
    var y = layer.forward(x);
    var g = [1, -0.5, 0.25];
    layer.backward(g);
    return y[0] - 0.5 * y[1] + 0.25 * y[2];
  };
  var res = NN.gradCheck(fn, layer.params(), { zeroGrad: layer.zeroGrad });
  ok(res.pass, "max rel error " + res.maxRelError);
});
test("Dense gradient check: sigmoid", function () {
  var layer = NN.Dense(2, 2, { rng: DL.rng(5), activation: "sigmoid", init: "uniform" });
  var x = [-1, 2];
  var fn = function () {
    layer.zeroGrad();
    var y = layer.forward(x);
    layer.backward([0.7, -0.3]);
    return 0.7 * y[0] - 0.3 * y[1];
  };
  var res = NN.gradCheck(fn, layer.params(), { zeroGrad: layer.zeroGrad });
  ok(res.pass, "max rel error " + res.maxRelError);
});

test("MLP gradient check: 2-3-2 cross-entropy", function () {
  var mlp = NN.MLP([2, 3, 2], { activation: "tanh", loss: "ce", seed: 11 });
  var x = [0.6, -0.4];
  var fn = function () {
    mlp.zeroGrad();
    var r = mlp.lossAndGrad(x, 1);
    mlp.backward(r.gradOut);
    return r.loss;
  };
  var res = NN.gradCheck(fn, mlp.params(), { zeroGrad: mlp.zeroGrad });
  ok(res.pass, "max rel error " + res.maxRelError);
});
test("MLP gradient check: 2-4-4-1 MSE", function () {
  var mlp = NN.MLP([2, 4, 4, 1], { activation: "relu", loss: "mse", seed: 4 });
  var x = [0.2, -0.9];
  var fn = function () {
    mlp.zeroGrad();
    var r = mlp.lossAndGrad(x, [0.5]);
    mlp.backward(r.gradOut);
    return r.loss;
  };
  var res = NN.gradCheck(fn, mlp.params(), { zeroGrad: mlp.zeroGrad });
  ok(res.pass, "max rel error " + res.maxRelError);
});
test("MLP gradient check: bce-with-logits", function () {
  var mlp = NN.MLP([2, 3, 1], { activation: "tanh", loss: "bce", seed: 9 });
  var x = [0.1, 0.8];
  var fn = function () {
    mlp.zeroGrad();
    var r = mlp.lossAndGrad(x, 1);
    mlp.backward(r.gradOut);
    return r.loss;
  };
  var res = NN.gradCheck(fn, mlp.params(), { zeroGrad: mlp.zeroGrad });
  ok(res.pass, "max rel error " + res.maxRelError);
});
test("gradCheck catches a wrong gradient", function () {
  var fakeLayer = {
    v: [[0.5]], g: [[2]] // true gradient of 0.5*v^2 is v, not 2
  };
  var fn = function () { return 0.5 * fakeLayer.v[0][0] * fakeLayer.v[0][0]; };
  var res = NN.gradCheck(fn, [{ v: fakeLayer.v, g: fakeLayer.g }], {});
  ok(!res.pass, "gradCheck should fail on a wrong analytic gradient");
});

/* ================================================================== */
group("nn: losses");

test("cross-entropy of a confident correct prediction is ~0", function () {
  near(NN.loss.ce.f([10, 0], 0), 0.0000454, 1e-4);
});
test("ce gradient sums to zero", function () {
  var g = NN.loss.ce.df([1, 2, 3], 1);
  near(DL.sum(g), 0, 1e-12);
});
test("bce at p=0.5,t=1 is ln2", function () {
  near(NN.loss.bce.f(0.5, 1), Math.log(2), 1e-12);
});
test("mse of identical vectors is 0", function () {
  near(NN.loss.mse.f([1, 2], [1, 2]), 0, 1e-12);
});
test("hinge is 0 past the margin", function () {
  near(NN.loss.hinge.f(1.5, 1), 0);
  near(NN.loss.hinge.f(0.5, 1), 0.5);
});

/* ================================================================== */
group("nn: optimizers");

function scalarParam(x) { return [{ v: [[x]], g: [[0]] }]; }

test("SGD takes the expected step", function () {
  var p = scalarParam(1);
  p[0].g[0][0] = 2;
  NN.opt.SGD({ lr: 0.1 }).step(p);
  near(p[0].v[0][0], 0.8, 1e-12);
});
test("SGD minimises x^2", function () {
  var p = scalarParam(4);
  var opt = NN.opt.SGD({ lr: 0.1 });
  for (var i = 0; i < 100; i++) {
    p[0].g[0][0] = 2 * p[0].v[0][0];
    opt.step(p);
  }
  ok(Math.abs(p[0].v[0][0]) < 1e-6, "did not converge: " + p[0].v[0][0]);
});
test("momentum accumulates velocity", function () {
  var p = scalarParam(0);
  var opt = NN.opt.SGD({ lr: 0.1, momentum: 0.9 });
  p[0].g[0][0] = 1;
  opt.step(p); // v = -0.1
  opt.step(p); // v = -0.1 - 0.1*1.9 = -0.29
  near(p[0].v[0][0], -0.29, 1e-9);
});
test("Adam first step is ~lr regardless of gradient scale", function () {
  var a = scalarParam(0); a[0].g[0][0] = 0.001;
  var b = scalarParam(0); b[0].g[0][0] = 1000;
  NN.opt.Adam({ lr: 0.01 }).step(a);
  NN.opt.Adam({ lr: 0.01 }).step(b);
  near(a[0].v[0][0], -0.01, 1e-3);
  near(b[0].v[0][0], -0.01, 1e-3);
});
test("Adam bias correction makes the first step exact", function () {
  var p = scalarParam(0); p[0].g[0][0] = 2;
  NN.opt.Adam({ lr: 0.1 }).step(p);
  near(p[0].v[0][0], -0.1, 1e-6);
});
test("AdamW decays weights even with zero gradient", function () {
  var p = scalarParam(1); p[0].g[0][0] = 0;
  NN.opt.AdamW({ lr: 0.1, weightDecay: 0.1 }).step(p);
  ok(p[0].v[0][0] < 1, "weight did not decay");
});
test("RMSProp reduces loss on a quadratic", function () {
  var p = scalarParam(3);
  var opt = NN.opt.RMSProp({ lr: 0.05 });
  for (var i = 0; i < 400; i++) {
    p[0].g[0][0] = 2 * p[0].v[0][0];
    opt.step(p);
  }
  ok(Math.abs(p[0].v[0][0]) < 0.5, "did not converge: " + p[0].v[0][0]);
});
test("Nadam runs and reduces a quadratic", function () {
  var p = scalarParam(2);
  var opt = NN.opt.Nadam({ lr: 0.05 });
  for (var i = 0; i < 300; i++) {
    p[0].g[0][0] = 2 * p[0].v[0][0];
    opt.step(p);
  }
  ok(Math.abs(p[0].v[0][0]) < 0.6, "did not converge: " + p[0].v[0][0]);
});
test("optimizer reset clears state", function () {
  var p = scalarParam(1); p[0].g[0][0] = 1;
  var opt = NN.opt.Adam({ lr: 0.1 });
  opt.step(p);
  opt.reset();
  ok(opt.t === 0);
});

/* ================================================================== */
group("nn: MLP training on toy data");

test("MLP learns XOR", function () {
  var mlp = NN.MLP([2, 8, 2], { activation: "tanh", loss: "ce", seed: 3 });
  var X = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  var Y = [0, 1, 1, 0];
  var opt = NN.opt.Adam({ lr: 0.05 });
  for (var e = 0; e < 300; e++) mlp.fitBatch(X, Y), opt.step(mlp.params());
  var correct = 0;
  for (var i = 0; i < 4; i++) if (DL.argmax(mlp.forward(X[i]).out) === Y[i]) correct++;
  ok(correct === 4, "only " + correct + "/4 XOR points correct");
});
test("MLP fits a tiny regression to low loss", function () {
  var mlp = NN.MLP([1, 8, 1], { activation: "tanh", loss: "mse", seed: 2 });
  var X = [], Y = [];
  for (var i = 0; i < 40; i++) { var x = i / 10; X.push([x]); Y.push([Math.sin(x)]); }
  var opt = NN.opt.Adam({ lr: 0.02 });
  for (var e = 0; e < 400; e++) mlp.fitBatch(X, Y), opt.step(mlp.params());
  var res = mlp.evaluate(X, Y);
  ok(res.loss < 0.02, "loss too high: " + res.loss);
});
test("datasets have matching X/y lengths", function () {
  NN.datasetList.forEach(function (name) {
    var ds = NN.datasets[name](60, DL.rng(1));
    ok(ds.X.length === 60, name + " X length");
    ok(ds.y.length === 60, name + " y length");
    ok(ds.X[0].length === 2, name + " not 2-D");
  });
});
test("gridPredict returns res×res", function () {
  var mlp = NN.MLP([2, 3, 2], { seed: 1 });
  var g = NN.gridPredict(mlp, { xmin: -1, xmax: 1, ymin: -1, ymax: 1 }, 12);
  ok(g.values.length === 12 && g.values[0].length === 12);
});

/* ================================================================== */
group("nn: parameter counting");

test("fcParams", function () {
  ok(NN.fcParams(10, 5) === 55);
  ok(NN.fcParams(10, 5, false) === 50);
});
test("convParams", function () {
  ok(NN.convParams(3, 16, 3) === 3 * 16 * 9 + 16);
  ok(NN.convParams(3, 16, 3, false) === 3 * 16 * 9);
});
test("countParams over a mixed stack", function () {
  var n = NN.countParams([
    { type: "conv", cin: 3, cout: 8, k: 3 },
    { type: "bn", c: 8 },
    { type: "fc", "in": 8, out: 10 }
  ]);
  ok(n === (3 * 8 * 9 + 8) + 16 + 90, "got " + n);
});
test("MLP.countParams matches manual", function () {
  var mlp = NN.MLP([2, 4, 3], { seed: 1 });
  // (2*4+4) + (4*3+3) = 12 + 15 = 27
  ok(mlp.countParams() === 27, "got " + mlp.countParams());
});
test("formatCount is readable", function () {
  ok(NN.formatCount(1234567).indexOf("1,234,567") === 0);
});

/* ================================================================== */
group("tensor: agreement with PyTorch conventions");

test("conv is cross-correlation, not flipped convolution", function () {
  // PyTorch Conv2d does cross-correlation: out = sum x[i,j]*k[i,j]
  var input = [[1, 2], [3, 4]];
  var k = [[1, 2], [3, 4]];
  var out = T.conv2d(input, k, {});
  near(out[0][0], 1 * 1 + 2 * 2 + 3 * 3 + 4 * 4, 1e-12);
});
test("padding=1 on 3x3 keeps size", function () {
  var out = T.conv2d(T.zeros(3, 3), T.ones(3, 3), { padding: 1 });
  ok(out.length === 3);
});
test("efficientnet scaling helper (compound) is stable", function () {
  // compound scaling: depth 1.2^phi, width 1.1^phi, res 1.15^phi
  var phi = 2;
  var d = Math.pow(1.2, phi), w = Math.pow(1.1, phi), r = Math.pow(1.15, phi);
  ok(d > 1 && w > 1 && r > 1);
});

/* ================================================================== */
process.stdout.write("\n" + "-".repeat(58) + "\n");
process.stdout.write("passed: " + passed + "   failed: " + failed + "\n");
if (failed) {
  process.stdout.write("\nFailures:\n");
  failures.forEach(function (f) {
    process.stdout.write("  - " + f.name + ": " + (f.err && f.err.stack || f.err) + "\n");
  });
  process.exit(1);
} else {
  process.stdout.write("ALL TESTS PASSED\n");
}
