import { defineConfig } from '@playwright/test';
import base from './playwright.config';

process.env['RIICHI_API_TEST_URL'] = 'http://127.0.0.1:5089';
export default defineConfig({
  ...base,
  testMatch: ['online-live.spec.ts', 'online.spec.ts'],
  timeout: 60000,
  use: { ...base.use, serviceWorkers: 'block' },
  webServer: [
    ...(Array.isArray(base.webServer) ? base.webServer : base.webServer ? [base.webServer] : []),
    {
      command: `dotnet run --project apps/api --configuration Release --no-launch-profile -- --urls http://127.0.0.1:5089 --contentRoot "${process.cwd()}/artifacts"`,
      url: 'http://127.0.0.1:5089/api/health',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Testing',
        Cors__AllowedOrigins__0: 'http://localhost:4300',
        Logging__LogLevel__Default: 'Warning',
      },
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
