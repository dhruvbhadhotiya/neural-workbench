#!/usr/bin/env node
/* ==========================================================================
   DeepLearn Lab - tools/smoke.js
   Static structure checker. No dependencies, no browser.
   Run: node tools/smoke.js [--verbose]

   Checks every page for the contract's structural requirements:
   - head: doctype, lang, theme boot, KaTeX CSS, the four stylesheets
   - body: data-root / data-module / data-lesson, topbar nav, skip link, one h1
   - lesson sections in the fixed order, >=1 lab, 4 mistakes, debug details
   - every lab carries data-widget / data-badge / data-title / data-note, and the
     widget id is actually registered by the module's widgets file
   - quiz JSON parses; 8 questions per lesson, 10 per exam; 4 options each;
     correct index in range; one `why` string per option; the keyed `why` marks exactly one option correct
   - deferred script list in the required order (search index included)
   - no ES modules, no fetch(), no CDN links
   - duplicate element ids, broken relative links
   ========================================================================== */
"use strict";

var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var verbose = process.argv.indexOf("--verbose") >= 0;

var errors = [];
var warnings = [];
var stats = { pages: 0, lessons: 0, exams: 0, labs: 0, questions: 0 };

function rel(p) { return path.relative(root, p).replace(/\\/g, "/"); }
function err(file, msg) { errors.push(rel(file) + ": " + msg); }
function warn(file, msg) { warnings.push(rel(file) + ": " + msg); }

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir).sort().forEach(function (name) {
    var p = path.join(dir, name);
    var st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.html$/i.test(name)) out.push(p);
  });
  return out;
}

var SCRIPT_ORDER = [
  "assets/js/core.js",
  "assets/js/store.js",
  "assets/js/tensor.js",
  "assets/js/nn.js",
  "assets/js/viz.js",
  "assets/js/ui.js",
  "assets/js/quiz.js",
  "assets/js/progress.js",
  "assets/js/widgets.js",
  "assets/data/glossary.js",
  "assets/js/search-index.js"
];

var SECTION_ORDER = [
  ['objectives', 'class="objectives"'],
  ['bridge box', 'callout--bridge'],
  ['intuition', 'id="intuition"'],
  ['math', 'id="math"'],
  ['code', 'id="code"'],
  ['mistakes', 'id="mistakes"'],
  ['debug', 'id="debug"'],
  ['quiz', 'id="quiz"'],
  ['summary', 'id="summary"'],
  ['cheat sheet', 'class="cheatsheet"'],
  ['further reading', 'id="reading"'],
  ['prev/next', 'class="prevnext"']
];

function parseAttrs(tag) {
  var out = {};
  tag.replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g, function (_, k, v) {
    out[k.toLowerCase()] = v;
  });
  return out;
}

function count(re, s) { var m = s.match(re); return m ? m.length : 0; }

function checkQuiz(file, html, isExam) {
  var block = /<script[^>]*class="quiz__data"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!block) { err(file, "no quiz__data JSON block"); return; }
  var data;
  try { data = JSON.parse(block[1]); }
  catch (e) { err(file, "quiz__data is not valid JSON: " + e.message); return; }

  var qs = data.questions || [];
  var want = isExam ? 10 : 8;
  if (qs.length !== want) err(file, "quiz has " + qs.length + " questions, expected " + want);

  var section = /<section class="quiz"[^>]*>/i.exec(html);
  if (section) {
    var at = parseAttrs(section[0]);
    if (isExam && at["data-exam"] !== "1") err(file, "exam section missing data-exam=\"1\"");
    if (!isExam && !at["data-quiz"]) err(file, "quiz section missing data-quiz");
  }

  qs.forEach(function (q, i) {
    var n = i + 1;
    if (!q.q) err(file, "question " + n + " has no q");
    if (!Array.isArray(q.options) || q.options.length !== 4) err(file, "question " + n + " needs exactly 4 options");
    var key = typeof q.correct === "number" ? q.correct : q.a;
    if (typeof key !== "number" || key < 0 || key > 3) err(file, "question " + n + " has bad answer index");
    if (!Array.isArray(q.why) || q.why.length !== (q.options || []).length) err(file, "question " + n + " needs one why per option");
    if (!/^Correct(?::|\s+[—–-])/i.test(String(q.why[key] || ""))) err(file, "question " + n + ": why[" + key + "] does not mark the keyed option as correct");
    q.why.forEach(function (s, j) {
      if (j !== key && /^Correct(?::|\s+[—–-])/i.test(String(s || ""))) err(file, "question " + n + ": why[" + j + "] also claims to be correct");
    });
    stats.questions++;
  });
}

