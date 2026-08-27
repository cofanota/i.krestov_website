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

  function playVideo(video) {
    if (!video.dataset.src) {
      return;
    }

    if (!video.src) {
      video.src = video.dataset.src;
      video.load();
    }

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

  function init() {
    if (reduceMotion) {
      return;
    }

    document.querySelectorAll(".about__video[data-src]").forEach(function (video) {
      if (!isVideoVisible(video)) {
        video.pause();
        return;
      }

      playVideo(video);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
