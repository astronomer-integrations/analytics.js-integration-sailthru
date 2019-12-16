/* eslint-disable no-console */	

'use strict';
var _ = require('lodash');
// var request = require('request');
var md5 = require('md5');

/**
 * Module dependencies.
 */

var integration = require('@segment/analytics.js-integration');

/**
 * Expose `Sailthru` integration.
 */
var apiBaseUrl = 'https://api.sailthru.com/';

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
  var id = getUserId(identify, props);
  var email = getUserEmail(identify, props, traits);

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

  payload.vars = filterCustomTraits(traits);

  if (defaultListName !== '') {
    var lists = payload.lists = {};
    lists[defaultListName] = 1;
  }

  appendIdToPayload(payload, email, id);

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
  var id = getUserId(track, props);
  var email = getUserEmail(track, props, traits);
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

    appendIdToPayload(payload, email, id);

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
 
    props = removePIIFromProperties(props);
    payload.vars = flattenProperties(props);
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
  var email = getUserEmail(track, props, traits);
  var id = getUserId(track, props);

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
  // request
  //   .get(url)
  //   .on('error', function(err) { console.log('Error:'), console.error(err); })
  //   .on('response', function(response) { console.log('Response:'), console.log(response); });
  // var payload = addToCartPayload(product, productBaseUrl);

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
  var item = mapItems(product, productBaseUrl)[0];
  var payload = updateCart(item, cart, type);
  appendIdToPayload(payload, email, id);

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
  var id = getUserId(track, props);
  var email = getUserEmail(track, props, traits);
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

  var items = mapItems(products, pageUrl, productBaseUrl);

  var payload = {
    items: items,
    adjustments: getAdjustments(track, props),
    incomplete: 1
    // onSuccess: function() { console.log('addToCart Successful'); },
    // onError: function() { console.log('addToCart Error'); }
  };

  delete props.products;
  props = removePIIFromProperties(props);
  payload.props = flattenProperties(props);
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
 * @param {Track} track - track event
 */

