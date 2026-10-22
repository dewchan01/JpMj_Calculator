# Feature coverage

## Rules and conditions

| Area                                                                  | Status                                                                                                                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mahjong Soul / Tenhou / Custom descriptions and selection             | Implemented in setup and Quick score; existing matches keep immutable snapshots                                                                                |
| 3P/4P setup, East-only/East-South games, initial seats/names/points   | Implemented                                                                                                                                                    |
| Custom configuration                                                  | Starting points, red fives, open Tanyao, Kiriage, double/stacked Yakuman, counted limit, multi-Ron/head-bump, Pao, Ankan robbery, Kita Rinshan, Sanma payments |
| Standard Yaku, Fu, Dora/Ura/Aka/Kita, limits and highest-payment form | Implemented with deterministic fixtures                                                                                                                        |
| All standard Yakuman and special waits                                | Implemented; preset controls double forms and stacking                                                                                                         |
| Tenhou / Chiihou                                                      | Implemented with uninterrupted-first-draw attestation; Tenhou maximizes the initial deal                                                                       |
| Four Kans                                                             | Implemented as Yakuman for one completed hand; multiple-player abort handled by draw entry                                                                     |
| Pao for Daisangen/Daisuushii                                          | Implemented from declared original call order/provider; component-only vs whole-hand differs by preset                                                         |
| Double/triple Ron and head-bump                                       | Implemented; same context/discard required, combined physical inventory checked, pot/honba awarded once                                                        |
| Exhaustive draw                                                       | Implemented: 3P 2,000 / 4P 3,000 Noten pool, no transfers for all/none Tenpai                                                                                  |
| Abortive draws                                                        | Nine terminals, four winds, four Riichi, multiple-player four Kans, profile-dependent triple Ron; user declares circumstances                                  |
| Nagashi Mangan                                                        | Implemented with simultaneous qualifiers, Tsumo shares/honba, replaces Noten transfers; continuation follows Tenpai                                            |
| Kita replacement/robbery and earlier Kita with later timing claims    | Implemented; no blanket timing rejection; user declares current circumstances                                                                                  |
| Other-player Kans                                                     | Count supports additional revealed indicators; app does not infer reveal timing                                                                                |
| Dealer/honba/round progression, bankruptcy, extension, dealer finish  | Implemented; state changes and final escrow award are one undoable event                                                                                       |
| Final Uma/Oka and rank progression                                    | Not implemented; raw balances and placement remain distinct                                                                                                    |
| Local Yaku / chombo                                                   | Outside the presets; not implemented                                                                                                                           |

## Application

| Area                                                                 | Status                                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| English / zh-TW                                                      | Implemented including new controls, results and errors                                    |
| Tile palette/notation/winning tile, undo/redo                        | Implemented; direct tile reorder controls still absent                                    |
| Chi/Pon/Kan, provider/called tile, Kakan provenance/call order       | Implemented; individual meld changes use remove/recreate                                  |
| IndexedDB matches/drafts/history                                     | Implemented; win profiles/inputs/results, draw declarations and round before/after stored |
| Duplicate prevention, funded escrow, audit/replay, latest-event undo | Implemented                                                                               |
| Historical editing                                                   | Older edits blocked; latest event can be undone                                           |
| JSON export / match deletion                                         | Implemented; import and post-creation seat/name editor absent                             |
| Production offline PWA                                               | Implemented; Chromium offline regression passes                                           |
| Real iPhone Safari / Android device validation                       | Not performed                                                                             |
| Photo capture/file fallback                                          | Implemented; recognizer is fixed mock, no inference/upload                                |
| Crop/rotate, persistent captures, multiple-photo merge               | Not implemented                                                                           |
| Backend/sync/auth                                                    | Deferred; unnecessary for local scoring                                                   |

## Validation

125 unit tests and 10 browser tests pass, including the prior advanced-rule todos now replaced by executable fixtures. Browser checks cover English/zh-TW, offline storage, preset differences, custom configuration, fixed match snapshots, draws/undo, multiple Ron, Pao and last-hand match-end/undo. Automated axe WCAG AA scans pass on setup/custom rules, scoring and English/zh-TW draw controls. Lint, typecheck and production build pass.

This is a manually declared scorer, not a complete wall/discard legality simulator or a certified replica of either platform. Reference verification and numerical fixture provenance are listed in `rule-verification.md`.
