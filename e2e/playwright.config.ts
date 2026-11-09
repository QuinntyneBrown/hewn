import { defineConfig, devices } from '@playwright/test';

/** Dedicated ports so the suite never reuses another dev server (4200/5200 are for local development). */
const appUrl = 'http://localhost:4300';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: appUrl,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
  webServer: [
    {
      command: 'pwsh ../eng/Start-E2eApi.ps1',
      url: 'http://localhost:5300/health/live',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
      stdout: 'ignore',
    },
    {
      command: 'npm --prefix ../frontend start -- --port 4300 --proxy-config proxy.e2e.conf.json',
      url: appUrl,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
