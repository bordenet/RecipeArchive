// Basic unit test for popup.js
const { JSDOM } = require('jsdom');

describe('Chrome Extension Popup', () => {
  let window, document;
  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost' });
    window = dom.window;
    document = window.document;
    global.document = document;
    global.window = window;
    global.navigator = window.navigator;
  });

  it('should render main container on DOMContentLoaded', () => {
    // Simulate DOMContentLoaded
    require('../popup.js');
    const event = new window.Event('DOMContentLoaded');
    document.dispatchEvent(event);
    expect(document.getElementById('main-container')).not.toBeNull();
  });
});
