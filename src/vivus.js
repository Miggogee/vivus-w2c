  /* jshint strict: false */
  /* global: Pathformer */

  /**!
   * Vivus
   * Beta version
   *
   * Take any SVG and make the animation
   * to give give the impression of live drawing
   *
   * This in more than just inspired from codrops
   * At that point, it's a pure fork.
   */

  /**
   * Class constructor
   * option structure
   *   type: 'delayed'|'async'|'oneByOne'|'script' (to know if the item must be drawn asynchronously or not, default: delayed)
   *   duration: <int> (in frames)
   *   start: 'inViewport'|'manual'|'autostart' (start automatically the animation, default: inViewport)
   *   delay: <int> (delay between the drawing of first and last path)
   *
   * The attribute 'type' is by default on 'delayed'.
   *  - 'delayed'
   *    all paths are draw at the same time but with a
   *    little delay between them before start
   *  - 'async'
   *    all path are start and finish at the same time
   *  - 'oneByOne'
   *    only one path is draw at the time
   *    the end of the first one will trigger the draw
   *    of the next one
   *
   * All these values can be overritten individualy
   * for each path item in the SVG
   * The value of frames will always take the advantage of
   * the duration value.
   * If you fail somewhere, an error will be thrown.
   * Good luck.
   *
   * @constructor
   * @this {Vivus}
   * @param {DOM|String}   element  Dom element of the SVG or id of it
   * @param {Object}       options  Options about the animation
   * @param {Function}     callback Callback for the end of the animation
   */
  function Vivus (element, options, callback) {

    // Setup
    this.setElement(element);
    this.setOptions(options);
    this.setCallback(callback);

    // Set object variables
    this.frameLength = 0;
    this.currentFrame = 0;
    this.map = [];

    // Start
    new Pathformer(element);
    this.mapping();
    this.starter();
  }


  /**
   * Setters
   **************************************
   */

  /**
   * Check and set the element in the instance
   * The method will not return enything, but will throw an
   * error if the parameter is invalid
   *
   * @param {DOM|String}   element  SVG Dom element or id of it
   */
  Vivus.prototype.setElement = function (element) {
    // Basic check
    if (typeof element === 'undefined') {
      throw new Error('Vivus [contructor]: "element" parameter is required');
    }

    // Set the element
    if (element.constructor === String) {
      element = document.getElementById(element);
      if (!element) {
        throw new Error('Vivus [contructor]: "element" parameter is not related to an existing ID');
      }
    }
    if (element.constructor === SVGSVGElement) {
      this.el = element;
    } else {
      throw new Error('Vivus [contructor]: "element" parameter must be a string or a SVGelement');
    }
  };

  /**
   * Set up user option to the instance
   * The method will not return enything, but will throw an
   * error if the parameter is invalid
   *
   * @param  {object} options Object from the constructor
   */
  Vivus.prototype.setOptions = function (options) {
    var allowedTypes = ['delayed', 'async', 'oneByOne', 'scenario', 'scenario-sync'];
    var allowedStarts =  ['inViewport', 'manual', 'autostart'];

    // Basic check
    if (options !== undefined && options.constructor !== Object) {
      throw new Error('Vivus [contructor]: "options" parameter must be an object');
    }
    else {
      options = options || {};
    }

    // Set the animation type
    if (options.type && allowedTypes.indexOf(options.type) === -1) {
      throw new Error('Vivus [contructor]: ' + options.type + ' is not an existing animation `type`');
    }
    else {
      this.type = options.type || allowedTypes[0];
    }

    // Set the start type
    if (options.start && allowedStarts.indexOf(options.start) === -1) {
      throw new Error('Vivus [contructor]: ' + options.start + ' is not an existing `start` option');
    }
    else {
      this.start = options.start || allowedStarts[0];
    }

    this.duration = parsePositiveInt(options.duration, 120);
    this.delay = parsePositiveInt(options.delay, null);
    this.selfDestroy = !!options.selfDestroy;

    if (this.delay >= this.duration) {
      throw new Error('Vivus [contructor]: delai must be shorter than duration');
    }
  };

  /**
   * Set up callback to the instance
   * The method will not return enything, but will throw an
   * error if the parameter is invalid
   *
   * @param  {Function} callback Callback for the animation end
   */
  Vivus.prototype.setCallback = function (callback) {
    // Basic check
    if (!!callback && callback.constructor !== Function) {
      throw new Error('Vivus [contructor]: "callback" parameter must be a function');
    }
    this.callback = callback || function () {};
  };


  /**
   * Core
   **************************************
   */

  /**
   * Map the svg, path by path.
   * The method return nothing, it just fill the
   * `map` array. Each item in this array represent
   * a path element from the SVG, with informations for
   * the animation.
   *
   * ```
   * [
   *   {
   *     el: <DOMobj> the path element
   *     length: <number> length of the path line
   *     startAt: <number> time start of the path animation (in frames)
   *     duration: <number> path animation duration (in frames)
   *   },
   *   ...
   * ]
   * ```
   *
   */
  Vivus.prototype.mapping = function () {
    var i, paths, path, pAttrs, pathObj, totalLength, lengthMeter, timePoint;
    timePoint = totalLength = lengthMeter = 0;
    paths = this.el.querySelectorAll('path');

    for (i = 0; i < paths.length; i++) {
      path = paths[i];
      pathObj = {
        el: path,
        length: Math.ceil(path.getTotalLength())
      };
      // Test if the path length is correct
      if (isNaN(pathObj.length)) {
        if (console && console.warn) {
          console.warn('Vivus [mapping]: cannot retrieve a path element length', path);
        }
        continue;
      }
      totalLength += pathObj.length;
      this.map.push(pathObj);
      path.style.strokeDasharray = pathObj.length + ' ' + (pathObj.length + 10);
      path.style.strokeDashoffset = pathObj.length;
    }

    totalLength = totalLength === 0 ? 1 : totalLength;
    this.delay = this.delay === null ? this.duration / 3 : this.delay;
    this.delayUnit = this.delay / (paths.length > 1 ? paths.length - 1 : 1);

    for (i = 0; i < this.map.length; i++) {
      pathObj = this.map[i];

      switch (this.type) {
      case 'delayed':
        pathObj.startAt = this.delayUnit * i;
        pathObj.duration = this.duration - this.delay;
        break;

      case 'oneByOne':
        pathObj.startAt = lengthMeter / totalLength * this.duration;
        pathObj.duration = pathObj.length / totalLength * this.duration;
        break;

      case 'async':
        pathObj.startAt = 0;
        pathObj.duration = this.duration;
        break;

      case 'scenario-sync':
        path = paths[i];
        pAttrs = this.parseAttr(path);
        pathObj.startAt = timePoint + (parsePositiveInt(pAttrs['data-delay'], this.delayUnit) || 0);
        pathObj.duration = parsePositiveInt(pAttrs['data-duration'], this.duration);
        timePoint = pAttrs['data-async'] !== undefined ? pathObj.startAt : pathObj.startAt + pathObj.duration;
        this.frameLength = Math.max(this.frameLength, (pathObj.startAt + pathObj.duration));
        break;

      case 'scenario':
        path = paths[i];
        pAttrs = this.parseAttr(path);
        pathObj.startAt = parsePositiveInt(pAttrs['data-start'], this.delayUnit) || 0;
        pathObj.duration = parsePositiveInt(pAttrs['data-duration'], this.duration);
        this.frameLength = Math.max(this.frameLength, (pathObj.startAt + pathObj.duration));
        break;
      }
      lengthMeter += pathObj.length;
      this.frameLength = this.frameLength || this.duration;
    }
  };

  /**
   * Interval method to draw the SVG from current
   * position of the animation. It update the value of
   * `currentFrame` and re-trace the SVG.
   *
   * It use this.handle to store the requestAnimationFrame
   * and clear it one the animation is stopped. So this
   * attribute can be used to know if the animation is
   * playing.
   *
   * Once the animation at the end, this method will
   * trigger the Vivus callback.
   *
   */
  Vivus.prototype.drawer = function () {
    var self = this;
    this.currentFrame += this.speed;

    if (this.currentFrame <= 0) {
      this.stop();
      this.reset();
    } else if (this.currentFrame >= this.frameLength) {
      this.stop();
      this.currentFrame = this.frameLength;
      this.trace();
      if (this.selfDestroy) {
        this.destroy();
      }
      this.callback(this);
    } else {
      this.trace();
      this.handle = requestAnimFrame(function () {
        self.drawer();
      });
    }
  };

  /**
   * Draw the SVG at the current instant from the
   * `currentFrame` value. Here is where most of the magic is.
   * The trick is to use the `strokeDashoffset` style property.
   *
   * For optimisation reasons, a new property called `progress`
   * is added in each item of `map`. This one contain the current
   * progress of the path element. Only if the new value is different
   * the new value will be applied to the DOM element. This
   * method save a lot of ressources to re-render the SVG. And could
   * be improuved if the animation couldn't be played forward.
   *
   */
  Vivus.prototype.trace = function () {
    var i, progress, path;
    for (i = 0; i < this.map.length; i++) {
      path = this.map[i];
      progress = (this.currentFrame - path.startAt) / path.duration;
      progress = Math.max(0, Math.min(1, progress));
      if (path.progress !== progress) {
        path.progress = progress;
        path.el.style.strokeDashoffset = Math.floor(path.length * (1 - progress));
      }
    }
  };

  /**
   * Trigger to start of the animation.
   * Depending on the `start` value, a different script
   * will be applied.
   *
   * If the `start` value is not valid, an error will be thrown.
   * Even if technically, this is impossible.
   *
   */
  Vivus.prototype.starter = function () {
    switch (this.start) {
    case 'manual':
      return;

    case 'autostart':
      this.play();
      break;

    case 'inViewport':
      var self = this,
      listener = function (e) {
        if (self.isInViewport(self.el, 1)) {
          self.play();
          window.removeEventListener('scroll', listener);
        }
      };
      window.addEventListener('scroll', listener);
      break;

    default:
      throw new Error('Vivus [start]: unexisting `start` option');
    }
  };


  /**
   * Controls
   **************************************
   */

  /**
   * Reset the instance to the inital state : undraw
   * Be careful, it just reset the animation, if you're
   * playing the animation, this won't stop it. But just
   * make it start from start.
   *
   */
  Vivus.prototype.reset = function () {
    this.currentFrame = 0;
    this.trace();
  };

  /**
   * Play the animation at the desired speed.
   * Speed must be a valid number (no zero).
   * By default, the speed value is 1.
   * But a negative value is accepted to go forward.
   *
   * And works with float too.
   * But don't forget we are in JavaScript, se be nice
   * with him and give him a 1/2^x value.
   *
   * @param  {number} speed Animation speed [optional]
   */
  Vivus.prototype.play = function (speed) {
    if (speed && typeof speed !== 'number') {
      throw new Error('Vivus [play]: invalid speed');
    }
    this.speed = speed || 1;
    if (!this.handle) {
      this.drawer();
    }
  };

  /**
   * Stop the current animation, if on progress.
   * Should not trigger any error.
   *
   */
  Vivus.prototype.stop = function () {
    if (this.handle) {
      cancelAnimFrame(this.handle);
      delete this.handle;
    }
  };

  /**
   * Destroy the instance.
   * Remove all bad styling attributes on all
   * path tags
   *
   */
  Vivus.prototype.destroy = function () {
    var i, path;
    for (i = 0; i < this.map.length; i++) {
      path = this.map[i];
      path.el.style.strokeDashoffset = null;
      path.el.style.strokeDasharray = null;
    }
  };


  /**
   * Utils methods
   * from Codrops
   **************************************
   */

  /**
   * Parse attributes of a DOM element to
   * get an object of {attributeName => attribueValue}
   *
   * @param  {object} element DOM element to parse
   * @return {object}         Object of attributes
   */
  Vivus.prototype.parseAttr = function (element) {
    var attr, output = {};
    if (element && element.attributes) {
      for (var i = 0; i < element.attributes.length; i++) {
        attr = element.attributes[i];
        output[attr.name] = attr.value;
      }
    }
    return output;
  };

  /**
   * Reply if an element is in the page viewport
   *
   * @param  {object} el Element to observe
   * @param  {number} h  Percentage of height
   * @return {boolean}
   */
  Vivus.prototype.isInViewport = function (el, h) {
    while (!el.offsetTop) {
      el = el.parentElement;
    }
    var elH = el.offsetHeight,
      scrolled = this.scrollY(),
      viewed = scrolled + this.getViewportH(),
      elTop = this.getOffset(el).top,
      elBottom = elTop + elH,
      // if 0, the element is considered in the viewport as soon as it enters.
      // if 1, the element is considered in the viewport only when it's fully inside
      // value in percentage (1 >= h >= 0)
      height = h || 0;

    return (elTop + elH * height) <= viewed && (elBottom) >= scrolled;
  };

  /**
   * Alias for document element
   *
   * @type {DOMelement}
   */
  Vivus.prototype.docElem = window.document.documentElement;

  /**
   * Get the viewport height in pixels
   *
   * @return {integer} Viewport height
   */
  Vivus.prototype.getViewportH = function () {
    var client = this.docElem.clientHeight,
      inner = window.innerHeight;

    if (client < inner) {
      return inner;
    }
    else {
      return client;
    }
  };

  /**
   * Get the page Y offset
   *
   * @return {integer} Page Y offset
   */
  Vivus.prototype.scrollY = function () {
    return window.pageYOffset || this.docElem.scrollTop;
  };

  /**
   * Get the offset position of an element
   * in the viewport. The returned object
   * contain `top` and `left` property.
   *
   * With help from:
   * http://stackoverflow.com/a/5598797/989439
   *
   * @param  {DOMelement} el Element to observe
   * @return {object}        Offset position
   */
  Vivus.prototype.getOffset = function (el) {
    var offsetTop = 0, offsetLeft = 0;
    do {
      if (!isNaN(el.offsetTop)) {
        offsetTop += el.offsetTop;
      }
      if (!isNaN(el.offsetLeft)) {
        offsetLeft += el.offsetLeft;
      }
    } while (!!(el = el.offsetParent));

    return {
      top : offsetTop,
      left : offsetLeft
    };
  };

  /**
   * Alias for `requestAnimationFrame` or
   * `setTimeout` function for deprecated browsers.
   *
   */
  var requestAnimFrame = function () {
    return (
      window.requestAnimationFrame       ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame    ||
      window.oRequestAnimationFrame      ||
      window.msRequestAnimationFrame     ||
      function(/* function */ callback){
        window.setTimeout(callback, 1000 / 60);
      }
    );
  }();

  /**
   * Alias for `cancelAnimationFrame` or
   * `cancelTimeout` function for deprecated browsers.
   *
   */
  var cancelAnimFrame = function () {
    return (
      window.cancelAnimationFrame       ||
      window.webkitCancelAnimationFrame ||
      window.mozCancelAnimationFrame    ||
      window.oCancelAnimationFrame      ||
      window.msCancelAnimationFrame     ||
      function(id){
        window.clearTimeout(id);
      }
    );
  }();

  /**
   * Parse string to integer.
   * If the number is not positive or null
   * the method will return the default value
   * or 0 if undefined
   *
   * @param {string} value String to parse
   * @param {*} defaultValue Value to return if the result parsed is invalid
   * @return {number}
   *
   */
  var parsePositiveInt = function (value, defaultValue) {
    var output = parseInt(value, 10);
    return (output >= 0) ? output : defaultValue;
  };