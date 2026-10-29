# Quick start

Run commands from the repository root. Angular works without the optional backend; data stays in this browser's IndexedDB.

## Frontend

Install a supported Node version and the project dependencies. The installed Angular CLI declares its supported Node ranges in `node_modules/@angular/cli/package.json`; the Pages workflow pins Node 22.23.2.

```powershell
npm.cmd ci
npm.cmd start
```

Open `http://localhost:4200`. On Windows, use `npm.cmd` when PowerShell blocks `npm.ps1`.

For a production/offline preview:

```powershell
npm.cmd run build
npm.cmd run preview
```

The service worker runs only in production builds. Load the app online before using it offline. `npm run start:host` exposes development over the LAN; camera/PWA capabilities generally require HTTPS outside localhost. Regular production routes need an `index.html` fallback; [GitHub Pages](../deployment/github-pages.md) uses the dedicated hash-routing build instead.

## Optional backend

Install the .NET 10 SDK. Copy the safe Development example once:

```powershell
Copy-Item apps/api/appsettings.Development.example.json apps/api/appsettings.Development.json
dotnet run --project apps/api
```

Preserve an existing local Development file instead of overwriting it. The API listens at `http://localhost:5080`; Development uses local SQLite when `ConnectionStrings:Database` is empty. Health is `/api/health`, Swagger is `/swagger`, and OpenAPI is `/openapi/v1.json`.

Production uses SQL Server and explicit migrations. See [backend deployment](../deployment/backend.md) and [Postman/API v1](../api/v1/README.md).

## Public frontend configuration

| Build           | Source copied to the deployed `config.json` |
| --------------- | ------------------------------------------- |
| `npm start`     | `apps/web/config/development/config.json`   |
| `npm run build` | `apps/web/config/production/config.json`    |

Set `backend.apiUrl` to the API origin. An empty value disables online features. The same public file contains recognition, support email and developer-name settings. Never place private database credentials, room tokens or Seq ingestion keys here.

## Score a game

On My table, choose players, your viewing seat, rule preset and game length. New games default to East-only; M.League is fixed to East + South. Start match offers a local game or a shared game; shared games then offer Host or Join.

Others → Scoring mode offers **Assisted scoring** (full hand and validation, default) and **Manual Han entry** (final total Han/Fu, no complete hand required). Both keep calls, Riichi, Ron/Tsumo and rule-based payments. Manual Han already includes declarations and bonuses; it is not increased again automatically.

Quick score is independent of saved games. Use the tile palette, notation or photo preview; choose the winning tile and applicable declarations before calculating. In a live game, the table supplies dealer, round wind, Honba and escrow. History supports per-hand edits and later-hand replay where the saved metadata is sufficient.

See [table flow](live-table.md), [records](records.md), [CSV/QR transfers](data-transfer.md) and [recognition](recognition-and-storage.md) for details.

## Development checks

Git hooks are installed by `npm install` through Husky. Pre-commit checks staged files; pre-push runs Vitest and backend tests. Hooks can be bypassed, so CI remains the release check. Use `npm run prepare` to reactivate them in an existing checkout.

See [maintenance](../development/maintenance.md#verification) for check commands and [verification status](../development/verification.md) for what has actually been run.
