/* DeepLearn Lab — landing.js
   Renders the module roadmap with live progress rings. */
(function (DL) {
  "use strict";

  function card(m) {
    var stats = DL.progress.moduleStats(m.id);
    var ring = DL.el("canvas", {
      class: "progress-ring",
      "data-progress": m.id,
      "data-size": "46",
      width: "46",
      height: "46",
      "aria-label": m.title + " progress " + stats.pct + " percent",
      role: "img"
    });
    var a = DL.el("a", {
      class: "module-card", href: m.href, "data-module": m.id
    }, [
      DL.el("div", { class: "module-card__top" }, [
        DL.el("div", {}, [
          DL.el("p", { class: "module-card__n", text: "MODULE " + m.n }),
          DL.el("h3", { text: m.title })
        ]),
        ring
      ]),
      DL.el("p", { text: m.blurb }),
      DL.el("div", { class: "module-card__tags" }, m.tags.map(function (t) {
        return DL.el("span", { class: "tag", text: t });
      })),
      DL.el("div", { class: "module-card__meta" }, [
        DL.el("span", { text: m.lessons + " lessons" }),
        DL.el("span", { text: stats.read + "/" + m.lessons + " read · " + stats.pct + "%" })
      ])
    ]);
    return a;
  }

  function render() {
    var grid = DL.qs("#moduleGrid");
    if (grid) {
      grid.innerHTML = "";
      DL.MODULES.forEach(function (m) { grid.appendChild(card(m)); });
    }
    var totalLessons = DL.MODULES.reduce(function (n, m) { return n + m.lessons; }, 0);
    DL.qsa("[data-total-lessons]").forEach(function (el) { el.textContent = totalLessons; });
  }

  DL.ready(function () {
    render();
    // redraw rings now (lesson.js may not be loaded on this page)
    if (DL.progress && DL.progress.ring) {
      DL.qsa("[data-progress]").forEach(function (c) {
        var id = c.getAttribute("data-progress");
        var pct = id === "all" ? DL.progress.overall().pct : DL.progress.moduleStats(id).pct;
        DL.progress.ring(c, pct, { size: 46 });
      });
    }
    document.addEventListener("dl:theme", function () {
      DL.qsa("[data-progress]").forEach(function (c) {
        var id = c.getAttribute("data-progress");
        var pct = id === "all" ? DL.progress.overall().pct : DL.progress.moduleStats(id).pct;
        DL.progress.ring(c, pct, { size: 46 });
      });
    });
  });
})(window.DL);
