// Jest setup for Chrome extension tests
const { JSDOM } = require('jsdom');

// Setup jsdom environment for all tests
const dom = new JSDOM('<!DOCTYPE html><body></body>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

global.chrome = {
  runtime: {
    onInstalled: { addListener: jest.fn() },
  },
  tabs: {
    sendMessage: jest.fn(),
  },
};

global.localStorage = {
  store: {},
  getItem: function(key) { return this.store[key] || null; },
  setItem: function(key, value) { this.store[key] = value.toString(); },
  removeItem: function(key) { delete this.store[key]; },
  clear: function() { this.store = {}; },
};
