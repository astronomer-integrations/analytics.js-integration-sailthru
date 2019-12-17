'use strict';
var _ = require('lodash');

/**
 * Takes an array of products and maps them to an array of Items in Sailthru format
 *
 * @param {Array} products - array of products from event.properties.products
 * @param {String} productBaseUrl - default product url to be used if a product does not have a given url
 */

exports.mapItems = function(products, pageUrl, productBaseUrl) {
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
 * Retrieves the value to be assigned as the user's ID. userId will be used if available, otherwise anonymousId will be used.
 *
 * @param {Object} event - event which contains anonymousId and possibly userId
 * @param {Object} props - properties object which may contain userId or anonymousId
 */

exports.getUserId = function(event, props) {
  return event.userId() || props && props.userId || event.anonymousId() || props && props.anonymousId;
};

/**
 * Retrieves the value to be assigned as the user's email. Searches for email value at the event level first, then inside traits and properties in that order.
 *
 * @param {Object} event - event object
 * @param {Object} props - event properties
 * @param {Object} traits - event traits
 */

exports.getUserEmail = function(event, props, traits) {
  return event.email() || traits && traits.email || props && props.email;
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
 * Removes common user traits
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
    'birthday'
  ]);
};
  
/**
 * Removes Personally Identifiable Information from properties
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
 * Format tax, shipping, and discount properties as price adjustments
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