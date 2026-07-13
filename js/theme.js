(function () {
  "use strict";

  var STORAGE_KEY = "theme";
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

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
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
    }

    applyTheme(theme);
  }

  function onSystemThemeChange() {
    if (getStoredTheme()) {
      return;
    }
    applyTheme(getSystemTheme());
  }

  function init() {
    applyTheme(resolveTheme());

    var switchRoot = document.querySelector(".theme-switch");
    if (!switchRoot) {
      return;
    }

    switchRoot.addEventListener("click", function (event) {
      var segment = event.target.closest("[data-theme-value]");
      if (!segment || !switchRoot.contains(segment)) {
        return;
      }

      setTheme(segment.getAttribute("data-theme-value"), true);
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
