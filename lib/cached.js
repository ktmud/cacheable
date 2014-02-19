var debug = require('debug')('cached')
var log = require('debug')('cached:log')
var __slice = Array.prototype.slice

// all key pattern definations
var allkeys = {}

/**
 *
 * A cached wrapper for async funtions
 *
 * Options:
 *
 *   - `prefix` prefix for all keys under this cached manager
 *   - `silent` to ignore `redis.get` error
 *
 * @param client a redis client
 *
 */
function Cached(client, options) {
  if (!(this instanceof Cached)) return new Cached(client, options)
  options = options || {}
  this.options = options
  this.prefix = 'prefix' in options ? options.prefix : 'cached:'
  this.silent = options.silent === false ? false : true
  this.client = client
  this.helper = {}
  this.helper._clearCache = registry.clearCache(this)
  this.helper._addCache = registry.addCache(this)
}


Cached.prototype._applykey = function applykey(ctx, key, args, fn) {
  return Cached.keyReplacer.apply(ctx, key, args, fn)
}


Cached.prototype.DEFAULT_KEY =  '{name}:{_fn_}-{0}'
Cached.prototype.DEFAULT_PROTO_KEY = '{constructor.name}:{id}:{_fn_}'

/**
* Wraps an async funtion, automaticly cache the result
*/
Cached.prototype.wrap = function(fn, key, ttl) {
  var cached = this

  if ('number' == typeof key) {
    key = '' // will just use default key
    ttl = key
  }
  key = key || cached.DEFAULT_KEY

  if (!fn.name && key.indexOf('{method}')) {
    throw new Error('Cache key referred to "{method}", but the function doesn\'t have a name')
  }

  var realkey = cached.prefix + key
  if (realkey in allkeys) {
    console.error('Found possible cache key confilit: %s', realkey)
  } else {
    allkeys[realkey] = null
  }

  debug('wraping %s with key: %s, ttl: %s', fn.name || '[anonymous]', key, ttl)

  return function() {
    var self = this
    var args = __slice.apply(arguments)
    var callback = args.pop()

    // doesn't need a callback
    // just do the job as there is no cache
    if (typeof callback !== 'function') {
      return fn.apply(self, arguments)
    }

    function done() {
      return callback.apply(self, arguments)
    }

    // the real key
    var _key = cached._applykey(self, fn, key, args)

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
      args.push(function(err, result) {
        function _done(){
          callback.call(self, err, result)
        }
        if (err || result === undefined) {
          return _done()
        }
        // save the cache
        cached.set(_key, result, _done)
      })
      // run the job
      fn.apply(self, args)
    })
  }
}

/**
 * How to replace a cache key
 */
Cached.keyReplacer = function(key, args, fn) {
  var ks, v, k
  var self = this
  return key.replace(/{([\w]+)}/g, function(p0, p1) {
    ks = p1.split('.')
    v = null
    k = ks.shift()
    if (k === 'this') {
      v = self
    } else if (k === 'method') {
      v = fn.name
    } else {
      v = isdigit(k) ? args[k] : self[k]
    }
    // dive into object
    while (v && ks.length && ks[0] in v) {
      v = v[ks.shift()]
    }
    // useful for Date type
    if (v.toJSON) {
      v = v.toJSON()
    }
    return v || p0
  })
}

function isdigit(s) {
  return !isNaN(Number(s))
}

module.exports = Cached

require('./store')
require('./registry')
