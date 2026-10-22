import { defineConfig, devices } from '@playwright/test';
process.env['PLAYWRIGHT_BROWSERS_PATH'] ??= `${process.cwd()}/.playwright`;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4300',
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
