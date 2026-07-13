(function (global) {
  "use strict";

  var PORT_SIDES = ["top", "right", "bottom", "left"];

  var ELK_SIDE = {
    top: "NORTH",
    right: "EAST",
    bottom: "SOUTH",
    left: "WEST",
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createListenerSet() {
    var listeners = [];

    return {
      add: function (fn) {
        if (typeof fn === "function") {
          listeners.push(fn);
        }
      },
      remove: function (fn) {
        listeners = listeners.filter(function (l) {
          return l !== fn;
        });
      },
      emit: function (payload) {
        listeners.slice().forEach(function (fn) {
          fn(payload);
        });
      },
    };
  }

  function GraphModel(initial) {
    initial = initial || {};
    this._nodes = {};
    this._edges = {};
    this._listeners = createListenerSet();

    var nodes = initial.nodes || [];
    var edges = initial.edges || [];

    nodes.forEach(this.addNode.bind(this));
    edges.forEach(this.addEdge.bind(this));
  }

  GraphModel.PORT_SIDES = PORT_SIDES;
  GraphModel.ELK_SIDE = ELK_SIDE;

  GraphModel.prototype.onChange = function (fn) {
    this._listeners.add(fn);
    return function () {
      this._listeners.remove(fn);
    }.bind(this);
  };

  GraphModel.prototype._notify = function (type, detail) {
    this._listeners.emit({
      type: type,
      detail: detail || {},
      model: this,
    });
  };

  GraphModel.prototype.hasNode = function (id) {
    return Boolean(this._nodes[id]);
  };

  GraphModel.prototype.getNode = function (id) {
    var node = this._nodes[id];
    return node ? clone(node) : null;
  };

  GraphModel.prototype.getNodes = function () {
    return Object.keys(this._nodes).map(
      function (id) {
        return clone(this._nodes[id]);
      }.bind(this)
    );
  };

  GraphModel.prototype.getEdge = function (id) {
    var edge = this._edges[id];
    return edge ? clone(edge) : null;
  };

  GraphModel.prototype.getEdges = function () {
    return Object.keys(this._edges).map(
      function (id) {
        return clone(this._edges[id]);
      }.bind(this)
    );
  };

  GraphModel.prototype.portId = function (nodeId, side) {
    return nodeId + ":" + side;
  };

  GraphModel.prototype.addNode = function (node) {
    if (!node || !node.id) {
      throw new Error("GraphModel.addNode requires an id");
    }

    if (this._nodes[node.id]) {
      throw new Error("GraphModel node already exists: " + node.id);
    }

    this._nodes[node.id] = {
      id: node.id,
      width: node.width || 0,
      height: node.height || 0,
      type: node.type || null,
      group: node.group || null,
    };

    this._notify("node:add", { id: node.id });
    return clone(this._nodes[node.id]);
  };

  GraphModel.prototype.updateNode = function (id, patch) {
    var node = this._nodes[id];
    if (!node) {
      throw new Error("GraphModel unknown node: " + id);
    }

    if (patch.width != null) node.width = patch.width;
    if (patch.height != null) node.height = patch.height;
    if (patch.type !== undefined) node.type = patch.type;
    if (patch.group !== undefined) node.group = patch.group;

    this._notify("node:update", { id: id });
    return clone(node);
  };

  GraphModel.prototype.removeNode = function (id) {
    if (!this._nodes[id]) return false;

    delete this._nodes[id];

    Object.keys(this._edges).forEach(
      function (edgeId) {
        var edge = this._edges[edgeId];
        if (edge.source === id || edge.target === id) {
          delete this._edges[edgeId];
          this._notify("edge:remove", { id: edgeId });
        }
      }.bind(this)
    );

    this._notify("node:remove", { id: id });
    return true;
  };

  GraphModel.prototype.addEdge = function (edge) {
    if (!edge || !edge.id || !edge.source || !edge.target) {
      throw new Error("GraphModel.addEdge requires id, source, and target");
    }

    if (!this._nodes[edge.source] || !this._nodes[edge.target]) {
      throw new Error("GraphModel.addEdge references unknown node");
    }

    if (this._edges[edge.id]) {
      throw new Error("GraphModel edge already exists: " + edge.id);
    }

    this._edges[edge.id] = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourcePort: edge.sourcePort || null,
      targetPort: edge.targetPort || null,
    };

    this._notify("edge:add", { id: edge.id });
    return clone(this._edges[edge.id]);
  };

  GraphModel.prototype.removeEdge = function (id) {
    if (!this._edges[id]) return false;
    delete this._edges[id];
    this._notify("edge:remove", { id: id });
    return true;
  };

  GraphModel.prototype.toJSON = function () {
    return {
      nodes: this.getNodes(),
      edges: this.getEdges(),
    };
  };

  var MapGraph = (global.MapGraph = global.MapGraph || {});
  MapGraph.Model = GraphModel;
  MapGraph.PORT_SIDES = PORT_SIDES;
  MapGraph.ELK_SIDE = ELK_SIDE;
})(typeof window !== "undefined" ? window : global);
