#!/usr/bin/env node
/* ==========================================================================
   DeepLearn Lab — tools/build-search.js
   Dev-time only. Scans module HTML and writes assets/js/search-index.js.
   Run: node tools/build-search.js
   ========================================================================== */
"use strict";

var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var modulesDir = path.join(root, "modules");

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir).forEach(function (name) {
    var p = path.join(dir, name);
    var st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.html$/i.test(name)) out.push(p);
  });
  return out;
}

function decode(s) {
  return s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&times;/g, "×")
    .replace(/&rarr;/g, "→").replace(/&larr;/g, "←").replace(/&le;/g, "≤")
    .replace(/&ge;/g, "≥").replace(/&sum;/g, "Σ").replace(/&theta;/g, "θ")
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); });
}

function strip(html) {
  return decode(html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    // a chunk may be cut inside a block, leaving an unterminated tag
    .replace(/<(script|style|svg)\b[\s\S]*/gi, " ")
    .replace(/\\([\[\]])/g, " ")
    .replace(/\\\(([\s\S]*?)\\\)/g, " $1 ")
    .replace(/\\(?:mathrm|mathbf|mathit|text|operatorname|mathcal|mathbb)\{([^{}]*)\}/g, "$1")
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\(?:cdot|times)/g, " x ")
    .replace(/\\(tanh|sinh|cosh|exp|log|max|min|argmax|softmax|relu)\b/gi, "$1")
    .replace(/\\[,;!]/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

var files = walk(modulesDir, []);
var index = [];

files.forEach(function (file) {
  var html = fs.readFileSync(file, "utf8");
  var rel = path.relative(root, file).replace(/\\/g, "/");
  var modMatch = /<body[^>]*data-module="([^"]+)"/i.exec(html);
  var mod = modMatch ? modMatch[1] : (rel.split("/")[1] || "").slice(0, 2);
  var tMatch = /<title>([\s\S]*?)<\/title>/i.exec(html);
  var lessonTitle = tMatch ? decode(tMatch[1].replace(/\s+/g, " ").trim()).replace(/\s*·\s*DeepLearn Lab\s*$/, "") : rel;

  // main content only
  var mIdx = html.search(/<main[\s>]/i);
  var main = mIdx >= 0 ? html.slice(mIdx) : html;
  var endIdx = main.search(/<\/main>/i);
  if (endIdx >= 0) main = main.slice(0, endIdx);

  // split into heading-delimited chunks
  var re = /<h([23])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;
  var m, marks = [];
  while ((m = re.exec(main))) {
    marks.push({ level: +m[1], id: m[2], text: strip(m[3]), at: re.lastIndex });
  }

  // page-level entry (so the page itself is findable)
  index.push({
    t: lessonTitle, h: "Overview", m: mod, u: rel, x: strip(main).slice(0, 160)
  });

  marks.forEach(function (mk) {
    var nextAt = main.length;
    for (var i = 0; i < marks.length; i++) {
      if (marks[i].at > mk.at) { nextAt = marks[i].at - 40; break; }
    }
    var chunk = strip(main.slice(mk.at, Math.min(nextAt, mk.at + 2600)));
    index.push({
      t: lessonTitle,
      h: mk.text,
      m: mod,
      u: rel + "#" + mk.id,
      x: chunk.slice(0, 180)
    });
  });
});

// de-duplicate (same url + heading)
var seen = {}, out = [];
index.forEach(function (it) {
  var k = it.u + "|" + it.h;
  if (seen[k]) return;
  seen[k] = 1;
  out.push(it);
});

var header = [
  "/* GENERATED FILE — do not edit by hand.",
  "   Source: tools/build-search.js   Generated: " + new Date().toISOString().slice(0, 10),
  "   Entries: " + out.length + " */",
  "window.DL = window.DL || {};",
  "DL.searchIndex = " + JSON.stringify(out) + ";",
  ""
].join("\n");

fs.writeFileSync(path.join(root, "assets", "js", "search-index.js"), header, "utf8");
process.stdout.write("search-index.js: " + out.length + " entries from " + files.length + " pages\n");
