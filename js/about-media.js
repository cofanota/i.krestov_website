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
    video.setAttribute("disablepictureinpicture", "");
    video.preload = "metadata";
    video.loop = true;
  }

  function ensureSrc(video) {
    var nextSrc = video.dataset.src;
    if (!nextSrc) {
      return;
    }

    if (video.getAttribute("src") !== nextSrc) {
      delete video.dataset.playBound;
      video.setAttribute("src", nextSrc);
      video.load();
    }
  }

  function playVideo(video) {
    if (!video.dataset.src) {
      return;
    }

    if (!video.paused && video.readyState >= 2) {
      return;
    }

    prepareVideo(video);
    video.preload = "auto";
    ensureSrc(video);

    function attempt() {
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(function () {});
      }
    }

    attempt();

    if (video.readyState < 2 && video.dataset.playBound !== "1") {
      video.dataset.playBound = "1";
      video.addEventListener(
        "loadeddata",
        function () {
          delete video.dataset.playBound;
          attempt();
        },
        { once: true }
      );
    }
  }

  function getAutoplayVideos() {
    return document.querySelectorAll(
      ".about__video[data-src], .case-tile__video[data-src], .case-detail__gallery-video[data-src], .case-split__cover-video[data-src], .case-split__app-shot-img[data-src], .case-split__nav-shot-img[data-src]"
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
    playOne: playVideo,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
