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
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/perf/**',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    // L2-045: Lighthouse and the read-API load test, only with `npm run test:perf` (HEWN_PERF=1), never in a full run.
    ...(process.env['HEWN_PERF']
      ? [{ name: 'perf', testMatch: '**/perf/**/*.perf.spec.ts', use: { ...devices['Desktop Chrome'] } }]
      : []),
  ],
  webServer: [
    {
      command: 'pwsh ../eng/Start-E2eApi.ps1',
      url: 'http://localhost:5300/health/live',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
      // HEWN_E2E_API_LOGS prints the API's log (CI sets warnings and errors only), so a 500 says why.
      stdout: process.env['HEWN_E2E_API_LOGS'] ? 'pipe' : 'ignore',
    },
    {
      command: 'npm --prefix ../frontend start -- --port 4300 --proxy-config proxy.e2e.conf.json',
      url: appUrl,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
