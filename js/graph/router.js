(function (global) {
  "use strict";

  function distance(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function normalize(dx, dy) {
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  function lerpPoint(a, b, t) {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
  }

  function flattenSections(sections) {
    if (!sections || !sections.length) return [];

    var points = [];
    sections.forEach(function (section, index) {
      if (index === 0 && section.startPoint) {
        points.push({ x: section.startPoint.x, y: section.startPoint.y });
      }
      (section.bendPoints || []).forEach(function (p) {
        points.push({ x: p.x, y: p.y });
      });
      if (section.endPoint) {
        points.push({ x: section.endPoint.x, y: section.endPoint.y });
      }
    });

    return dedupePoints(points);
  }

  function dedupePoints(points) {
    if (!points.length) return [];
    var out = [points[0]];
    for (var i = 1; i < points.length; i++) {
      var prev = out[out.length - 1];
      var cur = points[i];
      if (Math.abs(prev.x - cur.x) > 0.01 || Math.abs(prev.y - cur.y) > 0.01) {
        out.push(cur);
      }
    }
    return out;
  }

  function buildOrthogonalPath(points, cornerRadius) {
    if (!points || points.length < 2) return "";

    cornerRadius = cornerRadius || 12;
    var d = "M " + points[0].x + " " + points[0].y;

    if (points.length === 2) {
      d += " L " + points[1].x + " " + points[1].y;
      return d;
    }

    for (var i = 1; i < points.length - 1; i++) {
      var prev = points[i - 1];
      var corner = points[i];
      var next = points[i + 1];

      var inVec = normalize(corner.x - prev.x, corner.y - prev.y);
      var outVec = normalize(next.x - corner.x, next.y - corner.y);

      var inLen = distance(prev, corner);
      var outLen = distance(corner, next);
      var r = Math.min(cornerRadius, inLen / 2, outLen / 2);

      var start = lerpPoint(corner, prev, r / inLen);
      var end = lerpPoint(corner, next, r / outLen);

      d += " L " + start.x + " " + start.y;
      d += " Q " + corner.x + " " + corner.y + " " + end.x + " " + end.y;
    }

    var last = points[points.length - 1];
    d += " L " + last.x + " " + last.y;
    return d;
  }

  function buildCurvedPath(points) {
    if (!points || points.length < 2) return "";
    if (points.length === 2) {
      return (
        "M " + points[0].x + " " + points[0].y + " L " + points[1].x + " " + points[1].y
      );
    }

    var d = "M " + points[0].x + " " + points[0].y;

    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i - 1] || points[i];
      var p1 = points[i];
      var p2 = points[i + 1];
      var p3 = points[i + 2] || p2;

      var cp1x = p1.x + (p2.x - p0.x) / 6;
      var cp1y = p1.y + (p2.y - p0.y) / 6;
      var cp2x = p2.x - (p3.x - p1.x) / 6;
      var cp2y = p2.y - (p3.y - p1.y) / 6;

      d +=
        " C " +
        cp1x +
        " " +
        cp1y +
        " " +
        cp2x +
        " " +
        cp2y +
        " " +
        p2.x +
        " " +
        p2.y;
    }

    return d;
  }

  function buildEdgePath(sections, options) {
    options = options || {};
    var points = flattenSections(sections);
    if (points.length < 2) return "";

    if (options.mode === "curved") {
      return buildCurvedPath(points);
    }

    return buildOrthogonalPath(points, options.cornerRadius);
  }

  function buildEdgePaths(edges, options) {
    return edges.map(function (edge) {
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        points: flattenSections(edge.sections),
        pathD: buildEdgePath(edge.sections, options),
      };
    });
  }

  var MapGraph = (global.MapGraph = global.MapGraph || {});
  MapGraph.Router = {
    flattenSections: flattenSections,
    buildEdgePath: buildEdgePath,
    buildEdgePaths: buildEdgePaths,
  };
})(typeof window !== "undefined" ? window : global);
