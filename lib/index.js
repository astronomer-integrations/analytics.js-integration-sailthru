/* eslint-disable no-console */	

'use strict';

/**
 * Module dependencies.
 */

var helper = require('./helpers');
var request = require('request');
var md5 = require('md5');
var integration = require('@segment/analytics.js-integration');
var apiBaseUrl = 'https://api.sailthru.com/';

/**
 * Expose `Sailthru` integration.
 */


var Sailthru = module.exports = integration('Sailthru')
  .global('Sailthru')
  .option('clientId', '')
  .option('apiKey', '')
  .option('secret', '')
  .option('productBaseUrl', '')
  .option('optoutValue', 'none')
  .option('defaultListName', '')
  .option('sendTemplate', '')
  .option('reminderTemplate', '')
  .option('reminderTime', '')
  .tag('https', '<script src="https://ak.sail-horizon.com/spm/spm.v1.min.js">');

/**
 * Initialize
 *
 * https://getstarted.sailthru.com/developers/api-client/javascript/
 *
 * @api public
 */

Sailthru.prototype.initialize = function() {
  var self = this;
  this.load('https', function() {
    window.Sailthru.init({ 
      customerId: self.options.clientId,
      isCustom: true,
      autoTrackPageview: false,
      useStoredTags: false 
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
 * Identify events are mapped to userSignUp Sailthru event which can create or update a user
 * Running an identify event will also set the sailthru_hid cookie in the user's browser
 *
 * @api public
 * @param {Identify} identify - identify event
 */

Sailthru.prototype.identify = function(identify) {
  var self = this;
  var props;
  var traits = identify.traits();
  var id = helper.getUserId(identify, props);
  var email = helper.getUserEmail(identify, props, traits);

  // Config Options
  var integrations = identify.integrations();
  var options = self && self.options;
  var optoutValue = integrations && integrations.Sailthru && integrations.Sailthru.optoutValue
    || options && options.optoutValue
    || 'none';
  var defaultListName = traits && traits.defaultListName
    || integrations && integrations.Sailthru && integrations.Sailthru.optoutValue
    || options && options.defaultListName;

  var payload = {
    keys: {
      email: email,
      extid: id
    },
    optout_email: optoutValue,
    keysconflict: 'merge'
    // onSuccess: function() { console.log('Sign Up Successful'); },
    // onError: function() { console.log('Sign Up Error'); }
  };

  payload.vars = helper.filterCustomTraits(traits);

  if (defaultListName !== '') {
    var lists = payload.lists = {};
    lists[defaultListName] = 1;
  }

  helper.appendIdToPayload(payload, email, id);

  this._integration('userSignUp', payload);
};

/**
 * Page events are mapped to the pageview Sailthru event
 *
 * @api public
 * @param {Page} page - page event
 */

Sailthru.prototype.page = function(page) {
  var props = page.properties();
  var context = page.context();
  var url = props && props.url || context && context.page && context.page.url;

  var payload = {
    url: url
    // onSuccess : function() {console.log('trackPageView success');},
    // onError : function() {console.log('trackPageView failure');} 
  };

  if (props && props.tags) {
    payload.tags = props.tags;
  }

  this._track('pageview', payload);
};

/**
 * Track Events
 *
 * @api public
 * @param {Track} track - track event
 */

Sailthru.prototype.track = function(track) {
  var event = track.event();
  var integrations = track.integrations();
  var props = track.properties();
  var traits = track.traits();
  var id = helper.getUserId(track, props);
  var email = helper.getUserEmail(track, props, traits);
  var template = props && props.template
    || integrations && integrations.Sailthru && integrations.Sailthru.template;
  var payload = null;

  switch (event) {
  case 'userSignUpConfirmedOptIn':
    payload = {
      template: {
        name: template
      },
      vars: traits
      // onSuccess: function() { console.log('Sign Up Confirmed Opt In Successful'); },
      // onError: function() { console.log('Sign Up Confirmed Opt In Error'); }
    };

    helper.appendIdToPayload(payload, email, id);

    this._integration('userSignUpConfirmedOptIn', payload);
    break;
  case 'gdprDoNotTrack':
    payload = null;
    this._track('gdprDoNotTrack', payload);
    break;
  case 'cookiesDoNotTrack':
    payload = null;
    this._track('cookiesDoNotTrack', payload);
    break;
  default:
    payload = {
      name: event
      // onSuccess: function() { console.log('Custom Event Successful'); },
      // onError: function() { console.log('Custom Event Error'); }
    };
 
    props = helper.removePIIFromProperties(props);
    payload.vars = helper.flattenProperties(props);
    helper.appendIdToPayload(payload, email, id);

    this._integration('customEvent', payload);
  }
};

/**
 * productAdded events map to addToCart Sailthru event
 * 
 * @api public
 * @param {Track} event
 */

Sailthru.prototype.productAdded = function(track) {
  this._addOrRemoveProduct(track, 'add');
};

/**
 * productRemoved events map to addToCart Sailthru event
 * 
 * @api public
 * @param {Track} event
 */

Sailthru.prototype.productRemoved = function(track) {
  this._addOrRemoveProduct(track, 'remove');
};

Sailthru.prototype._addOrRemoveProduct = function(track, type) {
  var props = track.properties();
  var traits = track.traits();
  var context = track.context();
  var email = helper.getUserEmail(track, props, traits);
  var id = helper.getUserId(track, props);

  var self = this;
  var options = self && self.options;
  var productBaseUrl = context && context.page && context.page.url || options && options.productBaseUrl;
  var reminderTemplate = props && props.reminderTemplate || options && options.reminderTemplate;
  var reminderTime = props && props.reminderTime || options && options.reminderTime;

  var auth = {
    apiKey: options.apiKey,
    secret: options.secret
  };
  var req;
  if (email) {
    req = { id: email, fields: { purchase_incomplete: 1 } };
  } else {
    req = { id: id, key: 'extid', fields: { purchase_incomplete: 1 } };
  }
  var apiKey = auth.apiKey;
  // eslint-disable-next-line
  req = JSON.stringify(req);
  var sig = md5(auth.secret+auth.apiKey+'json'+req);
  req = encodeURIComponent(req);

  var url = apiBaseUrl + 'user?api_key=' + apiKey + '&sig=' + sig + '&format=json&json=' + req;
  console.log('Url:');
  console.log(url);

  // fetch(url)
  // .then(function(response) {
  //   console.log(response);
  // })
  // // eslint-disable-next-line
  // .catch(function(error) {
  //   console.log(error);
  // });
  request
    .get(url)
    .on('error', function(err) { console.log('Error:'), console.error(err); })
    .on('response', function(response) { console.log('Response:'), console.log(response); });

  // For testing
  var cart = {
    items: [],
    incomplete: 1
  };

  if (traits && traits.cart) {
    cart.items = traits.cart;
  }
  // For testing

  var product = [props];
  var item = helper.mapItems(product, productBaseUrl)[0];
  var payload = helper.updateCart(item, cart, type);
  helper.appendIdToPayload(payload, email, id);

  if (reminderTemplate !== '' && reminderTime !== '') { 
    payload.reminder_template = reminderTemplate;
    payload.reminder_time = reminderTime;
  }

  this._integration('addToCart', payload);
};

/**
 * orderUpdated events map to addToCart Sailthru event
 * 
 * @api public
 * @param {Track} track - track event
 */

Sailthru.prototype.orderUpdated = function(track) {
  var props = track.properties();
  var traits  = track.traits();
  var context = track.context();
  var id = helper.getUserId(track, props);
  var email = helper.getUserEmail(track, props, traits);
  var pageUrl = context && context.page && context.page.url;
  var products = props && props.products;

  // Config Options
  var self = this;
  var integrations = track.integrations();
  var options = self && self.options;
  var reminderTemplate = props && props.reminderTemplate
    || integrations && integrations.Sailthru && integrations.Sailthru.reminderTemplate
    || options && options.reminderTemplate;
  var reminderTime = props && props.reminderTime
    || integrations && integrations.Sailthru && integrations.Sailthru.reminderTime
    || options && options.reminderTime;
  var productBaseUrl = options && options.productBaseUrl;

  var items = helper.mapItems(products, pageUrl, productBaseUrl);

  var payload = {
    items: items,
    adjustments: helper.getAdjustments(track, props),
    incomplete: 1
    // onSuccess: function() { console.log('addToCart Successful'); },
    // onError: function() { console.log('addToCart Error'); }
  };

  delete props.products;
  props = helper.removePIIFromProperties(props);
  payload.vars = helper.flattenProperties(props);
  helper.appendIdToPayload(payload, email, id);

  if (reminderTemplate !== '' && reminderTime !== '') { 
    payload.reminder_template = reminderTemplate;
    payload.reminder_time = reminderTime;
  }

  this._integration('addToCart', payload);
};

/**
 * orderCompleted events map to purchase Sailthru event
 * 
 * @api public
 * @param {Track} track - track event
 */

Sailthru.prototype.orderCompleted = function(track) {
  var props = track.properties();
  var traits  = track.traits();
  var context = track.context();
  var id = helper.getUserId(track, props);
  var email = helper.getUserEmail(track, props, traits);
  var products = props && props.products;
  var pageUrl = context && context.page && context.page.url;

  // Config Options
  var self = this;
  var integrations = track.integrations();
  var options = self && self.options;
  var sendTemplate = props && props.sendTemplate
    || integrations && integrations.Sailthru && integrations.Sailthru.sendTemplate
    || options && options.sendTemplate;
  var productBaseUrl = options && options.productBaseUrl;

  var items = helper.mapItems(products, pageUrl, productBaseUrl);

  var payload = {
    items: items,
    adjustments: helper.getAdjustments(track, props)
    // onSuccess: function() { console.log('Purchase Successful'); },
    // onError: function() { console.log('Purchase Error'); }
  };

  delete props.products;
  props = helper.removePIIFromProperties(props);
  payload.vars = helper.flattenProperties(props);
  helper.appendIdToPayload(payload, email, id);

  if (sendTemplate !== '') { payload.send_template = sendTemplate; }

  this._integration('purchase', payload);
};

Sailthru.prototype._track = function(event, payload) {
  if (payload !== null) {
    console.log('Sending Track Event with Payload');
    console.log('Event:');
    console.log(event);
    console.log('Payload:');
    console.log(payload);
    window.Sailthru.track(event, payload);
  } else {  
    console.log('Sending Track Event without Payload');
    console.log('Event:');
    console.log(event);
    window.Sailthru.track(event);  
  }
};

Sailthru.prototype._integration = function(event, payload) {
  console.log('Sending Sailthru Event');
  console.log('Event:');
  console.log(event);
  console.log('Payload:');
  console.log(payload);
  window.Sailthru.integration(event, payload);
};