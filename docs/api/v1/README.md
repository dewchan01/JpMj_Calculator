# Riichi API v1

Import `Riichi-v1.postman_collection.json` and choose either the Local or Production environment. The Local environment points to `http://localhost:5080`; Production points to `https://jpmj.runasp.net`. No credential values are included.

Run the collection against a test backend first. It creates its own four-player sample room, reserves the host seat, joins a player, submits an action, changes capabilities, transfers an archive, and cleans up the room/share. Response scripts retain generated credentials only in your Postman collection variables. Do not commit or share an export containing those generated credentials.

The API does not calculate scores. The snapshot commit example resends the latest snapshot unchanged; a real settlement must supply the client-calculated match and action decisions. Keep the host browser open to process normal player declarations. A revision conflict requires reading the latest game again before retrying a commit.

## Local Swagger / OpenAPI

```powershell
dotnet run --project apps/api
```

- Swagger UI: `http://localhost:5080/swagger`
- OpenAPI v1: `http://localhost:5080/openapi/v1.json`

`openapi.json` is the exported v1 contract snapshot and can also be imported into Postman.

Documentation routes are enabled only in Development/Testing. They are absent on the production host; Postman can still call the production API. Existing application routes remain `/api/...`, without a new URL prefix.

Bearer auth uses a room host token or occupied-seat token. Archive revocation uses the independent `X-Deletion-Secret` header. Room creation/join, health, share creation and share download do not use Bearer auth.

## SignalR

Before starting a game, `POST /api/rooms` accepts optional ordered `playerNames` along with
`playerCount` and `hostSeat`. The authenticated lobby response includes `playerNames` and occupied
`seats`. A joined guest can `PUT /api/rooms/{id}/player` with `{ "seat": 2 }` and their seat Bearer
token to choose a free, zero-based player index. It returns 204; invalid indexes return 400,
invalid credentials return 401, host credentials return 403, and occupied seats or changes after
game start return 409. Existing credentials remain valid after a move; reconnect the hub to update
presence. These changes use the existing snapshot storage and require no database migration.

`Join` returns the initial `{ version, seats }` presence snapshot to the host, or null to participants, in addition to subscribing the connection to events.

Use the SignalR client against `/hubs/rooms`, then invoke `Join(roomId, token)`. Rejoin after reconnecting. `Changed` means refetch the versioned room/game state. Host connections also receive `Presence` objects with `{ version, seats }`, containing authenticated online seat indexes only. Presence does not increment the game revision or require polling. A seat stays online while any of its connections remain; abrupt network loss may remain visible until SignalR detects the disconnect. Presence is process-local for the current single-instance hosting model.

## Updating this package

```powershell
node scripts/generate-api-postman.mjs
```

The generated collection is version 1.0.0 in Postman collection format 2.1. Regenerate it after changing the documented requests, and keep real secrets out of the saved environments. The release ZIP is generated at `artifacts/riichi-postman-v1.zip`.
