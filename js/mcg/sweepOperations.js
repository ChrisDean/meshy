Object.assign(MCG.Sweep, (function() {

  // adds a new segment set to the result object with the given name
  function resultAddSet(result, context, name) {
    result[name] = new MCG.SegmentSet(context);

    return result;
  }

  // assign values to store, from sweep params if provided
  function assignParams(store, params) {
    params = params || {};

    store.minDepthA = params.hasOwnProperty("minDepthA") ? params.minDepthA : 1;
    store.minDepthB = params.hasOwnProperty("minDepthB") ? params.minDepthB : 1;
  }

  // makes an object containing the init function and event handler
  function makeOperation(initStore, handleEvent) {
    var op = function(params) {
      return {
        initStore: function(context, srcA, srcB) {
          return initStore(context, srcA, srcB, params);
        },
        handleEvent: handleEvent
      };
    };

    return op;
  }



  // operation store initialization functions

  function unionInit(context, srcA, srcB, params) {
    var store = { result: resultAddSet({}, context, "union") };

    assignParams(store, params);

    return store;
  }

  function intersectionInit(context, srcA, srcB, params) {
    var store = { result: resultAddSet({}, context, "intersection") };

    assignParams(store, params);

    return store;
  }

  function intersectionOpenInit(context, srcA, srcB, params) {
    var store = { result: resultAddSet({}, context, "intersectionOpen") };

    assignParams(store, params);

    return store;
  }

  function differenceInit(context, srcA, srcB, params) {
    var store = { result: resultAddSet({}, context, "difference") };

    assignParams(store, params);

    return store;
  }

  function fullDifferenceInit(context, srcA, srcB, params) {
    var result = {};

    resultAddSet(result, context, "AminusB");
    resultAddSet(result, context, "BminusA");
    resultAddSet(result, context, "intersection");

    var store =  { result: result };

    assignParams(store, params);

    return store;
  }

  function linearInfillInit(context, srcA, srcB, params) {
    // calculate the leftmost line that crosses the contour s.t. all lines are
    // vertical, all lines have the given spacing, and one line passes through 0
    var spacing = params.spacing;
    var hline = Math.ceil(srcA.min.h / spacing) * spacing;

    var store = {
      spacing: spacing,
      hline: hline,
      result: resultAddSet({}, context, "infill")
    };

    assignParams(store, params);

    return store;
  }



  // event handler functions

  function unionHandle(event, status, store) {
    var flags = MCG.Sweep.EventPositionFlags;
    var pos = event.getPosition(store.minDepthA, store.minDepthB);
    var result = store.result;

    var inside = pos & flags.insideA || pos & flags.insideB;
    var boundaryA = pos & flags.boundaryA, boundaryB = pos & flags.boundaryB;
    var fromAtoB = pos & flags.fromAtoB;

    if (!inside && (boundaryA || boundaryB) && !fromAtoB) {
      event.addSegmentToSet(result.union);
    }
  }

  function intersectionHandle(event, status, store) {
    var flags = MCG.Sweep.EventPositionFlags;
    var pos = event.getPosition(store.minDepthA, store.minDepthB);
    var result = store.result;

    var inside = pos & flags.insideA || pos & flags.insideB;
    var boundaryA = pos & flags.boundaryA, boundaryB = pos & flags.boundaryB;
    var boundaryAB = boundaryA && boundaryB;
    var fromAtoB = pos & flags.fromAtoB;

    if (boundaryAB && !fromAtoB) {
      event.addSegmentToSet(result.intersection);
    }
    else if (inside && (boundaryA || boundaryB)) {
      event.addSegmentToSet(result.intersection);
    }
  }

  function intersectionOpenHandle(event, status, store) {
    var flags = MCG.Sweep.EventPositionFlags;
    var pos = event.getPosition(store.minDepthA, store.minDepthB);
    var result = store.result;

    var insideA = pos & flags.insideA;
    var isB = event.weightB !== 0;

    if (insideA && isB) {
      event.addSegmentToSet(result.intersectionOpen);
    }
  }

  function differenceHandle(event, status, store) {
    var flags = MCG.Sweep.EventPositionFlags;
    var pos = event.getPosition(store.minDepthA, store.minDepthB);
    var result = store.result;

    var inside = pos & flags.insideA || pos & flags.insideB;
    var boundaryA = pos & flags.boundaryA, boundaryB = pos & flags.boundaryB;
    var boundaryAB = boundaryA && boundaryB;
    var fromAtoB = pos & flags.fromAtoB;

    if (boundaryAB) {
      if (fromAtoB) {
        event.addSegmentToSet(result.difference, false, event.weightA);
      }
    }
    else if (!inside && boundaryA) {
      event.addSegmentToSet(result.difference);
    }
    else if (inside && boundaryB) {
      event.addSegmentToSet(result.difference, true);
    }
  }

  function fullDifferenceHandle(event, status, store, params) {
    var flags = MCG.Sweep.EventPositionFlags;
    var pos = event.getPosition(store.minDepthA, store.minDepthB);
    var result = store.result;

    var inside = pos & flags.insideA || pos & flags.insideB;
    var boundaryA = pos & flags.boundaryA, boundaryB = pos & flags.boundaryB;
    var boundaryAB = boundaryA && boundaryB;
    var fromAtoB = pos & flags.fromAtoB;

    if (boundaryAB) {
      if (fromAtoB) {
        event.addSegmentToSet(result.AminusB, false, event.weightA);
        event.addSegmentToSet(result.BminusA, false, event.weightB);
      }
      else {
        event.addSegmentToSet(result.intersection);
      }
    }
    else {
      if (!inside && boundaryA) {
        event.addSegmentToSet(result.AminusB);
      }
      if (inside && boundaryB) {
        event.addSegmentToSet(result.AminusB, true);
        event.addSegmentToSet(result.intersection);
      }
      if (!inside && boundaryB) {
        event.addSegmentToSet(result.BminusA);
      }
      if (inside && boundaryA) {
        event.addSegmentToSet(result.BminusA, true);
        event.addSegmentToSet(result.intersection);
      }
    }
  }

  function linearInfillHandle(event, status, store) {
    var result = store.result;
    var spacing = store.spacing;
    var hline = store.hline;
    var h = event.p.h, ht = event.twin.p.h;

    // if segment is vertical, return
    if (h === ht) return;
    // if line position is already past the segment, return
    if (hline >= ht) return;

    // move the line position up, drawing lines as we go, until it clears the
    // segment completely
    while (hline <= ht) {
      // go through events in status, find pairs that enclose the interior of the
      // contour, draw a segment between them
      var iter = status.iterator();
      var prev = null, curr;

      while ((curr = iter.next()) !== null) {
        if (!curr.hcontains(hline)) continue;

        if (prev !== null) {
          if (curr.depthBelowA > 0 && (prev.depthBelowA + prev.weightA) > 0) {
            var p1 = prev.interpolate(hline);
            var p2 = curr.interpolate(hline);

            result.infill.addPointPair(p1, p2);
          }
        }

        prev = curr;
      }

      hline += spacing;
    }

    store.hline = hline;
  }



  var Operations = {
    union: makeOperation(unionInit, unionHandle),
    intersection: makeOperation(intersectionInit, intersectionHandle),
    intersectionOpen: makeOperation(intersectionOpenInit, intersectionOpenHandle),
    difference: makeOperation(differenceInit, differenceHandle),
    fullDifference: makeOperation(fullDifferenceInit, fullDifferenceHandle),
    linearInfill: makeOperation(linearInfillInit, linearInfillHandle)
  };



  return {
    Operations: Operations
  };

})());
