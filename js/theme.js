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
    var color = THEME_BG[theme];
    var schemeMeta = document.querySelector('meta[name="color-scheme"]');
    var themeColor;

    root.style.colorScheme = theme;

    if (schemeMeta) {
      schemeMeta.setAttribute("content", theme);
    }

    document.querySelectorAll('meta[name="theme-color"]').forEach(function (node) {
      node.remove();
    });

    themeColor = document.createElement("meta");
    themeColor.setAttribute("name", "theme-color");
    themeColor.setAttribute("content", color);
    document.head.appendChild(themeColor);
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

  function fadeDeskTheme() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    var root = document.documentElement;
    root.classList.add("is-theme-switching");
    window.clearTimeout(fadeDeskTheme.timer);
    fadeDeskTheme.timer = window.setTimeout(function () {
      root.classList.remove("is-theme-switching");
    }, 320);
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
    }

    if (document.documentElement.getAttribute("data-theme") === theme) {
      return;
    }

    fadeDeskTheme();
    applyTheme(theme);
  }

  function onSystemThemeChange() {
    if (getStoredTheme()) {
      return;
    }
    fadeDeskTheme();
    applyTheme(getSystemTheme());
  }

  function init() {
    applyTheme(resolveTheme());

    var switchRoots = document.querySelectorAll(".theme-switch");
    if (!switchRoots.length) {
      return;
    }

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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
