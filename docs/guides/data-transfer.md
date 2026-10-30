# Game data transfer

Open Others > Data, then choose Import data, Export data or Share history. Import and Export are routed pages with sticky Back-button headers. Export actions stay together in one row on phones. Files use CSV; JSON stays internal to storage and APIs. Table-history downloads also use CSV. Filter whole games by player and inclusive local dates, then select individual games. A player filter includes every participant and settlement; it never splits the ledger.

CSV transfers retain complete rules, players, hand history, tiles and manual Han/Fu metadata. Each row describes a typed field with `game_id`, `game_name`, `created_at`, `path`, `type` and `value` columns. Paths use JSON Pointer escaping; cell values are CSV rather than embedded JSON documents. Container rows preserve arrays and empty objects. Import expects this application's CSV schema, not arbitrary spreadsheet score sheets. UTF-8 BOM, quoted multiline cells and spreadsheet formula escaping preserve text safely. Files are limited to 20 MiB and 10,000 games. Malformed, duplicate and unsafe paths are rejected. Imports validate and reconcile payments before inserting selected new IDs transactionally; existing IDs are skipped without replacing local changes.

Import accepts a camera photo/QR image, a transfer ID or a CSV file. QR/ID lookup opens the game-selection preview. Share selected games opens a separate prompt above the Export page, with Back navigation, a QR, copyable transfer ID and expiry; no URL is shown. Share history lists this device's active transfers and regenerates their QR codes after navigation or reload. The QR contains a versioned ID, not the full game data. Older share URLs remain readable internally for compatibility. Importing does not populate the independent saved-player library.

The import QR action opens the shared live-camera scanner, with an image-selection fallback.
Recognition opens the transfer preview; it does not import games without review. Camera access
requires HTTPS or localhost and browser permission. Closing the scanner stops its camera tracks.

Shared archives stay in the backend database for 24 hours, including after imports. Expired archives cannot be downloaded and are reclaimed on subsequent backend uploads/room creation. They are not consumed on import, and no temporary 24-hour browser cache is used. Imported games remain in normal local records until deleted. Anyone with the transfer ID can access the archive until expiry or explicit revocation. Shares are limited to 5 MiB with a global quota. Share history saves IDs, expiry, game count/title and revocation secrets locally, scoped by backend URL. The latest 100 active transfers are retained; expired entries are pruned when loading history and while the page is open. Revoking removes both the server archive and its local history entry. No game payload is duplicated in share history.

Successful revocation closes the share prompt; failed requests keep it open with the error.
Imports deduplicate games by game ID; existing games are skipped and never rewritten. The preview
lets users match each incoming player to an existing or another incoming identity. Matching
`profileId` values refer to the same person; different IDs remain separate by default even when names
match. Explicit matching also supports different names. Mapping affects only newly imported games,
preserves historical names, seat IDs, payments and hand history, and does not populate the saved-player
library. Cycles and assigning two seats in one game to the same person are rejected.

Analytics, comparisons and participant filters use identity IDs. Legacy records without `profileId`
receive a stable game-and-seat identity, so unrelated `p0` seats or matching names are not silently
combined. Users can explicitly match these identities during import. Older share URLs redirect to
the same import preview and matching controls.
