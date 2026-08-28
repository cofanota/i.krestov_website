(function () {
  "use strict";

  var SECTION_IDS = ["home", "cases", "experience", "tools", "about", "contact"];
  var SCROLL_SECTION_IDS = ["home", "cases", "experience", "about", "contact"];

  function navHighlightId(id) {
    return id === "tools" ? "experience" : id;
  }

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
          id === "cases"
            ? window.location.pathname + window.location.search
            : "#" + id;
        window.history.replaceState(null, "", nextUrl);
      } else if (id !== "cases") {
        window.location.hash = id;
      }
    }

    return true;
  }

  function setActiveSection(id) {
    var highlightId = navHighlightId(id);
    document.querySelectorAll("[data-nav-section]").forEach(function (link) {
      var section = link.getAttribute("data-nav-section");
      if (section === highlightId) {
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

    var isHome = document.body.getAttribute("data-page") === "home";

    if (!isHome) {
      return;
    }

    var sections = SCROLL_SECTION_IDS.map(function (id) {
      return document.getElementById(id);
    }).filter(Boolean);

    function resolveSectionFromLink(link) {
      if (link.classList.contains("site-nav__cta")) {
        return "contact";
      }
      if (link.classList.contains("site-nav__identity")) {
        return "cases";
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
      var activeId = "cases";

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
      var id = getSectionIdFromHash(window.location.hash) || "cases";
      scrollToSection(id, false);
      setActiveSection(id);
    });

    if (window.location.hash === "#cases") {
      if (window.history && typeof window.history.replaceState === "function") {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }

    var initialId = getSectionIdFromHash(window.location.hash) || "cases";
    if (initialId !== "cases") {
      window.requestAnimationFrame(function () {
        scrollToSection(initialId, false);
        setActiveSection(initialId);
      });
    } else {
      setActiveSection("cases");
    }

    syncFromScroll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
