(function () {
  "use strict";

  var LOGO_MOVE_MS = 900;
  var TEXT_MS = 2200;
  var LINE_STAGGER_MS = 120;
  var REST_MS = 1400;
  var FAST_MS = 200;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var landTimer = null;
  var doneTimer = null;
  var landed = false;
  var finished = false;
  var hurried = false;
  var hero = null;

  function shouldPlay() {
    if (reduceMotion) {
      return false;
    }
    if (!document.body || document.body.getAttribute("data-page") !== "home") {
      return false;
    }
    var hash = String(window.location.hash || "").replace(/^#/, "");
    if (hash && hash !== "home") {
      return false;
    }
    return document.documentElement.classList.contains("is-hero-intro");
  }

  function clearTimers() {
    window.clearTimeout(landTimer);
    window.clearTimeout(doneTimer);
  }

  function finish() {
    if (finished) {
      return;
    }
    finished = true;
    clearTimers();
    unbindHurry();
    document.documentElement.classList.remove("is-hero-intro");
    document.documentElement.classList.remove("is-hero-rest");
    document.documentElement.classList.remove("is-hero-fast");
  }

  function logoFromCenter(wrap) {
    var rect = wrap.getBoundingClientRect();
    var dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
    var dy = window.innerHeight / 2 - (rect.top + rect.height / 2);
    wrap.style.setProperty(
      "--hero-logo-from",
      "translate3d(" + dx + "px, " + dy + "px, 0)"
    );
  }

  function onLand() {
    if (landed || !hero) {
      return;
    }
    landed = true;
    hero.classList.add("is-landed");
    document.documentElement.classList.add("is-hero-rest");

    if (window.RevealText) {
      window.RevealText.revealNow(document.querySelector(".folio-stack__inner"));
    }
  }

  function remainingMs() {
    if (hurried) {
      return FAST_MS;
    }
    return LOGO_MOVE_MS + Math.max(TEXT_MS + LINE_STAGGER_MS, REST_MS) - (landed ? LOGO_MOVE_MS : 0);
  }

  function hurry() {
    if (finished || hurried) {
      return;
    }
    hurried = true;
    clearTimers();

    if (hero) {
      hero.classList.add("is-playing");
      hero.classList.add("is-fast");
    }
    document.documentElement.classList.add("is-hero-fast");

    onLand();
    doneTimer = window.setTimeout(finish, FAST_MS);
  }

  function onScrollIntent() {
    hurry();
  }

  function bindHurry() {
    window.addEventListener("wheel", onScrollIntent, { passive: true });
    window.addEventListener("touchmove", onScrollIntent, { passive: true });
    window.addEventListener("scroll", onScrollIntent, { passive: true });
    window.addEventListener("keydown", onKeyIntent, false);
  }

  function unbindHurry() {
    window.removeEventListener("wheel", onScrollIntent, { passive: true });
    window.removeEventListener("touchmove", onScrollIntent, { passive: true });
    window.removeEventListener("scroll", onScrollIntent, { passive: true });
    window.removeEventListener("keydown", onKeyIntent, false);
  }

  function onKeyIntent(event) {
    var keys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"];
    if (keys.indexOf(event.key) !== -1) {
      hurry();
    }
  }

  function start() {
    if (!shouldPlay()) {
      document.documentElement.classList.remove("is-hero-intro");
      if (window.RevealText) {
        window.RevealText.scan(document);
      }
      return;
    }

    hero = document.querySelector(".folio-hero");
    var wrap = document.querySelector(".folio-hero__logo-wrap");
    if (!hero) {
      document.documentElement.classList.remove("is-hero-intro");
      if (window.RevealText) {
        window.RevealText.revealNow(document);
      }
      return;
    }

    hero.classList.add("is-intro");
    if (wrap) {
      logoFromCenter(wrap);
    }
    bindHurry();

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (finished) {
          return;
        }
        hero.classList.add("is-playing");
      });
    });

    var landingDelay = wrap ? LOGO_MOVE_MS : 0;
    landTimer = window.setTimeout(onLand, landingDelay);
    doneTimer = window.setTimeout(finish, landingDelay + Math.max(TEXT_MS + LINE_STAGGER_MS, REST_MS));
  }

  function init() {
    if (document.fonts && document.fonts.ready) {
      var settled = false;
      function go() {
        if (settled) {
          return;
        }
        settled = true;
        start();
      }
      document.fonts.ready.then(go);
      window.setTimeout(go, 400);
      return;
    }
    start();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
