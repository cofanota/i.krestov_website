(function (global) {
  "use strict";

  var DEFAULT_LAYOUT_OPTIONS = {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.portConstraints": "FIXED_SIDE",
    "elk.spacing.nodeNode": "96",
    "elk.spacing.edgeNode": "48",
    "elk.spacing.edgeEdge": "56",
    "elk.layered.spacing.nodeNodeBetweenLayers": "240",
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  };

  var elkInstance = null;

  function siteUrl(path) {
    var base = (global.SITE_BASE_PATH || "/").replace(/\/$/, "");
    return path.charAt(0) === "/" ? base + path : path;
  }

  function getElk(workerUrl) {
    if (elkInstance) return elkInstance;
    if (typeof global.ELK !== "function") {
      throw new Error("ELK is not loaded. Include /assets/vendor/elk.bundled.js before graph modules.");
    }
    elkInstance = new global.ELK({
      workerUrl: siteUrl(workerUrl || "/assets/vendor/elk-worker.min.js"),
      defaultLayoutOptions: DEFAULT_LAYOUT_OPTIONS,
    });
    return elkInstance;
  }

  function portId(nodeId, side) {
    return nodeId + ":" + side;
  }

  function collectUsedPorts(nodes, edges) {
    var used = {};

    function mark(nodeId, side) {
      if (!side) return;
      if (!used[nodeId]) used[nodeId] = {};
      used[nodeId][side] = true;
    }

    edges.forEach(function (edge) {
      mark(edge.source, edge.sourcePort);
      mark(edge.target, edge.targetPort);
    });

    nodes.forEach(function (node) {
      if (!used[node.id]) {
        used[node.id] = { right: true, left: true, top: true, bottom: true };
      }
    });

    return used;
  }

  function buildElkPorts(node, usedSides) {
    var sides = global.MapGraph.PORT_SIDES;
    var elkSide = global.MapGraph.ELK_SIDE;
    var ports = [];

    sides.forEach(function (side) {
      if (!usedSides[side]) return;
      ports.push({
        id: portId(node.id, side),
        width: 1,
        height: 1,
        layoutOptions: {
          "port.side": elkSide[side],
        },
      });
    });

    if (!ports.length) {
      ports.push({
        id: portId(node.id, "right"),
        width: 1,
        height: 1,
        layoutOptions: {
          "port.side": "EAST",
        },
      });
    }

    return ports;
  }

  function buildExplicitPorts(portList) {
    return portList.map(function (p) {
      return {
        id: p.id,
        width: 1,
        height: 1,
        x: p.x,
        y: p.y,
      };
    });
  }

  function buildElkEdges(edges, edgePorts) {
    edgePorts = edgePorts || {};
    return edges.map(function (edge) {
      var explicit = edgePorts[edge.id];
      if (explicit) {
        return {
          id: edge.id,
          sources: [explicit.source],
          targets: [explicit.target],
        };
      }

      return {
        id: edge.id,
        sources: [
          edge.sourcePort
            ? portId(edge.source, edge.sourcePort)
            : portId(edge.source, "right"),
        ],
        targets: [
          edge.targetPort
            ? portId(edge.target, edge.targetPort)
            : portId(edge.target, "left"),
        ],
      };
    });
  }

  /**
   * Groups nodes by `group` into ELK compound hierarchy.
   * Ungrouped nodes sit at the root; each distinct group becomes a parent node.
   */
  function makeElkNode(node, usedPorts, ports) {
    var explicit = ports && ports[node.id];
    var elkNode = {
      id: node.id,
      width: node.width,
      height: node.height,
    };

    if (explicit && explicit.length) {
      elkNode.ports = buildExplicitPorts(explicit);
      elkNode.layoutOptions = { "elk.portConstraints": "FIXED_POS" };
    } else {
      elkNode.ports = buildElkPorts(node, usedPorts[node.id] || {});
      if (node.type) {
        elkNode.layoutOptions = {
          "elk.nodeLabels.placement": "INSIDE V_CENTER H_LEFT",
        };
      }
    }

    return elkNode;
  }

  function buildElkChildren(nodes, edges, usedPorts, ports, spacingMultiplier) {
    spacingMultiplier = spacingMultiplier || 1;
    var groupPad = Math.round(48 * spacingMultiplier);
    var groupPadding =
      "[top=" +
      groupPad +
      ",left=" +
      groupPad +
      ",bottom=" +
      groupPad +
      ",right=" +
      groupPad +
      "]";
    var groups = {};
    var rootNodes = [];

    nodes.forEach(function (node) {
      if (node.group) {
        if (!groups[node.group]) {
          groups[node.group] = [];
        }
        groups[node.group].push(node);
      } else {
        rootNodes.push(node);
      }
    });

    var elkNodes = rootNodes.map(function (node) {
      return makeElkNode(node, usedPorts, ports);
    });

    Object.keys(groups).forEach(function (groupId) {
      var members = groups[groupId];
      elkNodes.push({
        id: "group:" + groupId,
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.padding": groupPadding,
        },
        children: members.map(function (node) {
          return makeElkNode(node, usedPorts, ports);
        }),
      });
    });

    return elkNodes;
  }

  /**
   * Extensibility hooks (no renderer/model changes required):
   * - `node.group` -> ELK compound parent via buildElkChildren()
   * - Multiple roots -> layered layout handles multiple sources natively
   * - Extra constraints -> pass layoutOptions into Controller / layout()
   * - Engine swap -> replace LayoutElk adapter; keep LayoutResult shape stable
   */
  function buildElkGraph(model, layoutOptions, ports, edgePorts, includeEdges, spacingMultiplier) {
    var nodes = model.getNodes();
    var edges = includeEdges === false ? [] : model.getEdges();
    var usedPorts = collectUsedPorts(nodes, edges);

    return {
      id: "root",
      layoutOptions: Object.assign({}, DEFAULT_LAYOUT_OPTIONS, layoutOptions || {}),
      children: buildElkChildren(nodes, edges, usedPorts, ports, spacingMultiplier),
      edges: buildElkEdges(edges, edgePorts),
    };
  }

  function flattenElkNodes(elkGraph, out, offsetX, offsetY) {
    offsetX = offsetX || 0;
    offsetY = offsetY || 0;

    (elkGraph.children || []).forEach(function (child) {
      if (child.id && child.id.indexOf("group:") === 0) {
        flattenElkNodes(child, out, offsetX + (child.x || 0), offsetY + (child.y || 0));
        return;
      }

      if (child.width == null) return;

      var absX = offsetX + child.x;
      var absY = offsetY + child.y;

      out[child.id] = {
        x: absX,
        y: absY,
        width: child.width,
        height: child.height,
        ports: {},
      };

      (child.ports || []).forEach(function (port) {
        var nodeId = child.id;
        var side = port.id;
        if (!out[nodeId]) return;
        out[nodeId].ports[side] = {
          x: absX + port.x,
          y: absY + port.y,
        };
      });
    });
  }

  function normalizeToAnchor(nodes, anchorId) {
    var anchor = nodes[anchorId];
    if (!anchor) return nodes;

    var ax = anchor.x + anchor.width / 2;
    var ay = anchor.y + anchor.height / 2;
    var normalized = {};

    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      var cx = n.x + n.width / 2 - ax;
      var cy = n.y + n.height / 2 - ay;
      var ports = {};
      Object.keys(n.ports || {}).forEach(function (side) {
        var p = n.ports[side];
        ports[side] = { x: p.x - ax, y: p.y - ay };
      });
      normalized[id] = {
        x: n.x - ax,
        y: n.y - ay,
        width: n.width,
        height: n.height,
        centerX: cx,
        centerY: cy,
        ports: ports,
      };
    });

    return normalized;
  }

  function computeBounds(nodes) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id];
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });

    if (!isFinite(minX)) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  function normalizeSections(sections, offsetX, offsetY) {
    return (sections || []).map(function (section) {
      return {
        startPoint: section.startPoint
          ? { x: section.startPoint.x - offsetX, y: section.startPoint.y - offsetY }
          : undefined,
        endPoint: section.endPoint
          ? { x: section.endPoint.x - offsetX, y: section.endPoint.y - offsetY }
          : undefined,
        bendPoints: (section.bendPoints || []).map(function (p) {
          return { x: p.x - offsetX, y: p.y - offsetY };
        }),
      };
    });
  }

  var CHANNEL_TOLERANCE = 2;

  /**
   * ELK routes edges crossing-free, but it minimises bends by packing the
   * vertical channels tightly against the source layer (and shares one channel
   * between edges whose vertical spans do not overlap). That yields correct but
   * visually cramped connectors.
   *
   * This re-spaces the DISTINCT vertical channels ELK produced: it maps each
   * distinct channel-x (in left-to-right order) onto an evenly spaced, centred
   * position within the gap between the source and target layers. Because the
   * channel ORDER and the per-edge channel ASSIGNMENT are both preserved (edges
   * that shared a channel still share it; no channel crosses another), ELK's
   * crossing-free / overlap-free guarantees are preserved - only the spacing
   * between lanes changes. Validated to keep 0 crossings across randomised fans.
   *
   * Engine- and layout-agnostic: no per-page coordinates or edge names.
   * Runs per source fan so nested edges (e.g. cases → case-test) do not
   * dilute channel spacing for the home hub.
   */
  function respreadChannelGroup(edges, nodes, spacing) {
    var breakXs = [];
    edges.forEach(function (edge) {
      edge.sections.forEach(function (section) {
        (section.bendPoints || []).forEach(function (b) {
          breakXs.push(b.x);
        });
      });
    });
    if (!breakXs.length) return;

    var srcRight = -Infinity;
    var tgtLeft = Infinity;
    edges.forEach(function (edge) {
      var sn = nodes[edge.source];
      var tn = nodes[edge.target];
      if (sn) srcRight = Math.max(srcRight, sn.x + sn.width);
      if (tn) tgtLeft = Math.min(tgtLeft, tn.x);
    });
    if (!isFinite(srcRight) || !isFinite(tgtLeft) || tgtLeft <= srcRight) {
      return;
    }

    var sorted = breakXs.slice().sort(function (a, b) {
      return a - b;
    });
    var distinct = [];
    sorted.forEach(function (x) {
      if (
        !distinct.length ||
        Math.abs(x - distinct[distinct.length - 1]) > CHANNEL_TOLERANCE
      ) {
        distinct.push(x);
      }
    });

    var count = distinct.length;
    var gapCenter = (srcRight + tgtLeft) / 2;
    var gapWidth = tgtLeft - srcRight;
    var desired = spacing && spacing > 0 ? spacing : 96;
    var step = count > 1 ? Math.min(desired, gapWidth / (count + 1)) : 0;
    var start = gapCenter - (step * (count - 1)) / 2;

    var mapped = distinct.map(function (_, i) {
      return start + step * i;
    });

    function remap(x) {
      var bestIdx = 0;
      var bestDist = Infinity;
      for (var i = 0; i < distinct.length; i++) {
        var d = Math.abs(distinct[i] - x);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      return mapped[bestIdx];
    }

    edges.forEach(function (edge) {
      edge.sections.forEach(function (section) {
        (section.bendPoints || []).forEach(function (b) {
          b.x = remap(b.x);
        });
      });
    });
  }

  function respreadChannels(edges, nodes, spacing) {
    var bySource = {};

    edges.forEach(function (edge) {
      if (!bySource[edge.source]) {
        bySource[edge.source] = [];
      }
      bySource[edge.source].push(edge);
    });

    Object.keys(bySource).forEach(function (sourceId) {
      respreadChannelGroup(bySource[sourceId], nodes, spacing);
    });
  }

  function parseElkResult(elkGraph, model, anchorId, channelSpacing) {
    var rawNodes = {};
    flattenElkNodes(elkGraph, rawNodes);
    anchorId = anchorId || "home";
    var anchor = rawNodes[anchorId];
    var offsetX = anchor ? anchor.x + anchor.width / 2 : 0;
    var offsetY = anchor ? anchor.y + anchor.height / 2 : 0;
    var nodes = normalizeToAnchor(rawNodes, anchorId);

    var edgeMap = {};
    (elkGraph.edges || []).forEach(function (edge) {
      edgeMap[edge.id] = edge;
    });

    var edges = model.getEdges().map(function (edge) {
      var elkEdge = edgeMap[edge.id] || {};
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sections: normalizeSections(elkEdge.sections, offsetX, offsetY),
      };
    });

    respreadChannels(edges, nodes, channelSpacing);

    return {
      nodes: nodes,
      edges: edges,
      bounds: computeBounds(nodes),
      anchorId: anchorId,
    };
  }

  function layout(model, options) {
    options = options || {};
    var elk = getElk(options.workerUrl);
    var graph = buildElkGraph(
      model,
      options.layoutOptions,
      options.ports,
      options.edgePorts,
      options.includeEdges,
      options.spacingMultiplier
    );

    return elk.layout(graph).then(function (result) {
      return parseElkResult(
        result,
        model,
        options.anchorId,
        options.channelSpacing
      );
    });
  }

  var MapGraph = (global.MapGraph = global.MapGraph || {});
  MapGraph.LayoutElk = {
    DEFAULT_LAYOUT_OPTIONS: DEFAULT_LAYOUT_OPTIONS,
    buildElkGraph: buildElkGraph,
    layout: layout,
    parseElkResult: parseElkResult,
  };
})(typeof window !== "undefined" ? window : global);
