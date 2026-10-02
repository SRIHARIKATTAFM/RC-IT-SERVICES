import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.PHASE20_16_BASE_URL || '';
const localBaseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests',
  testMatch: /phase20-16-cross-browser-accessibility\.spec\.mjs/,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 3 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'playwright-report-phase20-16', open: 'never' }]] : 'line',
  use: {
    baseURL: externalBaseURL || localBaseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  webServer: externalBaseURL ? undefined : {
    command: 'npm run build && node scripts/serve-phase18-preview.mjs',
    url: localBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [
    { name: 'mobile-chromium-390', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop-firefox-1280', use: { browserName: 'firefox', viewport: { width: 1280, height: 800 } } },
    { name: 'tablet-webkit-768', use: { ...devices['iPad Mini'], viewport: { width: 768, height: 1024 } } }
  ]
});
