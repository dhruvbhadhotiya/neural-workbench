#!/usr/bin/env node
/* ==========================================================================
   DeepLearn Lab — tools/shot.js
   Screenshot a page at an exact CSS viewport width, using the Chrome DevTools
   Protocol (no npm dependencies; Node 22+ has a global WebSocket).

   node tools/shot.js <url-or-path> <out.png> [options]

   Options
     --width=1440        CSS pixels
     --height=900        viewport height in CSS pixels
     --scale=1           device scale factor (2 for retina)
     --full              capture the whole page, not just the viewport
     --theme=light|dark  appends ?theme=… (or &theme=…)
     --wait=700          extra milliseconds after load
     --mobile            sets mobile:true (touch emulation)
     --print             emulate the print media type (print stylesheet QA)
     --js=<expr>         evaluate JS after load (e.g. mount all labs, click a control)
     --chrome=<path>     override the browser binary

   Exit code is non-zero if the page logged a console error or threw.
   ========================================================================== */
"use strict";

var fs = require("fs");
var path = require("path");
var { spawn } = require("child_process");

/* ------------------------------------------------------------------ args */
var argv = process.argv.slice(2);
if (argv.length < 2) {
  console.error("usage: node tools/shot.js <url> <out.png> [--width=1440] [--height=900] [--full] [--theme=light] [--scale=1] [--wait=700] [--mobile]");
  process.exit(2);
}
var target = argv[0];
var outFile = path.resolve(argv[1]);
var opt = { width: 1440, height: 900, scale: 1, full: false, theme: null, wait: 700, mobile: false, chrome: null, js: null, print: false };
argv.slice(2).forEach(function (a) {
  if (a === "--full") return (opt.full = true);
  if (a === "--mobile") return (opt.mobile = true);
  if (a === "--print") return (opt.print = true);
  var m = /^--([a-z]+)=(.*)$/.exec(a);
  if (!m) return;
  if (m[1] === "chrome") opt.chrome = m[2];
  else if (m[1] === "theme") opt.theme = m[2];
  else if (m[1] === "js") opt.js = m[2];
  else if (m[1] === "width") opt.width = parseInt(m[2], 10);
  else if (m[1] === "height") opt.height = parseInt(m[2], 10);
  else if (m[1] === "scale") opt.scale = parseFloat(m[2]);
  else if (m[1] === "wait") opt.wait = parseInt(m[2], 10);
});

function toUrl(s) {
  if (/^(file|https?):\/\//.test(s)) return s;
  var abs = path.resolve(s).replace(/\\/g, "/");
  return "file:///" + encodeURI(abs).replace(/#/g, "%23");
}
var url = toUrl(target);
if (opt.theme) url += (url.indexOf("?") >= 0 ? "&" : "?") + "theme=" + opt.theme;

/* --------------------------------------------------------------- browser */
var CANDIDATES = [
  opt.chrome,
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].filter(Boolean);

var CHROME = null;
for (var i = 0; i < CANDIDATES.length; i++) {
  try { if (fs.existsSync(CANDIDATES[i])) { CHROME = CANDIDATES[i]; break; } } catch (e) {}
}
if (!CHROME) {
  console.error("No Chrome/Edge binary found. Pass --chrome=<path>.");
  process.exit(2);
}
if (!fs.existsSync(path.dirname(outFile))) fs.mkdirSync(path.dirname(outFile), { recursive: true });

var userDir = path.join(require("os").tmpdir(), "dll-shot-" + Date.now());
var args = [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--disable-background-networking",
  "--remote-debugging-port=0",
  "--user-data-dir=" + userDir,
  "--allow-file-access-from-files",
  "about:blank"
];

var child = spawn(CHROME, args, { stdio: ["ignore", "pipe", "pipe"] });
var wsUrl = null;
var bootBuf = "";
var stderrTail = "";

child.stderr.on("data", function (b) {
  var s = b.toString();
  stderrTail = (stderrTail + s).slice(-2000);
  var m = /DevTools listening on (ws:\/\/\S+)/.exec(s);
  if (m && !wsUrl) { wsUrl = m[1]; start(); }
});

var killTimer = setTimeout(function () {
  console.error("timed out waiting for the browser");
  child.kill();
  process.exit(1);
}, 30000);
var runTimer = null;

/* ------------------------------------------------------------------- cdp */
var ws = null;
var nextId = 1;
var pending = new Map();
var events = [];
var consoleErrors = [];

function send(method, params, sessionId) {
  var id = nextId++;
  var msg = { id: id, method: method, params: params || {} };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise(function (res, rej) {
    pending.set(id, { res: res, rej: rej, method: method });
  });
}

function start() {
  ws = new WebSocket(wsUrl);
  ws.addEventListener("message", function (ev) {
    var msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      var p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.rej(new Error(p.method + ": " + msg.error.message));
      else p.res(msg.result);
      return;
    }
    if (msg.method) {
      events.push(msg.method);
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        consoleErrors.push(msg.params.args.map(function (a) { return a.value || a.description || ""; }).join(" "));
      }
      if (msg.method === "Runtime.exceptionThrown") {
        var d = msg.params.exceptionDetails;
        consoleErrors.push((d.exception && d.exception.description) || d.text || "exception");
      }
    }
  });
  ws.addEventListener("error", function (e) {
    console.error("websocket error", e.message || e);
    cleanup(1);
  });
  ws.addEventListener("open", function () {
    clearTimeout(killTimer);
    runTimer = setTimeout(function () {
      console.error("shot timed out after navigation");
      cleanup(1);
    }, 240000);
    run().catch(fail);
  });
}

