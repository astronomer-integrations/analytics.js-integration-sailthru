'use strict';

/**
 * Module dependencies.
 */

var helpers = require('./helpers');
var integration = require('@segment/analytics.js-integration');

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
 * @param {Object} identify - identify event
 */

Sailthru.prototype.identify = function(identify) {
  var self = this;
  var props = null;
  var traits = identify.traits();
  var id = helpers.getUserId(identify, props);
  var email = helpers.getUserEmail(identify, props, traits);
  var integrations = identify.integrations();
  var options = self && self.options;

  // Config Options
  var optoutValue = helpers.getOptoutValue(integrations, options); 
  var listName = helpers.getListName(props, traits, integrations, options); 

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

  payload.vars = helpers.filterCustomTraits(traits);

  if (listName !== '') {
    var lists = payload.lists = {};
    lists[listName] = 1;
  }

  helpers.appendIdToPayload(payload, email, id);

  this._integration('userSignUp', payload);
};

/**
 * Page events are mapped to the pageview Sailthru event
 *
 * @api public
 * @param {Object} page - page event
 */

Sailthru.prototype.page = function(page) {
  var props = page.properties();
  var context = page.context();
  var url = helpers.getPageUrl(props, context);

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
 * Maps track events for userSignUpConfirmedOptIn, gdprDoNotTrack, and cookies DoNotTrack
 * Any other track events besides Product Added, Product Removed, Order Updated, and Order Completed are mapped as a customEvent
 *
 * @api public
 * @param {Object} track - track event
 */

Sailthru.prototype.track = function(track) {
  var event = track.event();
  var integrations = track.integrations();
  var props = track.properties();
  var traits = track.traits();
  var id = helpers.getUserId(track, props);
  var email = helpers.getUserEmail(track, props, traits);
  var payload = null;

  switch (event) {
  case 'userSignUpConfirmedOptIn':
    var template = helpers.getOptInTemplate(props, integrations);

    payload = {
      template: {
        name: template
      },
      vars: traits
      // onSuccess: function() { console.log('Sign Up Confirmed Opt In Successful'); },
      // onError: function() { console.log('Sign Up Confirmed Opt In Error'); }
    };

    helpers.appendIdToPayload(payload, email, id);
    this._integration('userSignUpConfirmedOptIn', payload);
    break;
  case 'gdprDoNotTrack':
    this._track('gdprDoNotTrack', payload);
    break;
  case 'cookiesDoNotTrack':
    this._track('cookiesDoNotTrack', payload);
    break;
  default:
    payload = {
      name: event
      // onSuccess: function() { console.log('Custom Event Successful'); },
      // onError: function() { console.log('Custom Event Error'); }
    };
 
    props = helpers.removePIIFromProperties(props);
    payload.vars = helpers.flattenProperties(props);
    helpers.appendIdToPayload(payload, email, id);

    this._integration('customEvent', payload);
  }
};

/**
 * productAdded events map to addToCart Sailthru event using _addOrRemoveProduct
 * 
 * @api public
 * @param {Object} track - productAdded track event
 */

Sailthru.prototype.productAdded = function(track) {
  this._addOrRemoveProduct(track, 'add');
};

/**
 * productRemoved events map to addToCart Sailthru event using _addOrRemoveProduct
 * 
 * @api public
 * @param {Object} track- productRemoved track event
 */

Sailthru.prototype.productRemoved = function(track) {
  this._addOrRemoveProduct(track, 'remove');
};

/**
 * _addOrRemoveProduct maps productAdded and productRemoved events to addToCart
 * 
 * @api public
 * @param {Object} track- productAdded or productRemoved track event
 * @param {String} type - 'add' for productAdded events, 'remove' for productRemoved events
 */

Sailthru.prototype._addOrRemoveProduct = function(track, type) {
  var self = this;
  var props = track.properties();
  var traits = track.traits();
  var context = track.context();
  var email = helpers.getUserEmail(track, props, traits);
  var id = helpers.getUserId(track, props);
  var integrations = track.integrations();
  var options = self && self.options;

  // Config Options
  var productBaseUrl = helpers.getProductBaseUrl(context, options);
  var reminderTemplate = helpers.getReminderTemplate(props, integrations, options);
  var reminderTime = helpers.getReminderTime(props, integrations, options);

  var cart = {
    items: [],
    incomplete: 1
  };

  if (props && props.items) {
    cart.items = props.items;
    delete props.items;
  }

  props = helpers.removePIIFromProperties(props);
  var product = [props];
  var item = helpers.mapItems(product, productBaseUrl)[0];
  var payload = helpers.updateCart(item, cart, type);
  helpers.appendIdToPayload(payload, email, id);

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
  var self = this;
  var props = track.properties();
  var traits  = track.traits();
  var context = track.context();
  var id = helpers.getUserId(track, props);
  var email = helpers.getUserEmail(track, props, traits);
  var integrations = track.integrations();
  var products = props && props.products;
  var options = self && self.options;

  // Config Options
  var reminderTemplate = helpers.getReminderTemplate(props, integrations, options);
  var reminderTime = helpers.getReminderTime(props, integrations, options);
  var productBaseUrl = helpers.getProductBaseUrl(context, options);

  var items = helpers.mapItems(products, productBaseUrl);

  var payload = {
    items: items,
    adjustments: helpers.getAdjustments(track, props),
    incomplete: 1
    // onSuccess: function() { console.log('addToCart Successful'); },
    // onError: function() { console.log('addToCart Error'); }
  };

  delete props.products;
  props = helpers.removePIIFromProperties(props);
  payload.vars = helpers.flattenProperties(props);
  helpers.appendIdToPayload(payload, email, id);

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
  var self = this;
  var props = track.properties();
  var traits  = track.traits();
  var context = track.context();
  var id = helpers.getUserId(track, props);
  var email = helpers.getUserEmail(track, props, traits);
  var products = props && props.products;
  var integrations = track.integrations();
  var options = self && self.options;

  // Config Options
  var sendTemplate = helpers.getSendTemplate(props, integrations, options);
  var productBaseUrl = helpers.getProductBaseUrl(context, options);

  var items = helpers.mapItems(products, productBaseUrl);

  var payload = {
    items: items,
    adjustments: helpers.getAdjustments(track, props)
    // onSuccess: function() { console.log('Purchase Successful'); },
    // onError: function() { console.log('Purchase Error'); }
  };

  delete props.products;
  props = helpers.removePIIFromProperties(props);
  payload.vars = helpers.flattenProperties(props);
  helpers.appendIdToPayload(payload, email, id);

  if (sendTemplate !== '') { payload.send_template = sendTemplate; }

  this._integration('purchase', payload);
};

/**
 * Takes event name and payload and sends a Sailthru track event
 * 
 * @api public
 * @param {String} event - track event name
 * @param {Object} payload - track event payload
 */

Sailthru.prototype._track = function(event, payload) {
  if (payload === null) {
    // console.log('Sending Track Event without Payload');
    // console.log('Event:');
    // console.log(event);
    window.Sailthru.track(event);  
  } else {
    // console.log('Sending Track Event with Payload');
    // console.log('Event:');
    // console.log(event);
    // console.log('Payload:');
    // console.log(payload);
    window.Sailthru.track(event, payload);
  }
};

/**
 * Takes event name and payload and sends a Sailthru integration event
 * 
 * @api public
 * @param {String} event - integration event name
 * @param {Object} payload - integration event payload
 */

Sailthru.prototype._integration = function(event, payload) {
  // console.log('Sending Sailthru Event');
  // console.log('Event:');
  // console.log(event);
  // console.log('Payload:');
  // console.log(payload);
  window.Sailthru.integration(event, payload);
};