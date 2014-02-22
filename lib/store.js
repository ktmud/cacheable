/**
 * Cache storage API, handling the prefix
 */
var Cached = require('./cached')
var debug = require('debug')('cached:debug')

Cached.prototype.set = function setCache(key, value, ttl, callback) {
  var _this = this
  key = _this.prefix + key
  value = _this.pickle(value)
  if ('function' == typeof ttl) {
    callback = ttl
    ttl = _this.options.ttl
  }
  debug('cached set: %s -> %s, expires: %ss', key, value, ttl || 0)
  if (ttl) {
    _this.client.setex(key, ttl, value, callback)
  } else {
    _this.client.set(key, value, callback)
  }
}

Cached.prototype.get = function getCache(key, callback) {
  var _this = this
  key = _this.prefix + key
  debug('cached get: %s', key)
  _this.client.get(key, function(err, value) {
    if (value) {
      // may unpickle out a `null`
      value = _this.unpickle(value)
    } else {
      // null should be treated as undefined
      value = undefined
    }
    callback(err, value)
  })
}

Cached.prototype.mget = function multiGet(keys, callback) {
  var _this = this
  var prefix = _this.prefix
  keys = keys.map(function(item) {
    return prefix + item
  })
  debug('cached mget: %j', keys)
  this.client.mget(keys, function(err, items) {
    if (items) {
      items = items.map(function(value) {
        return value ? _this.unpickle(value) : undefined
      })
    }
    callback(err, items)
  })
}

Cached.prototype.del = function delCache(keys, callback) {
  if (!Array.isArray(keys)) {
    keys = [keys]
  }
  var prefix = this.prefix
  keys = keys.map(function(item) {
    return prefix + item
  })
  debug('cached del: %j', keys)
  this.client.del(keys, callback)
}

