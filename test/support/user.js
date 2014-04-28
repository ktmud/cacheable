module.exports = User

function User(data) {
  this.data = data
  this.id = data.id
}

User.prototype.toJSON = function() {
  return this.data
}

User.prototype.articleIds = function(callback) {
  User._called = true
  var self = this
  process.nextTick(function() {
    callback(null, [1,2,3, self.id])
  })
}

User.get = function(id, callback) {
  User._called = true
  process.nextTick(function() {
    callback(null, new User({ id: id }))
  })
}

