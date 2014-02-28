var Storeman = require('storeman');
var debug = require('debug')('cacheable:debug')

var log = require('debug')('cacheable:log')
var __slice = Array.prototype.slice

// all key pattern definations
var allkeys = {}
var RE_KEY_PATTERN = /(%j)?{([\w\.]+)}/g
var _REALNAME = '__cachedname'

/**
 *
 * A cached wrapper for async funtions
 *
 * Options:
 *
 *   - `prefix` prefix for all keys under this cached manager
 *   - `silent` to ignore `redis.get` error
 *
 *
 */
function Cacheable(options) {
  if (!(this instanceof Cacheable)) return new Cacheable(options)
  options = options || {}
  if (!options.prefix && options.prefix !== '') {
    options.prefix = 'cached:'
  }
  this.prefix = options.prefix
  this.silent = options.silent === false ? false : true
  this.helpers = {}
  Storeman.call(this, options);
}
// Inherit Storeman to get a bunch of `get`, `set` methods
require('util').inherits(Cacheable, Storeman)

Cacheable.prototype.debug = debug
Cacheable.prototype.DEFAULT_KEY =  '{_model_}:{_fn_}:%j{0}'
Cacheable.prototype.DEFAULT_PROTO_KEY = '{_model_}:{id}:{_fn_}'

Cacheable.prototype._applykey = function applykey(ctx, key, fn, args) {
  return Cacheable.keyReplacer.call(ctx, key, fn, args)
}

/**
* Wraps an async funtion, automaticly cache the result
*/
Cacheable.prototype.wrap = function(fn, key, ttl, ctx) {
  var cached = this

  if ('number' == typeof key) {
    // second parameter as ttl
    ctx = ttl
    ttl = key
    key = null
  }
  if ('function' == typeof key || 'object' == typeof key) {
    // second parameter as context
    ctx = key
    key = null
  }
  key = key || cached.DEFAULT_KEY

  if (!fn[_REALNAME] && key.indexOf('{method}')) {
    throw new Error('Cache key referred to "{method}", but the function doesn\'t have a name')
  }

  // try formating the key in advance
  var uniqkey = cached._applykey(ctx, key, fn, [])
  if (uniqkey in allkeys) {
    log('Possible key conflict -> fn: [%s], key: %s', fn[_REALNAME], uniqkey)
  } else {
    allkeys[uniqkey] = null
  }

  debug('wrapping "%s" - "%s", ttl: %s', fn[_REALNAME] || '[anonymous]', uniqkey, ttl)

  return function cacheWrapped() {
    var self = ctx || this
    var args = __slice.apply(arguments)
    var callback = args[args.length - 1]
    // the real key
    var _key = cached._applykey(self, key, fn, args)

    // doesn't need a callback
    // just do the job as there is no cache
    if (typeof callback !== 'function') {
      debug('called with no callback, skip "%s"', _key)
      return run()
    }
    if (_key.match(RE_KEY_PATTERN)) {
      debug('cache key not fully formatted, skip "%s"', _key, args)
      return run()
    }

    function run() {
      fn.apply(self, args)
    }

    function done(err, reply) {
      return callback.call(self, err, reply)
    }

    cached.get(_key, function(err, reply) {
      if (err) {
        if (!cached.silent) {
          // ignore cache error unless not silent
          return done(err)
        }
      }
      // cache found
      if (reply !== undefined) {
        return done(null, reply)
      }
      args[args.length - 1] = function(err, result) {
        function _done(){
          callback.call(self, err, result)
        }
        if (err || result === undefined) {
          return _done()
        }
        // save the cache
        cached.set(_key, result, _done)
      }
      run()
    })
  }
}

function isdigit(s) {
  return !isNaN(Number(s))
}

/**
 * How to replace a cache key
 */
Cacheable.keyReplacer = function(key, fn, args) {
  var ks, v, k
  var self = this
  return key.replace(RE_KEY_PATTERN, function(m, format, p1) {
    ks = p1.split('.')
    v = null
    k = ks.shift()
    if (k === 'this') {
      v = self
    } else if (k === '_fn_') {
      v = fn[_REALNAME]
    } else if (k === '_model_') {
      v = self[_REALNAME]
    } else {
      v = isdigit(k) ? args[k] : self[k]
    }
    // dive into object
    while (v && ks.length && ks[0] in v) {
      v = v[ks.shift()]
    }
    // make the value jsonized
    if (format === '%j') {
      v = JSON.stringify(v)
    }
    // a `[object object]` should not be used
    if ('object' === typeof v) {
      v = null
    }
    return v || m
  })
}

Cacheable._REALNAME = _REALNAME

module.exports = Cacheable

require('./registry')
