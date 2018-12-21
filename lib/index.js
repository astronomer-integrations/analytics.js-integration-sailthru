'use strict';

/**
 * Module dependencies.
 */

var integration = require('@segment/analytics.js-integration');
var util = require('./utils');

/**
 * Expose `Sailthru` integration.
 */
var baseUrl = 'https://api.sailthru.com/';

var Sailthru = module.exports = integration('Sailthru')
  .global('Sailthru')
  .option('customerId', '')
  .option('apiKey', '')
  .option('apiSecret', '')
  .tag('https', '<script src="https://ak.sail-horizon.com/spm/spm.v1.min.js">');

/**
 * Initialize.
 *
 * https://getstarted.sailthru.com/developers/api-client/javascript/
 *
 * @api public
 */

Sailthru.prototype.initialize = function() {
  var self = this;
  this.load('https', function() {
    window.Sailthru.init({
      customerId: self.options.customerId
    }).then(self.ready);
  });
};

/**
 * Loaded?
 *
 * @api private
 * @return {boolean}
 */

Sailthru.prototype.loaded = function() {
  return !!window.Sailthru;
};

/**
 * Identify.
 *
 * @api public
 * @param {Facade} identify
 */

Sailthru.prototype.identify = function(identify) {
  var traits = identify.traits();
  this._integration('userSignUp', traits);
};

/**
 * Page.
 *
 * @api public
 * @param {Page} page
 */

Sailthru.prototype.page = function(page) {
  var props = page.properties();
  props.name = page.name();
  props.url = page.url();
  this._integration('customEvent', props);
};

/**
 * Track.
 *
 * @api public
 * @param {Track} event
 */

Sailthru.prototype.track = function(track) {
  var event = track.event();
  this._trackEvents(event, track);
};

Sailthru.prototype._trackEvents = function(event, track) {
  var props = track.properties();
  var options = track.options();
  var auth = {
    api_key: options.apiKey,
    api_secret: options.apiSecret
  };

  switch (event) {
  case 'userSignUpConfirmedOptIn':
    this._integration('userSignUpConfirmedOptIn', props);
    break;
  case 'updateUser':
    // eslint-disable-next-line
    util.post(baseUrl + 'user', JSON.stringify(props), auth, handleRequest);
    break;
  case 'updateTrigger':
    // eslint-disable-next-line
    util.post(baseUrl + 'trigger', JSON.stringify(props), auth, handleRequest);
    break;
  default:
    props.name = event;
    this._integration('customEvent', props);
  }
};

function handleRequest(err, resp, body) {
  console.log(err);
  console.log(body);
}

Sailthru.prototype.productAdded = function(track) {
  var props = track.properties();
  props.items = track.products().map(mapProduct);
  this._integration('addToCart', props);
};

Sailthru.prototype.orderCompleted = function(track) {
  var props = track.properties();
  props.items = track.products().map(mapProduct);
  this._integration('purchase', props);
};

Sailthru.prototype._integration = function(event, props) {
  window.Sailthru.integration(event, props);
};

/**
 * Take a product conforming to the Segment ecommerce spec
 * and map it to a product in the format Sailthru expects.
 *
 * @param {Obj} product
 */

function mapProduct(product) {
  return {
    title: product.name,
    qty:	product.quantity,
    price:	product.price,
    id:	product.product_id,
    url:	product.url,
    tags: product.tags,
    vars: product.vars,
    images: {
      full: {
        url: product.image_url
      },
      thumb: {
        url: product.image_url_thumb
      }
    }
  };
}