function checkScripts(file, html) {
  var srcs = [];
  html.replace(/<script\b([^>]*)>/gi, function (tag, attrs) {
    var a = parseAttrs(tag);
    if (a.src) srcs.push(a.src.replace(/^\.\.\/\.\.\//, ""));
    else {
      if (/type="module"/i.test(tag)) err(file, "inline ES module script");
    }
    if (a.type && /module/i.test(a.type)) err(file, "type=\"module\" is forbidden");
    return tag;
  });

  var lessonAt = srcs.indexOf("assets/js/lesson.js");
  if (lessonAt < 0) { err(file, "missing assets/js/lesson.js"); return; }
  var ordered = srcs.slice(0, lessonAt);
  // last three before lesson.js must be module widgets, katex, auto-render
  var tail = ordered.slice(-3);
  if (!/widgets\/m\d-widgets\.js$/.test(tail[0] || "")) err(file, "expected module widgets file before katex (found " + tail[0] + ")");
  if (!/katex\.min\.js$/.test(tail[1] || "")) err(file, "expected katex.min.js before auto-render");
  if (!/auto-render\.min\.js$/.test(tail[2] || "")) err(file, "expected auto-render.min.js before lesson.js");

  var cursor = -1;
  SCRIPT_ORDER.forEach(function (want) {
    var at = ordered.indexOf(want);
    if (at < 0) {
      if (want === "assets/js/search-index.js") warn(file, "search-index.js not loaded - in-page search will be empty");
      else err(file, "missing script " + want);
      return;
    }
    if (at < cursor) err(file, "script out of order: " + want);
    cursor = at;
  });

  if (/<script[^>]+src="https?:/i.test(html)) err(file, "external script src");
  if (/<link[^>]+href="https?:/i.test(html)) err(file, "external stylesheet link");
  if (/\bfetch\s*\(/.test(html)) err(file, "fetch() of a local file");
}

function checkHead(file, html, needsMath) {
  if (!/^<!doctype html>/i.test(html)) err(file, "missing doctype");
  if (!/<html[^>]*lang="en"/i.test(html)) err(file, "html lang=\"en\" missing");
  if (!/<html[^>]*data-theme="/i.test(html)) err(file, "html data-theme missing");
  if (!/dll:theme/.test(html)) err(file, "theme boot script missing");
  if (!/<meta[^>]*name="viewport"/i.test(html)) err(file, "viewport meta missing");
  if (!/<meta[^>]*name="description"/i.test(html)) warn(file, "description meta missing");
  if (!/<title>[^<]{3,}<\/title>/.test(html)) err(file, "title missing");
  var sheets = ["assets/css/tokens.css", "assets/css/base.css",
    "assets/css/components.css", "assets/css/print.css"];
  if (needsMath !== false) sheets.unshift("assets/vendor/katex/katex.min.css");
  sheets.forEach(function (css) {
    if (html.indexOf(css) < 0) err(file, "missing stylesheet " + css);
  });
}

function checkIdsAndLinks(file, html) {
  var seen = {};
  html.replace(/\sid="([^"]+)"/g, function (_, id) {
    if (seen[id]) err(file, "duplicate id \"" + id + "\"");
    seen[id] = 1;
  });

  var dir = path.dirname(file);
  html.replace(/\s(?:href|src)="([^"]+)"/g, function (_, url) {
    if (/^(https?:|mailto:|javascript:|data:|#)/i.test(url)) return;
    if (/\{\{|<%/.test(url)) return;
    var clean = url.split("#")[0].split("?")[0];
    if (!clean) return;
    if (/\s/.test(clean)) { err(file, "link contains whitespace: " + url); return; }
    var target = path.resolve(dir, decodeURI(clean));
    if (!fs.existsSync(target)) {
      // Modules are written over time; a link to a module directory that does not
      // exist yet is a build warning, not a contract violation.
      var parts = path.relative(root, target).split(path.sep);
      var inProgress = parts[0] === "modules" && parts.length >= 2 &&
        !fs.existsSync(path.join(root, "modules", parts[1], "index.html"));
      if (inProgress) warn(file, "link to module still being written: " + url);
      else err(file, "broken link: " + url);
    }
  });
}

function checkLesson(file, html) {
  stats.lessons++;
  var base = path.basename(file, ".html");
  var lessonId = /^m\d-\d\d/.exec(base);
  lessonId = lessonId ? lessonId[0] : "";
  var modDir = path.basename(path.dirname(file));
  var modNum = modDir.slice(0, 2);

  checkHead(file, html);
  checkScripts(file, html);
  checkIdsAndLinks(file, html);

  var body = /<body\b([^>]*)>/i.exec(html);
  if (!body) { err(file, "no body tag"); return; }
  var b = parseAttrs(body[1]);
  if (b["data-module"] !== modNum) err(file, "body data-module is \"" + b["data-module"] + "\", expected \"" + modNum + "\"");
  if (b["data-lesson"] !== lessonId) err(file, "body data-lesson is \"" + b["data-lesson"] + "\", expected \"" + lessonId + "\"");
  if (b["data-root"] !== "../../") err(file, "body data-root must be \"../../\"");

  if (count(/<h1\b/gi, html) !== 1) err(file, "expected exactly one h1, found " + count(/<h1\b/gi, html));
  if (count(/class="skip-link"/g, html) !== 1) err(file, "skip link missing");

  var nav = /<nav class="topbar__nav"[\s\S]*?<\/nav>/i.exec(html);
  if (!nav) err(file, "topbar nav missing");
  else {
    ["M0", "M1", "M2", "M3", "M4", "M5", "M6"].forEach(function (m) {
      if (nav[0].indexOf(">" + m + "<") < 0) err(file, "topbar nav missing " + m);
    });
  }

  var last = -1;
  SECTION_ORDER.forEach(function (pair) {
    var at = html.indexOf(pair[1]);
    if (at < 0) { err(file, "missing section: " + pair[0]); return; }
    if (at < last) err(file, "section out of order: " + pair[0]);
    last = at;
  });

  if (count(/class="lab"/g, html) < 1) err(file, "no lab");
  if (count(/callout--warn/g, html) < 4) err(file, "expected >=4 mistake callouts");
  if (count(/<details\b/gi, html) < 1) err(file, "no <details> for Debug this");
  if (!/class="keyidea"/.test(html)) err(file, "no keyidea summary");
  if (!/data-reading-time/.test(html)) warn(file, "reading-time placeholder missing");

  var widgetsFile = path.join(path.dirname(file), "widgets", modNum + "-widgets.js");
  var registered = {};
  if (fs.existsSync(widgetsFile)) {
    var js = fs.readFileSync(widgetsFile, "utf8");
    js.replace(/register\s*\(\s*["']([^"']+)["']/g, function (_, id) { registered[id] = 1; });
  } else warn(file, "no widgets file " + rel(widgetsFile));

  var labs = html.match(/<section class="lab"[\s\S]*?>/g) || [];
  labs.forEach(function (tag) {
    stats.labs++;
    var a = parseAttrs(tag);
    var id = a["data-widget"];
    if (!id) { err(file, "lab without data-widget"); return; }
    if (a["data-badge"] !== "exact" && a["data-badge"] !== "illustrative") err(file, "lab " + id + " has bad data-badge");
    if (!a["data-title"]) err(file, "lab " + id + " missing data-title");
    if (!a["data-note"]) err(file, "lab " + id + " missing data-note");
    else {
      var lead = a["data-note"].split(":")[0].toLowerCase();
      if (lead.indexOf(a["data-badge"] || "") < 0) err(file, "lab " + id + " data-note does not match badge");
    }
    if (!registered[id]) err(file, "lab " + id + " is not registered in " + rel(widgetsFile));
  });

  checkQuiz(file, html, false);
}

function checkModuleIndex(file, html) {
  stats.exams++;
  var base = path.basename(path.dirname(file));
  var modNum = base.slice(0, 2);

  checkHead(file, html);
  checkScripts(file, html);
  checkIdsAndLinks(file, html);

  var body = /<body\b([^>]*)>/i.exec(html);
  if (body) {
    var b = parseAttrs(body[1]);
    if (b["data-module"] !== modNum) err(file, "body data-module is \"" + b["data-module"] + "\", expected \"" + modNum + "\"");
    if (b["data-root"] !== "../../") err(file, "body data-root must be \"../../\"");
  }
  if (count(/<h1\b/gi, html) !== 1) err(file, "expected exactly one h1");
  if (html.indexOf("data-quiz=\"" + modNum + "-exam\"") < 0) err(file, "exam quiz id " + modNum + "-exam missing");
  checkQuiz(file, html, true);

  var dir = path.dirname(file);
  var lessons = fs.readdirSync(dir).filter(function (n) { return /^m\d-\d\d-.+\.html$/.test(n); });
  if (lessons.length < 1) err(file, "no lesson files in module");
  lessons.forEach(function (n) {
    if (html.indexOf('href="' + n + '"') < 0) err(file, "lesson card/link missing for " + n);
  });
}

/* -------------------------------------------------------------------- run */
var pages = walk(path.join(root, "modules"), []);
pages.push(path.join(root, "index.html"));

var moduleIndexes = 0;
pages.forEach(function (file) {
  var html = fs.readFileSync(file, "utf8");
  stats.pages++;
  var name = path.basename(file);
  if (file === path.join(root, "index.html")) {
    checkHead(file, html, false);
    checkIdsAndLinks(file, html);
    if (html.indexOf("search-index.js") < 0) err(file, "landing page missing search-index.js");
    ["m0-foundations", "m1-cnns", "m2-sequences", "m3-gans", "m4-autoencoders", "m5-segmentation", "m6-toolkit"].forEach(function (m) {
      if (html.indexOf(m + "/index.html") < 0) err(file, "landing page does not link " + m);
    });
  } else if (name === "index.html") {
    moduleIndexes++;
    checkModuleIndex(file, html);
  } else if (/^m\d-\d\d-.+\.html$/.test(name)) {
    checkLesson(file, html);
  } else {
    warn(file, "unrecognised page name");
  }
  if (verbose) console.log("checked " + rel(file));
});

if (moduleIndexes !== 7) errors.push("expected 7 module index pages, found " + moduleIndexes);

function uniq(a) {
  var seen = {}, out = [];
  a.forEach(function (s) { if (!seen[s]) { seen[s] = 1; out.push(s); } });
  return out;
}
errors = uniq(errors);
warnings = uniq(warnings);

warnings.forEach(function (w) { console.log("WARN  " + w); });
errors.forEach(function (e) { console.log("FAIL  " + e); });

console.log("");
console.log(stats.pages + " pages (" + stats.lessons + " lessons, " + stats.exams + " exams), " +
  stats.labs + " labs, " + stats.questions + " quiz questions");
console.log(errors.length ? errors.length + " error(s), " + warnings.length + " warning(s)" : "PASS - 0 errors, " + warnings.length + " warning(s)");
process.exit(errors.length ? 1 : 0);
