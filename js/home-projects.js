(function () {
  "use strict";

  var DRAG_THRESHOLD = 6;
  var desktopMq = window.matchMedia("(min-width: 48.0625rem)");

  function bindTrackDrag(track) {
    if (track.dataset.dragBound === "true") {
      return;
    }
    track.dataset.dragBound = "true";

    var activePointerId = null;
    var isDragging = false;
    var startX = 0;
    var startScroll = 0;
    var dragged = false;

    function canScroll() {
      return track.scrollWidth > track.clientWidth + 1;
    }

    function endDrag(event) {
      if (event.pointerType !== "mouse" || event.pointerId !== activePointerId) {
        return;
      }

      if (track.hasPointerCapture(event.pointerId)) {
        track.releasePointerCapture(event.pointerId);
      }

      activePointerId = null;
      isDragging = false;
      track.classList.remove("is-dragging");
    }

    track.addEventListener(
      "click",
      function (event) {
        if (dragged) {
          event.preventDefault();
          event.stopPropagation();
          dragged = false;
        }
      },
      true
    );

    track.addEventListener(
      "pointerdown",
      function (event) {
        if (event.pointerType !== "mouse" || event.button !== 0) {
          return;
        }

        if (!canScroll()) {
          return;
        }

        activePointerId = event.pointerId;
        dragged = false;
        isDragging = false;
        startX = event.clientX;
        startScroll = track.scrollLeft;
      },
      { passive: true }
    );

    track.addEventListener(
      "pointermove",
      function (event) {
        if (event.pointerType !== "mouse" || event.pointerId !== activePointerId || !canScroll()) {
          return;
        }

        var delta = event.clientX - startX;
        if (!isDragging) {
          if (Math.abs(delta) < DRAG_THRESHOLD) {
            return;
          }

          isDragging = true;
          track.setPointerCapture(event.pointerId);
          track.classList.add("is-dragging");
        }

        event.preventDefault();
        dragged = true;
        track.scrollLeft = startScroll - delta;
      },
      { passive: false }
    );

    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
  }

  var GALLERY_SCROLL_SETTLE_MS = 100;

  function bindTrackScrollSync(track, onDuringScroll, onScrollEnd) {
    var settleTimer;

    function scheduleScrollEnd() {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(onScrollEnd, GALLERY_SCROLL_SETTLE_MS);
    }

    track.addEventListener(
      "scroll",
      function () {
        onDuringScroll();
        scheduleScrollEnd();
      },
      { passive: true }
    );

    track.addEventListener("scrollend", function () {
      clearTimeout(settleTimer);
      onScrollEnd();
    });
  }

  function syncNav(container, updateButtons) {
    if (updateButtons === undefined) {
      updateButtons = true;
    }

    var track = container.querySelector(".home-projects__track");
    var nav = container.querySelector(".home-projects__nav");
    var prevBtn = container.querySelector(".case-detail__gallery-btn--prev");
    var nextBtn = container.querySelector(".case-detail__gallery-btn--next");
    if (!track || !nav) {
      return;
    }

    var overflows = track.scrollWidth > track.clientWidth + 1;
    var navVisible = desktopMq.matches && overflows;
    nav.hidden = !navVisible;

    if (!navVisible) {
      if (prevBtn) {
        prevBtn.disabled = false;
      }
      if (nextBtn) {
        nextBtn.disabled = false;
      }
      return;
    }

    if (!updateButtons) {
      return;
    }

    var maxScroll = track.scrollWidth - track.clientWidth;
    if (prevBtn) {
      prevBtn.disabled = track.scrollLeft <= 1;
    }
    if (nextBtn) {
      nextBtn.disabled = track.scrollLeft >= maxScroll - 1;
    }
  }

  function bindHomeProjects(container) {
    if (container.dataset.bound === "true") {
      return;
    }
    container.dataset.bound = "true";

    var track = container.querySelector(".home-projects__track");
    var prevBtn = container.querySelector(".case-detail__gallery-btn--prev");
    var nextBtn = container.querySelector(".case-detail__gallery-btn--next");
    if (!track) {
      return;
    }

    var resizeTimer;

    function sync() {
      syncNav(container, true);
    }

    function syncDuringScroll() {
      syncNav(container, false);
    }

    function syncAfterScroll() {
      syncNav(container, true);
    }

    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(sync, 100);
    }

    bindTrackDrag(track);
    sync();
    bindTrackScrollSync(track, syncDuringScroll, syncAfterScroll);
    window.addEventListener("resize", onResize);
    desktopMq.addEventListener("change", sync);

    if (prevBtn) {
      prevBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        track.scrollTo({
          left: Math.max(0, track.scrollLeft - track.clientWidth),
          behavior: "smooth",
        });
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        var maxScroll = track.scrollWidth - track.clientWidth;
        track.scrollTo({
          left: Math.min(maxScroll, track.scrollLeft + track.clientWidth),
          behavior: "smooth",
        });
      });
    }
  }

  function initHomeProjects(root) {
    root = root || document;
    root.querySelectorAll(".home-projects").forEach(bindHomeProjects);
  }

  window.HomeProjects = {
    init: initHomeProjects,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initHomeProjects();
    });
  } else {
    initHomeProjects();
  }
})();
