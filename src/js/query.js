
var url = require("url");
var querystring = require("querystring");
var query = querystring.decode(url.parse(location.href).query);
module.exports = query;
