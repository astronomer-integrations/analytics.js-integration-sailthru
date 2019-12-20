'use strict';
var _ = require('lodash');

/**
 * Retrieves the value to be assigned as the user's ID. userId will be used if available, otherwise anonymousId will be used.
 *
 * @param {Object} event - event object
 * @param {Object} props - event properties
 * @param {Object} traits - event traits
 */

exports.getUserId = function(event, props, traits) {
  return props && props.userId 
    || traits && traits.userId 
    || event.userId() 
    || props && props.anonymousId
    || traits && traits.anonymousId
    || event.anonymousId();
};

/**
 * Retrieves the value to be assigned as the user's email
 *
 * @param {Object} event - event object
 * @param {Object} props - event properties
 * @param {Object} traits - event traits
 */

exports.getUserEmail = function(event, props, traits) {
  return traits && traits.email || props && props.email || event.email();
};

/**
 * Retrieves the url to be sent with a page event
 *
 * @param {Object} props - event properties
 * @param {Object} context - event context
 */

exports.getPageUrl = function(props, context) {
  return props && props.url || context && context.page && context.page.url;
};

/**
 * Retrieves the default optout value that is assigned to a user on sign up
 *
 * @param {Object} integrations - event integration settings
 * @param {Object} options - event options
 */

exports.getOptoutValue = function(integrations, options) {
  return integrations && integrations.Sailthru && integrations.Sailthru.optoutValue
    || options && options.optoutValue
    || 'none';
};

/**
 * Retrieves the default list name used when for signing up new users
 * 
 * @param {Object} traits - event traits
 * @param {Object} integrations - event integration settings
 * @param {Object} options - event options
 */

exports.getListName = function(props, traits, integrations, options) {
  return props && props.defaultListName
    || traits && traits.defaultListName
    || integrations && integrations.Sailthru && integrations.Sailthru.defaultListName
    || options && options.defaultListName;
};

/**
 * Retrieves the product base URL used if an item in a cart does not have a given URL
 * 
 * @param {Object} context - event context
 * @param {Object} options - event options
 */

exports.getProductBaseUrl = function(context, options) {
  return context && context.page && context.page.url || options && options.productBaseUrl;
};

/**
 * Retrieves value for an incomplete purchase reminder template
 * 
 * @param {Object} props - event properties
 * @param {Object} integrations - event integration settings
 * @param {Object} options - event options
 */

exports.getReminderTemplate = function(props, integrations, options) {
  return props && props.reminderTemplate
    || integrations && integrations.Sailthru && integrations.Sailthru.reminderTemplate
    || options && options.reminderTemplate;
};

/**
 * Retrieves value for an incomplete purchase reminder time
 * 
 * @param {Object} props - event properties
 * @param {Object} integrations - event integration settings
 * @param {Object} options - event options
 */

exports.getReminderTime = function(props, integrations, options) {
  return props && props.reminderTime
    || integrations && integrations.Sailthru && integrations.Sailthru.reminderTime
    || options && options.reminderTime;
};

/**
 * Retrieves value for a completed purchase send template
 * 
 * @param {Object} props - event properties
 * @param {Object} integrations - event integration settings
 * @param {Object} options - event options
 */

exports.getSendTemplate = function(props, integrations, options) {
  return props && props.sendTemplate
    || integrations && integrations.Sailthru && integrations.Sailthru.sendTemplate
    || options && options.sendTemplate;
};

/**
 * Retrieves value for a userSignUpConfirmedOptIn template
 * 
 * @param {Object} props - event properties
 * @param {Object} integrations - event integration settings
 */

exports.getOptInTemplate = function(props, integrations) {
  return props && props.template || integrations && integrations.Sailthru && integrations.Sailthru.template;
};

/**
 * Appends email to event payload if available. If email is undefined, either userId or anonymousId will be assigned as extid.
 *
 * @param {Object} payload - event payload to which user data wil be appended
 * @param {String} email - user's email taken from event, event.traits, or event.properties
 * @param {String} id - user's id taken from event.userId or event.anonymousId
 */

exports.appendIdToPayload = function(payload, email, id) {
  if (email) { 
    payload.email = email;
    return; 
  }
  payload.id = id,
  payload.key = 'extid';
};

/**
 * Removes common user traits event traits
 *
 * @param {Object} traits - user traits
 */

exports.filterCustomTraits = function(traits) {
  return _.omit(traits, [
    'email',
    'defaultListName',
    'optout_email',
    'id',
    'userId',
    'annonymousId'
  ]);
};

/**
 * Removes Personally Identifiable Information from properties
 * Also removes template or id information if passed in through paramters to reduce repeated information
 *
 * @param {Object} properties - event
 */
  
exports.removePIIFromProperties = function(properties) {
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
    'birthday',
    'defaultListName',
    'reminderTime',
    'reminderTemplate',
    'sendTemplate',
    'template',
    'userId',
    'anonymousId'
  ]);
};

/**
 * Takes an array of products and maps them to an array of Items in Sailthru format
 *
 * @param {Array} products - array of products from event.properties.products
 * @param {String} productBaseUrl - default product url to be used if a product does not have a given url
 */

exports.mapItems = function(products, productBaseUrl) {
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
        url: product && product.url || productBaseUrl + '/' + productId,
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
};
  
/**
 * Adds an item to or removes an item from cart depending on type
 *
 * @param {Object} currentItem - Sailthru item to be added or removed from cart
 * @param {Object} cart - cart object representing an incomplete purchase
 * @param {String} type - if set to 'remove', item will be removed from cart instead of added
 */

exports.updateCart = function(currentItem, cart, type) {
  if (cart.items.some(function(item) { return item.id === currentItem.id; })) {
    var itemInCart = cart.items.find(function(item) { return item.id === currentItem.id; });
    var newQty;
    if (type === 'remove') {
      newQty = itemInCart.qty - currentItem.qty;
    } else {
      newQty = itemInCart.qty + currentItem.qty;
    }
    itemInCart.vars = Object.assign({}, itemInCart.vars, currentItem.vars);
    itemInCart.qty = newQty;
    itemInCart.quantity = newQty;
    cart.items = cart.items.filter(function(item) { return item.qty > 0; });
    return cart;
  }
  if (type !== 'remove') {
    cart.items.push(currentItem);
  }
  return cart;
};
  
/**
 * Flattens nested objects or arrays (or a combination of both) into a single object
 * Adapted from: https://stackoverflow.com/a/53739792
 * 
 * @param {Object} props - event properties
 */

exports.flattenProperties = function(props) {
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
};
  
/**
 * Formats tax, shipping, and discount properties as price adjustments
 * 
 * @param {Object} event - event object
 * @param {Object} props - event properties
 */
  
exports.getAdjustments = function(event, props) {
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
};
  
/**
 * Convert price in dollars to price in cents
 * 
 * @param {Object} price - price in dollars
 */
  
function formatPrice(price) { return Math.round(Math.abs(price) * 100); } 

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
 * Flattens nested objects or arrays (or a combination of both) into a single object
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