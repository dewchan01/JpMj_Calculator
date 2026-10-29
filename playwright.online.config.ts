import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const apiContentRoot = resolve('artifacts', `online-test-${process.pid}-${Date.now()}`);
mkdirSync(apiContentRoot, { recursive: true });

process.env['RIICHI_API_TEST_URL'] = 'http://127.0.0.1:5089';
export default defineConfig({
  ...base,
  testMatch: [
    'dice-sound.spec.ts',
    'preferences.spec.ts',
    'room-permissions.spec.ts',
    'online-live.spec.ts',
    'online.spec.ts',
    'data-transfer.spec.ts',
    'table-flow-update.spec.ts',
  ],
  timeout: 60000,
  use: { ...base.use, serviceWorkers: 'block' },
  webServer: [
    ...(Array.isArray(base.webServer) ? base.webServer : base.webServer ? [base.webServer] : []),
    {
      command: `dotnet run --project apps/api --configuration Release --no-launch-profile -- --urls http://127.0.0.1:5089 --contentRoot "${apiContentRoot}"`,
      url: 'http://127.0.0.1:5089/api/health',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Testing',
        Cors__AllowedOrigins__0: 'http://localhost:4300',
        Serilog__MinimumLevel__Default: 'Warning',
      },
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
