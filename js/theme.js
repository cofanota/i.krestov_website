(function () {
  "use strict";

  var STORAGE_KEY = "theme";
  var THEME_BG = {
    light: "#eae7e4",
    dark: "#100f0f"
  };
  var systemMq = window.matchMedia("(prefers-color-scheme: dark)");

  function getSystemTheme() {
    return systemMq.matches ? "dark" : "light";
  }

  function getStoredTheme() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        return stored;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function resolveTheme() {
    return getStoredTheme() || getSystemTheme();
  }

  function syncBrowserChrome(theme) {
    var root = document.documentElement;
    var body = document.body;
    var color = THEME_BG[theme];
    var schemeMeta = document.querySelector('meta[name="color-scheme"]');
    var probe = document.getElementById("safari-chrome-bg");

    root.style.colorScheme = theme;
    root.style.backgroundColor = color;

    if (body) {
      body.style.backgroundColor = color;
      if (!probe) {
        probe = document.createElement("div");
        probe.id = "safari-chrome-bg";
        probe.className = "safari-chrome-bg";
        probe.setAttribute("aria-hidden", "true");
        body.insertBefore(probe, body.firstChild);
      }
      probe.style.backgroundColor = color;
    }

    if (schemeMeta) {
      schemeMeta.setAttribute("content", theme);
    }

    document.querySelectorAll('meta[name="theme-color"]').forEach(function (node) {
      node.remove();
    });

    ["light", "dark"].forEach(function (scheme) {
      var themeColor = document.createElement("meta");
      themeColor.setAttribute("name", "theme-color");
      themeColor.setAttribute("media", "(prefers-color-scheme: " + scheme + ")");
      themeColor.setAttribute("content", color);
      document.head.appendChild(themeColor);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    syncBrowserChrome(theme);
    syncSegments(theme);
  }

  function syncSegments(theme) {
    var segments = document.querySelectorAll("[data-theme-value]");
    segments.forEach(function (segment) {
      var isActive = segment.getAttribute("data-theme-value") === theme;
      segment.setAttribute("aria-pressed", isActive ? "true" : "false");
      segment.classList.toggle("is-active", isActive);
    });
  }

  function setTheme(theme, persist) {
    if (theme !== "light" && theme !== "dark") {
      return;
    }

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (error) {
        /* ignore quota / privacy mode */
      }
      scrollThemeArmed = false;
    }

    if (document.documentElement.getAttribute("data-theme") === theme) {
      return;
    }

    applyTheme(theme);
  }

  function onSystemThemeChange() {
    if (getStoredTheme() || scrollThemeArmed) {
      return;
    }
    applyTheme(getSystemTheme());
  }

  var SCROLL_THEME_ENTER_PX = 48;
  var SCROLL_THEME_EXIT_PX = 120;
  var scrollThemeAtBottom = false;
  var scrollThemeArmed = false;
  var scrollThemeFrame = 0;

  function currentTheme() {
    var attr = document.documentElement.getAttribute("data-theme");
    return attr === "dark" || attr === "light" ? attr : resolveTheme();
  }

  function oppositeTheme(theme) {
    return theme === "dark" ? "light" : "dark";
  }

  function remainingScrollPx() {
    var root = document.documentElement;
    return root.scrollHeight - window.scrollY - window.innerHeight;
  }

  function pageCanScrollForTheme() {
    return document.documentElement.scrollHeight > window.innerHeight + SCROLL_THEME_EXIT_PX;
  }

  function syncScrollTheme() {
    if (!pageCanScrollForTheme()) {
      if (scrollThemeArmed) {
        scrollThemeArmed = false;
        setTheme(resolveTheme(), false);
      }
      scrollThemeAtBottom = false;
      return;
    }

    var remaining = remainingScrollPx();
    var nowAtBottom = scrollThemeAtBottom
      ? remaining <= SCROLL_THEME_EXIT_PX
      : remaining <= SCROLL_THEME_ENTER_PX;

    if (nowAtBottom === scrollThemeAtBottom) {
      return;
    }

    scrollThemeAtBottom = nowAtBottom;

    if (scrollThemeAtBottom) {
      scrollThemeArmed = true;
      setTheme(oppositeTheme(currentTheme()), false);
      return;
    }

    if (scrollThemeArmed) {
      scrollThemeArmed = false;
      setTheme(resolveTheme(), false);
    }
  }

  function requestScrollThemeSync() {
    if (scrollThemeFrame) {
      return;
    }
    scrollThemeFrame = window.requestAnimationFrame(function () {
      scrollThemeFrame = 0;
      syncScrollTheme();
    });
  }

  function init() {
    applyTheme(resolveTheme());

    var switchRoots = document.querySelectorAll(".theme-switch");
    switchRoots.forEach(function (switchRoot) {
      switchRoot.addEventListener("click", function (event) {
        var segment = event.target.closest("[data-theme-value]");
        if (!segment || !switchRoot.contains(segment)) {
          return;
        }

        setTheme(segment.getAttribute("data-theme-value"), true);
      });
    });

    if (typeof systemMq.addEventListener === "function") {
      systemMq.addEventListener("change", onSystemThemeChange);
    } else if (typeof systemMq.addListener === "function") {
      systemMq.addListener(onSystemThemeChange);
    }

    var isHome = document.body && document.body.getAttribute("data-page") === "home";
    if (!isHome || !document.querySelector(".folio-desk")) {
      return;
    }

    window.addEventListener("scroll", requestScrollThemeSync, { passive: true });
    window.addEventListener("resize", requestScrollThemeSync);
    syncScrollTheme();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
