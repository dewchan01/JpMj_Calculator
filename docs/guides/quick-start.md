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

## Background music

See [music titles](music-titles.md) for the verified English, Chinese, Japanese, and Korean names of all bundled tracks.

Open **Music settings** from the desktop header, the room waiting area, or the in-game menu. The same controls are also available under **Others > Sound effects**. Choose a lobby theme, a game track, and a riichi track; game and riichi selections also support Random. Background music and sound effects have independent mute buttons. The volume slider controls music only: zero mutes music, and unmuting restores its previous nonzero volume. Action sounds keep their own saved setting. Playback begins after an interaction with the page. Preferences stay on this device and do not change other room members' audio or require host permission.

Review **Others > Terms and conditions** for local storage and online sharing information, and **Others > License** for asset sources and notices. Export a backup before clearing local records or all local data. Clearing browser data does not delete copies already sent to a room server or share link. Obtain other players' permission before sharing their information.

The repository does not specify an application license or document redistribution permission for the included Mahjong Soul music, character recordings or dice recording. Source notices record provenance; they do not grant permission. Confirm the necessary rights before distributing these assets. Tile artwork and icon licenses are listed separately in the app.

During a game, the selected game track plays, or Random chooses from Game, Game Master, and 23ex Duiju1–4. Any player's riichi declaration switches to the selected riichi track (or a random choice from the nine Liqi tracks and Yichujifa) for the rest of the hand; the next hand restores normal game music. Changing the current scene's track takes effect immediately. Leaving the table or finishing the match restores the selected lobby theme. Music pauses while the page is hidden. Tracks are cached as played, without downloading the whole music collection during app installation.

## Development checks

Git hooks are installed by `npm install` through Husky. Pre-commit checks staged files; pre-push runs Vitest and backend tests. Hooks can be bypassed, so CI remains the release check. Use `npm run prepare` to reactivate them in an existing checkout.

See [maintenance](../development/maintenance.md#verification) for check commands and [verification status](../development/verification.md) for what has actually been run.
