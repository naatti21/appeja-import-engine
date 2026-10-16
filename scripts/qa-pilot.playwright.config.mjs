import base from '../playwright.config.mjs';

// Reuse the existing real PDF.js/browser tests, with a fixed, explicit selection.
export default {
  ...base,
  testDir: '../tests/e2e',
  testMatch: 'semantic-review.spec.mjs',
  outputDir: '../test-results/qa-handoff-pilot',
  use: {...base.use, launchOptions: process.env.QA_CHROMIUM_EXECUTABLE
    ? {executablePath: process.env.QA_CHROMIUM_EXECUTABLE} : {}},
  webServer: {...base.webServer, cwd: new URL('../', import.meta.url).pathname, reuseExistingServer: false},
};
