/* transform.js
   classes:
    Transform
    EditStack
   description:
    A class representing a transformation. Created with a start value; apply
    the transform with the .apply() method and reverse it with .applyInverse().
    End the transform with an .end() call.
*/

function Transform(name, start) {
  this.name = name;

  // used to make new values of the same type as the starting value
  this.valConstructor = start.constructor;

  // start and target value of transformed parameter
  this.startVal = start.clone();
  this.targetVal = new this.valConstructor();
  // latest target value (if applied forward) or start val (if applied inverse)
  this.lastVal = new this.valConstructor();

  // function used to modify the input value to onApply
  this.preprocess = null;

  // functions called on transform application and transform end
  this.onApply = null;
  this.onEnd = null;

  // true if this transform can be applied in reverse
  var invertible = true;
  Object.defineProperty(this, "invertible", {
    get: function() { return invertible; },
    set: function(inv) { if (inv !== undefined) invertible = !!inv; }
  });
}

Object.assign(Transform.prototype, {

  constructor: Transform,

  // true if start value and target value are the same
  noop: function() {
    if (this.startVal === null || this.targetVal === null) return false;
    return this.startVal.equals(this.targetVal);
  },

  getLastVal: function() {
    return this.lastVal;
  },

  apply: function(val) {
    // if target value is given, record it
    if (val !== undefined) this.targetVal.copy(val);

    if (this.preprocess && this.targetVal) {
      this.targetVal.copy(this.preprocess(this.targetVal));
    }

    this.lastVal.copy(this.targetVal)

    // apply with current end value
    return this.onApply(this.targetVal);
  },

  applyInverse: function() {
    if (this.startVal) {
      this.lastVal.copy(this.startVal);

      if (this.preprocess) {
        this.lastVal.copy(this.preprocess(this.lastVal));
      }
    }

    return this.onApply(this.lastVal);
  },

  end: function() {
    if (this.onEnd) return this.onEnd();
    else return null;
  }

});

// Constructor - initialized with a printout object.
function EditStack() {
  // stack of transformations
  this.history = [];
  this.pos = -1
}

EditStack.prototype = {
  constructor: EditStack,

  // Get the inverse transform at current positition and apply it.
  undo: function() {
    if (this.pos < 0) {
      throw "No undo history available.";
    }

    var entry = this.history[this.pos--];

    // apply inverse
    entry.transform.applyInverse();
    entry.transform.end();

    // if update function exists, call it
    if (entry.onTransform) entry.onTransform();
  },

  // Get the transform at the next position and apply it.
  redo: function() {
    if (this.pos >= this.history.length-1) {
      throw "No redo history available.";
    }

    var entry = this.history[++this.pos];

    // apply the transform and update function if given
    entry.transform.apply();
    entry.transform.end();

    // if update function exists, call it
    if (entry.onTransform) entry.onTransform();
  },

  // Put a new transform onto the stack.
  push: function(transform, onTransform) {
    if (this.pos < this.history.length - 1) {
      // effectively deletes all entries after this.pos
      this.history.length = this.pos + 1;
    }
    if (transform) this.history.push({
      transform: transform,
      onTransform: onTransform || null
    });
    this.pos++;
  },

  // Clear the stack.
  clear: function() {
    this.history.length = 0;
    this.pos = -1;
  }
}
