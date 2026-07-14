(function () {
  "use strict";

  var indexCache = null;
  var metaCache = {};
  var textCache = {};

  var CASE_NODE_PREFIX = "case-";

  function siteUrl(path) {
    if (!path || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(path)) {
      return path;
    }

    var base = (window.SITE_BASE_PATH || "/").replace(/\/$/, "");
    return path.charAt(0) === "/" ? base + path : path;
  }

  function isCaseNode(nodeId) {
    return nodeId && nodeId.indexOf(CASE_NODE_PREFIX) === 0;
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) {
        throw new Error("Failed to fetch " + url);
      }
      return res.json();
    });
  }

  function fetchText(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) {
        return "";
      }
      return res.text();
    });
  }

  function loadIndex() {
    if (indexCache) {
      return Promise.resolve(indexCache);
    }
    return fetchJson(siteUrl("/cases/index.json")).then(function (data) {
      indexCache = data;
      return data;
    });
  }

  function caseAssetUrl(folder, file) {
    return siteUrl("/cases/" + encodeURIComponent(folder) + "/" + file);
  }

  function loadCaseMeta(folder) {
    return fetchJson(caseAssetUrl(folder, "meta.json")).then(function (data) {
      metaCache[folder] = data;
      return data;
    });
  }

  function loadCaseText(folder) {
    if (textCache[folder]) {
      return Promise.resolve(textCache[folder]);
    }
    return fetchText(caseAssetUrl(folder, "Text")).then(function (text) {
      textCache[folder] = parseTextOverrides(text);
      return textCache[folder];
    });
  }

  function parseTextOverrides(text) {
    var overrides = {};
    if (!text) {
      return overrides;
    }

    var blocks = text.split(/\n(?=\[[^\]]+\])/);
    blocks.forEach(function (block) {
      var match = block.match(/^\[([^\]]+)\]\s*\n?([\s\S]*)$/);
      if (!match) {
        return;
      }
      var content = match[2].trim();
      if (content && content.indexOf("Optional long-form") !== 0) {
        overrides[match[1]] = content;
      }
    });
    return overrides;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderLabels(labels) {
    return (labels || [])
      .map(function (label) {
        return '<li><span class="project-label">' + escapeHtml(label) + "</span></li>";
      })
      .join("");
  }

  function renderAwards(awards) {
    if (!awards || !awards.length) {
      return "";
    }

    return awards
      .map(function (award) {
        return (
          '<span class="case-detail__award" title="' +
          escapeHtml(award.name) +
          '">' +
          '<img src="' +
          escapeHtml(siteUrl(award.image)) +
          '" alt="' +
          escapeHtml(award.name) +
          '" width="34" height="32" decoding="async">' +
          "</span>"
        );
      })
      .join("");
  }

  function expandGalleryImages(images) {
    var items = [];

    (images || []).forEach(function (entry) {
      if (!entry) {
        return;
      }

      if (typeof entry === "string") {
        items.push({ src: entry, slices: 1, sliceIndex: 0 });
        return;
      }

      if (!entry.src) {
        return;
      }

      var slices = Math.max(1, parseInt(entry.slices, 10) || 1);
      for (var i = 0; i < slices; i += 1) {
        items.push({ src: entry.src, slices: slices, sliceIndex: i });
      }
    });

    return items;
  }

  function renderScaleButton() {
    return (
      '<button type="button" class="case-detail__scale-btn" aria-label="View larger">' +
      '<span class="case-detail__scale-btn-icon" aria-hidden="true"></span>' +
      "</button>"
    );
  }

  function renderGalleryItem(item) {
    var figureClass = "case-detail__gallery-item";
    var figureAttrs = "";

    if (item.slices > 1) {
      figureClass += " case-detail__gallery-item--slice";
      figureAttrs =
        ' data-slice-count="' +
        item.slices +
        '" data-slice-index="' +
        item.sliceIndex +
        '"';
    }

    return (
      "<figure class=\"" +
      figureClass +
      "\"" +
      figureAttrs +
      ">" +
      '<img src="' +
      escapeHtml(siteUrl(item.src)) +
      '" alt="" loading="lazy" decoding="async" draggable="false">' +
      renderScaleButton() +
      "</figure>"
    );
  }

  function renderGallery(images, sectionId) {
    if (!images || !images.length) {
      return '<div class="case-detail__gallery-placeholder" aria-hidden="true"></div>';
    }

    var trackHtml = expandGalleryImages(images).map(renderGalleryItem).join("");

    return (
      '<div class="case-detail__gallery" data-gallery="' +
      escapeHtml(sectionId) +
      '">' +
      '<div class="case-detail__gallery-track">' +
      trackHtml +
      "</div>" +
      '<div class="case-detail__gallery-nav" hidden>' +
      '<button type="button" class="case-detail__gallery-btn case-detail__gallery-btn--prev" aria-label="Previous images">' +
      '<span class="case-detail__gallery-btn-icon case-detail__gallery-btn-icon--prev" aria-hidden="true"></span>' +
      "</button>" +
      '<button type="button" class="case-detail__gallery-btn case-detail__gallery-btn--next" aria-label="Next images">' +
      '<span class="case-detail__gallery-btn-icon case-detail__gallery-btn-icon--next" aria-hidden="true"></span>' +
      "</button>" +
      "</div>" +
      "</div>"
    );
  }

  function renderCaseDetail(meta, textOverrides) {
    var hero = meta.hero || {};
    var caseMeta = meta.meta || {};
    var cta = meta.cta || {};
    var sections = meta.sections || [];

    var coverHtml = hero.cover
      ? '<img class="case-detail__cover-img" src="' +
        escapeHtml(siteUrl(hero.cover)) +
        '" alt="" decoding="async">'
      : "";

    var sectionsHtml = sections
      .map(function (section) {
        var paragraphs = (section.paragraphs || [])
          .map(function (para, paraIndex) {
            var text = para.text;
            if (paraIndex === 0 && textOverrides[section.id]) {
              text = textOverrides[section.id];
            }
            return (
              '<div class="case-detail__text-row">' +
              '<p class="case-detail__text">' +
              escapeHtml(text) +
              "</p>" +
              '<p class="case-detail__caption">' +
              escapeHtml(para.caption || "") +
              "</p>" +
              "</div>"
            );
          })
          .join("");

        var galleryHtml = "";
        if (section.gallery) {
          galleryHtml = renderGallery(section.gallery.images || [], section.id);
        }

        var titleHtml = section.title
          ? '<h3 class="case-detail__section-title">' +
            escapeHtml(section.title) +
            "</h3>"
          : "";

        return (
          '<section class="case-detail__section">' +
          titleHtml +
          '<div class="case-detail__text-block">' +
          paragraphs +
          "</div>" +
          galleryHtml +
          "</section>"
        );
      })
      .join("");

    var awardsHtml = renderAwards(meta.awards);
    var ctaHtml =
      cta.label
        ? '<a class="btn btn--case-link" href="' +
          escapeHtml(cta.url || "#") +
          '">' +
          '<span class="btn__label">' +
          escapeHtml(cta.label) +
          "</span>" +
          '<span class="btn__icon" aria-hidden="true">' +
          '<span class="btn__icon-svg btn__icon-svg--link-out"></span>' +
          "</span></a>"
        : "";

    return (
      '<div class="case-detail__hero">' +
      '<div class="case-detail__headline-row">' +
      '<h1 class="case-detail__title">' +
      escapeHtml(hero.title || meta.title) +
      "</h1>" +
      '<div class="case-detail__intro">' +
      '<p class="case-detail__description">' +
      escapeHtml(hero.description || "") +
      "</p>" +
      '<ul class="case-detail__labels" aria-label="Tags">' +
      renderLabels(hero.labels) +
      "</ul>" +
      "</div></div>" +
      '<figure class="case-detail__cover">' +
      coverHtml +
      "</figure></div>" +
      '<div class="case-detail__role-block">' +
      '<p class="case-detail__meta-label">My role</p>' +
      '<p class="case-detail__role">' +
      escapeHtml(caseMeta.role || "") +
      "</p>" +
      "</div>" +
      '<div class="case-detail__meta-grid">' +
      '<div class="case-detail__meta-col"><p class="case-detail__meta-label">Scope</p><p class="case-detail__meta-value">' +
      escapeHtml(caseMeta.scope || "") +
      "</p></div>" +
      '<div class="case-detail__meta-col"><p class="case-detail__meta-label">Team</p><p class="case-detail__meta-value">' +
      escapeHtml(caseMeta.team || "") +
      "</p></div>" +
      '<div class="case-detail__meta-col case-detail__meta-col--duration"><p class="case-detail__meta-label">Duration</p><p class="case-detail__meta-value">' +
      escapeHtml(caseMeta.duration || "") +
      "</p></div>" +
      "</div>" +
      '<div class="case-detail__cta-row">' +
      ctaHtml +
      (awardsHtml
        ? '<div class="case-detail__awards"><span class="case-detail__awards-label">Awards:</span><div class="case-detail__awards-list">' +
          awardsHtml +
          "</div></div>"
        : "") +
      "</div>" +
      '<hr class="case-detail__divider" aria-hidden="true">' +
      sectionsHtml
    );
  }

  function updateCaseMenu(card, meta) {
    var titleEl = card.querySelector(".card__menu-title");
    if (titleEl) {
      titleEl.textContent = meta.title;
    }
  }

  var galleryDesktopMq = window.matchMedia("(min-width: 48.0625rem)");
  var caseMobileMq = window.matchMedia("(max-width: 48rem)");

  function syncCtaAwardsFit(row) {
    var awards = row.querySelector(".case-detail__awards");
    if (!awards) {
      return;
    }

    if (!caseMobileMq.matches) {
      awards.hidden = false;
      return;
    }

    awards.hidden = false;
    awards.hidden = row.scrollWidth > row.clientWidth + 1;
  }

  function bindCtaAwards(root) {
    root.querySelectorAll(".case-detail__cta-row").forEach(function (row) {
      if (row.dataset.ctaAwardsBound === "true") {
        return;
      }
      row.dataset.ctaAwardsBound = "true";

      var resizeTimer;

      function sync() {
        syncCtaAwardsFit(row);
      }

      function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(sync, 100);
      }

      sync();

      var awards = row.querySelector(".case-detail__awards");
      if (awards) {
        awards.querySelectorAll("img").forEach(function (img) {
          if (img.complete) {
            return;
          }
          img.addEventListener("load", sync);
          img.addEventListener("error", sync);
        });
      }

      window.addEventListener("resize", onResize);
      caseMobileMq.addEventListener("change", sync);
    });
  }

  function galleryHeightPx(gallery) {
    var probe = gallery.querySelector(".case-detail__gallery-item");
    if (!probe) {
      return 0;
    }

    return Math.round(parseFloat(getComputedStyle(probe).height)) || 0;
  }

  function fitGalleryImageSizes(gallery) {
    var heightPx = galleryHeightPx(gallery);
    if (!heightPx) {
      return;
    }

    gallery.querySelectorAll(".case-detail__gallery-item").forEach(function (item) {
      var img = item.querySelector("img");
      if (!img || !img.naturalWidth || !img.naturalHeight) {
        return;
      }

      var fullWidthPx = Math.round((img.naturalWidth / img.naturalHeight) * heightPx);
      var heightValue = heightPx + "px";
      var fullWidthValue = fullWidthPx + "px";

      img.style.height = heightValue;
      img.style.width = fullWidthValue;

      if (item.classList.contains("case-detail__gallery-item--slice")) {
        var slices = parseInt(item.dataset.sliceCount, 10) || 1;
        var sliceIndex = parseInt(item.dataset.sliceIndex, 10) || 0;
        var sliceWidthPx = Math.round(fullWidthPx / slices);
        var offsetPx = sliceWidthPx * sliceIndex;

        item.style.width = sliceWidthPx + "px";
        img.style.transform = "translateX(-" + offsetPx + "px)";
        return;
      }

      item.style.width = fullWidthValue;
      img.style.removeProperty("transform");
    });
  }

  function syncGalleryNav(gallery, updateButtons) {
    if (updateButtons === undefined) {
      updateButtons = true;
    }

    var track = gallery.querySelector(".case-detail__gallery-track");
    var nav = gallery.querySelector(".case-detail__gallery-nav");
    var prevBtn = gallery.querySelector(".case-detail__gallery-btn--prev");
    var nextBtn = gallery.querySelector(".case-detail__gallery-btn--next");
    if (!track || !nav) {
      return;
    }

    var isDesktop = galleryDesktopMq.matches;
    var overflows = track.scrollWidth > track.clientWidth + 1;
    var navVisible = isDesktop && overflows;
    nav.hidden = !navVisible;

    gallery.querySelectorAll(".case-detail__gallery-item").forEach(function (item) {
      item.classList.remove("case-detail__gallery-item--nav-overlap");
    });

    if (!navVisible) {
      gallery.style.removeProperty("--case-gallery-nav-width");
      if (prevBtn) {
        prevBtn.disabled = false;
      }
      if (nextBtn) {
        nextBtn.disabled = false;
      }
      return;
    }

    if (updateButtons) {
      var maxScroll = track.scrollWidth - track.clientWidth;
      if (prevBtn) {
        prevBtn.disabled = track.scrollLeft <= 1;
      }
      if (nextBtn) {
        nextBtn.disabled = track.scrollLeft >= maxScroll - 1;
      }
    }

    var navRect = nav.getBoundingClientRect();
    gallery.style.setProperty("--case-gallery-nav-width", Math.round(navRect.width) + "px");

    gallery.querySelectorAll(".case-detail__gallery-item").forEach(function (item) {
      var itemRect = item.getBoundingClientRect();
      var overlaps =
        itemRect.right > navRect.left + 1 &&
        itemRect.left < navRect.right - 1 &&
        itemRect.bottom > navRect.top + 1;
      item.classList.toggle("case-detail__gallery-item--nav-overlap", overlaps);
    });
  }

  var GALLERY_SCROLL_SETTLE_MS = 100;

  function bindGalleryScrollSync(track, onDuringScroll, onScrollEnd) {
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

  var GALLERY_DRAG_THRESHOLD = 6;

  function bindGalleryDrag(track) {
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

        if (event.target.closest(".case-detail__gallery-btn, .case-detail__scale-btn")) {
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
          if (Math.abs(delta) < GALLERY_DRAG_THRESHOLD) {
            return;
          }

          isDragging = true;
          track.classList.add("is-dragging");
          track.setPointerCapture(event.pointerId);
        }

        event.preventDefault();

        if (Math.abs(delta) > GALLERY_DRAG_THRESHOLD) {
          dragged = true;
        }

        track.scrollLeft = startScroll - delta;
      },
      { passive: false }
    );

    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
  }

  function bindGalleries(root) {
    root.querySelectorAll(".case-detail__gallery").forEach(function (gallery) {
      if (gallery.dataset.bound === "true") {
        return;
      }
      gallery.dataset.bound = "true";

      var track = gallery.querySelector(".case-detail__gallery-track");
      var prevBtn = gallery.querySelector(".case-detail__gallery-btn--prev");
      var nextBtn = gallery.querySelector(".case-detail__gallery-btn--next");
      if (!track) {
        return;
      }

      var resizeTimer;

      function syncNav() {
        fitGalleryImageSizes(gallery);
        syncGalleryNav(gallery, true);
      }

      function syncNavDuringScroll() {
        syncGalleryNav(gallery, false);
      }

      function syncNavAfterScroll() {
        syncGalleryNav(gallery, true);
      }

      function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(syncNav, 100);
      }

      track.querySelectorAll("img").forEach(function (img) {
        if (img.complete) {
          syncNav();
        } else {
          img.addEventListener("load", syncNav);
          img.addEventListener("error", syncNav);
        }
      });

      syncNav();
      bindGalleryDrag(track);
      bindGalleryScrollSync(track, syncNavDuringScroll, syncNavAfterScroll);
      window.addEventListener("resize", onResize);
      galleryDesktopMq.addEventListener("change", syncNav);

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
    });
  }

  var touchScaleMq = window.matchMedia("(hover: none), (pointer: coarse)");

  function bindImageScale(root) {
    var containers = root.querySelectorAll(".case-detail__gallery-item");

    function closeAllScaleLabels() {
      containers.forEach(function (container) {
        container.classList.remove("is-scale-visible");
      });
    }

    containers.forEach(function (container) {
      if (container.dataset.scaleBound === "true") {
        return;
      }
      container.dataset.scaleBound = "true";

      container.addEventListener("click", function (event) {
        if (!touchScaleMq.matches) {
          return;
        }

        if (event.target.closest(".case-detail__scale-btn")) {
          return;
        }

        var wasVisible = container.classList.contains("is-scale-visible");
        closeAllScaleLabels();
        if (!wasVisible) {
          container.classList.add("is-scale-visible");
        }
      });
    });

    if (root.dataset.scaleDismissBound === "true") {
      return;
    }
    root.dataset.scaleDismissBound = "true";

    document.addEventListener("click", function (event) {
      if (!touchScaleMq.matches) {
        return;
      }

      if (event.target.closest(".case-detail__gallery-item")) {
        return;
      }

      closeAllScaleLabels();
    });

    if (typeof touchScaleMq.addEventListener === "function") {
      touchScaleMq.addEventListener("change", closeAllScaleLabels);
    } else if (typeof touchScaleMq.addListener === "function") {
      touchScaleMq.addListener(closeAllScaleLabels);
    }
  }

  function hydrateCaseCard(entry) {
    var card = document.getElementById("map-card-" + entry.nodeId);
    if (!card) {
      return Promise.resolve();
    }

    var host = card.querySelector(".card__content--case-detail");
    if (!host) {
      return Promise.resolve();
    }

    return Promise.all([loadCaseMeta(entry.folder), loadCaseText(entry.folder)]).then(
      function (results) {
        var meta = results[0];
        var textOverrides = results[1];
        var detail = host.querySelector(".case-detail");
        if (!detail) {
          return;
        }

        detail.innerHTML = renderCaseDetail(meta, textOverrides);
        detail.hidden = false;
        host.dataset.hydrated = "true";

        updateCaseMenu(card, meta);
        bindGalleries(detail);
        bindImageScale(detail);
        bindCtaAwards(detail);
      }
    );
  }

  function hydrateCasesList() {
    var list = document.querySelector("#map-card-cases .project-list");
    if (!list) {
      return Promise.resolve();
    }

    return loadIndex().then(function (entries) {
      var promises = entries.map(function (entry) {
        var row = list.querySelector('[data-case-slug="' + entry.slug + '"]');
        if (!row) {
          return Promise.resolve();
        }

        return loadCaseMeta(entry.folder).then(function (meta) {
          var listData = meta.list || {};
          var titleEl = row.querySelector(".project-row__title");
          var descEl = row.querySelector(".project-row__description");
          var labelsEl = row.querySelector(".project-row__labels");

          if (titleEl) {
            titleEl.textContent = listData.title || meta.title;
          }
          if (descEl) {
            descEl.textContent = listData.description || "";
          }
          if (labelsEl) {
            labelsEl.innerHTML = renderLabels(listData.tags);
          }
        });
      });

      return Promise.all(promises).then(function () {
        list.dataset.hydrated = "true";
      });
    });
  }

  function sync(nodeId) {
    if (nodeId === "cases") {
      return hydrateCasesList();
    }

    if (!isCaseNode(nodeId)) {
      return Promise.resolve();
    }

    return loadIndex().then(function (entries) {
      var entry = entries.find(function (item) {
        return item.nodeId === nodeId;
      });
      if (!entry) {
        return;
      }
      return hydrateCaseCard(entry);
    });
  }

  window.CasesContent = {
    sync: sync,
  };
})();
