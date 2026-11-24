/* ==========================================================================
   DeepLearn Lab — lesson.js
   Page shell: TOC + scrollspy, theme, search, tabs, copy buttons, in-house
   Python highlighter, glossary tooltips, reading time, progress, quiz mounting.
   ========================================================================== */
(function (DL) {
  "use strict";

  var L = {};

  /* ------------------------------------------------------------- theme button */
  function initTheme() {
    var btns = DL.qsa('[data-action="theme"]');
    function paint() {
      var dark = DL.theme() === "dark";
      btns.forEach(function (b) {
        b.setAttribute("aria-pressed", String(dark));
        b.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
      });
    }
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        // canvases are redrawn by widgets listening to dl:theme; reload progress rings
        DL.setTheme(DL.theme() === "dark" ? "light" : "dark");
        paint();
        drawRings();
      });
    });
    paint();
    document.addEventListener("dl:theme", paint);
  }

  /* ------------------------------------------------------------- mobile nav */
  function initMobileNav() {
    var bar = DL.qs(".topbar");
    if (!bar || DL.qs(".navtoggle")) return;
    var tools = DL.qs(".topbar__tools") || bar;

    var btn = DL.el("button", {
      type: "button", class: "btn btn--ghost navtoggle",
      "aria-label": "Open module menu", "aria-expanded": "false", "aria-controls": "mobilenav",
      text: "☰"
    });
    tools.appendChild(btn);

    var panel = DL.el("nav", { class: "mobilenav", id: "mobilenav", "aria-label": "All modules", hidden: "" });
    var here = (document.body && document.body.getAttribute("data-module")) || "";
    DL.MODULES.forEach(function (m) {
      var a = DL.el("a", {
        href: DL.root(m.href),
        text: m.short + " · " + m.title
      });
      if (here === m.id) a.setAttribute("aria-current", "page");
      panel.appendChild(a);
    });
    bar.appendChild(panel);

    function open(b) {
      panel.hidden = !b;
      btn.setAttribute("aria-expanded", String(b));
      btn.setAttribute("aria-label", b ? "Close module menu" : "Open module menu");
      btn.textContent = b ? "×" : "☰";
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      open(panel.hidden);
    });
    panel.addEventListener("click", function (e) {
      if (e.target.tagName === "A") open(false);
    });
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) open(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { open(false); btn.focus(); }
    });
  }

  /* ------------------------------------------------------------------- TOC */
  function initToc() {
    var main = DL.qs("main.lesson");
    var toc = DL.qs("#toc");
    if (!main) return;

    var heads = DL.qsa("h2, h3", main).filter(function (h) {
      if (h.closest(".lab") || h.closest(".quiz") || h.closest(".tabs")) return false;
      return h.id && h.textContent.trim().length > 0;
    });

    // number section h2s; the Objectives and cheat-sheet headings stay unnumbered
    var n = 0;
    heads.forEach(function (h) {
      if (h.tagName !== "H2") return;
      if (h.closest(".objectives") || h.closest(".cheatsheet")) return;
      n += 1;
      h.setAttribute("data-num", DL.pad2(n));
    });

    if (toc) {
      toc.innerHTML = "";
      heads.forEach(function (h) {
        var li = DL.el("li", { class: h.tagName === "H3" ? "toc-h3" : "" });
        li.appendChild(DL.el("a", { href: "#" + h.id, text: h.textContent.trim() }));
        toc.appendChild(li);
      });
    }

    // mobile TOC
    if (heads.length && !DL.qs(".toc-mobile") && window.innerWidth <= 980) {
      var det = DL.el("details", { class: "toc-mobile" });
      det.appendChild(DL.el("summary", { text: "On this page (" + heads.length + ")" }));
      var ul = DL.el("ul");
      heads.forEach(function (h) {
        var li = DL.el("li");
        li.appendChild(DL.el("a", { href: "#" + h.id, text: h.textContent.trim() }));
        ul.appendChild(li);
      });
      det.appendChild(ul);
      main.insertBefore(det, main.firstChild);
      ul.addEventListener("click", function (e) {
        if (e.target.tagName === "A") det.removeAttribute("open");
      });
    }

    // scrollspy
    var links = DL.qsa("#toc a");
    if (links.length && "IntersectionObserver" in window) {
      var map = {};
      links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
      var active = null;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var a = map[en.target.id];
          if (!a) return;
          if (active) active.classList.remove("is-active");
          active = a;
          a.classList.add("is-active");
        });
      }, { rootMargin: "-20% 0px -70% 0px", threshold: 0 });
      heads.forEach(function (h) { io.observe(h); });
    }
  }

  /* ----------------------------------------------------------- reading time */
  function initReadingTime() {
    var main = DL.qs("main.lesson");
    if (!main) return;
    var words = (main.textContent || "").trim().split(/\s+/).length;
    var mins = Math.max(3, Math.round(words / 210));
    DL.qsa("[data-reading-time]").forEach(function (el) {
      el.textContent = mins + " min read";
    });
  }

  /* ------------------------------------------------------------------- math */
  function initKatex() {
    if (!window.renderMathInElement) return;
    try {
      window.renderMathInElement(document.body, {
        delimiters: [
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false,
        strict: false,
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option", "svg"],
        ignoredClasses: ["no-math", "lab", "quiz"]
      });
    } catch (e) { /* degrade to raw TeX */ }
  }

  /* -------------------------------------------------------------- copy code */
  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
    } else fallback();

    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        done(ok);
      } catch (e) { done(false); }
    }
  }

  function initCopyButtons() {
    DL.qsa("pre.code").forEach(function (pre) {
      var parent = pre.parentElement;
      if (!parent) return;
      if (parent.querySelector(":scope > .copy-btn")) return;
      var wrap = parent;
      if (!wrap.classList.contains("tabs__panel")) {
        // ensure a positioning context
        var computed = getComputedStyle(wrap).position;
        if (computed === "static") wrap.style.position = "relative";
      }
      var btn = DL.el("button", {
        type: "button", class: "copy-btn", text: "Copy",
        "aria-label": "Copy code to clipboard"
      });
      btn.addEventListener("click", function () {
        copyText(pre.innerText, function (ok) {
          btn.textContent = ok ? "Copied" : "Failed";
          btn.classList.add("is-done");
          setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("is-done"); }, 1600);
        });
      });
      wrap.appendChild(btn);
    });
  }

  /* --------------------------------------------------------- syntax highlight */
  var PY_KW = ("False None True and as assert async await break class continue def del elif else except " +
    "finally for from global if import in is lambda nonlocal not or pass raise return try while with yield " +
    "self print").split(" ");
  var PY_BUILTIN = ("len range enumerate zip map filter sum min max abs round sorted list dict set tuple str int " +
    "float bool type isinstance super print open").split(" ");

  function esc(s) { return DL.escapeHTML(s); }

  function highlightPython(code) {
    var out = "";
    var i = 0, n = code.length;
    while (i < n) {
      var ch = code[i];
      // comment
      if (ch === "#") {
        var j = code.indexOf("\n", i);
        if (j < 0) j = n;
        out += '<span class="tok-com">' + esc(code.slice(i, j)) + "</span>";
        i = j;
        continue;
      }
      // strings (triple, single, double)
      if (ch === '"' || ch === "'") {
        var triple = code.slice(i, i + 3);
        var quote = (triple === '"""' || triple === "'''") ? triple : ch;
        var k = i + quote.length;
        while (k < n) {
          if (code[k] === "\\") { k += 2; continue; }
          if (code.slice(k, k + quote.length) === quote) { k += quote.length; break; }
          if (quote.length === 1 && code[k] === "\n") break;
          k++;
        }
        out += '<span class="tok-str">' + esc(code.slice(i, k)) + "</span>";
        i = k;
        continue;
      }
      // numbers
      if (/[0-9]/.test(ch) && !/[A-Za-z_]/.test(code[i - 1] || "")) {
        var m = /^[0-9][0-9_]*(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(code.slice(i));
        if (m) {
          out += '<span class="tok-num">' + esc(m[0]) + "</span>";
          i += m[0].length;
          continue;
        }
      }
      // identifiers
      if (/[A-Za-z_]/.test(ch)) {
        var idm = /^[A-Za-z_][A-Za-z0-9_]*/.exec(code.slice(i));
        var word = idm[0];
        if (PY_KW.indexOf(word) >= 0) out += '<span class="tok-kw">' + word + "</span>";
        else if (code[i + word.length] === "(") out += '<span class="tok-fn">' + word + "</span>";
        else if (PY_BUILTIN.indexOf(word) >= 0) out += '<span class="tok-blt">' + word + "</span>";
        else if (word === "self") out += '<span class="tok-var">' + word + "</span>";
        else out += esc(word);
        i += word.length;
        continue;
      }
      // operators
      if (/[+\-*/%=<>!&|^~]/.test(ch)) {
        out += '<span class="tok-op">' + esc(ch) + "</span>";
        i++;
        continue;
      }
      out += esc(ch);
      i++;
    }
    return out;
  }

  function initHighlight() {
    DL.qsa("pre.code").forEach(function (pre) {
      var code = pre.querySelector("code");
      if (!code) return;
      if (pre.getAttribute("data-no-hl") === "1") return;
      var lang = (pre.getAttribute("data-lang") || "python").toLowerCase();
      var src = code.textContent;
      if (lang === "python" || lang === "py") code.innerHTML = highlightPython(src);
      // shell/json/other: leave plain
    });
  }

  /* ------------------------------------------------------------------- tabs */
  function initTabs() {
    DL.qsa(".tabs").forEach(function (tabs) {
      var list = tabs.querySelector(".tabs__list");
      var panels = DL.qsa(".tabs__panel", tabs);
      if (!list) return;
      var btns = DL.qsa(".tabs__tab", list);
      if (!btns.length) return;
      list.setAttribute("role", "tablist");
      btns.forEach(function (b, i) {
        b.setAttribute("role", "tab");
        b.setAttribute("type", "button");
        b.setAttribute("aria-selected", String(i === 0));
        b.tabIndex = i === 0 ? 0 : -1;
        if (panels[i]) {
          var pid = panels[i].id || DL.uid("panel");
          panels[i].id = pid;
          panels[i].setAttribute("role", "tabpanel");
          b.setAttribute("aria-controls", pid);
          panels[i].hidden = i !== 0;
        }
        b.addEventListener("click", function () { activate(i); });
        b.addEventListener("keydown", function (e) {
          var next = null;
          if (e.key === "ArrowRight") next = (i + 1) % btns.length;
          if (e.key === "ArrowLeft") next = (i - 1 + btns.length) % btns.length;
          if (e.key === "Home") next = 0;
          if (e.key === "End") next = btns.length - 1;
          if (next !== null) { e.preventDefault(); btns[next].focus(); activate(next); }
        });
      });
      function activate(i) {
        btns.forEach(function (b, j) {
          b.setAttribute("aria-selected", String(j === i));
          b.tabIndex = j === i ? 0 : -1;
        });
        panels.forEach(function (p, j) { p.hidden = j !== i; });
      }
    });
  }

  /* -------------------------------------------------------------- glossary */
  function initGlossary() {
    var g = DL.glossary;
    if (!g) return;
    var terms = Object.keys(g).filter(function (t) { return t.length > 2; });
    if (!terms.length) return;
    terms.sort(function (a, b) { return b.length - a.length; });
    var used = {};
    var budget = 60;

    function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    var re = new RegExp("\\b(" + terms.map(escapeRe).join("|") + ")\\b", "i");

    var roots = DL.qsa(".lesson p, .lesson li, .lesson td");
    roots.forEach(function (root) {
      if (budget <= 0) return;
      var node = root;
      // only touch simple text nodes
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (tn) {
          if (!tn.nodeValue || tn.nodeValue.trim().length < 4) return NodeFilter.FILTER_REJECT;
          if (tn.parentElement.closest("pre, code, .katex, .term, .lab, .quiz, .search")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var tn = walker.nextNode();
      while (tn && budget > 0) {
        var text = tn.nodeValue;
        var m = re.exec(text);
        if (m) {
          var key = null;
          var low = m[1].toLowerCase();
          for (var i = 0; i < terms.length; i++) {
            if (terms[i].toLowerCase() === low) { key = terms[i]; break; }
          }
          if (key && !used[key]) {
            used[key] = true;
            budget--;
            var before = text.slice(0, m.index);
            var after = text.slice(m.index + m[1].length);
            var span = DL.el("abbr", { class: "term", "data-term": key, title: g[key] });
            span.appendChild(document.createTextNode(m[1]));
            var pop = DL.el("span", { class: "term__pop", hidden: "", text: g[key] });
            span.appendChild(pop);
            var parent = tn.parentNode;
            parent.insertBefore(document.createTextNode(before), tn);
            parent.insertBefore(span, tn);
            parent.insertBefore(document.createTextNode(after), tn);
            parent.removeChild(tn);
            tn = null;
          }
        }
        if (!tn) break;
        tn = walker.nextNode();
        if (tn) {
          // restart walker detection is unnecessary: walker keeps moving
        }
      }
    });

    document.addEventListener("focusin", function (e) {
      var t = e.target.closest && e.target.closest(".term");
      if (t) showPop(t);
    });
    document.addEventListener("focusout", function (e) {
      var t = e.target.closest && e.target.closest(".term");
      if (t) hidePop(t);
    });
    document.addEventListener("mouseover", function (e) {
      var t = e.target.closest && e.target.closest(".term");
      if (t) showPop(t);
    });
    document.addEventListener("mouseout", function (e) {
      var t = e.target.closest && e.target.closest(".term");
      if (t && !t.contains(e.relatedTarget)) hidePop(t);
    });
    function showPop(t) { var p = t.querySelector(".term__pop"); if (p) p.hidden = false; }
    function hidePop(t) { var p = t.querySelector(".term__pop"); if (p) p.hidden = true; }
  }

  /* ----------------------------------------------------------------- search */
  function initSearch() {
    var triggers = DL.qsa('[data-action="search"]');
    if (!triggers.length) return;
    var index = DL.searchIndex || [];

    var input = DL.el("input", {
      class: "search__input", type: "search", placeholder: "Search lessons, concepts, formulas…",
      "aria-label": "Search lessons", autocomplete: "off"
    });
    var results = DL.el("ul", { class: "search__results", role: "listbox" });
    var panel = DL.el("div", { class: "search__panel", role: "dialog", "aria-modal": "true", "aria-label": "Search" }, [
      input, results,
      DL.el("div", { class: "search__hint" }, [
        DL.el("span", { text: "↑ ↓ move" }), DL.el("span", { text: "↵ open" }),
        DL.el("span", { text: "esc close" }), DL.el("span", { text: index.length + " entries" })
      ])
    ]);
    var overlay = DL.el("div", { class: "search", hidden: "" }, [panel]);
    document.body.appendChild(overlay);

    var active = -1;
    var current = [];

    function open() {
      overlay.hidden = false;
      input.value = "";
      run("");
      setTimeout(function () { input.focus(); }, 20);
    }
    function close() {
      overlay.hidden = true;
      triggers[0].focus();
    }

    function score(item, q) {
      var t = (item.t || "").toLowerCase();
      var h = (item.h || "").toLowerCase();
      var x = (item.x || "").toLowerCase();
      var s = 0;
      q.forEach(function (w) {
        if (t.indexOf(w) >= 0) s += 8;
        if (h.indexOf(w) >= 0) s += 4;
        if (x.indexOf(w) >= 0) s += 1;
      });
      return s;
    }

    function run(qraw) {
      var q = qraw.toLowerCase().trim();
      var tokens = q ? q.split(/\s+/).filter(Boolean) : [];
      var scored = index.map(function (it) {
        return { it: it, s: tokens.length ? score(it, tokens) : 1 };
      }).filter(function (r) { return r.s > 0; });
      scored.sort(function (a, b) { return b.s - a.s; });
      current = scored.slice(0, 14).map(function (r) { return r.it; });
      active = current.length ? 0 : -1;
      results.innerHTML = "";
      if (!current.length) {
        results.appendChild(DL.el("li", { class: "search__empty", text: "No matches. Try “residual”, “adam”, “dice”." }));
        return;
      }
      current.forEach(function (it, i) {
        var a = DL.el("a", { href: DL.root(it.u), class: i === 0 ? "is-active" : "" }, [
          DL.el("div", { class: "s-meta", text: (it.m || "").toUpperCase() + " · " + (it.t || "") }),
          DL.el("div", { class: "s-title", text: it.h || it.t }),
          it.x ? DL.el("div", { class: "s-snip", text: it.x }) : null
        ]);
        results.appendChild(DL.el("li", { role: "option", "aria-selected": String(i === 0) }, [a]));
      });
    }

    function move(d) {
      if (!current.length) return;
      active = (active + d + current.length) % current.length;
      DL.qsa("a", results).forEach(function (a, i) {
        a.classList.toggle("is-active", i === active);
        a.parentElement.setAttribute("aria-selected", String(i === active));
      });
      var el = DL.qsa("a", results)[active];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("input", function () { run(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        var a = DL.qsa("a", results)[active];
        if (a) window.location.href = a.getAttribute("href");
      } else if (e.key === "Escape") { close(); }
    });
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      var typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open(); }
      else if (e.key === "/" && !typing && overlay.hidden) { e.preventDefault(); open(); }
      else if (e.key === "Escape" && !overlay.hidden) close();
    });
    triggers.forEach(function (b) { b.addEventListener("click", open); });
  }

  /* -------------------------------------------------------------- progress */
  function drawRings() {
    DL.qsa("[data-progress]").forEach(function (c) {
      var m = c.getAttribute("data-progress");
      var stats = m === "all" ? { pct: DL.progress.overall().pct } : DL.progress.moduleStats(m);
      DL.progress.ring(c, stats.pct, {
        size: parseInt(c.getAttribute("data-size") || "46", 10),
        label: c.getAttribute("data-label") !== "0"
      });
    });
    DL.qsa("[data-progress-label]").forEach(function (el) {
      var m = el.getAttribute("data-progress-label");
      el.textContent = DL.progress.moduleStats(m).pct + "%";
    });
  }

  function initReadTracking() {
    var main = DL.qs("main.lesson");
    if (!main) return;
    var id = main.getAttribute("data-lesson");
    if (!id) return;
    var marked = false;
    function mark() {
      if (marked) return;
      marked = true;
      DL.progress.markRead(id);
      DL.qsa("[data-lesson-read]").forEach(function (el) { el.textContent = "Read"; });
    }
    // mark as read when the end of the lesson is in view
    var sentinel = DL.el("div", { style: { height: "1px" } });
    main.appendChild(sentinel);
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { mark(); io.disconnect(); }
      }, { rootMargin: "0px 0px -10% 0px" });
      io.observe(sentinel);
    }
    // fallback: after 45 s of engagement
    setTimeout(function () { if (document.visibilityState === "visible") mark(); }, 45000);
  }

  /* ---------------------------------------------------------------- tables */
  function initTables() {
    // Wide tables scroll inside their own box instead of widening the page.
    // U.table already returns a .table-wrap; this covers hand-written tables.
    DL.qsa("main table").forEach(function (t) {
      var p = t.parentElement;
      if (!p || (p.classList && p.classList.contains("table-wrap"))) return;
      var wrap = DL.el("div", { class: "table-wrap" });
      p.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
  }

  /* ------------------------------------------------------------------ init */
  L.init = function () {
    initTheme();
    initMobileNav();
    initToc();
    initReadingTime();
    initTables();
    initKatex();
    initHighlight();
    initCopyButtons();
    initTabs();
    initGlossary();
    initSearch();
    drawRings();
    initReadTracking();

    // mount quizzes
    if (DL.quiz) {
      DL.qsa(".quiz[data-quiz]").forEach(function (el) {
        DL.quiz.mount(el, {
          id: el.getAttribute("data-quiz"),
          exam: el.getAttribute("data-exam") === "1"
        });
      });
    }

    // lazily mount labs
    if (DL.widgets) DL.widgets.mountAll(document);

    // A print preview starts at the top of the lesson, so labs below the fold
    // would otherwise print as empty shells. Build them on demand first.
    var mountLabsForPrint = function () {
      if (!DL.widgets) return;
      DL.qsa("[data-widget]").forEach(function (el) { DL.widgets.mount(el); });
    };
    window.addEventListener("beforeprint", mountLabsForPrint);
    if (window.matchMedia && window.matchMedia("print").addEventListener) {
      window.matchMedia("print").addEventListener("change", function (e) {
        if (e.matches) mountLabsForPrint();
      });
    }
  };

  DL.lesson = L;
  DL.ready(function () { L.init(); });
})(window.DL);
