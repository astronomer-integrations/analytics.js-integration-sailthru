/* eslint-disable no-console */	

'use strict';

/**
 * Module dependencies.
 */

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
      autoTrackPageview: false
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
 * @param {Facade} identify - identify event
 */

Sailthru.prototype.identify = function(identify) {
  var self = this;
  var id = identify.userId() || identify.anonymousId();
  var traits = identify.traits();
  var options = self && self.options;
  var optoutValue = options && options.optoutValue
    || 'none';
  var email = identify.email() 
    || traits && traits.email;
  var defaultListName = traits && traits.defaultListName
    || options && options.defaultListName;

  var payload = {
    keys: {
      email: email,
      extid: id
    },
    vars: traits,
    optout_email: optoutValue,
    keysconflict: 'merge',
    onSuccess: function() { console.log('Sign Up Successful'); },
    onError: function() { console.log('Sign Up Error'); }
  };

  appendIdToPayload(payload, email, id);

  if (defaultListName !== '') {
    var lists = payload.lists = {};
    lists[defaultListName] = 1;
  }

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
    url: url,
    onSuccess : function() {console.log('trackPageView success');},
    onError : function() {console.log('trackPageView failure');} 
  };

  this._track('pageview', payload);
};

/**
 * Track Events
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
  var id = track.userId() 
    || props && props.userId
    || track.anonymousId()
    || props && props.anonymousId;
  var email = track.email() 
    || traits && traits.email
    || props && props.email;
  var options = self && self.options;
  var sendTemplate = options && options.sendTemplate;
  var payload = null;

  switch (event) {
  case 'userSignUpConfirmedOptIn':
    payload = {
      template: {
        name: sendTemplate
      },
      vars: traits,
      onSuccess: function() { console.log('Sign Up Confirmed Opt In Successful'); },
      onError: function() { console.log('Sign Up Confirmed Opt In Error'); }
    };

    appendIdToPayload(payload, email, id);

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
      vars: props, // remove personal information?
      onSuccess: function() { console.log('Custom Event Successful'); },
      onError: function() { console.log('Custom Event Error'); }
    };

    appendIdToPayload(payload, email, id);

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
  var self = this;
  var options = self && self.options;
  var reminderTemplate = options && options.reminderTemplate;
  var reminderTime = options && options.reminderTime;
  var productBaseUrl = options && options.productBaseUrl;
  var props = track.properties();
  props.price = Math.round(props.price * 100);
  var traits = track.traits();
  var email = track.email() 
    || traits && traits.email
    || props && props.email;
  var id = track.userId() 
    || props && props.userId
    || track.anonymousId()
    || props && props.anonymousId;
  console.log('Id:');
  console.log(id);
  var payload = {
    name: event,
    items: [{
      qty: props && props.quantity,
      title: props && props.name,
      price: props && props.price,
      id: props && props.product_id,
      url: props && props.url || productBaseUrl,
      images: {
        full: {
          url: props && props.image_url 
        }
      },
      vars: props
    }],
    onSuccess: function() { console.log('Add to Cart Successful'); },
    onError: function() { console.log('Add to Cart Error'); }
  };

  appendIdToPayload(payload, email, id);

  if (reminderTemplate !== '' && reminderTime !== '') { 
    payload.reminder_template = reminderTemplate;
    payload.reminder_time = reminderTime;
  }

  this._integration('addToCart', payload);
};

/**
 * productRemoved events map to addToCart Sailthru event
 * 
 * @api public
 * @param {Track} event
 */

Sailthru.prototype.productRemoved = function(track) {
  var self = this;
  var options = self && self.options;
  var reminderTemplate = options && options.reminderTemplate;
  var reminderTime = options && options.reminderTime;
  var productBaseUrl = options && options.productBaseUrl;
  var props = track.properties();
  props.price = Math.round(props.price * 100);
  var traits = track.traits();
  var email = track.email() 
    || traits && traits.email
    || props && props.email;
  var id = track.userId() 
    || props && props.userId
    || track.anonymousId()
    || props && props.anonymousId;
  console.log('Id:');
  console.log(id);
  var payload = {
    name: event,
    items: [{
      qty: props && props.quantity,
      title: props && props.name,
      price: props && props.price,
      id: props && props.product_id,
      url: props && props.url || productBaseUrl,
      images: {
        full: {
          url: props && props.image_url 
        }
      },
      vars: props
    }],
    onSuccess: function() { console.log('Remove from Cart Successful'); },
    onError: function() { console.log('Remove from Cart Error'); }
  };

  appendIdToPayload(payload, email, id);

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
 * @param {Track} event
 */

Sailthru.prototype.orderCompleted = function(track) {
  var self = this;
  var options = self && self.options;
  var sendTemplate = options && options.sendTemplate;
  var productBaseUrl = options && options.productBaseUrl;
  var props = track.properties();
  var traits  = track.traits();
  var id = track.userId() 
    || props && props.userId
    || track.anonymousId()
    || props && props.anonymousId;
  console.log('Id:');
  console.log(id);
  var email = traits && traits.email;
  var products = props && props.products;
  var items = mapItems(products, productBaseUrl);
  var payload = {
    items: items,
    onSuccess: function() { console.log('Purchase Successful'); },
    onError: function() { console.log('Purchase Error'); }
  };

  appendIdToPayload(payload, email, id);

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

/**
 * Take an array of products and map them to an array of Items in the format Sailthru expects
 *
 * @param {Array} products - array of products from event.properties.products
 * @param {String} productBaseUrl - default product url to be used if a product does not have a given url
 */

function mapItems(products, productBaseUrl) {
  var items = [];
  products.forEach(function(product) {
    product.price = Math.round(product.price * 100);
    var item = {
      qty: product.quantity,
      title: product.name,
      price: product.price,
      url: product.url || productBaseUrl,
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

/**
 * Appends email to event payload if available. If email is undefined, either userId or anonymousId will be assigned as extid.
 *
 * @param {Object} payload - event payload to which user data wil be appended
 * @param {String} email - user's email taken from event, event.traits, or event.properties
 * @param {String} id - user's id taken from event.userId or event.anonymousId
 */

function appendIdToPayload(payload, email, id) {
  if (email) { 
    payload.email = email;
    return; 
  }
  payload.id = id,
  payload.key = 'extid';
}