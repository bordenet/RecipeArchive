const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './extension-tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['html'], ['list']],
  use: {
    headless: false,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chrome-extension',
      use: {
        channel: 'chrome',
      },
    },
  ],
});
