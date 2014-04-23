var Storeman = require('storeman');
var keyf = require('keyf')
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
*
* The async function must have a signature of `fn(arg1, [arg2...,] callback)`.
* The `arg1` can be an options object, if `options.fresh` is passed as true,
* cache will not be used.
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
    // when `options.fresh` is passed as true,
    // don't use cache
    if ('object' == typeof args[0] && args[0].fresh) {
      return run()
    }
    // cache key is not fully formatted means some args are not passed in
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
      // make sure we save cache after callback
      args[args.length - 1] = function(err, result) {
        function _done(){
          callback.call(self, err, result)
        }
        if (err || result === undefined) {
          return _done()
        }
        // save the cache
        cached.set(_key, result, ttl, _done)
      }
      run()
    })
  }
}

/**
 * How to replace a cache key
 */
Cacheable.keyReplacer = function(key, fn, args) {
  var self = this
  var data = {
    _fn_: fn && fn[_REALNAME],
    _model_: self[_REALNAME]
  }
  return keyf(key, data).call(self, args)
}

Cacheable._REALNAME = _REALNAME

module.exports = Cacheable

require('./registry')
