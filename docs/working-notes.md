# Working notes and historical milestones

## Current implementation snapshot - 2026-10-27

The app now includes final table Uma/Oka/chip/money settlement, completed-game records, player
analytics, JSON import/export under Others > Data, correction prompts, responsive sheets,
scrollable player selection and session diagnostics. Component HTML/CSS/TS are colocated;
19 Vitest spec files contain 232 passing tests. Playwright remains a separate browser suite.
Live-table History supports full per-hand editing with transactional later-hand replay and revision snapshots. The Dora table button opens its tile sheet directly and saves on Done. Ura appears only when the winner declared Riichi/Double Riichi.
All Kan variants offer Dora editing. Ron settlement with no Dora indicator requests one and resumes the same hand after saving. Concealed Kan has its own seat button beside open calls, with separate counts and recorded tiles. Record cards retain the latest hand's rule name as well as the history summary; filtered game counts sit beside the mode chips.
Recent interface updates include compact history rows with right-side chevrons, horizontal player
selectors and shared details, recorded call/Riichi markers below points, and permanent saved-rule
sections. Settings omits the introductory paragraph and keeps its heading close to the player-count
selector. Others > Sound effects provides device-voice playback, tone fallback, previews and mute.
See [feature coverage](feature-coverage.md), [records](records.md), [JSON transfer](data-transfer.md)
and [maintenance](maintenance.md) for current behavior. Counts and missing features below describe
older milestones, not current validation totals.

## Historical plan and milestones

1. Create a strict TypeScript workspace with independent tile, rule, scoring and fixture packages.
2. Test complete-hand validation, interpretation enumeration, yaku/fu, integer payments and settlement conservation.
3. Build an Angular standalone mobile interface with manual entry, meld provenance, win context and IndexedDB history.
4. Add PWA caching, clearly labelled mock capture, accessibility and end-to-end checks.
5. Run lint, tests and production build; record actual coverage and gaps.

Initial decisions: no backend or Docker required for the offline application. Use npm.cmd on Windows because npm.ps1 is blocked by execution policy. Begin with one winner; unsupported advanced game flow must be explicit. Rule profiles are versioned and stored with matches. Historical edits are blocked initially rather than silently changing settled balances.

Delivered: Angular 22.2 app, independent scoring modules, local matches/drafts/ledger, PWA shell, manual and mock capture flows. npm 10's Arborist resolver crashed on the initial dependency graph; npm 11 installed it successfully. The production build works with the installed Node 22.23.2. Verification completed: 72 unit passes, 2 advanced-rule todos, 2 production-browser passes, lint/typecheck/build passing. Visual QA inspected 375px home/scorer and desktop scorer screenshots. Browser test cleanup required sandbox escalation on Windows; the unsandboxed run exited zero. Real iPhone/Safari and advanced rules remain explicitly unverified.

Added zh-TW localization: language-independent domain data, runtime English/繁體中文 selector, persisted browser preference, translated controls/help/claims/results/validation/history and accessible tile labels. User-entered names are preserved. Chinese date formatting requires Angular's extra day-period locale data; a browser regression caught and verified this fix. E2E uses port 4300 to avoid reusing the development server. Current checks: 84 unit passes, 2 advanced-rule todos, 4 browser passes; lint/typecheck/build pass. Inspected the zh-TW mobile history screenshot.

2026-10-22 — User chose selectable Mahjong Soul, Tenhou and Custom presets after discussing platform differences. Added version-2 rule snapshots and descriptions/custom controls, special/double/stacked Yakuman, Tenhou/Chiihou declarations, four Kans, original-order Pao, multiple Ron/head-bump/triple abort, declared Kita replacement/robbery, external Kan indicators, exhaustive/abortive/Nagashi draws, dealer/honba/wind advancement, game endings/final escrow, and state-aware undo. Existing match histories retain their recorded results.

Verified the public official Mahjong Soul FAQ data and the official Tenhou manual; documented secondary-source discrepancies and absence of replay certification. The previous advanced-rule todos are executable regression fixtures now. Applied the newly added repository Angular guidance: extracted templates, removed explicit standalone flags, used model() for the two-way rule picker. Added axe WCAG AA scans and fixed helper-text contrast and tile label/visible-text mismatches. Visual QA inspected the rule snapshot/history at 375px. Final validation: 125 unit tests and 10 browser tests (including accessibility), lint, typecheck and production build passing. No full wall/discard simulator, real photo inference or platform rank/final placement-scoring module is claimed.
