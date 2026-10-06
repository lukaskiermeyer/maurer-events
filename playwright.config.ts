import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/browser-report.json' }]],
  use: { baseURL: process.env.ACCEPTANCE_URL || 'http://localhost:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{name:'chromium',use:{...devices['Desktop Chrome']}}, {name:'mobile',use:{...devices['Pixel 7']}}],
});
