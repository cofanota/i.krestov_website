(function () {
  "use strict";

  var indexCache = null;
  var metaCache = {};
  var textCache = {};

  var RASTER_EXT = /\.(png|jpe?g)$/i;
  var VIDEO_EXT = /\.(mp4|webm|mov)$/i;
  var COMPACT_MEDIA = "(max-width: 63.9375rem)";

  function siteUrl(path) {
    if (!path || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(path)) {
      return path;
    }

    var base = (window.SITE_BASE_PATH || "/").replace(/\/$/, "");
    return path.charAt(0) === "/" ? base + path : path;
  }

  function compactWebpUrl(src) {
    var parts = String(src).split("?");
    var path = parts[0];
    var query = parts[1] ? "?" + parts[1] : "";
    if (!RASTER_EXT.test(path)) {
      return "";
    }
    return path.replace(RASTER_EXT, "") + "-800w.webp" + query;
  }

  function applyOptimizedImage(img, src) {
    var url = siteUrl(src);
    var webp = compactWebpUrl(url);
    var picture = img.closest("picture");
    var source = picture && picture.querySelector("source");

    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.src = url;

    if (source && webp) {
      source.setAttribute("srcset", webp);
      source.setAttribute("type", "image/webp");
      source.setAttribute("media", COMPACT_MEDIA);
    }
  }

  function renderPlainImg(src, className, extraAttrs) {
    var url = siteUrl(src);
    var attrs = extraAttrs ? " " + extraAttrs : "";
    return (
      "<img" +
      (className ? ' class="' + className + '"' : "") +
      ' src="' +
      escapeHtml(url) +
      '"' +
      attrs +
      ">"
    );
  }

  function renderOptimizedImg(src, className, extraAttrs) {
    var url = siteUrl(src);
    var webp = compactWebpUrl(url);
    var attrs = extraAttrs ? " " + extraAttrs : "";
    var img =
      "<img" +
      (className ? ' class="' + className + '"' : "") +
      ' src="' +
      escapeHtml(url) +
      '"' +
      attrs +
      ">";

    if (!webp) {
      return img;
    }

    return (
      "<picture>" +
      '<source media="' +
      COMPACT_MEDIA +
      '" type="image/webp" srcset="' +
      escapeHtml(webp) +
      '">' +
      img +
      "</picture>"
    );
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

  function isVideoSrc(src) {
    return VIDEO_EXT.test(String(src).split("?")[0]);
  }

  function expandGalleryImages(images) {
    var items = [];

    (images || []).forEach(function (entry) {
      if (!entry) {
        return;
      }

      if (typeof entry === "string") {
        items.push({
          src: entry,
          type: isVideoSrc(entry) ? "video" : "image",
          slices: 1,
          sliceIndex: 0,
        });
        return;
      }

      if (!entry.src) {
        return;
      }

      var isVideo = entry.type === "video" || isVideoSrc(entry.src);
      if (isVideo) {
        items.push({
          src: entry.src,
          type: "video",
          poster: entry.poster || "",
          width: parseInt(entry.width, 10) || 0,
          height: parseInt(entry.height, 10) || 0,
          slices: 1,
          sliceIndex: 0,
        });
        return;
      }

      var slices = Math.max(1, parseInt(entry.slices, 10) || 1);
      for (var i = 0; i < slices; i += 1) {
        items.push({ src: entry.src, type: "image", slices: slices, sliceIndex: i });
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

  function renderGalleryVideo(item) {
    var src = siteUrl(item.src);
    var poster = item.poster ? siteUrl(item.poster) : "";
    var width = item.width || 1024;
    var height = item.height || 1024;

    return (
      '<video class="case-detail__gallery-video" width="' +
      width +
      '" height="' +
      height +
      '" muted playsinline webkit-playsinline loop autoplay preload="metadata"' +
      (poster ? ' poster="' + escapeHtml(poster) + '"' : "") +
      ' data-src="' +
      escapeHtml(src) +
      '" aria-hidden="true"></video>'
    );
  }

  function renderGalleryItem(item) {
    var figureClass = "case-detail__gallery-item";
    var figureAttrs = "";
    var isVideo = item.type === "video";

    if (isVideo) {
      figureClass += " case-detail__gallery-item--video";
    }

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
      (isVideo
        ? renderGalleryVideo(item)
        : renderOptimizedImg(
            item.src,
            "",
            'alt="" loading="lazy" decoding="async" draggable="false"'
          )) +
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

  function mediaSrc(entry) {
    return typeof entry === "string" ? entry : entry && entry.src ? entry.src : "";
  }

  function mediaPosition(entry) {
    return entry && typeof entry === "object" && entry.position ? entry.position : "";
  }

  function mediaNumber(entry, key, fallback) {
    if (entry && typeof entry === "object" && entry[key]) {
      return String(entry[key]);
    }
    return String(fallback);
  }

  function wrapZoomable(className, innerHtml) {
    if (!innerHtml) {
      return "";
    }

    return (
      '<figure class="' +
      className +
      ' case-split__zoom">' +
      innerHtml +
      renderScaleButton() +
      "</figure>"
    );
  }

  function renderPhoneFrame(entry) {
    var src = mediaSrc(entry);
    if (!src) {
      return "";
    }
    var position = mediaPosition(entry);
    var extra =
      'alt="" width="' +
      mediaNumber(entry, "width", 588) +
      '" height="' +
      mediaNumber(entry, "height", 1236) +
      '" loading="lazy" decoding="async"';
    var imgClass = "case-phone__img" + (position === "top" ? " case-phone__img--top" : "");
    return '<div class="case-phone">' + renderPlainImg(src, imgClass, extra) + "</div>";
  }

  function renderWebFrame(entry) {
    var src = mediaSrc(entry);
    if (!src) {
      return "";
    }
    var position = mediaPosition(entry);
    var extra =
      'alt="" width="' +
      mediaNumber(entry, "width", 1024) +
      '" height="' +
      mediaNumber(entry, "height", 580) +
      '" loading="lazy" decoding="async"';
    var imgClass = "case-web__img" + (position === "top" ? " case-web__img--top" : "");
    return wrapZoomable("case-web", renderPlainImg(src, imgClass, extra));
  }

  function renderShot(entry) {
    var src = mediaSrc(entry);
    if (!src) {
      return "";
    }

    return wrapZoomable(
      "case-split__shot",
      renderPlainImg(
        src,
        "case-split__shot-img",
        'alt="" loading="lazy" decoding="async"'
      )
    );
  }

  function renderMediaRow(media) {
    if (!media || !media.images || !media.images.length) {
      return "";
    }

    if (media.type === "shot") {
      return (
        '<div class="case-split__shot-row">' +
        media.images.map(renderShot).join("") +
        "</div>"
      );
    }

    if (media.type === "web") {
      var webRowClass =
        "case-split__web-row" +
        (media.images.length > 1 ? " case-split__web-row--pair" : "");
      return (
        '<div class="' +
        webRowClass +
        '">' +
        media.images.map(renderWebFrame).join("") +
        "</div>"
      );
    }

    return wrapZoomable(
      "case-split__phone-row",
      media.images.map(renderPhoneFrame).join("")
    );
  }

  function renderStory(story) {
    if (!story || !story.parts || !story.parts.length) {
      return "";
    }

    return (
      '<section class="case-split__card case-split__section reveal" id="story">' +
      '<h2 class="case-split__section-title">' +
      escapeHtml(story.title || "Story") +
      "</h2>" +
      '<div class="case-split__story-parts">' +
      story.parts
        .map(function (part) {
          return (
            '<div class="case-split__beat">' +
            '<p class="case-split__beat-label">' +
            escapeHtml(part.label || "") +
            "</p>" +
            '<p class="case-split__beat-text">' +
            escapeHtml(part.text || "") +
            "</p>" +
            "</div>"
          );
        })
        .join("") +
      "</div></section>"
    );
  }

  function renderBeats(beats) {
    if (!beats || !beats.length) {
      return "";
    }

    return (
      '<div class="case-split__beats">' +
      beats
        .map(function (beat) {
          return (
            '<div class="case-split__beat">' +
            '<p class="case-split__beat-label">' +
            escapeHtml(beat.label || "") +
            "</p>" +
            '<p class="case-split__beat-text">' +
            escapeHtml(beat.text || "") +
            "</p>" +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderScoreMeter(count, activeIndex) {
    var marks = "";
    var i;
    for (i = 0; i < count; i += 1) {
      marks +=
        '<span class="case-score__meter-mark' +
        (i === activeIndex ? " is-active" : "") +
        '"></span>';
    }
    return '<div class="case-score__meter" aria-hidden="true">' + marks + "</div>";
  }

  function renderScoreSlide(slide) {
    if (!slide) {
      return "";
    }

    if (slide.type === "award" && slide.image) {
      return (
        '<div class="case-score__slide case-score__slide--award">' +
        '<span class="case-score__award">' +
        '<img src="' +
        escapeHtml(siteUrl(slide.image)) +
        '" alt="" width="' +
        escapeHtml(slide.width || "112") +
        '" height="' +
        escapeHtml(slide.height || "191") +
        '">' +
        "</span>" +
        '<p class="case-score__label case-score__label--ui">' +
        escapeHtml(slide.label || "") +
        "</p></div>"
      );
    }

    return (
      '<div class="case-score__slide">' +
      '<p class="case-score__value">' +
      escapeHtml(slide.value || "") +
      "</p>" +
      '<p class="case-score__label">' +
      escapeHtml(slide.label || "") +
      "</p></div>"
    );
  }

  function renderScore(score) {
    if (!score) {
      return "";
    }

    var slides = score.slides && score.slides.length ? score.slides : [score];
    if (!slides.length) {
      return "";
    }

    var interactive = slides.length > 1;

    return (
      '<div class="case-score"' +
      (interactive
        ? ' data-score-carousel role="region" aria-roledescription="carousel" aria-label="' +
          escapeHtml(score.label || "Project results") +
          '"'
        : "") +
      ">" +
      '<div class="case-score__viewport">' +
      '<div class="case-score__track">' +
      slides.map(renderScoreSlide).join("") +
      "</div></div>" +
      (interactive
        ? renderScoreMeter(slides.length, 0) +
          '<button type="button" class="case-score__hit case-score__hit--prev" aria-label="Previous result" data-score-dir="-1"></button>' +
          '<button type="button" class="case-score__hit case-score__hit--next" aria-label="Next result" data-score-dir="1"></button>'
        : "") +
      "</div>"
    );
  }

  function renderSpotlight(meta) {
    var spot = meta.spotlight;
    if (!spot || !spot.map) {
      return "";
    }

    var map = wrapZoomable(
      "case-split__map",
      renderPlainImg(
        spot.map,
        "case-split__map-img",
        'alt="Ecosystem 3.0 transition map" width="5493" height="3434" decoding="async"'
      )
    );
    var device = spot.device
      ? wrapZoomable(
          "case-split__device",
          renderPlainImg(
            spot.device,
            "case-split__device-img",
            'alt="" width="714" height="714" decoding="async"'
          )
        )
      : "";

    return (
      '<div class="case-split__mosaic case-split__mosaic--map reveal">' +
      map +
      '<div class="case-split__mosaic-side">' +
      renderScore(meta.score) +
      device +
      "</div></div>"
    );
  }

  function renderSplitSection(section) {
    var beatsHtml = renderBeats(section.beats);
    var imagesHtml = renderMediaRow(section.media);
    var bodyHtml = imagesHtml ? imagesHtml + beatsHtml : beatsHtml;

    return (
      '<section class="case-split__card case-split__section reveal" id="' +
      escapeHtml(section.id || "") +
      '">' +
      '<h2 class="case-split__section-title">' +
      escapeHtml(section.title || "") +
      "</h2>" +
      bodyHtml +
      "</section>"
    );
  }

  function renderCaseDetailSplit(meta) {
    var hero = meta.hero || {};
    var caseMeta = meta.meta || {};
    var identity = meta.identity || {};
    var sections = meta.sections || [];

    var coverHtml = "";
    if (hero.cover) {
      if (isVideoSrc(hero.cover)) {
        coverHtml =
          '<video class="case-split__cover-video" width="1080" height="1350" muted playsinline webkit-playsinline loop autoplay preload="metadata"' +
          (hero.coverPoster
            ? ' poster="' + escapeHtml(siteUrl(hero.coverPoster)) + '"'
            : "") +
          ' data-src="' +
          escapeHtml(siteUrl(hero.cover)) +
          '" aria-hidden="true"></video>';
      } else {
        coverHtml = renderPlainImg(
          hero.cover,
          "case-split__cover-img",
          'alt="" width="511" height="656" decoding="async" fetchpriority="high"'
        );
      }
    }

    var mascotHtml = hero.mascot
      ? renderPlainImg(
          hero.mascot,
          "case-split__mascot-img",
          'alt="" width="501" height="327" decoding="async"'
        )
      : "";

    var appHtml = hero.app
      ? wrapZoomable(
          "case-split__app-shot",
          isVideoSrc(hero.app)
            ? '<video class="case-split__app-shot-img" muted playsinline webkit-playsinline loop autoplay preload="metadata" data-src="' +
              escapeHtml(siteUrl(hero.app)) +
              '" aria-hidden="true"></video>'
            : '<div class="case-snapshot">' +
              renderPlainImg(
                hero.app,
                "case-snapshot__img",
                'alt="" width="1024" height="580" decoding="async"'
              ) +
              "</div>"
        )
      : "";

    var navMedia = isVideoSrc(identity.nav)
      ? '<video class="case-split__nav-shot-img" width="614" height="614" muted playsinline webkit-playsinline loop autoplay preload="metadata" data-src="' +
        escapeHtml(siteUrl(identity.nav)) +
        '" aria-hidden="true"></video>'
      : renderPlainImg(
          identity.nav,
          "case-split__nav-shot-img",
          'alt="" width="614" height="614" loading="lazy" decoding="async"'
        );

    var identityRow =
      '<div class="case-split__identity-row" data-reveal-stagger="0.12">' +
      wrapZoomable(
        "case-split__tile reveal",
        renderPlainImg(
          identity.qr,
          "case-split__tile-img",
          'alt="" width="614" height="614" loading="lazy" decoding="async"'
        )
      ) +
      wrapZoomable("case-split__card case-split__nav-shot reveal", navMedia) +
      "</div>";

    var sectionsHtml = sections
      .map(function (section) {
        var trailing = section.trailingMedia
          ? '<div class="case-split__card case-split__media-card reveal">' +
            renderMediaRow(section.trailingMedia) +
            "</div>"
          : "";
        var prefix = section.id === "marketplace" ? identityRow : "";
        return prefix + renderSplitSection(section) + trailing;
      })
      .join("");

    var promo = hero.mosaic === "promo";
    var mosaicTop =
      !promo && (mascotHtml || appHtml)
        ? renderScore(meta.score) + wrapZoomable("case-split__mascot", mascotHtml)
        : "";
    var mosaicSide = "";
    if (promo) {
      mosaicSide =
        '<div class="case-split__mosaic-side">' +
        '<div class="case-split__mosaic-top">' +
        renderScore(meta.score) +
        wrapZoomable("case-split__mascot", mascotHtml) +
        "</div></div>";
    } else if (mosaicTop || appHtml) {
      mosaicSide =
        '<div class="case-split__mosaic-side">' +
        (mosaicTop
          ? '<div class="case-split__mosaic-top">' + mosaicTop + "</div>"
          : "") +
        appHtml +
        "</div>";
    }
    var coverFigure = wrapZoomable("case-split__cover", coverHtml);
    var mosaicHtml = "";
    if (coverFigure || mosaicSide) {
      mosaicHtml =
        '<div class="case-split__mosaic reveal' +
        (promo
          ? " case-split__mosaic--promo"
          : mosaicSide
            ? ""
            : " case-split__mosaic--solo") +
        '" id="overview">' +
        (promo ? mosaicSide + coverFigure : coverFigure + mosaicSide) +
        "</div>";
    }

    var leadCoverHtml = hero.leadCover
      ? '<figure class="case-split__lead-cover reveal">' +
        renderOptimizedImg(
          hero.leadCover,
          "case-split__lead-cover-img",
          'alt="" width="4800" height="1280" decoding="async" fetchpriority="high"'
        ) +
        "</figure>"
      : "";

    var metaHtml =
      '<section class="case-split__card case-split__meta reveal">' +
      '<div class="case-split__meta-role">' +
      '<p class="case-detail__meta-label">My role</p>' +
      '<p class="case-split__role">' +
      escapeHtml(caseMeta.role || "") +
      "</p></div>" +
      '<div class="case-split__meta-grid">' +
      '<div class="case-split__meta-col"><p class="case-detail__meta-label">Scope</p><p class="case-split__meta-value">' +
      escapeHtml(caseMeta.scope || "") +
      "</p></div>" +
      '<div class="case-split__meta-col case-split__meta-col--team"><p class="case-detail__meta-label">Team</p><p class="case-split__meta-value">' +
      escapeHtml(caseMeta.team || "") +
      "</p></div>" +
      '<div class="case-split__meta-col case-split__meta-col--duration"><p class="case-detail__meta-label">Duration</p><p class="case-split__meta-value">' +
      escapeHtml(caseMeta.duration || "") +
      "</p></div></div></section>";

    var storyHtml = renderStory(meta.story);
    var spotlightHtml = renderSpotlight(meta);
    var mainHtml = leadCoverHtml
      ? leadCoverHtml + metaHtml + storyHtml + mosaicHtml + spotlightHtml + sectionsHtml
      : mosaicHtml + metaHtml + storyHtml + spotlightHtml + sectionsHtml;

    return (
      '<div class="case-split">' +
      '<a class="btn btn--secondary case-split__back" href="/#cases">' +
      '<span class="btn__icon" aria-hidden="true">' +
      '<span class="btn__icon-svg btn__icon-svg--chevron-left"></span>' +
      "</span>" +
      '<span class="btn__label">Back</span>' +
      "</a>" +
      '<div class="case-split__intro reveal">' +
      '<h1 class="case-split__title">' +
      escapeHtml(hero.title || meta.title) +
      "</h1>" +
      '<div class="case-split__lede">' +
      '<p class="case-split__description">' +
      escapeHtml(hero.description || "") +
      "</p>" +
      '<ul class="case-split__labels" aria-label="Tags">' +
      renderLabels(hero.labels) +
      "</ul></div></div>" +
      '<div class="case-split__main">' +
      mainHtml +
      "</div></div>"
    );
  }

  function renderCaseDetail(meta, textOverrides) {
    if (meta.layout === "split") {
      return renderCaseDetailSplit(meta);
    }

    var hero = meta.hero || {};
    var caseMeta = meta.meta || {};
    var cta = meta.cta || {};
    var sections = meta.sections || [];

    var coverHtml = hero.cover
      ? renderOptimizedImg(
          hero.cover,
          "case-detail__cover-img",
          'alt="" width="2400" height="640" decoding="async" fetchpriority="high"'
        )
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
              '<div class="case-detail__text-row reveal">' +
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
          ? '<h3 class="case-detail__section-title reveal">' +
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
      '<div class="case-detail__headline-row" data-reveal-stagger="0.16">' +
      '<h1 class="case-detail__title reveal">' +
      escapeHtml(hero.title || meta.title) +
      "</h1>" +
      '<div class="case-detail__intro reveal">' +
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
      '<div class="case-detail__role-block reveal">' +
      '<p class="case-detail__meta-label">My role</p>' +
      '<p class="case-detail__role">' +
      escapeHtml(caseMeta.role || "") +
      "</p>" +
      "</div>" +
      '<div class="case-detail__meta-grid reveal">' +
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
      '<div class="case-detail__cta-row reveal">' +
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
      var media = item.querySelector("img") || item.querySelector("video");
      if (!media) {
        return;
      }

      var naturalWidth = media.naturalWidth || media.videoWidth || parseInt(media.getAttribute("width"), 10);
      var naturalHeight =
        media.naturalHeight || media.videoHeight || parseInt(media.getAttribute("height"), 10);
      if (!naturalWidth || !naturalHeight) {
        return;
      }

      var fullWidthPx = Math.round((naturalWidth / naturalHeight) * heightPx);
      var heightValue = heightPx + "px";
      var fullWidthValue = fullWidthPx + "px";

      media.style.height = heightValue;
      media.style.width = fullWidthValue;

      if (item.classList.contains("case-detail__gallery-item--slice")) {
        var slices = parseInt(item.dataset.sliceCount, 10) || 1;
        var sliceIndex = parseInt(item.dataset.sliceIndex, 10) || 0;
        var sliceWidthPx = Math.round(fullWidthPx / slices);
        var offsetPx = sliceWidthPx * sliceIndex;

        item.style.width = sliceWidthPx + "px";
        media.style.transform = "translateX(-" + offsetPx + "px)";
        return;
      }

      item.style.width = fullWidthValue;
      media.style.removeProperty("transform");
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

    measureGalleryNavWidth(gallery, nav);
  }

  function measureGalleryNavWidth(gallery, nav) {
    if (!gallery || !nav || nav.hidden) {
      return;
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

  function bindGalleryNavCollapseSync(gallery) {
    var nav = gallery.querySelector(".case-detail__gallery-nav");
    if (!nav || nav.dataset.collapseBound === "true") {
      return;
    }

    nav.dataset.collapseBound = "true";
    var collapseSyncTimer;

    nav.addEventListener("transitionend", function (event) {
      if (
        event.propertyName !== "max-width" &&
        event.propertyName !== "width" &&
        event.propertyName !== "gap"
      ) {
        return;
      }

      clearTimeout(collapseSyncTimer);
      collapseSyncTimer = setTimeout(function () {
        measureGalleryNavWidth(gallery, nav);
      }, 0);
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

      track.querySelectorAll("video").forEach(function (video) {
        if (video.videoWidth) {
          syncNav();
        } else {
          video.addEventListener("loadedmetadata", syncNav);
          video.addEventListener("error", syncNav);
        }
      });

      syncNav();
      bindGalleryNavCollapseSync(gallery);
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
    var containers = root.querySelectorAll(
      ".case-detail__gallery-item, .case-split__zoom"
    );

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

      if (event.target.closest(".case-detail__gallery-item, .case-split__zoom")) {
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

  function bindScoreCarousel(root) {
    var carousel = root.querySelector("[data-score-carousel]");
    if (!carousel) {
      return;
    }

    var track = carousel.querySelector(".case-score__track");
    var slides = carousel.querySelectorAll(".case-score__slide");
    var marks = carousel.querySelectorAll(".case-score__meter-mark");
    if (!track || slides.length < 2) {
      return;
    }

    var index = 0;
    var timer = 0;
    var intervalMs = 2000;
    var reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    function setSlide(nextIndex) {
      index = (nextIndex + slides.length) % slides.length;
      var width = carousel.clientWidth;
      carousel.style.setProperty("--score-slide-w", width + "px");
      track.style.transform = "translateX(-" + index * width + "px)";
      marks.forEach(function (mark, markIndex) {
        mark.classList.toggle("is-active", markIndex === index);
      });
      slides.forEach(function (slide, slideIndex) {
        slide.setAttribute("aria-hidden", slideIndex === index ? "false" : "true");
      });
    }

    function play() {
      stop();
      if (reducedMq.matches || slides.length < 2) {
        return;
      }
      timer = window.setInterval(function () {
        setSlide(index + 1);
      }, intervalMs);
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    }

    function step(delta) {
      setSlide(index + delta);
      play();
    }

    requestAnimationFrame(function () {
      setSlide(0);
      play();
    });

    window.addEventListener("resize", function () {
      setSlide(index);
    });

    if (typeof ResizeObserver === "function") {
      new ResizeObserver(function () {
        setSlide(index);
      }).observe(carousel);
    }

    carousel.querySelectorAll("[data-score-dir]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        step(parseInt(button.getAttribute("data-score-dir"), 10) || 0);
      });
    });

    carousel.addEventListener("mouseenter", stop);
    carousel.addEventListener("mouseleave", play);
    carousel.addEventListener("focusin", stop);
    carousel.addEventListener("focusout", play);

    if (typeof reducedMq.addEventListener === "function") {
      reducedMq.addEventListener("change", function () {
        setSlide(0);
        play();
      });
    }
  }

  function bindCaseSplitNav(root) {
    var split = root.querySelector(".case-split");
    if (!split) {
      return;
    }

    function caseAnchor(id) {
      if (window.CSS && typeof CSS.escape === "function") {
        return CSS.escape(id);
      }
      return String(id).replace(/[^a-zA-Z0-9_-]/g, "");
    }

    var main = split.querySelector(".case-split__main");
    if (!main) {
      return;
    }

    var links = Array.prototype.slice.call(
      split.querySelectorAll("[data-case-nav]")
    );
    var targets = links
      .map(function (link) {
        return main.querySelector("#" + caseAnchor(link.getAttribute("data-case-nav")));
      })
      .filter(Boolean);

    if (!links.length || !targets.length) {
      return;
    }

    function setActive(id) {
      links.forEach(function (link) {
        var active = link.getAttribute("data-case-nav") === id;
        link.classList.toggle("is-active", active);
        if (active) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    function scrollToTarget(id) {
      var target = main.querySelector("#" + caseAnchor(id));
      if (!target) {
        return;
      }
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }

    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        var id = link.getAttribute("data-case-nav");
        if (!id) {
          return;
        }
        event.preventDefault();
        setActive(id);
        scrollToTarget(id);
      });
    });

    if (typeof IntersectionObserver !== "function") {
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        var visible = entries
          .filter(function (entry) {
            return entry.isIntersecting;
          })
          .sort(function (a, b) {
            return b.intersectionRatio - a.intersectionRatio;
          })[0];
        if (visible && visible.target.id) {
          setActive(visible.target.id);
        }
      },
      {
        root: main,
        rootMargin: "0px 0px -55% 0px",
        threshold: [0.15, 0.35, 0.6],
      }
    );

    targets.forEach(function (target) {
      observer.observe(target);
    });
  }

  function hydrateCaseCard(entry) {
    var host = document.querySelector(
      '.card__content--case-detail[data-case-slug="' + entry.slug + '"]'
    );
    if (!host) {
      return Promise.resolve();
    }

    var card = host.closest(".card");

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

        if (meta.layout === "split") {
          document.body.classList.add("page--case-split");
          bindCaseSplitNav(detail);
          bindScoreCarousel(detail);
        } else {
          bindGalleries(detail);
          bindImageScale(detail);
          bindCtaAwards(detail);
        }
        if (window.RevealText) {
          window.RevealText.scan(detail);
        }
        if (window.AboutMedia && typeof window.AboutMedia.play === "function") {
          window.AboutMedia.play();
        }
      }
    );
  }

  function hydrateCasesList() {
    var list = document.querySelector(".folio-bento");
    if (!list) {
      return Promise.resolve();
    }

    list.dataset.hydrated = "true";
    return Promise.resolve();
  }

  function hydrateCurrentPage() {
    var page = document.body.getAttribute("data-page");

    if (page === "home") {
      return hydrateCasesList();
    }

    if (page === "case") {
      var host = document.querySelector(".card__content--case-detail[data-case-slug]");
      var slug = host && host.getAttribute("data-case-slug");
      if (!slug) {
        return Promise.resolve();
      }

      return loadIndex().then(function (entries) {
        var entry = entries.find(function (item) {
          return item.slug === slug;
        });
        if (!entry) {
          return;
        }
        return hydrateCaseCard(entry);
      });
    }

    return Promise.resolve();
  }

  window.CasesContent = {
    hydrate: hydrateCurrentPage,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrateCurrentPage);
  } else {
    hydrateCurrentPage();
  }
})();
