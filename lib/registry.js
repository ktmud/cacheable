// Global cache for constructor classes
var constructors = {}
var RE_JSON_TIME =  /^[0-9\-]+T[0-9\:\.]+Z$/

var Cacheable = require('./cacheable')

var _REALNAME = Cacheable._REALNAME

function enableCache(cached) {
  function enableInstCache(method, key, ttl) {
    var cls = this
    var fn = isValidFunc(cls.prototype[method], method)
    key = key || cached.DEFAULT_PROTO_KEY.replace('{_fn_}', method)
    hiddenProperty(fn, _REALNAME, fn.name || method)
    cls.addCacheKey(key)
    cls.prototype['fresh_' + method] = fn
    cls.prototype[method] = cached.wrap(fn, key, ttl)
  }

  return function _enableCache(method, key, ttl) {
    var cls = this, fn
    // can pass ttl as the second argument
    if ('number' === typeof key) {
      ttl = key
      key = null
    }
    if (method[0] === '.') {
      return enableInstCache.call(this, method.slice(1), key, ttl)
    }
    fn = isValidFunc(cls[method], method)
    key = key || cached.DEFAULT_KEY.replace('{_fn_}', method)
    hiddenProperty(fn, _REALNAME, fn.name || method)
    cls['fresh_' + method] = fn
    cls[method] = cached.wrap(fn, key, ttl, cls)
    cls.addCacheKey(key, true)
    return cls[method]
  }
}

function clearCache(cached) {
  return function _clearCache(callback) {
    cached.del(this._cacheKeys, callback)
  }
}

function addCacheKey(key, isClassMethod) {
  if (isClassMethod) {
    this.classCacheKeys.push(key)
  } else {
    this.itemCacheKeys.push(key)
  }
}

/**
 * Revive object from a json string
 */
function reviver(k, v) {
  if ('object' == typeof v && v !== null && !Array.isArray(v)) {
    var cls = v[_REALNAME]
    if (cls) {
      if (!(cls in constructors)) {
        log('Constructor for %s doesn\'t exist anymore.', cls)
        // return a undefined, mean this object is not available anymore
        return
      }
      cls = constructors[cls]
      delete v[_REALNAME]
      v = new cls(v)
      if (v._unpickle) {
        v._unpickle()
      }
    }
    return v
  }
  if ('string' === typeof v && RE_JSON_TIME.test(v)) {
    // revive a date object
    v = new Date(v)
  }
  return v
}

function unpickle(value) {
  return JSON.parse(value, reviver)
}


Cacheable.prototype._initClassHelper = function() {
  this.helpers.enableCache = enableCache(this)
  this.helpers.clearCache = clearCache(this)
  this.helpers.addCacheKey = addCacheKey
  this.unpickle = unpickle
}

/**
 * Register constructor class for unpickle
 */
Cacheable.prototype.register = function(cls, modelName) {
  modelName = modelName || cls.modelName || cls.name
  hiddenProperty(cls, _REALNAME, modelName)
  hiddenProperty(cls.prototype, _REALNAME, modelName)
  if (cls[_REALNAME] in constructors) {
    throw new Error('Class "' + cls[_REALNAME] + '" already defined')
  }
  if (!this.helpers.enableCache) {
    this._initClassHelper()
  }
  this._extend(cls)
  constructors[cls[_REALNAME]] = cls
}


/**
 * Extend Model with methods to enable and clear cache
 */
Cacheable.prototype._extend = function extendClass(cls) {
  var cached = this, proto = cls.prototype
  cls.classCacheKeys = []
  // default item related cache
  cls.itemCacheKeys = ['{_model_}:{id}']
  // instance cache keys
  Object.defineProperty(proto, '_cacheKeys', {
    get: function() {
      var self = this
      return cls.itemCacheKeys.map(function(item) {
        return cached._applykey(self, item)
      })
    }
  })
  cls.enableCache = cached.helpers.enableCache
  cls.addCacheKey = cached.helpers.addCacheKey
  proto._clearCache = cached.helpers.clearCache

  if ('function' != typeof proto.toJSON) {
    throw new Error('Cache-able class must have instance method .toJSON')
  }
  proto._toJSON = proto.toJSON
  proto.toJSON = function toJSON() {
    var obj = this._toJSON()
    obj[_REALNAME] = cls[_REALNAME]
    return obj
  }
  return cls
}


function hiddenProperty(where, property, value) {
  Object.defineProperty(where, property, { value: value });
}

function isValidFunc(fn, method) {
  if (!fn) {
    throw new Error('method "' + method + '" not defined')
  }
  if ('function' !== typeof fn) {
    throw new Error('method "' + method + '" is not a function')
  }
  return fn
}


