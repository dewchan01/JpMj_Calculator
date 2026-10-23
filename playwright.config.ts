import { defineConfig, devices } from '@playwright/test';
process.env['PLAYWRIGHT_BROWSERS_PATH'] ??= `${process.cwd()}/.playwright`;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4300',
    // Dedicated install tests use empty storage; general flow tests skip the reminder.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:4300',
          localStorage: [{ name: 'riichi-install-reminder-hidden', value: 'true' }],
        },
      ],
    },
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node node_modules/http-server/bin/http-server dist/web/browser -p 4300 -c-1',
    url: 'http://localhost:4300',
    reuseExistingServer: !process.env['CI'],
  },
  reporter: 'list',
});
