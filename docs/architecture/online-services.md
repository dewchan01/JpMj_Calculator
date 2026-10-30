# Online sharing and room access

The existing Angular app remains offline-first. `apps/api` is a separate ASP.NET Core 10
service; production uses SQL Server, while development and integration tests use SQLite.
No account registration is required. Frontend and backend deploy independently.

Backend operations use [vertical slices](backend.md): each room, game or sharing operation owns its endpoint, request and handler. Shared persistence, configuration and logging live under `Infrastructure`. Backend tests use MSTest, FluentAssertions and Moq.

Development/Testing exposes Swagger at `/swagger` and OpenAPI at `/openapi/v1.json`. Import the [Postman v1 package](../api/v1/README.md) to test local or production HTTP endpoints. These additions do not require another database migration.

Backend logs use Serilog with optional Seq shipping, configured by `Seq__ServerUrl` and `Seq__ApiKey`. Request events use route templates and correlation IDs rather than concrete share IDs or credentials. See [logging and cloud configuration](../development/backend-logging.md).

## Sharing and room access

- Others > Data links to Import, Export and Share history pages with Back navigation. Export downloads CSV or opens a separate sharing prompt with QR and transfer ID. JSON remains internal.
- A QR or transfer ID opens the import preview. Archives remain in the database for 24 hours even after importing, then expire; no temporary browser cache is used. Import validates the archive and skips existing IDs.
- Shares have random 256-bit identifiers and separate deletion secrets. Only the deletion-secret hash is saved.
- The deletion secret is retained in this device's Share history, scoped by API URL. Reopen an active transfer to view its QR or revoke it; expired entries are pruned locally.
- Maximum archive size is 5 MiB, with a transactional 50 MiB global quota. Expired archives are denied immediately and reclaimed on uploads.
- Start match > Start shared game opens Host game / Join game choices, followed by a stacked room prompt. Ordinary Start game stays offline.
- The room panel displays the ID and passcode with per-field copy buttons, without a URL field. The QR encodes a versioned room invitation including its code and passcode; scanning automatically joins and opens the table. Manual code/passcode entry and older code-only QR images remain supported. Anyone with the invitation image can join. Host passcodes survive reloads in sessionStorage on the creating tab and are cleared when forgetting access.
- Players enter the PIN and are assigned a free seat automatically. Duplicate seat claims are rejected.
- Random host/seat tokens are stored in this browser's localStorage, scoped by API URL, to support reloads. Clearing site data loses them.
- The server stores token hashes and a PBKDF2 hash of the PIN. The server cannot recover the PIN; the creating tab retains it in sessionStorage for reloads.
- Hosts can release seats and close rooms. Rooms expire after 24 hours. Every room-state request verifies current access.
- SignalR sends game-change notifications and host-only presence snapshots. Join returns the initial host presence snapshot. Clients refetch changed game state, rejoin on reconnection, and can manually reconnect after retries are exhausted. Connected rooms do not use regular game polling.

## Live room tables

See [shared table permissions and scoring flow](room-permissions.md) for host-only capability switches, per-device viewing angles, mandatory normal-mode indicators and local final-result choices. This update requires the `RoomPermissions` database migration.

1. Choose players, your player, rules and game length on My table, then Start match > Start shared game > Host game. Hosting reuses those choices without another setup prompt. Joined games use the host settings.
2. **Host game** creates the waiting room with its player names and host seat, then shows its QR invitation. **Start game** attaches the prepared game and opens the table. The invitation panel scrolls QR/credentials separately while keeping expiry/actions at the bottom with space after the player chips. Seat numbers follow the player order.
3. Other devices enter the room code and PIN, receive a free seat automatically, and enter the table directly. Guests waiting for the host see a waiting message rather than host invitation controls.
4. Keep the host's room table open. Players can declare their own Riichi/Double Riichi, cancel their
   own Riichi, record Chi/Pon/Kan/Kita, and submit Ron/Tsumo using the Assisted scoring or Manual Han entry.