async function run() {
  var t = await send("Target.createTarget", { url: "about:blank" });
  var att = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
  var sid = att.sessionId;

  await send("Page.enable", {}, sid);
  await send("Runtime.enable", {}, sid);
  await send("Emulation.setDeviceMetricsOverride", {
    width: opt.width, height: opt.height,
    deviceScaleFactor: opt.scale, mobile: opt.mobile
  }, sid);
  await send("Emulation.setEmulatedMedia", {
    media: opt.print ? "print" : "",
    features: [{ name: "prefers-color-scheme", value: (opt.theme === "dark" ? "dark" : "light") }]
  }, sid);

  var loaded = new Promise(function (res) {
    var iv = setInterval(function () {
      if (events.indexOf("Page.loadEventFired") >= 0) { clearInterval(iv); res(); }
    }, 40);
    setTimeout(function () { clearInterval(iv); res(); }, 12000);
  });

  await send("Page.navigate", { url: url }, sid);
  await loaded;
  await sleep(opt.wait);

  // settle layout: wait for fonts, then one more frame
  try {
    await send("Runtime.evaluate", { expression: "document.fonts && document.fonts.ready", awaitPromise: true }, sid);
  } catch (e) {}
  await sleep(120);

  if (opt.js) {
    var r = await send("Runtime.evaluate", { expression: opt.js, awaitPromise: true, returnByValue: true }, sid);
    if (r.exceptionDetails) {
      console.error("--js threw: " + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
    }
    await sleep(220);
  }

  var clip = null;
  if (opt.full) {
    var lm = await send("Page.getLayoutMetrics", {}, sid);
    var cs = lm.cssContentSize || lm.contentSize;
    clip = { x: 0, y: 0, width: Math.ceil(cs.width), height: Math.ceil(cs.height), scale: 1 };
  }
  var shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: !!opt.full,
    clip: clip || undefined
  }, sid);

  fs.writeFileSync(outFile, Buffer.from(shot.data, "base64"));

  // measurements for the QA log
  var probe = await send("Runtime.evaluate", {
    expression: "JSON.stringify({sw:document.documentElement.scrollWidth,vw:innerWidth,sh:document.documentElement.scrollHeight,title:document.title})",
    returnByValue: true
  }, sid);
  await send("Target.closeTarget", { targetId: t.targetId });

  cleanup(0, probe.result && probe.result.value);
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function fail(err) {
  console.error("shot failed:", err && err.message || err);
  cleanup(1);
}

function cleanup(code, probe) {
  clearTimeout(killTimer);
  clearTimeout(runTimer);
  try { if (ws) ws.close(); } catch (e) {}
  try { child.kill(); } catch (e) {}
  setTimeout(function () {
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) {}
  }, 200).unref();

  var info = probe ? JSON.parse(probe) : null;
  if (info) {
    var overflow = info.sw > info.vw + 1;
    console.log(
      path.basename(outFile) + "  " + opt.width + "x" + opt.height +
      "  scrollWidth=" + info.sw + (overflow ? "  OVERFLOW" : "") +
      "  height=" + info.sh
    );
  }
  if (consoleErrors.length) {
    console.error("console errors:\n  " + consoleErrors.slice(0, 10).join("\n  "));
    process.exit(1);
  }
  process.exit(code);
}
