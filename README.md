# Cached

Cache manager that doesn't suck.

Add a cache wrapper for your functions, automatically pickle and unpickle the data.
All you have to do is remember when to clear the cache.


## Usage

Basic:

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
```

Wraping a function to add cache:

```
function User(data) {
  this.attributes = data
}

// register a constructor class for object pickle and unpickle
// All classes must implement a `toJSON` method,
// and `new Class(json)` must be a valid object
// But you can always define how to pickle and unpickle an object,
// see blow.
cached.register(User)

User.prototype.toJSON = function() {
  return this.attributes
}

User.get = function(user_id, callback) {
  // get the user from data base
  // ...
  var user = new User(data)

  callback(err, user);
}

// Make a class method cached
User.addCache('get')

// You can also enable cache for an instance method
User.prototype.getPostIds = function(start, limit, callback) {
  // get user's posts
  callback(null, [1,2,3...])
}

User.addCache('.getPostIds', 'posts-{0}-{1}')


// Or just a simple function
function request(url, callback) {
  // ...
}
request = cached.wrap(request, 'get-url')
```

## API

### cached.register(cls, options)

You have to `register` the constructor class, so when cache is hit, the cached manager would know
how to restore the data as a proper JavaScript Object.

If your constructor function doesn't have a name, you can set a name in `options`.
The register method will set the constructor function's name for you.

```javascript
var Book = function() {
}
cached.register(Book, 'Book')

console.log(Book.name == 'Book')  // true
```

Your class.prototype should have a `.toJSON` method, or a private `._pickle` method,
so the cache wrapper could know how to save it to cache.

If an `._unpickle` method is defined, it will be called each time the object is loaded from cache.

That is:

```javascript
var item = new User(json)
item._unpickle()
return item
```

Note that it would be impossible to unpickle the cache properly 
if a constructor's name is changed.

When registered, the class will have a property of `._cacheKeys` and an instance would have a function
of `._clearCache()`.

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

    {this.name}:{_fn_}:{0}

which should be usable for most class methods.


You can use literal `{this}` in the key pattern, which is `this` itself in the scope while the cache 
function is called. You can also use a dot `.` to 

`{_fn_}` is the name of the function `fn`. If not found, an error will throw.
So you'd better alway name your functions, like this:

```javascript
User.get = function get(id) {
  // ...
}
```

Numbers like `{0}` is indexes of arguments when the function is called.

### cls.addCache(methodName, [key], [ttl])

When a `cls` is registered, you can use `cls.addCache` to enable cache for class/instance methods.

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

User.addCache('getAllIds', 'ids-{0.limit}-{0.offset}')

User.addCache('.getPostIds', 'posts-{0}-{1}')
```

It is strongly recommended to use this approach to add cache, instead of directly call `cached.wrap`.

For an instance method, the default `key` would be:

    {this.constructor.name}:{this.id}:{_fn_}


## TODO

Make this package compatible with other cache client, rather than only redis right now.


## License

the MIT licence.
