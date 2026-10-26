# JSON game transfer

Open Others > Data, then choose Import JSON or Export JSON. Import previews a chosen file; Export selects local games. Filter by player and inclusive local game dates, then select individual games. Player filtering includes the complete game with every participant and settlement; it never splits a ledger.

Archives use `{ "format": "riichi-table", "version": 1, "exportedAt": "ISO timestamp", "matches": [] }`. Each match retains its existing schema version, ID, players, saved rules, scores and history. Imports validate the archive and reconcile payments before writing. Selected new IDs are inserted in one database transaction; existing IDs are skipped without replacing local changes. Files are limited to 20 MiB and 10,000 games.

This is local JSON transfer. Account databases, synchronization and QR lookup by user ID are future integrations; the archive version and stable game IDs provide their migration boundary.