5. The host automatically processes non-winning declarations with the existing TypeScript rules engine.
   Guest winning hands appear in the winning-declarations dialog for settlement. The host's own winning preview settles directly, combining pending Ron on that hand. The existing multiple-Ron rules determine payments and progression.
6. The host controls indicators, corrections, draw settlement, historical hand editing and closing the game by default. Independent capability switches can delegate indicators, settlement, history and finishing. The API restricts delegated changes to their operation and preserves game identity, rules and player identities.
   Ongoing host commits save a local backup. On ending, each device chooses whether to save or discard its own copy.

Commands are persisted before processing, bound to the authenticated seat and current hand, and use stable
IDs so network retries cannot apply them twice. Table commits compare database revisions. If two host tabs
process the same queue, only one revision commits. The loser refreshes instead of overwriting the winner.
Changing hands rejects unfinished commands for the old hand; revoking a seat rejects its pending commands.
Connected rooms refresh only on SignalR invalidation. A 2.5-second polling fallback runs while the hub is disconnected or reconnecting, and stops after the room group is rejoined. Initial connection and reconnects refetch authoritative state; notifications received during synchronization queue another refresh.

**The host browser must remain open to process declarations and calculate scores.** If it sleeps or disconnects,
requests remain pending in the database until it reconnects. This reuses the tested TypeScript scoring engine;
the C# API enforces credentials, seat ownership, revisions and persistence, but does not independently verify
the host's Mahjong calculations. This is a trusted-host casual table, not a competitive anti-cheat server.

Rooms expire after 24 hours, including their pending actions. Keep/export the host's local records. Permanent
accounts and cloud backups are deferred by agreement. The logical storage quota covers archives, room
snapshots and action payloads together. Each room retains at most 512 action receipts; each credential can
have at most eight pending actions. Open a new room when the room reaches its action limit.

## Local development

From the repository root (PowerShell):

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project apps/api --urls http://localhost:5080
```

Run `npm.cmd start` in a second terminal. Angular automatically selects
`apps/web/config/development/config.json`, pointing to `http://localhost:5080`.
Production builds select `apps/web/config/production/config.json`, pointing to
`https://jpmj.runasp.net`. Both are emitted as `config.json` at the frontend root.
Set `backend.apiUrl` to an empty string to disable online features; offline scoring remains available.
Recognition settings, support email and developer name live in the same environment files.
Development data is in ignored `apps/api/App_Data/riichi.db`.

```powershell
dotnet test apps/api.tests/Riichi.Api.Tests.csproj
npm.cmd run build
npm.cmd run e2e -- e2e/online.spec.ts
npm.cmd run e2e -- --config playwright.online.config.ts
```

The API integration tests exercise SQLite, not hosted SQL Server. Hosted database migration,
HTTPS, WSS, idle restart and production origin checks require deployment verification.

## MonsterASP.NET deployment

API defaults live in `apps/api/appsettings.json`; `appsettings.Development.json` overrides them for local runs. The development launch profile sets Development and port 5080. Published hosting defaults to Production. Environment variables override the JSON values: `ConnectionStrings__Database` maps to `ConnectionStrings.Database`, while `Cors__AllowedOrigins__0` maps to the first allowed frontend origin. Store the production database password in the hosting variable or server-only JSON, not Git. `appsettings.Local.json` is no longer loaded. Frontend settings remain public: backend.apiUrl, recognition and support settings belong in config.json, but database credentials and server-only secrets do not.

1. Create a .NET 10 website and a dedicated SQL Server database. Enable HTTPS and WebSockets.
2. Configure `ConnectionStrings__Database` securely in the hosting environment. Never commit credentials.
3. The base JSON allows `https://dewchan01.github.io`; override `Cors__AllowedOrigins__0` only if your frontend origin differs.
   Origins do not include a repository path. The client does not send cookies; CORS permits credentials
   for SignalR-compatible hosting, but only explicitly listed origins.
