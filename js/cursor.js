(function () {
  var DESKTOP_QUERY = "(min-width: 64rem) and (pointer: fine)";
  var CURSOR_SCALE = 1.5;
  var CURSOR_HOTSPOTS = {
    base: { x: 7, y: 7 },
    search: { x: 11, y: 10 },
    hand: { x: 8, y: 6 },
  };

  var ZOOMABLE_SELECTOR = [
    ".cases__gallery .about__figure img",
    ".cases__gallery .about__thumb",
  ].join(", ");

  var SCALE_BTN_SELECTOR = ".case-detail__scale-btn";

  var INTERACTIVE_SELECTOR = [
    "a[href]",
    "button:not(:disabled)",
    "[role='button']:not([aria-disabled='true'])",
    ".project-row",
    "label",
    "summary",
    "select",
    "textarea",
    "input",
    "[data-map-target]",
    ".card__submenu-link",
    ".case-detail__gallery-btn",
    ".image-lightbox__nav-btn",
  ].join(", ");

  var desktopQuery = window.matchMedia(DESKTOP_QUERY);
  var cursorEl = null;
  var icons = {};
  var lightboxEl = null;
  var lightboxImg = null;
  var lightboxViewport = null;
  var galleryItems = [];
  var galleryIndex = -1;
  var lastPointer = { x: 0, y: 0 };
  var activeState = "base";
  var cursorEnabled = false;
  var zoomEnabled = false;

  function canUseCustomCursor() {
    return desktopQuery.matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function createCursor() {
    cursorEl = document.createElement("div");
    cursorEl.className = "custom-cursor";
    cursorEl.setAttribute("aria-hidden", "true");

    ["base", "search", "hand"].forEach(function (name) {
      var icon = document.createElement("img");
      icon.className = "custom-cursor__icon custom-cursor__icon--" + name;
      icon.src = "/assets/images/cursors/cursor-" + name + ".png";
      icon.alt = "";
      icon.width = 96;
      icon.height = 96;
      icon.draggable = false;
      if (name === "base") {
        icon.classList.add("is-active");
      }
      icons[name] = icon;
      cursorEl.appendChild(icon);
    });

    document.body.appendChild(cursorEl);
  }

  function createLightbox() {
    lightboxEl = document.createElement("div");
    lightboxEl.className = "image-lightbox";
    lightboxEl.hidden = true;
    lightboxEl.setAttribute("role", "dialog");
    lightboxEl.setAttribute("aria-modal", "true");
    lightboxEl.setAttribute("aria-label", "Image preview");
    lightboxEl.innerHTML =
      '<button type="button" class="image-lightbox__backdrop" aria-label="Close image preview"></button>' +
      '<figure class="image-lightbox__dialog">' +
      '<div class="image-lightbox__frame">' +
      '<div class="image-lightbox__viewport">' +
      '<img class="image-lightbox__img" alt="">' +
      "</div>" +
      '<nav class="image-lightbox__nav" hidden aria-label="Gallery navigation">' +
      '<button type="button" class="case-detail__gallery-btn case-detail__gallery-btn--prev image-lightbox__nav-btn" aria-label="Previous image">' +
      '<span class="case-detail__gallery-btn-icon case-detail__gallery-btn-icon--prev" aria-hidden="true"></span>' +
      "</button>" +
      '<button type="button" class="case-detail__gallery-btn case-detail__gallery-btn--next image-lightbox__nav-btn" aria-label="Next image">' +
      '<span class="case-detail__gallery-btn-icon case-detail__gallery-btn-icon--next" aria-hidden="true"></span>' +
      "</button>" +
      "</nav>" +
      '<button type="button" class="image-lightbox__close" aria-label="Close image preview">' +
      '<span class="image-lightbox__close-icon" aria-hidden="true"></span>' +
      "</button>" +
      "</div>" +
      "</figure>";

    document.body.appendChild(lightboxEl);
    lightboxImg = lightboxEl.querySelector(".image-lightbox__img");
    lightboxViewport = lightboxEl.querySelector(".image-lightbox__viewport");

    lightboxEl.querySelector(".image-lightbox__backdrop").addEventListener("click", closeLightbox);
    lightboxEl.querySelector(".image-lightbox__close").addEventListener("click", closeLightbox);
    lightboxEl.querySelector(".case-detail__gallery-btn--prev").addEventListener("click", function (event) {
      event.stopPropagation();
      showGalleryRelative(-1);
    });
    lightboxEl.querySelector(".case-detail__gallery-btn--next").addEventListener("click", function (event) {
      event.stopPropagation();
      showGalleryRelative(1);
    });
    lightboxEl.addEventListener("click", function (event) {
      if (event.target.closest(".image-lightbox__frame, .image-lightbox__close, .image-lightbox__nav")) {
        return;
      }
      closeLightbox();
    });
  }

  function getGalleryItemData(item) {
    var img = item.querySelector("img");
    if (!img) {
      return null;
    }

    return {
      src: img.currentSrc || img.src,
      alt: img.alt || "",
      sliceCount: parseInt(item.dataset.sliceCount, 10) || 1,
      sliceIndex: parseInt(item.dataset.sliceIndex, 10) || 0,
    };
  }

  function collectGalleryItems(galleryEl) {
    var items = [];

    galleryEl.querySelectorAll(".case-detail__gallery-item").forEach(function (item) {
      var data = getGalleryItemData(item);
      if (data) {
        items.push(data);
      }
    });

    return items;
  }

  function resetLightboxImageLayout() {
    if (!lightboxImg || !lightboxViewport) {
      return;
    }

    lightboxViewport.classList.remove("is-sliced");
    lightboxViewport.style.removeProperty("width");
    lightboxImg.style.removeProperty("width");
    lightboxImg.style.removeProperty("height");
    lightboxImg.style.removeProperty("transform");
  }

  function fitLightboxSlice(item) {
    if (!lightboxImg || !lightboxViewport || !item || item.sliceCount <= 1) {
      resetLightboxImageLayout();
      return;
    }

    if (!lightboxImg.naturalWidth || !lightboxImg.naturalHeight) {
      return;
    }

    var maxHeight = Math.min(window.innerHeight * 0.9, lightboxImg.naturalHeight);
    var fullWidth = Math.round((lightboxImg.naturalWidth / lightboxImg.naturalHeight) * maxHeight);
    var sliceWidth = Math.round(fullWidth / item.sliceCount);
    var offset = sliceWidth * item.sliceIndex;

    lightboxViewport.classList.add("is-sliced");
    lightboxImg.style.height = maxHeight + "px";
    lightboxImg.style.width = fullWidth + "px";
    lightboxImg.style.transform = "translateX(-" + offset + "px)";
    lightboxViewport.style.width = sliceWidth + "px";
  }

  function updateLightboxNav() {
    if (!lightboxEl) {
      return;
    }

    var nav = lightboxEl.querySelector(".image-lightbox__nav");
    var prevBtn = lightboxEl.querySelector(".case-detail__gallery-btn--prev");
    var nextBtn = lightboxEl.querySelector(".case-detail__gallery-btn--next");
    var hasGallery = galleryItems.length > 1;

    if (nav) {
      nav.hidden = !hasGallery;
    }
    if (prevBtn) {
      prevBtn.disabled = !hasGallery || galleryIndex <= 0;
    }
    if (nextBtn) {
      nextBtn.disabled = !hasGallery || galleryIndex >= galleryItems.length - 1;
    }
  }

  function updateLightboxLabel(item) {
    if (!lightboxEl) {
      return;
    }

    var label = "Image preview";
    if (item && item.alt) {
      label = "Image preview: " + item.alt;
    }
    if (galleryItems.length > 1 && galleryIndex >= 0) {
      label += " (" + (galleryIndex + 1) + " of " + galleryItems.length + ")";
    }
    lightboxEl.setAttribute("aria-label", label);
  }

  function showGalleryItem(index) {
    if (!lightboxEl || !lightboxImg || index < 0 || index >= galleryItems.length) {
      return;
    }

    galleryIndex = index;
    var item = galleryItems[index];
    var targetSrc = item.src;
    var sameSrc = lightboxImg.getAttribute("src") === targetSrc || lightboxImg.src === targetSrc;

    resetLightboxImageLayout();
    lightboxImg.alt = item.alt || "Enlarged preview";

    function applyItem() {
      fitLightboxSlice(item);
    }

    if (sameSrc) {
      lightboxImg.onload = null;
      applyItem();
    } else {
      lightboxImg.onload = applyItem;
      lightboxImg.src = targetSrc;
      if (lightboxImg.complete) {
        applyItem();
      }
    }

    updateLightboxNav();
    updateLightboxLabel(item);
  }

  function showGalleryRelative(delta) {
    if (galleryItems.length <= 1) {
      return;
    }

    showGalleryItem(Math.min(galleryItems.length - 1, Math.max(0, galleryIndex + delta)));
  }

  function setCursorState(state) {
    if (!icons[state] || activeState === state) {
      return;
    }

    icons[activeState].classList.remove("is-active");
    icons[state].classList.add("is-active");
    activeState = state;
  }

  function moveCursor(x, y) {
    if (!cursorEl) {
      return;
    }

    var hotspot = CURSOR_HOTSPOTS[activeState] || CURSOR_HOTSPOTS.base;
    cursorEl.style.transform =
      "translate3d(" +
      (x - hotspot.x * CURSOR_SCALE) +
      "px, " +
      (y - hotspot.y * CURSOR_SCALE) +
      "px, 0)";
  }

  function resolveCursorState(target) {
    if (!(target instanceof Element)) {
      return "base";
    }

    if (target.closest(".image-lightbox")) {
      return "hand";
    }

    if (target.closest(ZOOMABLE_SELECTOR)) {
      return "search";
    }

    if (target.closest(INTERACTIVE_SELECTOR)) {
      return "hand";
    }

    return "base";
  }

  function onPointerMove(event) {
    lastPointer.x = event.clientX;
    lastPointer.y = event.clientY;

    if (!cursorEl) {
      return;
    }

    cursorEl.classList.add("is-visible");
    setCursorState(resolveCursorState(event.target));
    moveCursor(event.clientX, event.clientY);
  }

  function onPointerOver(event) {
    if (!cursorEl) {
      return;
    }

    setCursorState(resolveCursorState(event.target));
    moveCursor(event.clientX, event.clientY);
  }

  function onPointerLeave() {
    if (cursorEl) {
      cursorEl.classList.remove("is-visible");
    }
  }

  function revealLightbox() {
    if (!lightboxEl) {
      return;
    }

    lightboxEl.hidden = false;
    document.body.classList.add("image-lightbox-open");
    lightboxEl.querySelector(".image-lightbox__close").focus();
  }

  function openLightbox(image) {
    if (!lightboxEl || !lightboxImg) {
      return;
    }

    galleryItems = [];
    galleryIndex = -1;
    resetLightboxImageLayout();

    lightboxImg.onload = null;
    lightboxImg.src = image.currentSrc || image.src;
    lightboxImg.alt = image.alt || "Enlarged preview";
    updateLightboxNav();
    updateLightboxLabel({ alt: lightboxImg.alt });
    revealLightbox();
  }

  function openGalleryLightbox(galleryEl, startIndex) {
    if (!lightboxEl || !lightboxImg || !galleryEl) {
      return;
    }

    galleryItems = collectGalleryItems(galleryEl);
    if (!galleryItems.length) {
      return;
    }

    showGalleryItem(Math.min(Math.max(startIndex, 0), galleryItems.length - 1));
    revealLightbox();
  }

  function closeLightbox() {
    if (!lightboxEl) {
      return;
    }

    lightboxEl.hidden = true;
    lightboxImg.onload = null;
    lightboxImg.removeAttribute("src");
    resetLightboxImageLayout();
    galleryItems = [];
    galleryIndex = -1;
    updateLightboxNav();
    document.body.classList.remove("image-lightbox-open");
    moveCursor(lastPointer.x, lastPointer.y);
  }

  function onClick(event) {
    if (!zoomEnabled) {
      return;
    }

    var scaleBtn = event.target.closest(SCALE_BTN_SELECTOR);
    if (scaleBtn) {
      var container = scaleBtn.closest(".case-detail__gallery-item");
      var gallery = scaleBtn.closest(".case-detail__gallery");
      var image = container ? container.querySelector("img") : null;
      if (image) {
        event.preventDefault();
        event.stopPropagation();
        if (container) {
          container.classList.remove("is-scale-visible");
        }
        if (gallery && container) {
          var galleryItemsEls = gallery.querySelectorAll(".case-detail__gallery-item");
          var startIndex = Array.prototype.indexOf.call(galleryItemsEls, container);
          openGalleryLightbox(gallery, startIndex);
        } else {
          openLightbox(image);
        }
      }
      return;
    }

    var zoomTarget = event.target.closest(ZOOMABLE_SELECTOR);
    if (!zoomTarget) {
      return;
    }

    if (zoomTarget instanceof HTMLImageElement) {
      event.preventDefault();
      openLightbox(zoomTarget);
      return;
    }

    var nestedImage = zoomTarget.querySelector("img");
    if (nestedImage) {
      event.preventDefault();
      openLightbox(nestedImage);
    }
  }

  function onKeyDown(event) {
    if (!lightboxEl || lightboxEl.hidden) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
      return;
    }

    if (galleryItems.length <= 1) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showGalleryRelative(1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showGalleryRelative(-1);
    }
  }

  function enableZoom() {
    if (zoomEnabled) {
      return;
    }

    zoomEnabled = true;

    if (!lightboxEl) {
      createLightbox();
    }

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
  }

  function disableZoom() {
    if (!zoomEnabled) {
      return;
    }

    zoomEnabled = false;
    document.body.classList.remove("image-lightbox-open");
    document.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeyDown);

    if (lightboxEl) {
      lightboxEl.remove();
      lightboxEl = null;
      lightboxImg = null;
      lightboxViewport = null;
      galleryItems = [];
      galleryIndex = -1;
    }
  }

  function enableCursor() {
    if (cursorEnabled) {
      return;
    }

    cursorEnabled = true;
    document.documentElement.classList.add("has-custom-cursor");

    if (!cursorEl) {
      createCursor();
    }

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave, { passive: true });
  }

  function disableCursor() {
    if (!cursorEnabled) {
      return;
    }

    cursorEnabled = false;
    document.documentElement.classList.remove("has-custom-cursor");

    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerleave", onPointerLeave);

    if (cursorEl) {
      cursorEl.remove();
      cursorEl = null;
      icons = {};
    }

    activeState = "base";
  }

  window.ImageLightbox = {
    open: openLightbox,
    close: closeLightbox,
  };

  function sync() {
    enableZoom();

    if (canUseCustomCursor()) {
      enableCursor();
    } else {
      disableCursor();
    }
  }

  if (typeof desktopQuery.addEventListener === "function") {
    desktopQuery.addEventListener("change", sync);
  } else if (typeof desktopQuery.addListener === "function") {
    desktopQuery.addListener(sync);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sync);
  } else {
    sync();
  }
})();
