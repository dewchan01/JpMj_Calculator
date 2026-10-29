# Feature coverage

Implementation summary refreshed from the repository on **2026-10-29**. Platform rule-source
review dates remain in [rule verification](../rules/verification.md); this is not a new external rule audit.

## Scoring and records

| Area         | Current implementation                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Rules        | Mahjong Soul, Tenhou and custom 3P/4P; M.League 4P with a fixed East + South game                                                |
| Entry modes  | Assisted scoring with complete-hand checks; Manual Han entry with final Han/Fu, optional Yakuman/Pao/chips                       |
| Score engine | Yaku, Fu, Dora/Ura/Aka/Kita, limits, highest-paying supported interpretation and profile-specific liability                      |
| Calls        | Chi/Pon/open, concealed and added Kan; physical IDs and original Pon chronology retained                                         |
| Declarations | Direct Riichi, separate Double Riichi below concealed Kan in player actions, Ron/Tsumo, eligible North extraction                |
| Indicators   | Direct Dora sheet; normal-mode Kan/settlement checks; Ura only for Riichi/Double Riichi winners                                  |
| Outcomes     | Ron/Tsumo, multiple Ron, exhaustive/allowed abortive draws and Nagashi; saved rule-based progression                             |
| Results      | Raw points, point score, Uma, first-place Oka, signed totals, chips and optional money conversion                                |
| History      | Compact expandable rows; canonical per-winner result avoids mirrored duplicates; displayed limit names including legacy fallback |
| Editing      | Per-hand replacement and transactional later-hand replay where metadata permits; separate final-point/date correction            |

## Interface and local data

| Area                | Current implementation                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Languages/themes    | English, zh-TW, zh-CN, ja; native names preserved; regular/dark tile faces and matching surfaces                        |
| Table view          | Chosen player below; local clockwise/counterclockwise rotation via Game menu → Adjust view; panel stays open            |
| Player library      | Search/sort/filter, independently scrolling incremental list, floating add and stacked creation prompt                  |
| Tile entry          | Shared palette/notation/photo inputs; selected-tray dragging, click removal and keyboard alternatives                   |
| Recognition         | Roboflow browser worker, configured JSON API or explicit mock; editable photo preview with confidence following reorder |
| Records/analysis    | Completed records, ongoing games on My table, result/history/details and recorded-hand player statistics                |
| Transfer            | Routed CSV import/export and QR/ID transfer; game/player/date filtering; duplicate IDs skipped atomically               |
| Storage             | IndexedDB games/drafts, timestamp conflict checks and ledger reconciliation; no permanent account backup                |
| Sound               | Bundled call and dice recordings, mute preference and playback fallback                                                 |
| Responsive controls | Mobile sheets or appropriate centered prompts; sticky gutters, reduced-motion support and sliding segmented selection   |
| Navigation          | Router top policy plus in-page tab/filter scroll handling; Pages-specific hash routes                                   |
| Diagnostics         | Local in-memory classified/redacted log, at most 200 entries; no frontend log upload                                    |
| Offline             | Production service worker caches app, tile assets and audio; recognition may still need network                         |

## Online backend

| Area            | Current implementation                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Hosting         | ASP.NET Core 10 vertical slices; SQL Server production, SQLite development/testing                                    |
| Rooms           | Code/PIN, hashed host/seat credentials, auto-assignment, host close/release and 24-hour expiry                        |
| Synchronization | SignalR change and host-presence events; initial Join snapshot; disconnected fallback polling                         |
| Presence        | Verified self-connection, known peers online/offline, gray unavailable state; no game revision increment for presence |
| Permissions     | Independent host-managed capabilities, enforced by API and reflected in Angular                                       |
| Settlement      | Host browser evaluates declarations; persisted deduplication, hand-key and revision checks                            |
| Shares          | JSON archive transport internal to API; 24-hour database retention, quota, separate revocation secret                 |
| Diagnostics/API | Serilog + optional Seq; local Swagger/OpenAPI v1; versioned Postman package                                           |

## Remaining scope

Permanent accounts, long-term cloud backup/user-ID QR lookup, full wall/discard timing,
automatic photo-to-meld assignment, image crop/rotation/merging, formal platform replay
certification, team/league standings, local nonstandard Yaku and referee/chombo workflows are
not implemented. Presence is process-local for a single backend instance. Real-device Safari/Android
and representative physical-photo accuracy remain separate verification work.

Current check results and commands live in [verification status](../development/verification.md),
not in this inventory. [Historical reports](../archive/2026-10-23-verification.md) are dated evidence only.
