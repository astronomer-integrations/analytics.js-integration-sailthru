/* eslint-disable no-console */

'use strict';

/**
 * Module dependencies.
 */

var integration = require('@segment/analytics.js-integration');

/**
 * Expose `Sailthru` integration.
 */
// var baseUrl = 'https://api.sailthru.com/';

var Sailthru = module.exports = integration('Sailthru')
  .global('Sailthru')
  .option('clientId', '')
  .option('apiKey', '')
  .option('secret', '')
  .option('productBaseUrl', '')
  .option('optoutValue', '')
  .option('defaultListName', '')
  .option('sendTemplate', '')
  .option('reminderTemplate', '')
  .option('reminderTime', '')
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
    console.log('self:');
    console.log(self);
    console.log('options:');
    console.log(self.options);
    window.Sailthru.init({
      customerId: self.options.clientId
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
  var self = this;
  console.log('Self:');
  console.log(self);
  var id = identify.userId() || identify.anonymousId();
  console.log('Id:');
  console.log(id);
  var traits = identify.traits();
  console.log('Traits:');
  console.log(traits);
  var options = self && self.options;
  console.log('Options:');
  console.log(options);
  var optoutValue = options.optoutValue
    || 'none';
  console.log('optoutValue:');
  console.log(optoutValue);
  var email = identify.email() 
    || traits && traits.email;
  console.log('Email:');
  console.log(email);
  var defaultListName = traits && traits.defaultListName
    || options.defaultListName;


  var payload = {
    id: id,
    key: 'extid',
    keys: {
      email: email,
      extid: id
    },
    lists: { 
    },
    vars: traits,
    optout_email: optoutValue,
    keysconflict: 'merge',
    onSuccess: function() { console.log('Sign Up Successful'); },
    onError: function() { console.log('Sign Up Error'); }
  };

  var lists = payload.lists;
  lists[defaultListName] = 1;

  console.log('Payload:');
  console.log(payload);

  this._integration('userSignUp', payload);
};

/**
 * Page.
 *
 * @api public
 * @param {Page} page
 */

Sailthru.prototype.page = function(page) {
  var props = page.properties();
  var context = page.context();
  var url = props && props.url || context && context.page && context.page.url;

  var payload = {
    url: url,
    onSuccess : function() {console.log('trackPageView success');},
    onError : function() {console.log('trackPageView failure');} 
  };

  this._track('pageview', payload);
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
  var self = this;
  var props = track.properties();
  var traits = track.traits();
  var anonymousId = track.anonymousId();
  var userId = track.userId();
  var id = userId || anonymousId;
  var email = traits && traits.email;
  var options = self && self.options;
  console.log('self:');
  console.log(self);
  console.log('options:');
  console.log(self.options);
  var payload = null;

  switch (event) {
  case 'userSignUpConfirmedOptIn':
    payload = {
      email: email,
      id: id,
      key: 'extid',
      template: {
        name: options.sendTemplate
      },
      vars: traits,
      onSuccess: function() { console.log('Sign Up Confirmed Opt In Successful'); },
      onError: function() { console.log('Sign Up Confirmed Opt In Error'); }
    };
    this._integration('userSignUpConfirmedOptIn', payload);
    break;
  case 'getCurrentUser':
    payload = {
      onSuccess: function(response) { console.log('getCurrentUser Success', response); },
      onError: function(response) { console.log('getCurrentUser ERROR', response); }
    };
    this._integration('getCurrentUser', payload);
    break;
  case 'gdprDoNotTrack':
    payload = {
      onSuccess: function(response) { console.log('gdprDoNotTrack Success', response); },
      onError: function(response) { console.log('gdprDoNotTrack ERROR', response); }
    };
    this._track('gdprDoNotTrack', payload);
    break;
  case 'cookiesDoNotTrack':
    payload = null;
    this._track('cookiesDoNotTrack', payload);
    break;
  default:
    for (var property in props) {
      if (typeof props[property] === 'object') {
        // eslint-disable-next-line
        props[property] = JSON.stringify(props[property]);
      }
    }
    payload = {
      name: event,
      vars: props,
      onSuccess: function() { console.log('Custom Event Successful'); },
      onError: function() { console.log('Custom Event Error'); }
    };
    appendId(payload, email, id);
    this._integration('customEvent', payload);
  }
};

Sailthru.prototype.productAdded = function(track) {
  var props = track.properties();
  props.price = Math.round(props.price * 100);
  var traits = track.traits();
  var payload = {
    name: event,
    email: traits.email,
    items: [{
      qty: props.quantity,
      title: props.name,
      price: props.price,
      id: props.product_id,
      url: props.url,
      images: {
        full: {
          url: props.image_url 
        }
      },
      vars: props
    }],
    onSuccess: function() { console.log('Add to Cart Successful'); },
    onError: function() { console.log('Add to Cart Error'); }
  };
  this._integration('addToCart', payload);
};

Sailthru.prototype.productRemoved = function(track) {
  var props = track.properties();
  props.price = Math.round(props.price * 100);
  var traits = track.traits();
  var payload = {
    name: event,
    email: traits && traits.email,
    items: [{
      qty: props.quantity,
      title: props.name,
      price: props.price,
      id: props.product_id,
      url: props.url,
      images: {
        full: {
          url: props.image_url 
        }
      },
      vars: props
    }],
    onSuccess: function() { console.log('Remove From Cart Successful'); },
    onError: function() { console.log('Remove From Cart Error'); }
  };
  this._integration('addToCart', payload);
};

Sailthru.prototype.orderCompleted = function(track) {
  var props = track.properties();
  var traits  = track.traits();
  var items = mapItems(props.products);
  var payload = {
    email: traits.email,
    items: items,
    onSuccess: function() { console.log('Purchase Successful'); },
    onError: function() { console.log('Purchase Error'); }
  };
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

/**
 * Take a product conforming to the Segment ecommerce spec
 * and map it to an item in the format Sailthru expects.
 *
 * @param {Obj} products
 */

function mapItems(products) {
  var items = [];
  products.forEach(function(product) {
    product.price = Math.round(product.price * 100);
    var item = {
      qty: product.quantity,
      title: product.name,
      price: product.price,
      url: product.url,
      id: product.product_id,
      images: {
        full: {
          url: product.image_url 
        }
      },
      vars: product
    };
    items.push(item);
  });
  return items;
}

function appendId(payload, email, id) {
  if (email !== undefined) {
    payload.email = email;
    return payload;
  } 
  payload.id = id,
  payload.key = 'extid';
  return payload;
}