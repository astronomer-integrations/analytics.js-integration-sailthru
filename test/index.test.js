'use strict';

var Analytics = require('@segment/analytics.js-core').constructor;
var integrationTester = require('@segment/analytics.js-integration-tester');
var sandbox = require('@segment/clear-env');
var Sailthru = require('../lib/');
var integration = require('@segment/analytics.js-integration');

describe('Sailthru', function() {
  var analytics;
  var sailthru;
  var options = {
    customerId: 'AJ1WTFKFAMAG8045ZXSQ9GMK',
    apiKey: 'asdfasdfasdf',
    apiSecret: 'asdfasdfasd'
  };

  beforeEach(function() {
    analytics = new Analytics();
    sailthru = new Sailthru(options);
    analytics.use(Sailthru);
    analytics.use(integrationTester);
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
      .option('customerId', '')
      .option('apiKey', '')
      .option('apiSecret', ''));
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

    it('should call _integration', function() {
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
        done();
      });
    });

    describe('identify', function() {
      it('shoulld sign up user', function() {
        var traits = {
          key : '123',
          email: 'jonny@gmailtest.com',
          lists : { testing1: 'asdf', testing2 : 'asdf' },
          vars : { },
          source : 'home'
        };
        analytics.identify('johny1234', traits);
        analytics.called(sailthru._integration, 'userSignUp', {
          id: 'johny1234',
          key : '123',
          email: 'jonny@gmailtest.com',
          lists : { testing1: 'asdf', testing2 : 'asdf' },
          vars : { },
          source : 'home'
        });
      });
    });

    describe('track', function() {
      it('should create a custom event', function() {
        var props = {
          id : 'john1234',
          email : 'jonny@gmailtest.com',
          vars: {
            lemon: 'tester'
          }
        };
        analytics.track('someReallyUseFulEvent', props);
        analytics.called(sailthru._integration, 'customEvent', {
          id: 'john1234',
          email: 'jonny@gmailtest.com',
          vars: {
            lemon: 'tester'
          },
          name: 'someReallyUseFulEvent'
        });
      });
    });
  });
});
