# Cached

Cache manager that doesn't suck.

Add a cache wrapper for your functions, automatically pickle and unpickle the data.
Manage all cache keys in one place, use a simple `._clearCache()` to purge cache.


## Usage

As a simple cache getter/setter with key prefix support:

```javascript
var Redis = require('redis');
var Cached = require('redis-cached');

var client = Redis.createClient();
var cached = Cached(client, {
  ttl: 60, // set a default max age of one minute for `cached.set`
  prefix: 'myapp:' // the prefix for every cache key
});

cached.set(key, value, callback)
cached.set(key, value, 300, callback)
cached.get(key, callback)
cached.del(['abc', 'aba'], callback)
```

Wraping a function to cache and automatically use cache:

```javascript
// Get remote content that expires in 3600 seconds
var getUrlContent = cached.wrap(function(url, callback) {
    request(url, function() {
      // ...
    })
}, 'url-{0}', 3600)
```

Manage cache for your models:

```
function User(data) {
  this.attributes = data
}

User.prototype.toJSON = function() {
  return this.attributes
}

// get user by id
User.get = function(user_id, callback) {
  // get the user from data base
  // ...
  var user = new User(data)

  callback(err, user);
}

User.prototype.getPostIds = function(start, limit, callback) {
  callback(null, [1,2,3...])
}

// register the constructor first
cached.register(User)

// enable cache for `User.get` method
User.enableCache('get', '{_model_}:{0}') // '{0}' means the `arguments[0]`

// You can also enable cache for an instance method
User.enableCache('.getPostIds', '{_model_}:posts-{0}-{1}')

```

## API

### cached.register(cls, name)

You have to `register` all model constructors, so when cache is hit, the cached manager would know
how to restore the data as a proper JavaScript Object.

If your model constructor doesn't have a name, you can give a name as the second parameter,
then cached will use this name.

```javascript
var Book = function() {
}
cached.register(Book, 'Book')
```

Your class.prototype must have a `.toJSON` method, so the cache wrapper could know how to save it to cache.
The `.toJSON` will be extended by `cache.register`, the output object will always have a property `__cachedname`,
as is the constructor's modelName. You can always add a `.toObject = .toJSON`, and always use `.toObject`
when you need a clean object.


If an `._unpickle` method is also defined, it will be called each time the object is restored from cache.

That is:

```javascript
var item = new User(json)
item._unpickle()
return item
```
Note that it would be impossible to unpickle a cache if the constructor's name was changed.

When registered, the class will have a property `._cacheKeys` and an instance would have
a method `._clearCache()`.

```javascript
User.prototype.destroy = function(callback) {
  var self = this
  // destroy the item from database
  db.destroy(..., function() {
    // then clear the cache
    self._clearCache(callback)
  })
}
```

### cached.wrap(fn, [key], [ttl])

Wrap an standard nodejs async function(which should have a `callback(err, result)` as the last parameter).
The `ttl` is in seconds. If no `ttl` set, the cache will never automatically expire, even it an `options.ttl`
is passed when you do `new Cached()`.

The parameter `key` is a pattern for formatting real cache keys.

The default `key` is:

    {_model_}:{_fn_}:%j{0}

`{_fn_}` is the name of the function `fn`. If not found, an error will throw.
So you'd better alway name your functions, like this:

```javascript
User.get = function get(id) {
  // ...
}
```

`{_model_}` equals to `{this.name}`, which is `this.modelName || this.name` in the scope when the function is called.
For a class method, this usually means the name of a constructor.

Numbers like `{0}` is indexes of arguments when the function is called.
`%j{0}` mean the first argument value will be converted to json.


### cls.enableCache(methodName, [key], [ttl])

When a `cls` is registered, you can use `cls.enableCache` to enable cache for class/instance methods.

If `methodName` starts with a dot `(.)`, it will be considered as an instance method, otherwise,
it's a class method.

```javascript
/**
 *
 * List all ids
 *
 * Options:
 *
 *    `limit`: limit per page
 *    `offset`: offset 
 * 
 */
User.getAllIds = function(options, callback) {
}

User.prototype.getPostIds = function(start, limit, callback) {
  // get user's posts
  callback(null, [1,2,3...])
}

User.enableCache('getAllIds', 'ids-{0.limit}-{0.offset}')

User.enableCache('.getPostIds', 'posts-{0}-{1}')
```

It is strongly recommended to use this approach to add cache, instead of directly call `cached.wrap`.

For an instance method, the default `key` would be:

    {_model_}:{this.id}:{_fn_}


## TODO

Make this package compatible with other cache client, rather than only redis right now.


## License

the MIT licence.
