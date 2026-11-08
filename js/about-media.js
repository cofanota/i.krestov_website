(function () {
  "use strict";

  var MAX_BUFFERING = 2;
  var ROOT_MARGIN = "200px 0px";
  var PRIORITY_CAP_MS = 8000;
  var SELECTOR = [
    ".about__video[data-src]",
    ".case-tile__video[data-src]",
    ".case-detail__gallery-video[data-src]",
    ".case-split__cover-video[data-src]",
    ".case-split__app-shot-img[data-src]",
    ".case-split__nav-shot-img[data-src]",
  ].join(", ");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wanted = new Set();
  var observer = null;
  var priorityDeadline = 0;

  function isShown(video) {
    var node = video;

    while (node && node !== document.body) {
      var style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      node = node.parentElement;
    }

    var rect = video.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function prepareVideo(video) {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("disablepictureinpicture", "");
    video.loop = true;
    if (!video.getAttribute("fetchpriority")) {
      video.setAttribute("fetchpriority", "low");
    }
  }

  function ensureSrc(video) {
    var nextSrc = video.dataset.src;
    if (!nextSrc) {
      return false;
    }

    if (video.getAttribute("src") !== nextSrc) {
      video.preload = "auto";
      video.setAttribute("src", nextSrc);
      video.load();
    }

    return true;
  }

  function attemptPlay(video) {
    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () {});
    }
  }

  function watchLoad(video) {
    var token = String(Date.now()) + "-" + Math.random();
    video.dataset.loadToken = token;

    function done() {
      if (video.dataset.loadToken !== token) {
        return;
      }
      delete video.dataset.loadToken;
      pump();
    }

    video.addEventListener("loadeddata", done, { once: true });
    video.addEventListener("error", done, { once: true });
  }

  function isBuffering(video) {
    return !!video.getAttribute("src") && video.readyState < 2 && !video.error;
  }

  function dropDetached() {
    wanted.forEach(function (video) {
      if (!video.isConnected) {
        wanted.delete(video);
      }
    });
  }

  function release(video) {
    video.pause();
    if (!video.getAttribute("src")) {
      return;
    }

    if (video.readyState < 2) {
      delete video.dataset.loadToken;
      video.removeAttribute("src");
      video.preload = "none";
      video.load();
    }
  }

  function playManaged(video) {
    if (!video.dataset.src || !isShown(video)) {
      return;
    }

    prepareVideo(video);

    if (video.getAttribute("src") === video.dataset.src && video.readyState >= 2) {
      if (video.paused) {
        attemptPlay(video);
      }
      return;
    }

    if (!video.getAttribute("src")) {
      ensureSrc(video);
      watchLoad(video);
    }

    attemptPlay(video);
  }

  function priorityImage() {
    return document.querySelector('img[fetchpriority="high"]');
  }

  function watchPriorityImage() {
    var img = priorityImage();
    if (!img || img.dataset.priorityWatch === "1") {
      return;
    }

    img.dataset.priorityWatch = "1";
    if (img.complete) {
      return;
    }

    img.addEventListener("load", pump, { once: true });
    img.addEventListener("error", pump, { once: true });
  }

  function priorityBlocks() {
    var img = priorityImage();
    if (!img || img.complete) {
      return false;
    }
    return Date.now() < priorityDeadline;
  }

  function pump() {
    var queue = [];
    var buffering = 0;

    if (reduceMotion) {
      return;
    }

    dropDetached();
    watchPriorityImage();

    document.querySelectorAll(SELECTOR).forEach(function (video) {
      if (!wanted.has(video) || !isShown(video)) {
        release(video);
      }
    });

    if (priorityBlocks()) {
      return;
    }

    wanted.forEach(function (video) {
      if (video.isConnected && isShown(video) && video.dataset.src) {
        queue.push(video);
      }
    });

    queue.sort(function (a, b) {
      var ra = a.getBoundingClientRect();
      var rb = b.getBoundingClientRect();
      if (Math.abs(ra.top - rb.top) > 8) {
        return ra.top - rb.top;
      }
      return ra.left - rb.left;
    });

    queue.forEach(function (video) {
      if (isBuffering(video)) {
        buffering += 1;
      }
    });

    queue.forEach(function (video) {
      if (video.getAttribute("src") === video.dataset.src && video.readyState >= 2) {
        if (video.paused) {
          attemptPlay(video);
        }
        return;
      }

      if (isBuffering(video)) {
        return;
      }

      if (buffering >= MAX_BUFFERING) {
        return;
      }

      playManaged(video);
      if (isBuffering(video)) {
        buffering += 1;
      }
    });
  }

  function onIntersect(entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        wanted.add(entry.target);
      } else {
        wanted.delete(entry.target);
      }
    });
    pump();
  }

  function ensureObserver() {
    if (observer || typeof IntersectionObserver !== "function") {
      return;
    }

    observer = new IntersectionObserver(onIntersect, {
      root: null,
      rootMargin: ROOT_MARGIN,
      threshold: [0, 0.01],
    });
  }

  function syncWantedFromLayout() {
    document.querySelectorAll(SELECTOR).forEach(function (video) {
      var rect = video.getBoundingClientRect();
      var near =
        rect.bottom > -200 &&
        rect.top < window.innerHeight + 200 &&
        rect.right > 0 &&
        rect.left < window.innerWidth;
      if (near && isShown(video)) {
        wanted.add(video);
      } else {
        wanted.delete(video);
      }
    });
  }

  function scan() {
    if (reduceMotion) {
      return;
    }

    ensureObserver();

    document.querySelectorAll(SELECTOR).forEach(function (video) {
      video.preload = video.getAttribute("src") ? video.preload : "none";
      if (observer && video.dataset.observed !== "1") {
        video.dataset.observed = "1";
        observer.observe(video);
      }
    });

    if (!observer) {
      syncWantedFromLayout();
    }

    pump();
  }

  function playOne(video) {
    if (!video || !video.dataset.src) {
      return;
    }

    prepareVideo(video);
    video.setAttribute("fetchpriority", "high");
    video.preload = "auto";
    ensureSrc(video);
    attemptPlay(video);

    if (video.readyState < 2) {
      video.addEventListener(
        "loadeddata",
        function () {
          attemptPlay(video);
        },
        { once: true }
      );
    }
  }

  function init() {
    if (reduceMotion) {
      return;
    }

    priorityDeadline = Date.now() + PRIORITY_CAP_MS;
    scan();

    ["pointerdown", "touchstart", "click", "keydown"].forEach(function (type) {
      document.addEventListener(type, pump, { capture: true, passive: true });
    });

    if (!observer) {
      window.addEventListener("scroll", scan, { passive: true });
      window.addEventListener("resize", scan);
    }

    window.addEventListener("hashchange", scan);
    window.addEventListener("pageshow", scan);
  }

  window.AboutMedia = {
    play: scan,
    playOne: playOne,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
