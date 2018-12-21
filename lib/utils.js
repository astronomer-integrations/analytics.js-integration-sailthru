'use strict';

var md5 = require('md5');
var request = require('request');

exports.post = function(url, req, auth, cb) {
  var body = {
    api_key:auth.api_key,
    sig:md5(auth.api_secret+auth.api_key+'json'+req),
    format:'json',
    json:req
  };

  request.post(url, { form: body }, cb);
};
