#!/usr/bin/env node
/* ==========================================================================
   DeepLearn Lab - tools/fix-search-index.js
   Dev-time only, idempotent. Adds the generated search index script to every
   lesson page that is missing it, immediately before the module widgets file.
   Run: node tools/fix-search-index.js
   ========================================================================== */
"use strict";

var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var changed = 0, skipped = 0;

function walk(dir, out) {
  fs.readdirSync(dir).forEach(function (name) {
    var p = path.join(dir, name);
    var st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.html$/i.test(name)) out.push(p);
  });
  return out;
}

var files = walk(path.join(root, "modules"), []);
var only = (process.argv.slice(2).filter(function (a) { return /^--only=/.test(a); })[0] || "").replace("--only=", "");
if (only) files = files.filter(function (f) { return path.relative(root, f).replace(/\\/g, "/").indexOf(only) >= 0; });

files.forEach(function (file) {
  var html = fs.readFileSync(file, "utf8");
  if (html.indexOf("assets/js/search-index.js") >= 0) { skipped++; return; }

  var tag = '<script defer src="../../assets/js/search-index.js"></script>';
  var marker = /(\n\s*)(<script defer src="widgets\/m\d-widgets\.js"><\/script>)/;
  if (!marker.test(html)) {
    console.log("SKIP  " + path.relative(root, file) + " (no module widgets script)");
    skipped++;
    return;
  }
  html = html.replace(marker, function (_, ws, widgetsTag) {
    return ws + tag + ws + widgetsTag;
  });
  fs.writeFileSync(file, html, "utf8");
  changed++;
  console.log("FIX   " + path.relative(root, file));
});

console.log("\n" + changed + " page(s) updated, " + skipped + " already had the index or were skipped.");
