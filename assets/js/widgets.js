/* ==========================================================================
   DeepLearn Lab — widgets.js
   Registry + lazy mounting. A widget is <section class="lab" data-widget="id">.
   ========================================================================== */
(function (DL) {
  "use strict";

  var registry = {};
  var mounted = new Set();
  var missing = [];
  var observer = null;

  function buildChrome(el) {
    var title = el.getAttribute("data-title") || "";
    var badge = el.getAttribute("data-badge") || "illustrative";
    var note = el.getAttribute("data-note") || "";
    var index = el.getAttribute("data-index");

    if (!el.querySelector(".lab__body")) {
      var body = DL.el("div", { class: "lab__body" });
      while (el.firstChild) body.appendChild(el.firstChild);
      el.appendChild(body);
    }

    if (el.getAttribute("data-noheader") !== "1" && !el.querySelector(".lab__head")) {
      var head = DL.el("header", { class: "lab__head" }, [
        index ? DL.el("span", { class: "lab__index", text: "LAB " + index }) : null,
        DL.el("h3", { class: "lab__title", text: title || "Interactive lab" }),
        DL.el("span", { class: "lab__badge-slot" }, [DL.badge(badge)])
      ]);
      el.insertBefore(head, el.firstChild);
    }

    if (note && !el.querySelector(".lab__note")) {
      el.appendChild(DL.el("p", { class: "lab__note", text: note }));
    }
  }

  function mountEl(el) {
    var id = el.getAttribute("data-widget");
    if (!id) return false;
    if (el.dataset.mounted === "1") return false;
    var fn = registry[id];
    if (!fn) {
      if (missing.indexOf(id) < 0) missing.push(id);
      el.dataset.mounted = "missing";
      var body = el.querySelector(".lab__body") || el;
      body.innerHTML = "";
      body.appendChild(DL.el("p", {
        class: "lab__loading",
        text: "This lab is not available on this page (" + id + ")."
      }));
      return false;
    }

    buildChrome(el);
    var raw = el.getAttribute("data-opts");
    var opts = {};
    if (raw) { try { opts = JSON.parse(raw); } catch (e) { opts = {}; } }

    var body = el.querySelector(".lab__body");
    body.setAttribute("aria-busy", "false");
    body.innerHTML = "";

    try {
      var api = fn(body, opts) || {};
      el._widgetApi = api;
      el.dataset.mounted = "1";
      mounted.add(id);
      var ev;
      try { ev = new CustomEvent("dl:widget-mounted", { detail: { id: id, el: el }, bubbles: true }); }
      catch (e2) { ev = document.createEvent("CustomEvent"); ev.initCustomEvent("dl:widget-mounted", true, false, { id: id, el: el }); }
      el.dispatchEvent(ev);
      return true;
    } catch (err) {
      el.dataset.mounted = "error";
      body.innerHTML = "";
      body.appendChild(DL.el("div", { class: "callout callout--warn" }, [
        DL.el("p", { class: "callout__title", text: "Lab failed to start" }),
        DL.el("p", { text: "Reload the page to retry. (" + (err && err.message) + ")" })
      ]));
      return false;
    }
  }

  function ensureObserver() {
    if (observer || !("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          mountEl(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "500px 0px", threshold: 0.01 });
  }

  var API = {
    register: function (id, fn) {
      if (!id || typeof fn !== "function") return;
      registry[id] = fn;
    },

    has: function (id) { return !!registry[id]; },

    registry: function () { return registry; },
    mounted: function () { return mounted; },
    missing: function () { return missing.slice(); },

    mountAll: function (root) {
      root = root || document;
      var els = DL.qsa("[data-widget]", root);
      ensureObserver();
      var count = 0;
      els.forEach(function (el) {
        if (el.dataset.mounted) return;
        el.querySelectorAll(".lab__body").forEach(function (b) { b.setAttribute("aria-busy", "true"); });
        if (observer) {
          observer.observe(el);
        } else {
          if (mountEl(el)) count++;
        }
      });
      return count;
    },

    mount: function (el) { return mountEl(el); },

    unmountAll: function () {
      DL.qsa("[data-widget]").forEach(function (el) {
        if (el._widgetApi && el._widgetApi.destroy) {
          try { el._widgetApi.destroy(); } catch (e) {}
        }
        el.dataset.mounted = "";
        el._widgetApi = null;
      });
      mounted.clear();
    }
  };

  DL.widgets = API;
})(window.DL);
