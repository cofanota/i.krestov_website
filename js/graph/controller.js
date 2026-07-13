(function (global) {
  "use strict";

  function isCompactMapView() {
    return window.matchMedia("(max-width: 63.9375rem)").matches;
  }

  function getMapSpacingMultiplier() {
    return isCompactMapView() ? 1 : 2;
  }

  function applyMapLayoutSpacing(layoutOptions, edgeSpacing, multiplier) {
    if (multiplier <= 1) {
      if (edgeSpacing) {
        layoutOptions["elk.spacing.edgeEdge"] = String(edgeSpacing);
      }
      return edgeSpacing;
    }

    var defaults = global.MapGraph.LayoutElk.DEFAULT_LAYOUT_OPTIONS;
    layoutOptions["elk.spacing.nodeNode"] = String(
      parseInt(defaults["elk.spacing.nodeNode"], 10) * multiplier
    );
    layoutOptions["elk.spacing.edgeNode"] = String(
      parseInt(defaults["elk.spacing.edgeNode"], 10) * multiplier
    );
    layoutOptions["elk.layered.spacing.nodeNodeBetweenLayers"] = String(
      parseInt(defaults["elk.layered.spacing.nodeNodeBetweenLayers"], 10) * multiplier
    );

    var edgeEdge = edgeSpacing
      ? Math.round(edgeSpacing * multiplier)
      : parseInt(defaults["elk.spacing.edgeEdge"], 10) * multiplier;
    layoutOptions["elk.spacing.edgeEdge"] = String(edgeEdge);
    return edgeEdge;
  }

  function GraphController(options) {
    this.model = options.model;
    this.canvas = options.canvas;
    this.cards = options.cards || [];
    this.getScale = options.getScale;
    this.debounceMs = options.debounceMs || 120;
    this.anchorId = options.anchorId || "home";
    this.layoutOptions = options.layoutOptions || null;
    this.workerUrl = options.workerUrl || "/assets/vendor/elk-worker.min.js";

    this.renderer = new global.MapGraph.Renderer({
      canvas: this.canvas,
      getScale: this.getScale,
      routerOptions: options.routerOptions || { cornerRadius: 14 },
    });

    this._runId = 0;
    this._debounceTimer = null;
    this._lastLayout = null;
    this._onLayoutDone = [];
    this._reflowPaused = false;

    if (this.model && typeof this.model.onChange === "function") {
      this.model.onChange(
        function () {
          this.scheduleReflow();
        }.bind(this)
      );
    }
  }

  GraphController.prototype.onLayoutDone = function (fn) {
    if (typeof fn === "function") {
      this._onLayoutDone.push(fn);
    }
  };

  GraphController.prototype._emitLayoutDone = function (layout) {
    this._onLayoutDone.forEach(function (fn) {
      fn(layout);
    });
  };

  GraphController.prototype.pauseReflow = function () {
    this._reflowPaused = true;
    window.clearTimeout(this._debounceTimer);
  };

  GraphController.prototype.resumeReflow = function () {
    this._reflowPaused = false;
    this.scheduleReflow();
  };

  GraphController.prototype.getNodeCenter = function (nodeId) {
    return this.renderer.getNodeCenter(nodeId);
  };

  GraphController.prototype.getLayout = function () {
    return this._lastLayout;
  };

  GraphController.prototype.hasNode = function (nodeId) {
    return this.model.hasNode(nodeId);
  };

  GraphController.prototype.measureNodes = function () {
    var scale = this.getScale();
    if (!scale || scale <= 0) scale = 1;

    this.cards.forEach(
      function (card) {
        var nodeId = card.getAttribute("data-node");
        if (!nodeId || !this.model.hasNode(nodeId)) return;

        var width = card.offsetWidth / scale;
        var height = card.offsetHeight / scale;

        if (width > 0 && height > 0) {
          this.model.updateNode(nodeId, {
            width: Math.round(width),
            height: Math.round(height),
          });
        }
      }.bind(this)
    );
  };

  function elementCenterInCard(card, el, scale) {
    if (!el) return null;
    var c = card.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    if (!c.width || !r.width) return null;

    var scrollContainer = el.closest(".card__content");
    var scrollLeft =
      scrollContainer && card.contains(scrollContainer) ? scrollContainer.scrollLeft : 0;
    var scrollTop =
      scrollContainer && card.contains(scrollContainer) ? scrollContainer.scrollTop : 0;

    return {
      x: (r.left + r.width / 2 - c.left + scrollLeft) / scale,
      y: (r.top + r.height / 2 - c.top + scrollTop) / scale,
    };
  }

  function resolvePortAnchors(edge, srcCard, tgtCard) {
    var srcDot = srcCard.querySelector('.dot[data-dot="' + edge.target + '"]');
    var tgtDot = tgtCard.querySelector('.dot[data-dot="' + edge.source + '"]');
    var srcEl = srcDot;
    var tgtEl = tgtDot;

    if (!srcDot || !srcDot.getBoundingClientRect().width) {
      srcEl = srcCard.querySelector('[data-map-target="' + edge.target + '"]');
    }

    if (!tgtDot || !tgtDot.getBoundingClientRect().width) {
      tgtEl = tgtCard.querySelector('[data-map-target="' + edge.source + '"]');
    }

    return { srcEl: srcEl, tgtEl: tgtEl };
  }

  /**
   * Measures the concrete dot markers so edges anchor dot-to-dot:
   *   edge A -> B  starts at  #map-card-A .dot[data-dot="B"]
   *               ends   at  #map-card-B .dot[data-dot="A"]  (the back link)
   * Produces FIXED_POS port geometry (design units, relative to card top-left)
   * plus an edge -> port id map for the ELK adapter.
   */
  GraphController.prototype.measurePorts = function () {
    var scale = this.getScale();
    if (!scale || scale <= 0) scale = 1;

    var portsByNode = {};
    var edgePorts = {};

    this.model.getEdges().forEach(function (edge) {
      var srcCard = document.getElementById("map-card-" + edge.source);
      var tgtCard = document.getElementById("map-card-" + edge.target);
      if (!srcCard || !tgtCard) return;

      var anchors = resolvePortAnchors(edge, srcCard, tgtCard);
      if (!anchors.srcEl || !anchors.tgtEl) return;

      var srcPos = elementCenterInCard(srcCard, anchors.srcEl, scale);
      var tgtPos = elementCenterInCard(tgtCard, anchors.tgtEl, scale);
      if (!srcPos || !tgtPos) return;

      var srcPortId = edge.source + "__" + edge.id + "__src";
      var tgtPortId = edge.target + "__" + edge.id + "__tgt";

      (portsByNode[edge.source] = portsByNode[edge.source] || []).push({
        id: srcPortId,
        x: srcPos.x,
        y: srcPos.y,
      });
      (portsByNode[edge.target] = portsByNode[edge.target] || []).push({
        id: tgtPortId,
        x: tgtPos.x,
        y: tgtPos.y,
      });

      edgePorts[edge.id] = { source: srcPortId, target: tgtPortId };
    });

    return { portsByNode: portsByNode, edgePorts: edgePorts };
  };

  /**
   * Derives the edge-to-edge channel spacing from the real dot rhythm: the
   * median vertical gap between adjacent connection dots on the busiest node.
   * This keeps horizontal spacing between routed channels visually in step
   * with the menu's vertical spacing, without hardcoding a per-page constant.
   */
  GraphController.prototype.computeEdgeSpacing = function (portsByNode) {
    var gaps = [];

    Object.keys(portsByNode).forEach(function (nodeId) {
      var ys = portsByNode[nodeId]
        .map(function (p) {
          return p.y;
        })
        .sort(function (a, b) {
          return a - b;
        });

      for (var i = 1; i < ys.length; i++) {
        var gap = ys[i] - ys[i - 1];
        if (gap > 1) gaps.push(gap);
      }
    });

    if (!gaps.length) return null;

    gaps.sort(function (a, b) {
      return a - b;
    });
    var median = gaps[Math.floor(gaps.length / 2)];
    return Math.max(24, Math.round(median));
  };

  GraphController.prototype.reflow = function () {
    if (this._reflowPaused) {
      return Promise.resolve(this._lastLayout);
    }

    var self = this;
    var runId = ++this._runId;

    this.measureNodes();
    var portData = this.measurePorts();

    var layoutOptions = Object.assign({}, this.layoutOptions);
    var spacingMult = getMapSpacingMultiplier();
    var edgeSpacing = this.computeEdgeSpacing(portData.portsByNode);
    var channelSpacing = applyMapLayoutSpacing(layoutOptions, edgeSpacing, spacingMult);

    return global.MapGraph.LayoutElk.layout(this.model, {
      anchorId: this.anchorId,
      layoutOptions: layoutOptions,
      workerUrl: this.workerUrl,
      ports: portData.portsByNode,
      edgePorts: portData.edgePorts,
      channelSpacing: channelSpacing,
      spacingMultiplier: spacingMult,
    })
      .then(function (layoutResult) {
        if (runId !== self._runId) return null;

        self._lastLayout = layoutResult;
        self.renderer.render(layoutResult, self.cards);
        self._emitLayoutDone(layoutResult);
        return layoutResult;
      })
      .catch(function (error) {
        console.error("[MapGraph] layout failed:", error);
        throw error;
      });
  };

  GraphController.prototype.scheduleReflow = function () {
    if (this._reflowPaused) {
      return;
    }

    var self = this;
    window.clearTimeout(this._debounceTimer);
    this._debounceTimer = window.setTimeout(function () {
      self.reflow();
    }, this.debounceMs);
  };

  GraphController.prototype.bindLifecycle = function () {
    var self = this;
    var lastResizeWidth = window.innerWidth;
    var lastResizeHeight = window.innerHeight;

    window.addEventListener("resize", function () {
      var width = window.innerWidth;
      var height = window.innerHeight;
      if (width === lastResizeWidth) {
        if (height === lastResizeHeight) {
          return;
        }
        lastResizeHeight = height;
        self.scheduleReflow();
        return;
      }
      lastResizeWidth = width;
      lastResizeHeight = height;
      self.scheduleReflow();
    });

    if (document.fonts && typeof document.fonts.ready === "object") {
      document.fonts.ready.then(function () {
        self.scheduleReflow();
      });
    }

    var motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    var onMotionChange = function () {
      self.scheduleReflow();
    };

    if (typeof motionMq.addEventListener === "function") {
      motionMq.addEventListener("change", onMotionChange);
    } else if (typeof motionMq.addListener === "function") {
      motionMq.addListener(onMotionChange);
    }

    var compactMq = window.matchMedia("(max-width: 63.9375rem)");
    var onCompactChange = function () {
      self.scheduleReflow();
    };

    if (typeof compactMq.addEventListener === "function") {
      compactMq.addEventListener("change", onCompactChange);
    } else if (typeof compactMq.addListener === "function") {
      compactMq.addListener(onCompactChange);
    }

    if (typeof ResizeObserver !== "undefined") {
      var observer = new ResizeObserver(function () {
        self.scheduleReflow();
      });
      this.cards.forEach(function (card) {
        observer.observe(card);
      });
    }
  };

  function createSiteGraph() {
    var Model = global.MapGraph.Model;
    var model = new Model();

    var nodeIds = [
      "home",
      "about",
      "cases",
      "case-picksell",
      "case-sbibank",
      "case-edstore",
      "case-post-ecosystem",
      "case-mindloom",
      "contacts",
    ];
    nodeIds.forEach(function (id) {
      model.addNode({ id: id, width: 1024, height: 800 });
    });

    var hubEdges = [
      { id: "home-about", target: "about" },
      { id: "home-cases", target: "cases" },
      { id: "home-contacts", target: "contacts" },
    ];

    hubEdges.forEach(function (spec) {
      model.addEdge({
        id: spec.id,
        source: "home",
        target: spec.target,
        sourcePort: "right",
        targetPort: "left",
      });
    });

    [
      "case-picksell",
      "case-sbibank",
      "case-edstore",
      "case-post-ecosystem",
      "case-mindloom",
    ].forEach(function (target) {
      model.addEdge({
        id: "cases-" + target,
        source: "cases",
        target: target,
        sourcePort: "right",
        targetPort: "left",
      });
    });

    return model;
  }

  var MapGraph = (global.MapGraph = global.MapGraph || {});
  MapGraph.Controller = GraphController;
  MapGraph.createSiteGraph = createSiteGraph;
  MapGraph.isCompactMapView = isCompactMapView;
})(typeof window !== "undefined" ? window : global);