4. Generate/review an idempotent migration script, then apply it with database deployment credentials:

   ```powershell
   dotnet tool restore
   dotnet ef migrations script --idempotent --project apps/api --output artifacts/online-schema.sql
   dotnet publish apps/api -c Release -o artifacts/api
   ```

   Alternatively run the published API with `--migrate` using deployment credentials. Normal production
   startup never modifies the schema. SQLite development databases use `EnsureCreated`, not SQL Server migrations.

5. Upload `artifacts/api` to the IIS website using the host's supported deployment method.
6. Set `backend.apiUrl` in `apps/web/config/production/config.json` to the HTTPS API origin, build and deploy the frontend.
   GitHub Pages uses the existing hash-routing build and repository base href. Generated QR links
   use Angular's active location strategy, so they work with both hash and normal routes.
7. Verify `/api/health`, upload/import/revoke, two-device seat joining, PIN throttling,
   seat release, reconnect after recycle, and expiry before enabling access publicly.

The backend workflow builds/tests and produces an IIS publish artifact; it does not deploy or contain secrets.
Free hosting may suspend the API. The lobby reconnects; offline Mahjong remains usable independently.
Do not cache `/api/*` through a proxy/service worker. Do not log Authorization, PIN bodies, deletion
headers, or share URLs. Share links are bearer access to private game/player data.

## HTTP contracts

| Method | Path                             | Access                                                                       |
| ------ | -------------------------------- | ---------------------------------------------------------------------------- |
| POST   | `/api/shares`                    | JSON archive body; returns ID, expiry, deletion secret                       |
| GET    | `/api/shares/{id}`               | Random share ID; downloads JSON                                              |
| DELETE | `/api/shares/{id}`               | `X-Deletion-Secret`                                                          |
| POST   | `/api/rooms`                     | `{ playerCount: 3 or 4 }`; returns code, PIN, host token                     |
| POST   | `/api/rooms/{code}/join`         | `{ pin }`; optional zero-based seat for API clients, auto-assigned by the UI |
| GET    | `/api/rooms/{code}`              | Bearer host or current seat token                                            |
| DELETE | `/api/rooms/{code}/seats/{seat}` | Bearer host token                                                            |
| DELETE | `/api/rooms/{code}`              | Bearer host token                                                            |

Game endpoints use the same room credentials:

- `GET /api/rooms/{code}/game`: snapshot plus pending and recent action receipts.
- `POST /api/rooms/{code}/game/actions`: seat action `{ id, handKey, kind, payload }`; host may specify a seat.
- `PUT /api/rooms/{code}/game`: expected revision, snapshot and action decisions; host or explicitly authorized delegate, with operation-specific validation.
- `PUT /api/rooms/{code}/permissions`: host-only independent capability switches.

`/hubs/rooms` accepts `Join(code, token)` once per connection and emits `Changed` without payload. Hosts also receive `{ version, seats }` through the Join return value and `Presence` events; participants receive no other-player presence roster.
Clients reauthorize on each state fetch. Released connections may receive non-sensitive invalidation
notifications until disconnected but cannot retrieve room data. There is no arbitrary broadcast method.
Rate limits are per server-process IP: 120 requests/minute generally and 10/minute for room creation/join.
They reset on process recycle and are not a distributed abuse-control system. Configure trusted proxy
forwarding only for the actual host topology; never trust an arbitrary client-supplied forwarded IP.

The room panel shows a connection chip at the upper right and omits the seat roster. Close room and Open room table share one row, with Close on the left. Copy uses an accessible icon beside each field. Room panels and shared tables use a reusable color-coded pulse with a translated tooltip for connection state; expiry is highlighted. Shared table routes hide navigation and use the full-width game workspace, like local table routes. The join form only asks for room code and passcode; the server assigns a free seat.

Shared tables fill the game workspace like local tables, with only the additional room-status row consuming vertical space; minimum table height still prevents control clipping on short screens.
