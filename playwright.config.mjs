import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'tests/e2e',
  testIgnore: process.env.REAL_OCR_QA==='1' ? [] : ['**/qa-real-ocr.spec.mjs'],
  timeout:60000,
  retries:0,
  use:{baseURL:'http://127.0.0.1:4175',browserName:'chromium',headless:true},
  webServer:{command:'python3 -m http.server 4175 --bind 127.0.0.1',port:4175,reuseExistingServer:!process.env.CI,timeout:20000}
});
