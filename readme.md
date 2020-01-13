---
title: Sailthru
sidebar: platform_sidebar
---

MetaRouter makes it easy to send your data to Sailthru. Once you follow the steps below, your data will be routed through our platform and pushed to Sailthru in the appropriate format.

## What is Sailthru and how does it work?

[Sailthru](https://www.sailthru.com/) is the complete, unified and integrated marketing solution which allows purchases tracking, content personalization and email managing. You can visit their developer docs [here](https://getstarted.sailthru.com/developers/overview/).

## Why send data to Sailthru using MetaRouter?

With MetaRouter, you can use Sailthru without having to install their JavaScript library on every page of your site. We also eliminate the need to write custom code to track user event data. Once your Sailthru is routed through MetaRouter, our platform translates page views and events into corresponding Sailthru events.

## Getting Started with Sailthru and MetaRouter

### Initialization

The Sailthru server-side destination will allow you to add users, send custom events and purchase events. Once you have configured a source and our MetaRouter [snippet](https://docs.metarouter.io/v2/clickstream/sources/analyticsjs.html#copy--paste-the-snippet) is installed, enable and configure Sailthru as a destination and add your API Key and Shared Secret, which you can find in the [API & Postbacks](https://my.sailthru.com/settings/api_postbacks) section of your Sailthru Dashboard under **App Settings > Setup > API & Postbacks**.

### Implementation checklist

**Important: In order for this destination to work, you must have a few prerequisite configurations.**

- You must have `extid` lookup enabled in Sailthru, which usually needs to be requested from Sailthru. This is critical to enabling full functionality. If you do not do so, you will only be able to access users via their email address.
- You must configure a `Client ID` in your integration settings in order to initialize the Sailthru Javascript API Library. This value can be found in the [API & Postbacks](https://my.sailthru.com/settings/api_postbacks) section of your Sailthru Dashboard listed as `Customer ID`.
- Use the [Ecommerce](https://docs.metarouter.io/v2/clickstream/ecommerce.html) event spec to track `Order Completed`,`Order Updated`, `Product Added`, and `Product Removed`.
- For `Product Added` and `Product Removed` events, you will need to make a request to the Sailthru User API at `https://api.sailthru.com/user` to grab the items currently in the user’s cart. More information about this API call is located under the `Product Added and Product Removed` section later in this document.
- To trigger abandoned cart campaigns, you must pass in a `reminderTime` and `reminderTemplate` on the `Product Added` and `Product Removed` events.
- The templates passed through as `sendTemplate` or `reminderTemplate` must match the public name of a template previously configured in [Sailthru's UI](https://my.sailthru.com/templates-list).
- Since email is the main method used by Sailthru for user identification, we recommend appending the user's email to `traits.email` or `properties.email` whenever possible in your analytics.js events. For example, if you send an identify call without a `traits.email` and only a `userId`, the profile will be created in Sailthru but you will not be able to find that user via their [User Look Up](https://my.sailthru.com/reports/user_profile) feature or to send `Product Added`, `Product Removed` `Order Updated` and `Order Completed` events.

### Identify

`identify` events map to the [`userSignUp`](https://getstarted.sailthru.com/developers/api-client/javascript/#userSignUp) event in the Sailthru Javascript API Library.

You can use `identify` to create a new user profile or to update an existing user profile if the email address given already exists as a user profile key.

When you `identify` a user, MetaRouter will pass that user’s information to Sailthru with `userId` (or `anonymousId` if `userId` is not passed) as Sailthru’s External User ID (`extid`). MetaRouter sends all traits to Sailthru as `vars`.

Successfully sending an `identify` event will set the user's unique identifier to the `sailthru_hid` cookie in the browser to identify the user for current and future browsing sessions.

You can configure a `defaultListName` in the Metarouter UI. This will automatically assign any newly identified users to the default list that you specify. You can assign a user to a list manually by setting `traits.defaultListName` or `properties.defaultListName` with a value equal to the list name. You can also assign a user to a list as a destination option like so:

```javascript
analytics.identify('1234567890',{
    name: 'Some User',
    email: 'example@gmail.com'
}, {
  integrations: {
    Sailthru: {
      defaultListName: 'test-list'
    },
  },
});
```

You can see all of your lists using the [Lists](https://my.sailthru.com/templates-list) section of the Sailthru UI under **Users > Lists**:

<!-- sailthru-lists.png -->

An `optoutValue` value can be configured in the MetaRouter UI. This will set a new user's default [email optout level](https://getstarted.sailthru.com/audience/managing-users/user-optout-levels/). Valid values are `none`, `all`, `basic`, or `blast`. If no `optoutValue` is set, it will default to `none`. More information about user optout values can be found in the `Optout` section of the `FAQ` at the bottom of this document.

If you identify a user using their email address, you will be able to view that user's activity using Sailthru's [user lookup](https://my.sailthru.com/reports/user_profile/) feature (Sailthru only allows a user lookup up based on an email). Using user lookup you can view an individual user's profile page:

<!-- sailthru-profile.png -->

However, if you send an`identify` call without an email and only a `userId` or `anonymousId`, the profile will be created in Sailthru but you will not be able to find that user via the [user lookup](https://my.sailthru.com/reports/user_profile/) feature.

### Page

When you call `page`, we will trigger a Sailthru [`pageview`](https://getstarted.sailthru.com/integrations/google-tag-manager/track/) track event and you can see the calls populate in the [Sailthru Realtime Dashboard](https://my.sailthru.com/reports/dashboard/).

The `page` event relies on the `sailthru_hid` (which is set via `identify`) cookie to identify which user is visiting a page. If a user's `sailthru_hid` cookie is set, you can track their pageviews on their profile via [user lookup](https://my.sailthru.com/reports/user_profile/). If the `sailthru_hid` cookie is not set, pageviews will not be tracked properly.

The URL tracked by `page` is taken from `properties.url` or from `context.page.url` if `properties.url` is not available. The URL **must** be a domain name, otherwise the request will fail.

Sailthru provides an out of band web scraper that will automatically collect contextual information from your pages to power their [personalization engine](https://getstarted.sailthru.com/site/personalization-engine/meta-tags/). If the design of your site requires passing these tags to Sailthru manually (Single Page Apps are one example), you can manually pass them via a `tags` property in the page event, with `tags` being an array of tags in string format:

```javascript
analytics.page('Page Name', {
  tags: ['football', 'green bay packers', 'aaron rodgers']
});
```

### Track Custom Events

We map `Product Added`, `Product Removed`, and `Order Updated` events to the [`addToCart`](https://getstarted.sailthru.com/developers/api-client/javascript/#addToCart) Sailthru event representing an incomplete purchase, and `Order Completed` events to the [`purchase`](https://getstarted.sailthru.com/developers/api-client/javascript/#purchase) Sailthru event representing a completed purchase. All other Analytics.js Ecommerce Events will be mapped to [`customEvent`](https://getstarted.sailthru.com/developers/api-client/javascript/#customEvent) with the same name.

**Important: You must have each custom event mapped in Sailthru using the [Lifecycle Optimizer](https://my.sailthru.com/lifecycle_optimizer#/) in order to leverage the custom event**. Be sure that the **Status** is set to **Active**. You can reach the [Lifecycle Optimizer](https://my.sailthru.com/lifecycle_optimizer#/) through **Communications > Lifecycle Optimizer** in your Sailthru Dashboard:

<!-- sailthru-lifecycle-optimizer.png -->

Your account must have triggers or lifecycle optimizer enabled. This should be enabled when the account is set up, but you may need to reach out to your account representative to confirm it is enabled.

You can configure a custom event to a new flow and trigger a follow up action whenever a custom event hits the **Sailthru Lifecycle Optimizer**:

<!-- sailthru-event-flow.png -->

For instance, in the above example notice that the custom `User Registered` event will add the user who triggered the event to the list named `registered`.

### Purchase Events

`Product Added`, `Product Removed`, `Order Updated`, and `Order Completed` events will all trigger a purchase that is sent to Sailthru's [purchase log](https://my.sailthru.com/reports/purchaselog):

<!-- sailthru-purchase-logs.png -->

In addition, the purchase will show up in the purchase history of the user that made the purchase:

<!-- sailthru-user-purchases.png -->

`Order Completed` events will create a completed purchase, while `Product Added`, `Product Removed`, and `Order Updated` events will create an incomplete purchase.

Sailthru does not allow `extid` to be the main lookup identifier for purchases. Instead, `email` must be used as the primary identifier. Be sure to call `identify` with an `email` in the `traits` object prior to sending purchase events. If necessary, you can make a GET request to Sailthru's [User API](https://getstarted.sailthru.com/developers/api/user/) to retrieve a user's email based on their `userId`, which is their `extid` in Sailthru. You can also pass a user's email value in your `track` calls under `traits.email` or `properties.email` if needed.

MetaRouter maps the following Sailthru **required fields** from purchase events:

| Sailthru spec         | Analytics.js spec      |
| --------------------- | ---------------------- |
| title                 | products.$.name        |
| qty                   | products.$.quantity    |
| price                 | products.$.price       |
| id                    | products.$.product_id  |
| url                   | products.$.url         |

**Note:** the `url` field is required by Sailthru for each product. If it’s not explicitly attached to the product, MetaRouter will pull this value out from the `context.page.url` for you, or if this value is not present, we'll use the `productBaseUrl` value configured in Metarouter UI.

In addition, the following optional fields will be mapped:

| Sailthru spec              | Analytics.js spec          |
| -------------------------- | -------------------------- |
| tags                       | products.$.tags            |
| image_url                  | products.$.image_url       |
| image_url_thumb            | products.$.image_url_thumb |

The values from `properties.tax`, `properties.shipping`, and `properties.discount` will also be used to modify the final price of the purchase as Sailthru `adjustments`. Any other properties sent with an item will be mapped as Sailthru `vars` for that item.

A user can only have one incomplete purchase at a time. This means that if a user has an incomplete purchase and sends another incomplete purchase event, the previous incomplete purchase will be overwritten by the new one. Also note that purchases cannot be edited once they are posted.

### Product Added and Product Removed

When you `track` a `Product Added` or `Product Removed` event, we will map the event to the [`addToCart`](https://getstarted.sailthru.com/developers/api-client/javascript/#addToCart) event in the Sailthru JavaScript API Library. In order to successfully track when users add items to or remove items from their cart, Sailthru expects an `addToCart` event to contain a list of all items currently in the user's cart, including the item that was just added or removed.

Because `Product Added` and `Product Removed` events only contain information about the item that is added or removed, you will need to first trigger a GET request to the [Sailthru User API](https://getstarted.sailthru.com/developers/api/user/) at `https://api.sailthru.com/user` to check if the user has any items currently in their cart. The JSON request to the Sailthru User API should look something like this:

```json
{
    "id":"example@gmail.com",
    "fields": {
        "purchase_incomplete": 1
    }
}
```

The example request will return incomplete purchase information (including items currently in the user's cart) for the user with the email `example@gmail.com`.

To structure your request URL you will need your request JSON object (like the example given above), the format of the response (which should be `json`), your API key from the [API & Postbacks](https://my.sailthru.com/settings/api_postbacks) section of your Sailthru Dashboard, and a request signature (called `sig` by Sailthru) which is an MD5 hash constructed based on the other request parameters. More information on how to structure and authenticate requests to the Sailthru User API can be found under the [Authentication & Requests](https://getstarted.sailthru.com/developers/api-basics/technical/#Authentication_Requests) section of the Sailthru API Technical Details.

If the user has an incomplete purchase, the response to the User API request will contain an attribute called `purchase_incomplete.items`, which is an array of objects representing items in Sailthru format. When you send a `Product Added` or `Product Removed` event, you must assign the array of items representing the user's cart from `purchase_incomplete.items` to an event property called `items`. When you do so, the product contained in `properties` will be added to or removed from the cart items assigned in `properties.items`, and the updated cart will be sent to Sailthru as an incomplete purchase. An example event might look like this:

```javascript
analytics.track('Product Added', {
  cart_id: '11111',
  product_id: '0123456789',
  sku: 'G-32',
  category: 'Games',
  name: 'Monopoly: 3rd Edition',
  brand: 'Hasbro',
  variant: '200 pieces',
  price: 18.99,
  quantity: 1,
  coupon: 'MAYDEALS',
  position: 3,
  items: [
    {
      url: 'https://www.example.com/product/path',
      id: '0123456789',
      sku: null,
      qty: 1,
      price: 1900,
      title: 'Monopoly: 3rd Edition',
      images: {
        full: 'https://www.example.com/product/path.jpg'
      },
      vars: {
        sku: '45790-32',
        category: 'Games'
      },
      quantity: 1
    },
    {
      url: 'http://dev-mr.bluecode.co/505bd76785ebb509fc183733',
      id: '9876543210',
      sku: null,
      qty: 2,
      price: 300,
      title: 'Uno Card Game',
      images: {
        full: {
          url: ''
        },
        thumb: {
          url: ''
        }
      },
      vars: {
        sku: '46493-32',
        category: 'Games'
      },
      quantity: 2
    }
  ]
});
```

In this case, because the `id` of the product that was added is the same as the `id` of the first item in `properties.items`, the quantity of the item in the cart will be increased by one and the entire cart will be sent as an incomplete purchase.

**Important: If you send a `Product Added` or `Product Removed` event without assigning their previous cart items to the `properties.items` property, the items previously in the user's cart will be lost**

### Order Updated

`Order Updated` events function similarly to `Product Added` and `Product Removed` events, but without the need to make an API call before sending event data since the event contains all the items currently in a user's cart. Like `Product Added` and `Product Removed`, `Order Updated` events are mapped to the [`addToCart`](https://getstarted.sailthru.com/developers/api-client/javascript/#addToCart) event in the Sailthru JavaScript API Library. The entire array of products contained in `properties.products` will be mapped to items in Sailthru format and saved as an incomplete purchase for the given user.

### Order Completed

`Order Completed` events are mapped to the [`purchase`](https://getstarted.sailthru.com/developers/api-client/javascript/#purchase) event in the Sailthru JavaScript API Library. Like `Order Updated`, `Order Completed` events also map the entire array of products contained in `properties.products` to items in Sailthru format. However, `Order Completed` events are the only purchase events that will map to a Sailthru completed purchase, as opposed to an incomplete purchase.

For `Order Completed` events you can configure an additional `sendTemplate` parameter using the [MetaRouter UI](http://app.metarouter.io/), which will send a transactional email for purchase confirmation. The `sendTemplate` parameter must match the public name of a template previously configured in [Sailthru's UI](https://my.sailthru.com/templates-list). `sendTemplate` can also be passed in through the event properties as `properties.sendTemplate`, or as a destination option like so:

```javascript
analytics.track('Order Completed', {
  checkout_id: '11111',
  order_id: '22222',
  total: 21.49,
  revenue: 18.99,
  shipping: 3,
  tax: 2,
  discount: 2.5,
  coupon: 'MAYDEALS',
  currency: 'USD',
  products: [{
    product_id: '0123456789',
    sku: 'G-32',
    category: 'Games',
    name: 'Monopoly: 3rd Edition',
    brand: 'Hasbro',
    variant: '200 pieces',
    price: 18.99,
    quantity: 1,
    position: 3,
  }]
}, {
  integrations: {
    Sailthru: {
      sendTemplate: 'test-send',
    },
  },
});
```

### Abandoned Cart Events

To support Sailthru's [Abandoned Carts](https://getstarted.sailthru.com/lo/automate-abandoned-cart-reminders/) system, we offer the option to configure a `reminderTemplate` and `reminderTime` for `Product Added`, `Product Removed`, and `Order Updated` events. These are transactional emails that are sent after a user "abandons" their cart, or has an incomplete purchase on their account for a certain period of time.

Both values are configured in the [MetaRouter UI](http://app.metarouter.io/). If you configure a `reminderTemplate`, you must configure a `reminderTime` as well. The `reminderTemplate` must match the public name of a template previously configured in [Sailthru's UI](https://my.sailthru.com/templates-list). `reminderTime` must be a unit of time, such as `60 minutes`, `24 hours`, or `2 weeks`. We will handle adding the `+` to the front of the time value. To read more about how Sailthru calculates time, refer to their [time documentation](https://getstarted.sailthru.com/developers/zephyr-functions-library/time/).

You can also pass in `reminderTemplate` and `reminderTime` as properties on the track event object under `properties.reminderTime` or as a destination option like so:

```javascript
analytics.track('Product Added', {
  cart_id: '9876543210',
  product_id: '0123456789',
  sku: 'G-32',
  category: 'Games',
  name: 'Monopoly: 3rd Edition',
  brand: 'Hasbro',
  variant: '200 pieces',
  price: 18.99,
  quantity: 1,
  coupon: 'MAYDEALS',
  position: 3
}, {
  integrations: {
    Sailthru: {
    reminderTemplate: 'abandoned cart',
    reminderTime: '20 minutes'
    }
  }
});
```

### userSignUpConfirmedOptIn

If you send a custom event named `userSignUpConfirmedOptIn`, we will map it to the [`userSignUpConfirmedOptIn`](https://getstarted.sailthru.com/developers/api-client/javascript/#userSignUpConfirmedOptin) event in the Sailthru JavaScript API Library. This event can be used if you want to request that an opt-in confirmation email is sent to a user before they are added to a specified list. In conjunction, you can create a [Lifecycle Optimizer](https://my.sailthru.com/lifecycle_optimizer#/) flow that is initiated when the user finally enters the target list.

When sending a `userSignUpConfirmedOptIn` event, you must send the user's email through `traits.email` or `properties.email`. You also need to attach send the name of the opt-in template you want to send to the user under `properties.template` or as a destination option like so:

```javascript
analytics.track('userSignUpConfirmedOptIn', {
  email: 'example@gmail.com'
}, {
  integrations: {
    Sailthru: {
      template: 'opt-in-template'
    }
  }
});
```

The name of the opt-in template must match the public name of a template previously configured in [Sailthru's UI](https://my.sailthru.com/templates-list). Any additional properties from `event.properties` sent with the event will be mapped to `vars` as template vars that are accessible within the opt-in template.

### gdprDoNotTrack

If you send a custom event named `gdprDoNotTrack`, we will map it to the [`gdprDoNotTrack`](https://getstarted.sailthru.com/developers/api-client/javascript/#gdprDoNotTrack) event in the Sailthru JavaScript API Library. This event can be triggered to opt out a user from online tracking across devices whenever they identify themselves.

The event will update an existing user profile with the status 'do not track', as well as setting the `sailthru_hid` cookie to 'Do Not Track' in the user's browser client. All tracking cookies will be purged and not created again for 'Do Not Track' users.

The `gdprDoNotTrack` event does not require any additional parameters. The event will identify the user from the sailthru_hid cookie or create one automatically, should the user not be known by Sailthru.

### cookiesDoNotTrack

If you send a custom event named `cookiesDoNotTrack`, we will map it to the [`cookiesDoNotTrack`](https://getstarted.sailthru.com/developers/api-client/javascript/#cookiesDoNotTrack) event in the Sailthru JavaScript API Library. This event can be triggered to suppress tracking cookies for a user without opting them out. On-site activity information and user email engagement data will still be available.

Like `gdprDoNotTrack`, `cookiesDoNotTrack` does not require any additional parameters.

### Settings

MetaRouter lets you change these destination settings via your MetaRouter dashboard without having to touch any code.

#### Client ID

**Required** This value is required to initialize the Sailthru JavaScript API Libaray. This value can be found in the [API & Postbacks](https://my.sailthru.com/settings/api_postbacks) section your Sailthru dashboard as `Customer ID`.

#### Product Base URL

The default `productBaseUrl`, which will be used as a fallback for extracting a product url, if there is no `properties.url` for a product or `context.page.url`.

#### Optout Value

Select whether to opt out users from email campaigns. Possible options are `none`, `all`, `basic`, and `blast`. If no optout value is set, it will default to `none`. More information about optout values can be found in the `Optout` section of the `FAQ` below.

#### Default List Name

Sailthru best practice dictates every user be added to a list. Configure a default list here, and any new users that sign up using `identify` will automatically be added to the default list. You can also explicitly set your own `defaultListName` through `traits.defaultListName` or via the destination option for `identify` events.

#### Send Template

The public name of your template which is sent when for a completed purchase. You first must configure it in [Sailthru's UI](https://my.sailthru.com/templates-list).

#### Reminder Template

***Required with Reminder Time** The public name of your template which you first must configure in [Sailthru's UI](https://my.sailthru.com/templates-list).

#### Reminder Time

**Required with Reminder Template** The time frame you will want the email to send. **You must enter a numerical time and field minutes, hours, or weeks** For example: `60 minutes`, `24 hours`, or `2 weeks` are all acceptable values. We will handle adding the `+` to the front of the time value. To read more about how Sailthru calculates time, refer to their [time documentation](https://getstarted.sailthru.com/developers/zephyr-functions-library/time/).

#### API Key (Required)

The API Key found in the [API & Postbacks](https://my.sailthru.com/settings/api_postbacks) section your Sailthru dashboard.

#### Secret (Required)

The Secret found in the [API & Postbacks](https://my.sailthru.com/settings/api_postbacks) section your Sailthru dashboard.

### FAQ

#### Optout

The default status for the optout value is `none`, or you can select `all`, `basic` or `blast`. **Note:** Configuring a setting other than none in your integrations settings will apply to **all users**. If you need to dynamically opt users in or out of emails, pass the setting as a parameter on each event.

`all`: Opts the user out of all emails (campaigns & transactionals). This is the default status when a subscriber marks your email as spam from within an email client.

`basic`: This opt-out setup allows for certain communications (see some acceptable examples in the next bullet) to always send to a user – despite their status.

`blast`: Opts the user out of all campaign emails. The user will still receive all transactional (1:1) emails.

`none`: Optout(none) is a way of revalidating users back from being any type of optout. This would only be used if an end user has previously opted out and would like to opt back in to be a valid user.

You can read more about [Optout Levels here](https://getstarted.sailthru.com/audience/managing-users/user-optout-levels/).

#### Nested Traits and Property Handling

Sailthru does not accept nested custom traits or properties, so by default we will flatten any custom nested properties. For example, see the below nested properties and the flattened output:

```javascript
properties: {
  list_id: 'todays_deals_may_11_2016',
  filters: [
    {
      type: 'department',
      value: 'beauty'
    },
    {
      type: 'price',
      value: 'under-$25'
    }
  ],
  sorts: [
    {
      type: 'price',
      value: 'desc'
    }
  ],
  products: [
    {
      product_id: '507f1f77bcf86cd798439011',
      sku: '45360-32',
      name: 'Dove Facial Powder',
      price: 12.6,
      position: 1,
      category: 'Beauty',
      url: 'https://www.example.com/product/path',
      image_url: 'https://www.example.com/product/path.jpg'
    },
    {
      product_id: '505bd76785ebb509fc283733',
      sku: '46573-32',
      name: 'Artin Hairbrush',
      price: 7.6,
      position: 2,
      category: 'Beauty'
    }
  ]
}
```

```javascript
vars: {
  list_id: 'todays_deals_may_11_2016'
  filters_0_type: 'department'
  filters_0_value: 'beauty'
  filters_1_type: 'price'
  filters_1_value: 'under-$25'
  sorts_0_type: 'price'
  sorts_0_value: 'desc'
  products_0_product_id: '507f1f77bcf86cd798439011'
  products_0_sku: '45360-32'
  products_0_name: 'Dove Facial Powder'
  products_0_price: 12.6
  products_0_position: 1
  products_0_category: 'Beauty'
  products_0_url: 'https://www.example.com/product/path'
  products_0_image_url: 'https://www.example.com/product/path.jpg'
  products_1_product_id: '505bd76785ebb509fc283733'
  products_1_sku: '46573-32'
  products_1_name: 'Artin Hairbrush'
  products_1_price: 7.6
  products_1_position: 2
  products_1_category: 'Beauty'
}
```

#### Replays

Note that Sailthru does not support historical replay.
