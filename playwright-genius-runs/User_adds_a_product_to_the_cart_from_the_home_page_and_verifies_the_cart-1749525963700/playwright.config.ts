
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 60 * 1000,
  expect: { timeout: 10 * 1000 },
  reporter: [['json', { outputFile: 'playwright-output/report.json' }]],
  use: {
    headless: true, // Set to true for server execution
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    baseURL: 'http://localhost:8080/',
  },
  projects: [ 
    { 
      name: 'chromium', 
      use: { 
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 }
      } 
    } 
  ],
  outputDir: 'playwright-output',
  testDir: '.',
  webServer: {
    command: 'echo "Using external server"',
    url: 'http://localhost:8080/',
    reuseExistingServer: true,
    timeout: 5000,
  },
};

export default config;
