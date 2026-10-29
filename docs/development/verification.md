# Verification status

Last recorded local runs: **2026-10-29**. These results describe the tested working tree, not a successful production deployment or a new full-browser-suite certification.

| Check                                 | Latest recorded result                                                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest application/domain tests       | 293 passed in 29 spec files                                                                                                                           |
| ASP.NET Core tests                    | 37 passed; includes configuration, lobby selection, concurrent-seat protection and draw-only authorization                                            |
| Angular production build              | Passed                                                                                                                                                |
| TypeScript typecheck                  | Passed                                                                                                                                                |
| Backend Release publish               | Passed; private Development JSON and its template excluded                                                                                            |
| Focused Chromium checks               | Passed for the affected record layouts, room permissions/presence, navigation, dice audio, photo-preview interactions, themes and scoring preferences |
| Entire current Playwright suite       | Not rerun as one complete suite; focused passes do not imply this                                                                                     |
| Current GitHub Actions run            | Must be verified in GitHub after pushing the changes                                                                                                  |
| Real phones and production SQL Server | Separate deployment/device verification is still needed                                                                                               |

Historical test numbers remain in [archived reports](../archive/2026-10-23-verification.md). Do not use them as current release evidence.

Shared-toast checks passed for update results, CSV transfers, online notices, modal layering,
dismissal and rule-save feedback. The older full `e2e/settings.spec.ts` run still fails on legacy
hold-help behavior, a navigation locator matching a hidden setup dialog, and the old win-entry
helper. Its focused rule-save/validation replacement in `e2e/toast.spec.ts` passes; do not count
the full settings suite as green.

## Repeat the checks

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run docs:check
dotnet test apps/api.tests/Riichi.Api.Tests.csproj --configuration Release
dotnet publish apps/api/Riichi.Api.csproj --configuration Release --output artifacts/api
```

For browser checks, build first, install Chromium once, then select the relevant suite:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.playwright"
npx.cmd playwright install chromium
npm.cmd run e2e
npm.cmd run e2e -- --config playwright.online.config.ts
```

The normal suite serves the production build on port 4300. The online configuration starts an isolated Testing API with its own SQLite data. These checks use Chromium and do not certify Safari or every physical-tile recognition scenario.

Backend CI uploads TRX files under the `backend-test-results` artifact, even when tests fail. `A total of 1 test files matched...` reports assembly discovery; read the failing test and assertion beneath it for the cause.
