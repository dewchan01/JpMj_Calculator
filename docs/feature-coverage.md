# Feature coverage

Implementation inventory checked against the repository on 2026-10-26. Source-review dates in
[rule verification](rule-verification.md) are historical; this inventory is not a new platform audit.

## Rules and settlement

| Area                | Current implementation                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Presets             | Mahjong Soul, Tenhou and Custom in 3P/4P; M.League in 4P                                                                                |
| Standard scoring    | Yaku, Fu, Dora/Ura/Aka/Kita, limits, highest-payment interpretation, standard Yakuman and special waits                                 |
| First-turn wins     | Tenhou/Chiihou declarations; uninterrupted-first-draw circumstances remain user supplied                                                |
| Riichi and outcomes | Direct ordinary Riichi from the player box; separate Double Riichi and Ron/Tsumo actions in the player prompt, with existing validation |
| Calls               | Chi/Pon/Kan, source/called tile, original order and Kakan provenance; physical-copy validation                                          |
| Pao                 | Profile-specific original-call liability; composite and rare-edge replay certification remains incomplete                               |
| Multiple Ron        | Same context/discard, combined inventory, head-bump/triple-abort policy and single pot/honba allocation                                 |
| Draws               | Exhaustive, declared abortive and Nagashi settlement subject to the saved preset                                                        |
| Progression         | Dealer/Honba/winds, extension, bankruptcy, first-place dealer finish and final escrow policy                                            |
| Final table results | Raw/converted points, Uma/Oka, signed total score, rounding, chips and optional money conversion                                        |
| Corrections         | Final point/date editor conserves total points and appends an auditable scoreAdjustment event                                           |
| Not implemented     | Local/nonstandard Yaku, chombo/referee penalties, account ranks and league/team standings                                               |

## Application

| Area                 | Current implementation                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Languages            | English, zh-TW, zh-CN and ja; dates follow the selected locale; player names remain unchanged                                      |
| Manual tiles         | Palette/notation/photo preview, winning-tile selection, reorder, keyboard alternatives, undo/redo and direct meld/North assignment |
| Live tables          | Timer, pause/resume, calls/Riichi/Kita, indicators, dice, display-only seat swaps and point differences                            |
| Player library       | Search, sort/filter, independently scrolling incremental list, floating + and stacked creation prompt                              |
| Responsive controls  | Mobile home/filter sheets animate; desktop uses centered prompts; reduced motion is respected                                      |
| Navigation           | Shared sticky gutters; new tabs/filter chips reset scrolling; cancel/delete controls use shared styles                             |
| Records              | Completed games only; whole cards open results. Ongoing games resume from My table                                                 |
| Result-only entry    | Final points and local game date without fabricated hands                                                                          |
| Results              | Result/History/Details, compact comparison tables, expandable event details, metric/player filtering and PNG sharing               |
| Player analysis      | Rank trend/histogram, basic and conditional rates, win/deal-in scores, stability, chemistry, comparison and seat analysis          |
| M.League resemblance | Offline versioned eight-player reference; descriptive similarity, not live data or a skill rating                                  |
| Storage              | IndexedDB matches/drafts, optimistic timestamp checks, ledger reconciliation and storage estimates                                 |
| JSON transfer        | Separate Others > Data import/export, game/player/date selection, validated atomic insertion, duplicate IDs skipped                |
| Diagnostics          | Developer-brand triple-click opens up to 200 session navigation/error entries; no log persistence/upload                           |
| Recognition          | Configured Roboflow browser worker, JSON API or offline mock; editable independent target previews                                 |
| Offline              | Production service worker caches application/artwork; recognition network/model requirements remain separate                       |

Each recorded hand with a round snapshot can be re-entered from live-table History; later hands are replayed atomically. Missing later scoring metadata or contradictory progression blocks saving. Latest-event undo and final-score corrections remain distinct.
Existing table names/seating are not editable as a general post-creation editor. Missing historical
hand metadata is unavailable rather than assumed false. Rates are based on recorded hands, not a
full wall/discard simulator. M.League resemblance has minimum sample/metadata requirements.

## Validation and remaining work

The latest completed unit run has **230 passing tests in 19 Vitest spec files**. Lint, TypeScript
and the production build passed. Focused Chromium checks cover live games, player actions, record lists,
results, quick-score isolation and table controls. They cover direct Riichi, manually recorded late Double Riichi,
persisted declarations and recorded-call handling, player Ron/Tsumo
entry, signed result breakdowns and existing settlement/undo behavior. Earlier focused runs covered
routes, recognition previews, JSON transfer, player analysis, sticky spacing, complete list scrolling,
mobile animations and accessibility. Result comparison checks include a separate rank row and narrow-screen fit;
record-list checks verify Player heading/name alignment at 320, 390 and 1280 pixels. These are named subsets,
not a fresh full-suite certification.

The current hand-edit/indicator checks cover earlier-hand replacement, replay of later Ron/Tsumo,
multiple Ron and draws, revisions, final escrow, cancellation, reloads, direct indicator sheets and
invalid-indicator recovery. Two separately executed short-phone Home setup height checks (360 and
390 pixels at 667 pixels high) failed their no-scroll assertion; this run does not certify that layout.

The 2026-10-26 documentation refresh does not certify a new deployment. Use the commands in
[maintenance](maintenance.md#verification) for a current release check. The 2026-10-23
[pre-deployment report](pre-deployment-verification.md) is a historical snapshot.

Real-device Safari/Android validation, representative physical-photo accuracy/red-five evaluation,
photo crop/rotation/persistence/merging, image-based meld assignment, backend/auth/sync and user-ID QR
lookup remain unfinished. Numerical fixtures are hand-authored, not certified platform replays.
