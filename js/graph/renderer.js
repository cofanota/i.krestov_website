(function (global) {
  "use strict";

  function designToScreen(point, scale, origin) {
    if (!point) return { x: 0, y: 0 };
    return {
      x: origin.x + point.x * scale,
      y: origin.y + point.y * scale,
    };
  }

  function transformSections(sections, scale, origin) {
    return (sections || []).map(function (section) {
      return {
        startPoint: designToScreen(section.startPoint, scale, origin),
        endPoint: designToScreen(section.endPoint, scale, origin),
        bendPoints: (section.bendPoints || []).map(function (p) {
          return designToScreen(p, scale, origin);
        }),
      };
    });
  }

  function getOrigin() {
    var root = getComputedStyle(document.documentElement);
    return {
      x: parseFloat(root.getPropertyValue("--map-origin-x")) || 512,
      y: parseFloat(root.getPropertyValue("--map-origin-y")) || 1000,
    };
  }

  function GraphRenderer(options) {
    this.canvas = options.canvas;
    this.getScale = options.getScale;
    this.router = global.MapGraph.Router;
    this.routerOptions = options.routerOptions || { cornerRadius: 14 };
    this._edgeElements = {};
    this._svg = null;
    this._edgeLayer = null;
    this._lastLayout = null;
  }

  GraphRenderer.prototype.ensureSvg = function () {
    if (this._svg) return this._svg;

    var svg = document.getElementById("map-edges");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("id", "map-edges");
      svg.setAttribute("class", "map-edges");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      this.canvas.insertBefore(svg, this.canvas.firstChild);
    }

    var layer = svg.querySelector(".map-edges__layer");
    if (!layer) {
      layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
      layer.setAttribute("class", "map-edges__layer");
      svg.appendChild(layer);
    }

    this._svg = svg;
    this._edgeLayer = layer;
    return svg;
  };

  GraphRenderer.prototype.getNodeCenter = function (nodeId) {
    if (!this._lastLayout || !this._lastLayout.nodes[nodeId]) {
      return null;
    }

    var scale = this.getScale();
    var origin = getOrigin();
    var node = this._lastLayout.nodes[nodeId];

    return designToScreen({ x: node.centerX, y: node.centerY }, scale, origin);
  };

  GraphRenderer.prototype.positionCard = function (card, nodeLayout, scale, origin) {
    var center = designToScreen({ x: nodeLayout.centerX, y: nodeLayout.centerY }, scale, origin);
    card.style.left = center.x + "px";
    card.style.top = center.y + "px";
  };

  GraphRenderer.prototype.clearEdges = function () {
    var self = this;
    Object.keys(this._edgeElements).forEach(function (id) {
      self._edgeElements[id].remove();
      delete self._edgeElements[id];
    });
  };

  GraphRenderer.prototype.render = function (layoutResult, cards) {
    this._lastLayout = layoutResult;
    var scale = this.getScale();
    var origin = getOrigin();
    var svg = this.ensureSvg();

    cards.forEach(
      function (card) {
        var nodeId = card.getAttribute("data-node");
        var nodeLayout = layoutResult.nodes[nodeId];
        if (!nodeLayout) return;
        this.positionCard(card, nodeLayout, scale, origin);
      }.bind(this)
    );

    this.clearEdges();
    return {
      nodes: layoutResult.nodes,
      edges: [],
    };
  };

  GraphRenderer.prototype.ensureMarkers = function (svg) {
    var defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svg.insertBefore(defs, svg.firstChild);
    }

    if (!svg.querySelector("#map-edge-arrow")) {
      var marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
      marker.setAttribute("id", "map-edge-arrow");
      marker.setAttribute("viewBox", "0 0 10 10");
      marker.setAttribute("refX", "9");
      marker.setAttribute("refY", "5");
      marker.setAttribute("markerWidth", "6");
      marker.setAttribute("markerHeight", "6");
      marker.setAttribute("orient", "auto-start-reverse");

      var head = document.createElementNS("http://www.w3.org/2000/svg", "path");
      head.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
      head.setAttribute("class", "map-edge__arrow");
      marker.appendChild(head);
      defs.appendChild(marker);
    }
  };

  var MapGraph = (global.MapGraph = global.MapGraph || {});
  MapGraph.Renderer = GraphRenderer;
})(typeof window !== "undefined" ? window : global);
