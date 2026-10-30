# Riichi / table

An offline-first Angular PWA for Japanese Riichi Mahjong scoring. It supports Mahjong Soul,
Tenhou, M.League and custom 3P/4P presets, live-table declarations, complete-hand calculation,
manual Han/Fu entry, records and player analysis. Optional ASP.NET Core services add shared
rooms and expiring QR/ID data transfers.

## Start locally

```powershell
npm.cmd ci
npm.cmd start
```

Open **http://localhost:4200**. For the optional backend, install .NET 10 and prepare the ignored
Development settings once from the credential-free example:

```powershell
Copy-Item apps/api/appsettings.Development.example.json apps/api/appsettings.Development.json
dotnet run --project apps/api
```

Keep an existing local settings file instead of overwriting it. The backend listens on
**http://localhost:5080**, with Swagger at **/swagger** in Development. Local development uses
SQLite when the database connection is empty; production uses SQL Server.

Frontend public settings are selected from `apps/web/config/development/config.json` or
`apps/web/config/production/config.json`. Set `backend.apiUrl` to connect the API, or leave it
empty for offline-only use. Never put private credentials in public frontend settings.

See [quick start](docs/guides/quick-start.md) for supported tooling, offline previews and configuration.

## Use the app

- Choose players and rules, then start a local or shared game. New games default to East-only;
  M.League is fixed to East + South.
- Others → Scoring mode offers **Assisted scoring** and **Manual Han entry**. Both retain Riichi,
  calls and Ron/Tsumo. Manual entry uses the final total Han/Fu without adding bonuses twice.
- Quick score calculates independently of saved matches. Live tables record declarations,
  settlements and editable hand history with later-hand replay.
- Others → Data imports/exports **CSV** and shares games through **QR/ID**. Server shares expire
  after 24 hours; JSON is internal to storage and APIs.
- Shared rooms use code/passcode or QR joining, host-controlled permissions and SignalR updates.
  The host browser processes declarations with the scoring engine and must remain open.
- English, Traditional Chinese, Simplified Chinese, Japanese and Korean are supported, with light/dark
  themes and saved sound preferences.

## Documentation

Start at the [documentation index](docs/README.md).

| Topic                 | Guide                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Playing and recording | [Live table](docs/guides/live-table.md), [records](docs/guides/records.md), [data transfer](docs/guides/data-transfer.md)                                    |
| Photo recognition     | [Providers, editable previews and storage](docs/guides/recognition-and-storage.md)                                                                           |
| Architecture          | [Angular](docs/architecture/frontend.md), [ASP.NET Core vertical slices](docs/architecture/backend.md), [shared rooms](docs/architecture/online-services.md) |
| Development           | [Maintenance](docs/development/maintenance.md), [verification status](docs/development/verification.md)                                                      |
| API                   | [Swagger, OpenAPI, Postman v1 and SignalR](docs/api/v1/README.md)                                                                                            |
| Deployment            | [Backend / MonsterASP](docs/deployment/backend.md), [frontend / GitHub Pages](docs/deployment/github-pages.md)                                               |
| Scope                 | [Feature coverage](docs/planning/feature-coverage.md), [rule verification](docs/rules/verification.md)                                                       |

## Repository

```text
apps/web/                   Angular frontend
apps/api/                   ASP.NET Core API and SQL Server migrations
apps/api.tests/             Backend unit/integration tests
packages/mahjong-core/       Tile identities, notation and ledger
packages/mahjong-rules/      Versioned rule presets
packages/mahjong-scoring/    Validation, Yaku/Fu, limits and payments
packages/mahjong-fixtures/   Deterministic test inputs
e2e/                        Playwright browser checks
docs/                       Guides, architecture, development, deployment and archives
```

Run `npm test` for Vitest, `dotnet test apps/api.tests --configuration Release` for backend
tests and `npm run docs:check` for local documentation links. Browser tests require a fresh build;
see [verification](docs/development/verification.md).

## Scope and attribution

The app records declarations; it does not simulate the wall or discard sequence. Players remain
responsible for timing, legal waits and accurate input. Browser storage is not permanent cloud
backup. This is an independent tool, not an official product of the rule platforms or detector.

Tile artwork: [FluffyStuff / CC0](apps/web/public/tiles/README.md) and [license](apps/web/public/tiles/LICENSE.md).
Audio sources: [call recordings](apps/web/public/sounds/ichihime/SOURCES.md) and [dice recording](apps/web/public/sounds/SOURCES.md).
Source/rights notes stay beside the bundled assets. The project has not selected an application license;
see the in-app License page and dependency notices for their separate scopes.
