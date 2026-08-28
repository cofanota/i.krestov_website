(function () {
  "use strict";

  var COMPACT_QUERY = "(max-width: 63.9375rem)";
  var SECTION_IDS = ["home", "cases", "tools", "about", "contact"];

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function getSectionIdFromHash(hash) {
    var id = String(hash || "").replace(/^#/, "");
    return SECTION_IDS.indexOf(id) !== -1 ? id : "";
  }

  function scrollToSection(id, updateHash) {
    var target = document.getElementById(id);
    if (!target) {
      return false;
    }

    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });

    if (updateHash) {
      if (window.history && typeof window.history.replaceState === "function") {
        var nextUrl =
          id === "home" ? window.location.pathname + window.location.search : "#" + id;
        window.history.replaceState(null, "", nextUrl);
      } else if (id !== "home") {
        window.location.hash = id;
      }
    }

    return true;
  }

  function setActiveSection(id) {
    document.querySelectorAll("[data-nav-section]").forEach(function (link) {
      var section = link.getAttribute("data-nav-section");
      if (section === id) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function init() {
    var nav = document.querySelector("[data-site-nav]");
    if (!nav) {
      return;
    }

    var moreBtn = nav.querySelector(".site-nav__more");
    var panel = nav.querySelector("#site-nav-panel");
    if (!moreBtn || !panel) {
      return;
    }

    var compactMq = window.matchMedia(COMPACT_QUERY);
    var isHome = document.body.getAttribute("data-page") === "home";

    function setExpanded(expanded) {
      var next = Boolean(expanded) && compactMq.matches;
      nav.classList.toggle("is-expanded", next);
      moreBtn.setAttribute("aria-expanded", next ? "true" : "false");
    }

    function toggleExpanded() {
      setExpanded(moreBtn.getAttribute("aria-expanded") !== "true");
    }

    moreBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleExpanded();
    });

    document.addEventListener("click", function (event) {
      if (!nav.classList.contains("is-expanded")) {
        return;
      }
      if (nav.contains(event.target)) {
        return;
      }
      setExpanded(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") {
        return;
      }
      if (!nav.classList.contains("is-expanded")) {
        return;
      }
      setExpanded(false);
      moreBtn.focus();
    });

    function onBreakpointChange() {
      if (!compactMq.matches) {
        setExpanded(false);
      }
    }

    if (typeof compactMq.addEventListener === "function") {
      compactMq.addEventListener("change", onBreakpointChange);
    } else if (typeof compactMq.addListener === "function") {
      compactMq.addListener(onBreakpointChange);
    }

    setExpanded(false);

    if (!isHome) {
      nav.addEventListener("click", function (event) {
        var link = event.target.closest(
          "a.site-nav__link, a.site-nav__cta, a.site-nav__identity"
        );
        if (!link) {
          return;
        }
        setExpanded(false);
      });
      return;
    }

    var sections = SECTION_IDS.map(function (id) {
      return document.getElementById(id);
    }).filter(Boolean);

    function resolveSectionFromLink(link) {
      if (link.classList.contains("site-nav__cta")) {
        return "contact";
      }
      if (link.classList.contains("site-nav__identity")) {
        return "home";
      }
      return (
        link.getAttribute("data-nav-section") ||
        getSectionIdFromHash(link.getAttribute("href") || "")
      );
    }

    nav.addEventListener("click", function (event) {
      var link = event.target.closest(
        "[data-nav-section], .site-nav__cta, .site-nav__identity"
      );
      if (!link || !nav.contains(link)) {
        return;
      }

      var id = resolveSectionFromLink(link);
      if (!id || !document.getElementById(id)) {
        return;
      }

      event.preventDefault();
      scrollToSection(id, true);
      setActiveSection(id);
      setExpanded(false);
    });

    document.addEventListener("click", function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link || nav.contains(link)) {
        return;
      }

      var id = getSectionIdFromHash(link.getAttribute("href"));
      if (!id || !document.getElementById(id)) {
        return;
      }

      event.preventDefault();
      scrollToSection(id, true);
      setActiveSection(id);
    });

    function syncFromScroll() {
      var marker = window.scrollY + Math.min(160, window.innerHeight * 0.25);
      var activeId = "home";

      sections.forEach(function (section) {
        if (section.offsetTop <= marker) {
          activeId = section.id;
        }
      });

      setActiveSection(activeId);
    }

    var scrollTimer;
    window.addEventListener(
      "scroll",
      function () {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(syncFromScroll, 50);
      },
      { passive: true }
    );

    window.addEventListener("hashchange", function () {
      var id = getSectionIdFromHash(window.location.hash) || "home";
      scrollToSection(id, false);
      setActiveSection(id);
    });

    var initialId = getSectionIdFromHash(window.location.hash) || "home";
    if (initialId !== "home") {
      window.requestAnimationFrame(function () {
        scrollToSection(initialId, false);
        setActiveSection(initialId);
      });
    } else {
      setActiveSection("home");
    }

    syncFromScroll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
