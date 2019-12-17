'use strict';

var Analytics = require('@segment/analytics.js-core').constructor;
var integration = require('@segment/analytics.js-integration');
var sandbox = require('@segment/clear-env');
var tester = require('@segment/analytics.js-integration-tester');
var Sailthru = require('../lib/');

describe('Sailthru', function() {
  var analytics;
  var sailthru;
  var options = {
    clientId: 'AJ1WTFKFAMAG8045ZXSQ9GMK',
    apiKey: 'asdfasdfasdf',
    apiSecret: 'asdfasdfasd',
    productBaseUrl: 'https://www.example.com/product/path',
    optoutValue: 'basic',
    defaultListName: 'test-list',
    sendTemplate: 'test-send',
    reminderTemplate: 'test-reminder',
    reminderTime: '20 minutes'
  };

  beforeEach(function() {
    analytics = new Analytics();
    sailthru = new Sailthru(options);
    analytics.use(Sailthru);
    analytics.use(tester);
    analytics.add(sailthru);
  });

  afterEach(function() {
    analytics.restore();
    analytics.reset();
    sailthru.reset();
    sandbox();
  });

  it('should have the correct options', function() {
    analytics.compare(Sailthru, integration('Sailthru')
      .global('Sailthru')
      .option('clientId', '')
      .option('apiKey', '')
      .option('secret', '')
      .option('productBaseUrl', '')
      .option('optoutValue', 'none')
      .option('defaultListName', '')
      .option('sendTemplate', '')
      .option('reminderTemplate', '')
      .option('reminderTime', ''));
  });

  describe('before loading', function() {
    beforeEach(function() {
      analytics.stub(sailthru, 'load');
    });

    afterEach(function() {
      sailthru.reset();
    });

    describe('#initialize', function() {
      it('should call load', function() {
        analytics.initialize();
        analytics.called(sailthru.load);
      });
    });
  });

  describe('loading', function() {
    it('should load', function(done) {
      analytics.load(sailthru, done);
    });
  });

  describe('_integration', function() {
    beforeEach(function(done) {
      analytics.initialize();
      analytics.once('ready', function() {
        analytics.stub(window.Sailthru, 'integration');
        done();
      });
    });

    it('should call integration', function() {
      sailthru._integration('customEvent', { id: 'tim' });
      analytics.called(window.Sailthru.integration, 'customEvent', { id: 'tim' });
    });
  });

  describe('after loading', function() {
    beforeEach(function(done) {
      analytics.initialize();
      analytics.once('ready', function() {
        analytics.stub(window.Sailthru, 'integration');
        analytics.stub(sailthru, '_integration');
        analytics.stub(window.Sailthru, 'track');
        analytics.stub(sailthru, '_track');
        done();
      });
    });

    describe('identify', function() {
      it('shoulld sign up user', function() {
        var traits = {
          key : '123',
          email: 'testuser@gmail.com',
          source : 'home'
        };
        analytics.identify('test_user1234', traits);

        analytics.called(sailthru._integration, 'userSignUp', {
          keys: {
            email: 'testuser@gmail.com',
            extid: 'test_user1234'
          },
          vars: {
            key: '123',
            source: 'home'
          },
          optout_email: 'basic',
          keysconflict: 'merge',
          lists: {
            'test-list': 1
          },
          email: 'testuser@gmail.com'
        });
      });
    });

    describe('page', function() {
      it('shoulld send a pageview', function() {
        var props = {
          tags: ['tag1', 'tag2'],
          path: '/dash',
          referrer: 'http://dev-mr.bluecode.co/dash',
          search: '',
          title: 'MetaRouter - Testing app',
          url: 'http://dev-mr.bluecode.co'
        };
        analytics.page('pageview', props);

        analytics.called(sailthru._track, 'pageview', {
          url: 'http://dev-mr.bluecode.co',
          tags: ['tag1', 'tag2']
        });
      });
    });

    describe('customEventTrack', function() {
      it('should create a custom event', function() {
        var props = {
          email: 'testuser@gmail.com',
          'list id': 'todays_deals_may_11_2016',
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
        };
        analytics.track('productListFiltered', props);
        analytics.called(sailthru._integration, 'customEvent', {
          name: 'productListFiltered',
          vars: {
            'list id': 'todays_deals_may_11_2016',
            filters_0_type: 'department',
            filters_0_value: 'beauty',
            filters_1_type: 'price',
            filters_1_value: 'under-$25',
            sorts_0_type: 'price',
            sorts_0_value: 'desc',
            products_0_product_id: '507f1f77bcf86cd798439011',
            products_0_sku: '45360-32',
            products_0_name: 'Dove Facial Powder',
            products_0_price: 12.6,
            products_0_position: 1,
            products_0_category: 'Beauty',
            products_0_url: 'https://www.example.com/product/path',
            products_0_image_url: 'https://www.example.com/product/path.jpg',
            products_1_product_id: '505bd76785ebb509fc283733',
            products_1_sku: '46573-32',
            products_1_name: 'Artin Hairbrush',
            products_1_price: 7.6,
            products_1_position: 2,
            products_1_category: 'Beauty'
          },
          email: 'testuser@gmail.com'
        });
      });
    });

    describe('userSignUpConfirmedOptIn', function() {
      it('should send a userSignUpConfirmedOptIn event', function() {
        var props = {
          template: 'test-send',
          email : 'testuser@gmail.com'
        };
        analytics.track('userSignUpConfirmedOptIn', props);
        analytics.called(sailthru._integration, 'userSignUpConfirmedOptIn', {
          template: {
            name: 'test-send'
          },
          email : 'testuser@gmail.com',
          vars: {}
        });
      });
    });

    describe('gdprDoNotTrack', function() {
      it('should send a gdprDoNotTrack track event', function() {
        var props = {};
        analytics.track('gdprDoNotTrack', props);
        analytics.called(sailthru._track, 'gdprDoNotTrack', null);
      });
    });

    describe('cookiesDoNotTrack', function() {
      it('should send a cookiesDoNotTrack track event', function() {
        var props = {};
        analytics.track('cookiesDoNotTrack', props);
        analytics.called(sailthru._track, 'cookiesDoNotTrack', null);
      });
    });

    describe('productAdded', function() {
      it('should send an addToCart event', function() {
        var props = {
          email: 'testuser@gmail.com',
          cart_id: 'skdjsidjsdkdj29j',
          product_id: '507f1f77bcf86cd799439011',
          sku: 'G-32',
          category: 'Games',
          name: 'Monopoly: 3rd Edition',
          brand: 'Hasbro',
          variant: '200 pieces',
          price: 18.99,
          quantity: 1,
          coupon: 'MAYDEALS',
          position: 3,
          url: 'https://www.example.com/product/path',
          image_url: 'https://www.example.com/product/path.jpg'
        };
        analytics.track('productAdded', props);
        analytics.called(sailthru._integration, 'addToCart', {
          items: [
            {
              qty: 1,
              title: 'Monopoly: 3rd Edition',
              price: 1899,
              id: '507f1f77bcf86cd799439011',
              url: 'https://www.example.com/product/path',
              images: {
                full: {
                  url: 'https://www.example.com/product/path.jpg'
                },
                thumb: {
                  url: ''
                }
              },
              vars: {
                cart_id: 'skdjsidjsdkdj29j',
                sku: 'G-32',
                category: 'Games',
                brand: 'Hasbro',
                variant: '200 pieces',
                coupon: 'MAYDEALS',
                position: 3
              }
            }
          ],
          incomplete: 1,
          email: 'testuser@gmail.com',
          reminder_template: 'test-reminder',
          reminder_time: '20 minutes'
        });
      });
    });

    describe('productRemoved', function() {
      it('should send an addToCart event', function() {
        var props = {
          email: 'testuser@gmail.com',
          cart_id: 'skdjsidjsdkdj29j',
          product_id: '507f1f77bcf86cd799439011',
          sku: 'G-32',
          category: 'Games',
          name: 'Monopoly: 3rd Edition',
          brand: 'Hasbro',
          variant: '200 pieces',
          price: 18.99,
          quantity: 1,
          coupon: 'MAYDEALS',
          position: 3,
          url: 'https://www.example.com/product/path',
          image_url: 'https://www.example.com/product/path.jpg',
          other_var: 'some value'
        };
        analytics.track('productRemoved', props);
        analytics.called(sailthru._integration, 'addToCart', {
          items: [],
          incomplete: 1,
          email: 'testuser@gmail.com',
          reminder_template: 'test-reminder',
          reminder_time: '20 minutes'
        });
      });
    });

    describe('orderUpdated', function() {
      it('shoulld send an addToCart event', function() {
        var props = {
          email: 'testuser@gmail.com',
          order_id: '50314b8e9bcf000000000000',
          affiliation: 'Google Store',
          total: 27.5,
          revenue: 25,
          shipping: 3,
          tax: 2,
          discount: 2.5,
          coupon: 'hasbros',
          currency: 'USD',
          products: [
            {
              product_id: '507f1f77bcf86cd799439011',
              sku: '45790-32',
              name: 'Monopoly: 3rd Edition',
              price: 19,
              quantity: 1,
              category: 'Games',
              url: 'https://www.example.com/product/path',
              image_url: 'https://www.example.com/product/path.jpg'
            },
            {
              product_id: '505bd76785ebb509fc183733',
              sku: '46493-32',
              name: 'Uno Card Game',
              price: 3,
              quantity: 2,
              category: 'Games'
            }
          ]
        };
        analytics.track('orderUpdated', props);
        analytics.called(sailthru._integration, 'addToCart', {
          items: [
            {
              qty: 1,
              title: 'Monopoly: 3rd Edition',
              price: 1900,
              id: '507f1f77bcf86cd799439011',
              url: 'https://www.example.com/product/path',
              images: {
                full: {
                  url: 'https://www.example.com/product/path.jpg'
                },
                thumb: {
                  url: ''
                }
              },
              vars: {
                sku: '45790-32',
                category: 'Games'
              }
            },
            {
              qty: 2,
              title: 'Uno Card Game',
              price: 300,
              id: '505bd76785ebb509fc183733',
              url: 'http://localhost:9876/context.html/505bd76785ebb509fc183733',
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
              }
            }
          ],
          adjustments: [
            {
              title: 'tax',
              price: 200
            },
            {
              title: 'shipping',
              price: 300
            },
            {
              title: 'discount',
              price: -250
            }
          ],
          incomplete: 1,
          vars: {
            order_id: '50314b8e9bcf000000000000',
            affiliation: 'Google Store',
            total: 27.5,
            revenue: 25,
            shipping: 3,
            tax: 2,
            discount: 2.5,
            coupon: 'hasbros',
            currency: 'USD'
          },
          email: 'testuser@gmail.com',
          reminder_template: 'test-reminder',
          reminder_time: '20 minutes'      
        });
      });
    });

    describe('orderComplete', function() {
      it('shoulld send an purchase event', function() {
        var props = {
          email: 'testemail@gmail.com',
          order_id: '50314b8e9bcf000000000000',
          affiliation: 'Google Store',
          total: 27.5,
          revenue: 25,
          shipping: 3,
          tax: 2,
          discount: 2.5,
          coupon: 'hasbros',
          currency: 'USD',
          products: [
            {
              product_id: '507f1f77bcf86cd799439011',
              sku: '45790-32',
              name: 'Monopoly: 3rd Edition',
              price: 19,
              quantity: 1,
              category: 'Games',
              url: 'https://www.example.com/product/path',
              image_url: 'https://www.example.com/product/path.jpg'
            },
            {
              product_id: '505bd76785ebb509fc183733',
              sku: '46493-32',
              name: 'Uno Card Game',
              price: 3,
              quantity: 2,
              category: 'Games'
            }
          ]
        };
        analytics.track('orderCompleted', props);
        analytics.called(sailthru._integration, 'purchase', {
          items: [
            {
              qty: 1,
              title: 'Monopoly: 3rd Edition',
              price: 1900,
              id: '507f1f77bcf86cd799439011',
              url: 'https://www.example.com/product/path',
              images: {
                full: {
                  url: 'https://www.example.com/product/path.jpg'
                },
                thumb: {
                  url: ''
                }
              },
              vars: {
                sku: '45790-32',
                category: 'Games'
              }
            },
            {
              qty: 2,
              title: 'Uno Card Game',
              price: 300,
              id: '505bd76785ebb509fc183733',
              url: 'http://localhost:9876/context.html/505bd76785ebb509fc183733',
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
              }
            }
          ],
          adjustments: [
            {
              title: 'tax',
              price: 200
            },
            {
              title: 'shipping',
              price: 300
            },
            {
              title: 'discount',
              price: -250
            }
          ],
          vars: {
            order_id: '50314b8e9bcf000000000000',
            affiliation: 'Google Store',
            total: 27.5,
            revenue: 25,
            shipping: 3,
            tax: 2,
            discount: 2.5,
            coupon: 'hasbros',
            currency: 'USD'
          },
          email: 'testemail@gmail.com',
          send_template: 'test-send'
        });
      });
    });
  });
});