Sailthru.prototype.orderCompleted = function(track) {
  var props = track.properties();
  var traits  = track.traits();
  var context = track.context();
  var id = getUserId(track, props);
  var email = getUserEmail(track, props, traits);
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

  var items = mapItems(products, pageUrl, productBaseUrl);

  var payload = {
    items: items,
    adjustments: getAdjustments(track, props)
    // onSuccess: function() { console.log('Purchase Successful'); },
    // onError: function() { console.log('Purchase Error'); }
  };

  delete props.products;
  props = removePIIFromProperties(props);
  payload.vars = flattenProperties(props);
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

// Helper Functions:

/**
 * Takes an array of products and maps them to an array of Items in Sailthru format
 *
 * @param {Array} products - array of products from event.properties.products
 * @param {String} productBaseUrl - default product url to be used if a product does not have a given url
 */

function mapItems(products, pageUrl, productBaseUrl) {
  var items = [];
  if (products) {
    products.forEach(function(product) {
      var productId = product && product.product_id || product && product.id || product && product.sku || null;
      product.price = formatPrice(product.price);
      var item = {
        qty: product && product.quantity || 1,
        title: product && product.name || '',
        price: product && product.price || 0,
        id: productId,
        url: product && product.url || pageUrl + '/' + productId || productBaseUrl + '/' + productId,
        images: {
          full: {
            url: product && product.image_url || ''
          },
          thumb: {
            url: product && product.image_url_thumb || ''
          }
        }
      };

      item.vars = filterProductCustomProperties(product); 
      items.push(item);
    });
  }
  return items;
}

function updateCart(currentItem, cart, type) {
  if (cart.items.some(function(item) { return item.id === currentItem.id; })) {
    console.log('Item found in cart');
    var itemInCart = cart.items.find(function(item) { return item.id === currentItem.id; });
    console.log('itemInCart:');
    console.log(itemInCart);
    var newQty;
    if (type === 'remove') {
      newQty = itemInCart.qty - currentItem.qty;
    } else {
      newQty = itemInCart.qty + currentItem.qty;
    }
    console.log('newQty:');
    console.log(newQty);
    itemInCart.vars = Object.assign({}, itemInCart.vars, currentItem.vars);
    itemInCart.qty = newQty;
    itemInCart.quantity = newQty;
    console.log('itemInCart after update:');
    console.log(itemInCart);
    cart.items = cart.items.filter(function(item) { return item.qty > 0; });
    return cart;
  }
  console.log('Item not found in cart');
  if (type !== 'remove') {
    cart.items.push(currentItem);
  }
  return cart;
}

/**
 * Retrieves the value to be assigned as the user's ID. userId will be used if available, otherwise anonymousId will be used.
 *
 * @param {Object} event - event which contains anonymousId and possibly userId
 * @param {Object} props - properties object which may contain userId or anonymousId
 */

function getUserId(event, props) {
  return event.userId() || props && props.userId || event.anonymousId() || props && props.anonymousId;
}

/**
 * Retrieves the value to be assigned as the user's email. Searches for email value at the event level first, then inside traits and properties in that order.
 *
 * @param {Object} event - event object
 * @param {Object} props - event properties
 * @param {Object} traits - event traits
 */

function getUserEmail(event, props, traits) {
  return event.email() || traits && traits.email || props && props.email;
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

/**
 * Removes common user traits
 *
 * @param {Object} traits - user traits
 */

function filterCustomTraits(traits) {
  return _.omit(traits, [
    'email',
    'defaultListName',
    'optout_email',
    'id',
    'userId',
    'annonymousId'
  ]);
}

/**
 * Removes common product properties
 *
 * @param {Object} properties - product properties
 */

function filterProductCustomProperties(properties) {
  return _.omit(properties, [
    'url',
    'value',
    'quantity',
    'name',
    'price',
    'product_id',
    'id',
    'image_url',
    'image_url_thumb'
  ]);
}

/**
 * Removes Personally Identifiable Information from properties
 *
 * @param {Object} properties - event
 */

function removePIIFromProperties(properties) {
  return _.omit(properties, [
    'email',
    'firstName',
    'lastName',
    'gender',
    'city',
    'country',
    'phone',
    'state',
    'zip',
    'birthday'
  ]);
}

/**
 * Removes Personally Identifiable Information from properties
 * Adapted from: https://stackoverflow.com/a/53739792
 * 
 * @param {Object} props - event properties
 */

function flattenProperties(props) {
  var toReturn = {};

  for (var i in props) {
    if (!props.hasOwnProperty(i)) continue;

    if (typeof props[i] === 'object' && props[i] !== null) {
      var flatObject = flattenProperties(props[i]);
      for (var x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue;

        toReturn[i + '_' + x] = flatObject[x];
      }
    } else {
      toReturn[i] = props[i];
    }
  }
  return toReturn;
}

/**
 * Format tax, shipping, and discount properties as price adjustments
 * 
 * @param {Object} event - event object
 * @param {Object} props - event properties
 */

function getAdjustments(event, props) {
  var tax = event.tax() || props && props.tax;
  var shipping = event.shipping() || props && props.shipping;
  var discount = event.discount() || props && props.discount;
  var adjustments = [];

  if (tax) {
    adjustments.push({
      title: 'tax',
      price: formatPrice(tax)
    });
  }
  if (shipping) {
    adjustments.push({
      title: 'shipping',
      price: formatPrice(shipping)
    });
  }
  if (discount) {
    adjustments.push({
      title: 'discount',
      price: -formatPrice(discount) 
    });
  }

  return adjustments;
}

/**
 * Convert price in dollars to price in cents
 * 
 * @param {Object} price - price in dollars
 */

function formatPrice(price) { return Math.round(price * 100); } // absolute value