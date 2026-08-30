(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var observer = null;

  function applyStagger(el) {
    if (el.hasAttribute("data-reveal-delay-set")) {
      return;
    }

    var group = el.closest("[data-reveal-stagger]");
    if (!group) {
      return;
    }

    var items = group.querySelectorAll(".reveal");
    var index = 0;
    var i;
    for (i = 0; i < items.length; i += 1) {
      if (items[i] === el) {
        index = i;
        break;
      }
    }
    var step = parseFloat(group.getAttribute("data-reveal-stagger"));
    if (isNaN(step)) {
      step = 0.16;
    }
    el.style.setProperty("--reveal-delay", index * step + "s");
    el.setAttribute("data-reveal-delay-set", "true");
  }

  function revealEl(el) {
    if (el.classList.contains("is-inview")) {
      return;
    }
    applyStagger(el);
    el.classList.add("is-inview");
  }

  function observe(el) {
    if (el.getAttribute("data-reveal-bound") === "true") {
      return;
    }

    if (document.documentElement.classList.contains("is-hero-intro")) {
      return;
    }

    el.setAttribute("data-reveal-bound", "true");

    if (reduceMotion || !observer) {
      revealEl(el);
      return;
    }

    observer.observe(el);
  }

  function scan(root) {
    var scope = root || document;
    var nodes;
    var i;

    if (scope.classList && scope.classList.contains("reveal")) {
      observe(scope);
    }

    if (!scope.querySelectorAll) {
      return;
    }

    nodes = scope.querySelectorAll(".reveal");
    for (i = 0; i < nodes.length; i += 1) {
      observe(nodes[i]);
    }
  }

  if (!reduceMotion && typeof IntersectionObserver === "function") {
    observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          revealEl(entry.target);
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0,
        rootMargin: "0px 0px -8% 0px",
      }
    );
  } else if (!reduceMotion) {
    document.documentElement.classList.remove("js-reveal");
  }

  function revealNow(root) {
    var scope = root || document;
    var nodes;
    var i;

    function go(el) {
      el.setAttribute("data-reveal-bound", "true");
      revealEl(el);
      if (observer) {
        observer.unobserve(el);
      }
    }

    if (scope.classList && scope.classList.contains("reveal")) {
      go(scope);
    }

    if (!scope || !scope.querySelectorAll) {
      return;
    }

    nodes = scope.querySelectorAll(".reveal");
    for (i = 0; i < nodes.length; i += 1) {
      go(nodes[i]);
    }
  }

  window.RevealText = {
    scan: scan,
    revealNow: revealNow,
  };

  function init() {
    scan(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
