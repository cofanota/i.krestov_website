(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function isVideoVisible(video) {
    var node = video;

    while (node && node !== document.body) {
      var style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      node = node.parentElement;
    }

    return true;
  }

  function prepareVideo(video) {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("autoplay", "");
    video.loop = true;
  }

  function ensureSrc(video) {
    var nextSrc = video.dataset.src;
    if (!nextSrc) {
      return;
    }

    if (video.getAttribute("src") !== nextSrc) {
      video.setAttribute("src", nextSrc);
      video.load();
    }
  }

  function playVideo(video) {
    if (!video.dataset.src) {
      return;
    }

    prepareVideo(video);
    ensureSrc(video);

    function attempt() {
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {});
      }
    }

    if (video.readyState >= 2) {
      attempt();
    } else {
      video.addEventListener("loadeddata", attempt, { once: true });
    }
  }

  function getAutoplayVideos() {
    return document.querySelectorAll(
      ".about__video[data-src], .case-tile__video[data-src], .case-detail__gallery-video[data-src]"
    );
  }

  function playAboutVideos() {
    if (reduceMotion) {
      return;
    }

    getAutoplayVideos().forEach(function (video) {
      if (!isVideoVisible(video)) {
        return;
      }

      playVideo(video);
    });
  }

  function init() {
    if (reduceMotion) {
      return;
    }

    playAboutVideos();

    ["pointerdown", "touchstart", "click", "keydown"].forEach(function (type) {
      document.addEventListener(type, playAboutVideos, { capture: true, passive: true });
    });

    window.addEventListener("hashchange", playAboutVideos);
    window.addEventListener("pageshow", playAboutVideos);
  }

  window.AboutMedia = {
    play: playAboutVideos,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
