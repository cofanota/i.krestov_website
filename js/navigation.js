(function () {
  "use strict";

  var SECTION_IDS = ["home", "cases", "about", "experience", "tools", "contact"];
  var SCROLL_SECTION_IDS = ["home", "cases", "about", "experience", "contact"];
  var SCROLLED_PX = 8;
  var SCROLL_SECTION_KEY = "icross-scroll-section";

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

  function clearSectionHash() {
    if (!window.location.hash) {
      return;
    }
    if (window.history && typeof window.history.replaceState === "function") {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  }

  function takePendingScrollSection() {
    var stored = "";
    try {
      stored = sessionStorage.getItem(SCROLL_SECTION_KEY) || "";
      sessionStorage.removeItem(SCROLL_SECTION_KEY);
    } catch (error) {
      stored = "";
    }
    return getSectionIdFromHash(stored);
  }

  function isHomePath(pathname) {
    var path = String(pathname || "").replace(/\/index\.html$/i, "");
    if (!path || path === "/") {
      return true;
    }
    var base = String(window.SITE_BASE_PATH || "/").replace(/\/index\.html$/i, "");
    if (base.length > 1) {
      base = base.replace(/\/$/, "");
    }
    return path === base;
  }

  function rememberSectionAndOpen(link, id) {
    try {
      sessionStorage.setItem(SCROLL_SECTION_KEY, id);
    } catch (error) {}
    var url = new URL(link.href, window.location.href);
    url.hash = "";
    window.location.assign(url.pathname + url.search || "/");
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
      clearSectionHash();
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

  function getNavPaddingResetMarker() {
    /* Compact: Tools is below Experience — wait for Tools.
       Desktop: Experience + Tools share one row. */
    var compact = window.matchMedia("(max-width: 63.9375rem)").matches;
    if (compact) {
      return (
        document.getElementById("tools") ||
        document.querySelector(".folio-row--split")
      );
    }
    return (
      document.querySelector(".folio-row--split") ||
      document.getElementById("experience")
    );
  }

  function syncPageScrolled() {
    var scrolled = window.scrollY > SCROLLED_PX;
    var isHome = document.body.getAttribute("data-page") === "home";

    if (isHome && scrolled) {
      var marker = getNavPaddingResetMarker();
      var nav = document.querySelector("[data-site-nav]");
      if (marker && nav) {
        var navBottom = nav.getBoundingClientRect().bottom;
        /* Reset only while leaving the marker — after its bottom clears the header. */
        if (marker.getBoundingClientRect().bottom <= navBottom) {
          scrolled = false;
        }
      }
    }

    document.documentElement.classList.toggle("is-page-scrolled", scrolled);
  }

  function init() {
    var nav = document.querySelector("[data-site-nav]");
    if (!nav) {
      return;
    }

    window.addEventListener("scroll", syncPageScrolled, { passive: true });
    syncPageScrolled();

    var isHome = document.body.getAttribute("data-page") === "home";

    document.addEventListener("click", function (event) {
      if (isHome || event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      var link = event.target.closest("a[href]");
      if (!link || link.target === "_blank") {
        return;
      }

      var url;
      try {
        url = new URL(link.href, window.location.href);
      } catch (error) {
        return;
      }

      var id = getSectionIdFromHash(url.hash);
      if (!id || !isHomePath(url.pathname)) {
        return;
      }

      event.preventDefault();
      rememberSectionAndOpen(link, id);
    });

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
      clearSectionHash();
    });

    var initialId =
      takePendingScrollSection() ||
      getSectionIdFromHash(window.location.hash) ||
      "home";
    clearSectionHash();
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
