# Redis Cached

Provide a function wrapper  to cache return vals into redis.

Only support async calls.

## Usage

```javascript
var Redis = require('redis');
var Cached = require('redis-cached');

var client = Redis.createClient();
var cached = Cached(client, {
  ttl: 60000, // cache will expire in one minutes
  prefix: 'myapp-'
});


var getUser = function(user_id, callback) {

  // do something
  // ...

  callback(err, data);
}

getUser = cached.wrap(getUser, 'user-{0}');

```
