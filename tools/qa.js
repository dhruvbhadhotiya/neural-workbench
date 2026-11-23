#!/usr/bin/env node
/* ==========================================================================
   DeepLearn Lab - tools/qa.js
   Runs tools/shot.js over every page at several widths, mounting all labs,
   and reports overflow, console errors and failures in one table.
   Run: node tools/qa.js [--widths=360,768,1440] [--themes=light,dark]
                          [--only=m1] [--fast]
   Screenshots go to <tmp>/dll-qa/. Nothing in the repo is modified.
   ========================================================================== */
"use strict";

var fs = require("fs");
var os = require("os");
var path = require("path");
var { spawnSync } = require("child_process");

var root = path.join(__dirname, "..");
var outDir = path.join(os.tmpdir(), "dll-qa");
fs.mkdirSync(outDir, { recursive: true });

var opt = { widths: [360, 768, 1440], themes: ["light"], only: null, fast: false };
process.argv.slice(2).forEach(function (a) {
  var m = /^--([a-z]+)=(.*)$/.exec(a);
  if (!m) return;
  if (m[1] === "widths") opt.widths = m[2].split(",").map(Number);
  else if (m[1] === "themes") opt.themes = m[2].split(",");
  else if (m[1] === "only") opt.only = m[2];
  else if (m[1] === "fast") opt.fast = true;
});

function walk(dir, out) {
  fs.readdirSync(dir).sort().forEach(function (name) {
    var p = path.join(dir, name);
    var st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.html$/i.test(name)) out.push(p);
  });
  return out;
}

var pages = [path.join(root, "index.html")].concat(walk(path.join(root, "modules"), []));
if (opt.only) pages = pages.filter(function (p) { return path.relative(root, p).replace(/\\/g, "/").indexOf(opt.only) >= 0; });

var shot = path.join(__dirname, "shot.js");
var rows = [];
var failures = 0;

pages.forEach(function (page, pi) {
  var isLesson = /[\\/]m\d-\d\d-/.test(page);
  opt.themes.forEach(function (theme) {
    opt.widths.forEach(function (w) {
      var relName = path.relative(root, page).replace(/\\/g, "/").replace(/\.html$/, "").replace(/\//g, "_");
      var base = relName + "-" + theme + "-" + w + ".png";
      var out = path.join(outDir, base);
      var args = [shot, page, out, "--width=" + w, "--height=900", "--theme=" + theme];
      if (isLesson && !opt.fast) args.push("--js=DL.qsa('[data-widget]').forEach(function(el){DL.widgets.mount(el)})");
      var r = spawnSync(process.execPath, args, { encoding: "utf8" });
      var text = (r.stdout || "") + (r.stderr || "");
      var over = /OVERFLOW/.test(text);
      var errs = /console errors:|--js threw|shot failed|timed out/.test(text);
      var bad = r.status !== 0 || over || errs;
      if (bad) failures++;
      rows.push({
        page: path.relative(root, page).replace(/\\/g, "/"),
        theme: theme, width: w, ok: !bad, over: over, errs: errs,
        detail: text.trim().split(/\r?\n/).filter(function (l) {
          return /OVERFLOW|console errors|--js threw|shot failed|timed out|Error/.test(l);
        }).join(" | ")
      });
      var pct = Math.round(((pi * opt.themes.length * opt.widths.length) +
        (opt.themes.indexOf(theme) * opt.widths.length) + (opt.widths.indexOf(w) + 1)) /
        (pages.length * opt.themes.length * opt.widths.length) * 100);
      process.stdout.write("\r" + pct + "%  " + path.basename(page) + " @" + w + " " + theme + "   ");
    });
  });
});
process.stdout.write("\r");

var bad = rows.filter(function (r) { return !r.ok; });
bad.forEach(function (r) {
  console.log("FAIL  " + r.page + "  " + r.width + "px " + r.theme +
    (r.over ? "  OVERFLOW" : "") + (r.errs ? "  console/js error" : "") +
    (r.detail ? "\n      " + r.detail : ""));
});

console.log("");
console.log(rows.length + " shots, " + (rows.length - bad.length) + " clean, " + bad.length + " failed");
console.log("screenshots: " + outDir);
process.exit(failures ? 1 : 0);
