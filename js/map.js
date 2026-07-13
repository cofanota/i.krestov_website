(function () {
  "use strict";

  var ROUTES = {
    home: "/",
    about: "/about",
    cases: "/cases",
    "case-picksell": "/cases/picksell",
    "case-sbibank": "/cases/sbibank",
    "case-edstore": "/cases/edstore",
    "case-post-ecosystem": "/cases/post-ecosystem",
    "case-mindloom": "/cases/mindloom",
    contacts: "/contacts",
  };

  var PATH_TO_NODE = {
    "/": "home",
    "/about": "about",
    "/cases": "cases",
    "/cases/picksell": "case-picksell",
    "/cases/sbibank": "case-sbibank",
    "/cases/edstore": "case-edstore",
    "/cases/post-ecosystem": "case-post-ecosystem",
    "/cases/mindloom": "case-mindloom",
    "/contacts": "contacts",
  };

  var TRANSITION_MS = 780;
  var CARD_ANIMATION_MS = 550;

  var viewport = document.getElementById("map-viewport");
  var canvas = document.getElementById("map-canvas");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".map-card"));
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll("[data-map-target]")
  );

  var currentNode = "home";
  var cameraTargetNode = "home";
  var isAnimating = false;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var resizeTimer = null;
  var resizeEndTimer = null;
  var lastResizeWidth = window.innerWidth;
  var lastResizeHeight = window.innerHeight;
  var graphController = null;

  function setResizeInstant(enabled) {
    if (!canvas) {
      return;
    }

    canvas.classList.toggle("is-instant", enabled);
    cards.forEach(function (card) {
      card.classList.toggle("is-instant", enabled);
    });
  }

  function syncAboutLayout(nodeId) {
    if (nodeId !== "about") {
      return;
    }

    requestAnimationFrame(function () {
      playAboutVideos();
    });
  }

  function nodeFromPath(pathname) {
    var path = pathname.replace(/\/+$/, "") || "/";
    return PATH_TO_NODE[path] || "home";
  }

  function getCard(nodeId) {
    return document.querySelector('.map-card[data-node="' + nodeId + '"]');
  }

  function getScale() {
    var card = getCard("home");
    if (!card) return 1;
    var width = card.offsetWidth;
    var design = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--map-design-card-width")
    ) || 1024;
    return width / design;
  }

  function cardCenter(nodeId) {
    if (graphController) {
      var center = graphController.getNodeCenter(nodeId);
      if (center) return center;
    }

    var originX =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--map-origin-x")) ||
      512;
    var originY =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--map-origin-y")) ||
      1000;
    return { x: originX, y: originY };
  }

  function positionCards() {
    if (graphController) {
      return graphController.reflow();
    }
    return Promise.resolve();
  }

  function cameraOffsetY() {
    var raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--map-camera-offset-y")
      .trim();
    if (!raw) return 0;

    var value = parseFloat(raw);
    if (isNaN(value)) return 0;

    if (raw.indexOf("rem") !== -1) {
      var rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return value * rootSize;
    }

    return value;
  }

  function readViewportTokenLength(tokenName) {
    if (!viewport) return 0;

    var probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;visibility:hidden;pointer-events:none;height:var(" + tokenName + ");";
    viewport.appendChild(probe);
    var height = probe.offsetHeight;
    viewport.removeChild(probe);
    return height;
  }

  function isViewportHeightCapped(card) {
    if (!card) return false;

    var cardHeight = card.offsetHeight;
    var designHeight = readViewportTokenLength("--card-design-height");
    return cardHeight > 0 && designHeight > 0 && cardHeight < designHeight - 1;
  }

  function setCamera(nodeId, instant) {
    if (!viewport || !canvas) return;

    cameraTargetNode = nodeId;

    var center = cardCenter(nodeId);
    var vpRect = viewport.getBoundingClientRect();
    var card = getCard(nodeId);
    var cardHeight = card ? card.offsetHeight : 0;
    var compact = window.matchMedia("(max-width: 63.9375rem)").matches;
    var tx = vpRect.width / 2 - center.x;
    var ty;

    if (compact) {
      ty = vpRect.height / 2 - center.y - cameraOffsetY();
    } else if (isViewportHeightCapped(card)) {
      ty = cardHeight / 2 - center.y;
    } else {
      ty = vpRect.height / 2 - center.y - cameraOffsetY();
    }

    if (instant) {
      canvas.classList.add("is-instant");
    }

    canvas.offsetHeight;
    canvas.style.transform = "translate3d(" + tx + "px, " + ty + "px, 0)";

    if (instant) {
      canvas.offsetHeight;
      canvas.classList.remove("is-instant");
    }
  }

  function beginNavigation() {
    if (canvas) {
      canvas.classList.add("is-navigating");
    }

    if (graphController) {
      graphController.pauseReflow();
    }
  }

  function endNavigation() {
    if (canvas) {
      canvas.classList.remove("is-navigating");
    }

    if (graphController) {
      graphController.resumeReflow();
    }
  }

  function isAboutVideoVisible(video) {
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

  function playAboutVideo(video) {
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

  function getAboutVideos() {
    return document.querySelectorAll("#map-card-about .about__video[data-src]");
  }

  function playAboutVideos() {
    if (reduceMotion) {
      return;
    }

    getAboutVideos().forEach(function (video) {
      if (!isAboutVideoVisible(video)) {
        video.pause();
        return;
      }

      playAboutVideo(video);
    });
  }

  function pauseAboutVideos() {
    getAboutVideos().forEach(function (video) {
      video.pause();
    });
  }

  function syncAboutVideos(nodeId) {
    if (nodeId === "about") {
      playAboutVideos();
      return;
    }

    pauseAboutVideos();
  }

  function updateNavCurrent(nodeId) {
    navLinks.forEach(function (link) {
      link.removeAttribute("aria-current");
    });

    navLinks.forEach(function (link) {
      var card = link.closest(".map-card");
      var inActiveCard = card && card.classList.contains("is-active");
      var inHeader = Boolean(link.closest(".site-header"));
      if (!inActiveCard && !inHeader) {
        return;
      }

      if (link.getAttribute("data-map-target") === nodeId) {
        link.setAttribute("aria-current", "page");
      }
    });
  }

  function setActiveCard(nodeId, instant) {
    cards.forEach(function (card) {
      var isTarget = card.getAttribute("data-node") === nodeId;
      card.classList.toggle("is-active", isTarget);
      card.classList.remove("is-leaving", "is-entering", "is-settling");

      if (instant) {
        card.classList.add("is-instant");
        card.offsetHeight;
        card.classList.remove("is-instant");
      }
    });

    document.body.setAttribute("data-map-node", nodeId);
    currentNode = nodeId;
    updateNavCurrent(nodeId);
    syncAboutVideos(nodeId);
    syncAboutLayout(nodeId);
    if (window.CasesContent && typeof window.CasesContent.sync === "function") {
      window.CasesContent.sync(nodeId);
    }
  }

  function startSettling(card) {
    if (!card) return;

    function finish() {
      card.classList.remove("is-settling");
    }

    function onEnd(event) {
      if (event.target !== card || event.propertyName !== "transform") return;
      card.removeEventListener("animationend", onEnd);
      window.clearTimeout(fallbackTimer);
      finish();
    }

    var fallbackTimer = window.setTimeout(function () {
      card.removeEventListener("animationend", onEnd);
      finish();
    }, CARD_ANIMATION_MS + 80);

    card.addEventListener("animationend", onEnd);
    card.classList.remove("is-entering");
    card.classList.add("is-active", "is-settling");
  }

  function waitTransition(el) {
    if (reduceMotion || !el) return Promise.resolve();

    return new Promise(function (resolve) {
      var done = false;

      function finish() {
        if (done) return;
        done = true;
        el.removeEventListener("transitionend", onEnd);
        resolve();
      }

      function onEnd(event) {
        if (event.target === el && event.propertyName === "transform") {
          finish();
        }
      }

      el.addEventListener("transitionend", onEnd);
      window.setTimeout(finish, TRANSITION_MS + 80);
    });
  }

  function navigateTo(nodeId, options) {
    options = options || {};
    var push = options.push !== false;
    var replace = options.replace === true;
    var instant = options.instant === true || reduceMotion;

    if (nodeId === currentNode || isAnimating) return Promise.resolve();
    if (!graphController || !graphController.hasNode(nodeId)) return Promise.resolve();

    var fromNode = currentNode;
    var fromCard = getCard(fromNode);
    var toCard = getCard(nodeId);
    var path = ROUTES[nodeId];

    isAnimating = true;

    if (instant) {
      if (push) {
        if (replace) {
          history.replaceState({ node: nodeId }, "", path);
        } else {
          history.pushState({ node: nodeId }, "", path);
        }
      }
      setActiveCard(nodeId, true);
      setCamera(nodeId, true);
      isAnimating = false;
      return Promise.resolve();
    }

    beginNavigation();

    if (fromNode === "about") {
      pauseAboutVideos();
    }

    if (fromCard) {
      fromCard.classList.add("is-leaving");
      fromCard.classList.remove("is-active");
    }

    if (toCard) {
      toCard.classList.remove("is-active");
      toCard.classList.add("is-entering");
      if (nodeId === "about") {
        syncAboutLayout(nodeId);
      }
      if (window.CasesContent && typeof window.CasesContent.sync === "function") {
        window.CasesContent.sync(nodeId);
      }
    }

    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          setCamera(nodeId, false);

          if (push) {
            if (replace) {
              history.replaceState({ node: nodeId }, "", path);
            } else {
              history.pushState({ node: nodeId }, "", path);
            }
          }

          waitTransition(canvas)
            .then(function () {
              if (fromCard) {
                fromCard.classList.remove("is-leaving");
              }
              if (toCard) {
                requestAnimationFrame(function () {
                  startSettling(toCard);
                });
              }
              document.body.setAttribute("data-map-node", nodeId);
              currentNode = nodeId;
              updateNavCurrent(nodeId);
              syncAboutVideos(nodeId);
              syncAboutLayout(nodeId);
            })
            .then(function () {
              endNavigation();
              isAnimating = false;
              resolve();
            });
        });
      });
    });
  }

  function onLinkClick(event) {
    var link = event.currentTarget;
    var target = link.getAttribute("data-map-target");
    if (!target || target === currentNode) return;

    event.preventDefault();
    navigateTo(target);
  }

  function onPopState(event) {
    var nodeId =
      (event.state && event.state.node) || nodeFromPath(window.location.pathname);
    navigateTo(nodeId, { push: false, instant: reduceMotion });
  }

  function scheduleResizeReflow() {
    setResizeInstant(true);
    window.clearTimeout(resizeTimer);
    window.clearTimeout(resizeEndTimer);
    resizeTimer = window.setTimeout(function () {
      if (graphController && !isAnimating) {
        graphController.scheduleReflow();
      }
      syncAboutLayout(currentNode);
    }, 120);
    resizeEndTimer = window.setTimeout(function () {
      setResizeInstant(false);
    }, 280);
  }

  function onResize() {
    var width = window.innerWidth;
    var height = window.innerHeight;

    if (width === lastResizeWidth) {
      if (height === lastResizeHeight) {
        return;
      }

      // %-based card heights need a reflow when viewport height changes.
      lastResizeHeight = height;
      scheduleResizeReflow();
      return;
    }

    lastResizeWidth = width;
    lastResizeHeight = height;
    scheduleResizeReflow();
  }

  function initGraph() {
    if (!window.MapGraph) {
      console.error("[map] MapGraph modules are not loaded.");
      return Promise.resolve();
    }

    var model = window.MapGraph.createSiteGraph();
    graphController = new window.MapGraph.Controller({
      model: model,
      canvas: canvas,
      cards: cards,
      getScale: getScale,
      anchorId: "home",
    });

    graphController.onLayoutDone(function () {
      if (isAnimating) {
        return;
      }
      setCamera(currentNode, true);
      syncAboutLayout(currentNode);
    });

    graphController.bindLifecycle();
    return graphController.reflow();
  }

  function init() {
    initGraph().then(function () {
      var initialNode = nodeFromPath(window.location.pathname);
      setActiveCard(initialNode, true);
      setCamera(initialNode, true);
      history.replaceState({ node: initialNode }, "", ROUTES[initialNode]);
    });

    navLinks.forEach(function (link) {
      link.addEventListener("click", onLinkClick);
    });

    window.addEventListener("popstate", onPopState);
    window.addEventListener("resize", onResize);

    var compactMq = window.matchMedia("(max-width: 63.9375rem)");
    if (typeof compactMq.addEventListener === "function") {
      compactMq.addEventListener("change", onResize);
    } else if (typeof compactMq.addListener === "function") {
      compactMq.addListener(onResize);
    }

    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", function (e) {
      reduceMotion = e.matches;
      if (graphController) {
        graphController.scheduleReflow();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
