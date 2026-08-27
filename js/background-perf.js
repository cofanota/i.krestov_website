(function () {
  "use strict";

  var root = document.documentElement;
  var DIAG_PARAM = "diag";

  function isWebKitEngine() {
    if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
      return CSS.supports("-webkit-backdrop-filter", "blur(1px)");
    }

    return /AppleWebKit/i.test(navigator.userAgent);
  }

  function isChromiumEngine() {
    return (
      typeof navigator.userAgentData !== "undefined" &&
      navigator.userAgentData.brands &&
      navigator.userAgentData.brands.some(function (brand) {
        return /Chrom/i.test(brand.brand);
      })
    ) || /Chrome|Chromium|Edg\//i.test(navigator.userAgent);
  }

  function readDiagFlags() {
    try {
      var params = new URLSearchParams(window.location.search);
      var raw = params.get(DIAG_PARAM);
      if (!raw) {
        return [];
      }

      return raw
        .split(/[,\s]+/)
        .map(function (value) {
          return value.trim();
        })
        .filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function applyDiagFlags(flags) {
    if (!flags.length) {
      root.removeAttribute("data-diag");
      return;
    }

    root.setAttribute("data-diag", flags.join(" "));
  }

  function percentile(values, p) {
    if (!values.length) {
      return 0;
    }

    var sorted = values.slice().sort(function (a, b) {
      return a - b;
    });
    var index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
    );
    return sorted[index];
  }

  function startHoverProfiler() {
    var samples = [];
    var running = false;
    var stopTimer = null;
    var lastTs = 0;
    var targetLabel = "";

    function tick(ts) {
      if (!running) {
        return;
      }

      if (lastTs) {
        samples.push(ts - lastTs);
      }
      lastTs = ts;
      window.requestAnimationFrame(tick);
    }

    function stopProfiler() {
      running = false;
      window.clearTimeout(stopTimer);

      if (!samples.length) {
        console.info("[hover-diag] No frame samples collected.");
        return;
      }

      var summary = {
        target: targetLabel,
        samples: samples.length,
        fpsP50: Math.round(1000 / percentile(samples, 50)),
        fpsP95: Math.round(1000 / percentile(samples, 95)),
        frameMsP50: Math.round(percentile(samples, 50) * 10) / 10,
        frameMsP95: Math.round(percentile(samples, 95) * 10) / 10,
        frameMsMax: Math.round(Math.max.apply(null, samples) * 10) / 10,
        diag: root.getAttribute("data-diag") || "",
        engine: isChromiumEngine() ? "chromium" : isWebKitEngine() ? "webkit" : "other",
      };

      console.info("[hover-diag] Hover frame summary", summary);
    }

    function startProfiler(label) {
      targetLabel = label;
      samples = [];
      lastTs = 0;
      running = true;
      window.clearTimeout(stopTimer);
      window.requestAnimationFrame(tick);
      stopTimer = window.setTimeout(stopProfiler, 2000);
    }

    var selectors = [
      ".site-nav__link",
      ".page-back__link",
      ".btn",
      ".project-row",
      ".contact-link",
      ".site-nav__identity",
    ].join(",");

    document.addEventListener(
      "pointerenter",
      function (event) {
        var target = event.target.closest(selectors);
        if (!target) {
          return;
        }

        var label = target.className || target.tagName;
        startProfiler(label);
      },
      true
    );

    console.info(
      "[hover-diag] Profiler active. Hover interactive elements for 2s to log frame stats."
    );
  }

  function init() {
    var flags = readDiagFlags();
    applyDiagFlags(flags);

    if (flags.indexOf("profile") !== -1) {
      startHoverProfiler();
    }

    if (flags.length) {
      console.info("[hover-diag] Active flags:", flags.join(", "));
    }
  }

  init();
})();
