(function () {
  "use strict";

  var COMPACT_QUERY = "(max-width: 63.9375rem)";

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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
