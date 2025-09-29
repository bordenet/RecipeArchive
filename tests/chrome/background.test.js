// Basic unit test for background.js

describe('Chrome Extension Background Script', () => {
  beforeAll(() => {
    global.chrome = {
      runtime: {
        onInstalled: { addListener: jest.fn() },
      },
    };
  });
  it('should be defined and executable', () => {
    expect(() => require('../background.js')).not.toThrow();
  });
});
