/* ============================================================
   AVALIA UI — client interactions (framework-agnostic)
   ------------------------------------------------------------
   Works with plain HTML, Astro, or React islands.
   Import once (e.g. in your base Layout):

     import 'avalia-ui/avalia-ui.js';

   …or drop <script src="/avalia-ui/avalia-ui.js"></script> before </body>.
   Safe to call init() multiple times — it is idempotent.
   ============================================================ */
(function (global) {
  "use strict";

  var AGE_KEY = "avalia_age_ok";
  var reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- TOAST (public API) ---------- */
  var ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>'
  };
  function ensureStack() {
    var s = document.getElementById("toast-stack");
    if (!s) { s = document.createElement("div"); s.id = "toast-stack"; document.body.appendChild(s); }
    return s;
  }
  function toast(opts) {
    opts = opts || {};
    var type = opts.type || "info";
    var stack = ensureStack();
    var el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.setAttribute("role", "status");
    el.innerHTML = '<div class="toast-icon">' + (ICONS[type] || ICONS.info) + '</div>' +
      '<div><div class="toast-title"></div><div class="toast-msg"></div></div>';
    el.querySelector(".toast-title").textContent = opts.title || "";
    el.querySelector(".toast-msg").textContent = opts.message || "";
    stack.appendChild(el);
    var ttl = opts.duration == null ? 4800 : opts.duration;
    setTimeout(function () {
      el.style.transition = "opacity 300ms, transform 300ms";
      el.style.opacity = "0"; el.style.transform = "translateX(40px)";
      setTimeout(function () { el.remove(); }, 320);
    }, ttl);
    return el;
  }

  /* ---------- AGE GATE ---------- */
  function initAgeGate() {
    var gate = document.getElementById("agegate");
    if (!gate || gate.dataset.bound) return;
    gate.dataset.bound = "1";

    function show() { gate.classList.add("is-shown"); document.documentElement.style.overflow = "hidden"; }
    function hide() { gate.classList.remove("is-shown"); document.documentElement.style.overflow = ""; }

    var passed = false;
    try { passed = localStorage.getItem(AGE_KEY) === "1"; } catch (e) {}
    if (!passed) show();

    gate.querySelectorAll("[data-gate-confirm]").forEach(function (b) {
      b.addEventListener("click", function () {
        try { localStorage.setItem(AGE_KEY, "1"); } catch (e) {}
        hide();
      });
    });
    gate.querySelectorAll("[data-gate-leave]").forEach(function (b) {
      b.addEventListener("click", function () {
        var url = b.getAttribute("data-leave-url") || "https://www.google.com";
        global.location.href = url;
      });
    });
  }

  /* ---------- NAVBAR scroll state ---------- */
  function initNavbar() {
    document.querySelectorAll(".navbar[data-scroll-aware]").forEach(function (nav) {
      if (nav.dataset.bound) return;
      nav.dataset.bound = "1";
      var threshold = parseInt(nav.getAttribute("data-scroll-threshold") || "40", 10);
      var onScroll = function () { nav.classList.toggle("is-scrolled", global.scrollY > threshold); };
      onScroll();
      global.addEventListener("scroll", onScroll, { passive: true });
    });
  }

  /* ---------- MOBILE MENU ---------- */
  function initMobileMenu() {
    document.querySelectorAll("[data-mm-open]").forEach(function (b) {
      if (b.dataset.bound) return; b.dataset.bound = "1";
      b.addEventListener("click", function () {
        var t = document.querySelector(b.getAttribute("data-mm-open"));
        if (t) t.classList.add("is-open");
      });
    });
    document.querySelectorAll("[data-mm-close]").forEach(function (b) {
      if (b.dataset.bound) return; b.dataset.bound = "1";
      b.addEventListener("click", function () {
        var t = document.querySelector(b.getAttribute("data-mm-close"));
        if (t) t.classList.remove("is-open");
      });
    });
  }

  /* ---------- FILTER PILLS ---------- */
  function initFilters() {
    document.querySelectorAll("[data-filter-group]").forEach(function (group) {
      if (group.dataset.bound) return; group.dataset.bound = "1";
      group.querySelectorAll(".pill").forEach(function (p) {
        p.addEventListener("click", function () {
          group.querySelectorAll(".pill").forEach(function (x) { x.classList.remove("is-active"); });
          p.classList.add("is-active");
          group.dispatchEvent(new CustomEvent("filter:change", {
            detail: { value: p.getAttribute("data-value") || p.textContent.trim() },
            bubbles: true
          }));
        });
      });
    });
  }

  /* ---------- ACCORDION ---------- */
  function initAccordion() {
    document.querySelectorAll("[data-accordion]").forEach(function (acc) {
      if (acc.dataset.bound) return; acc.dataset.bound = "1";
      var single = acc.hasAttribute("data-accordion-single");
      acc.querySelectorAll(".acc-head").forEach(function (head) {
        head.addEventListener("click", function () {
          var item = head.closest(".acc-item");
          var body = item.querySelector(".acc-body");
          var open = item.classList.contains("is-open");
          if (single && !open) {
            acc.querySelectorAll(".acc-item.is-open").forEach(function (o) {
              o.classList.remove("is-open");
              o.querySelector(".acc-body").style.maxHeight = "0px";
            });
          }
          if (open) { item.classList.remove("is-open"); body.style.maxHeight = "0px"; }
          else { item.classList.add("is-open"); body.style.maxHeight = body.scrollHeight + "px"; }
        });
      });
    });
  }

  /* ---------- LIGHTBOX / GALLERY ---------- */
  function initLightbox() {
    var lb = document.getElementById("lightbox");
    if (!lb) return;
    var stage = lb.querySelector(".lb-stage");
    var state = { items: [], i: 0 };

    function render() {
      var it = state.items[state.i];
      if (!it) return;
      if (it.src) { stage.style.background = "#0c1020"; stage.style.backgroundImage = "url(" + it.src + ")"; stage.style.backgroundSize = "cover"; stage.style.backgroundPosition = "center"; }
      else { stage.style.background = it.bg || "var(--bg-elevated)"; }
    }
    function open(items, i) { state.items = items; state.i = i; render(); lb.classList.add("is-open"); }
    function close() { lb.classList.remove("is-open"); }
    function step(d) { if (!state.items.length) return; state.i = (state.i + d + state.items.length) % state.items.length; render(); }

    if (!lb.dataset.bound) {
      lb.dataset.bound = "1";
      var prev = lb.querySelector(".lb-prev"), next = lb.querySelector(".lb-next"), x = lb.querySelector(".lb-close");
      if (prev) prev.addEventListener("click", function () { step(-1); });
      if (next) next.addEventListener("click", function () { step(1); });
      if (x) x.addEventListener("click", close);
      lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
      document.addEventListener("keydown", function (e) {
        if (!lb.classList.contains("is-open")) return;
        if (e.key === "ArrowRight") step(1);
        else if (e.key === "ArrowLeft") step(-1);
        else if (e.key === "Escape") close();
      });
      var sx = 0;
      stage.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
      stage.addEventListener("touchend", function (e) {
        var dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
      });
      lb._open = open;
    }

    document.querySelectorAll("[data-gallery]").forEach(function (g) {
      if (g.dataset.bound) return; g.dataset.bound = "1";
      var thumbs = Array.prototype.slice.call(g.querySelectorAll(".thumb"));
      var items = thumbs.map(function (t) { return { src: t.getAttribute("data-src"), bg: t.getAttribute("data-bg") }; });
      thumbs.forEach(function (t, i) {
        t.addEventListener("click", function () {
          g.querySelectorAll(".thumb").forEach(function (x2) { x2.classList.remove("is-active"); });
          t.classList.add("is-active");
          (lb._open || open)(items, i);
        });
      });
    });
  }

  /* ---------- SCROLL REVEAL ---------- */
  function initReveal() {
    var els = document.querySelectorAll(".av-reveal:not(.is-in)");
    if (reduce || !("IntersectionObserver" in global)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- INIT ---------- */
  function init() {
    initAgeGate();
    initNavbar();
    initMobileMenu();
    initFilters();
    initAccordion();
    initLightbox();
    initReveal();
  }

  var AvaliaUI = { init: init, toast: toast };
  global.AvaliaUI = AvaliaUI;
  global.avaliaToast = toast; // convenience

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // re-run after Astro client-side view transitions / island hydration
  document.addEventListener("astro:page-load", init);
})(typeof window !== "undefined" ? window : this);
