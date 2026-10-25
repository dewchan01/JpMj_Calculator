# Riichi / table

An offline-first Angular PWA for scoring Japanese Riichi Mahjong, with Mahjong Soul, Tenhou, M.League and Custom presets. Includes manual scoring, draw/multiple-winner settlement, match progression and configurable photo recognition. Manual scoring works offline; API recognition uploads selected photos. This independent application is not affiliated with the rule platforms or detection provider.

## Run

Requires Node **22.22.3+** on the Node 22 line (or an Angular-22-compatible Node 24/26 version). Tested here with Node 22.23.2.

```powershell
npm.cmd ci
npm.cmd start
```

Open **http://localhost:4200**. On Windows, use `npm.cmd` if execution policy blocks `npm.ps1`. Dependencies are already installed in this working directory. If an npm 10 dependency-resolution crash occurs during a fresh install, use `npx.cmd --yes npm@11 install` (the workaround used for initial installation).

For the production PWA, including service-worker offline caching:

```powershell
npm.cmd run build
npm.cmd run preview
```

The development server intentionally does not enable the service worker. Load the production app online once before going offline. Serve the `dist/web/browser` directory over HTTPS when deploying. Hosting must fall back to `index.html` for Angular routes. Manual scoring and match entry work over an HTTP LAN address (use `npm run start:host` for phone previews). Camera and PWA features on an iPhone require HTTPS outside localhost; an ordinary HTTP LAN address is insufficient for full PWA behavior. No Docker, backend, database server, account or API key is needed.

## Play at a table

Save reusable player names on My table, choose them for seats, then start a 3P/4P match. The game opens a compact live table. Tap a player to record Riichi, Chi/Pon/Kan or 3P North extraction; update Dora/Ura from the table. End this hand guides you through winner(s), method, concealed tiles, winning tile and conditional claims before settlement. The floating menu contains pause/resume, full-match ending, history/export/undo, game information, display settings, display seat swaps and help. The timer survives reloads and excludes pauses. Dice and point differences are available beside the table. See [Live table flow](docs/live-table.md).

## Try a hand in Quick score

1. Open Quick score from My table. Choose Mahjong Soul, Tenhou, M.League or a saved custom profile on Settings.
2. Use **Try an example hand**, the palette, or compact notation (`123m456m789p234s55p`). The concealed hand includes the winning tile.
3. Mark the actual winning tile. Drag a matching tile (or a selected group) into Open melds, Concealed Kan, or, in 3P, Extracted North. Open melds ask for the call details in a popup; concealed Kan and North are assigned immediately. Use the move buttons as a keyboard alternative. Assigned groups remain in the same hand card with return, upgrade and remove actions.
4. Choose Ron/Tsumo, the discarder, indicators and claims. Ongoing games use their saved dealer, round wind, hand number and honba automatically; Quick score keeps these fields editable.
5. Review the tiles and calculate. Read Yaku, bonus Han, Fu and individual payments. There is no separate verification checkbox; scoring and settlement still validate the hand and declarations.
6. In a match, record Riichi deposits before settlement. Confirm and save; reopen History to audit or undo the latest event.

Data and drafts stay in IndexedDB on this browser. JSON export provides a backup; import is not yet implemented. Site-data deletion removes local matches. Dealer rotation, honba, round wind, extension rounds, bankruptcy and first-place dealer finish are automatic after settlement. Undo restores points and the preceding round state.

## Rule presets and advanced conditions

- **Mahjong Soul:** double Yakuman for Kokushi thirteen-wait, Suuankou tanki, pure Chuuren and Daisuushii; triple Ron wins; Pao applies to the liable Yakuman component.
- **Tenhou:** those special forms remain single Yakuman; triple Ron is an abortive draw; Pao covers the whole combined Yakuman hand. The preset selects open Tanyao and red fives.
- **Custom:** save named, separate 3P/4P profiles on Settings. Configure game progression, bankruptcy ending, starting/return scores, Noten, Honba, Yakitori, Uma, tied ranks, final rounding, money/chip conversion, Wareme, Riichi escrow recipients and existing hand-scoring options. 3P supports Tsumo loss, North-bisection without loss, and equal shares ignoring the dealer. The no-100-point-stick option rounds each hand payment upward to 1,000 after Honba/Wareme. Each setting has expandable help.

Settings are saved as a versioned snapshot when creating a match. Existing matches keep their snapshots; switching Quick score presets preserves entered tiles. Existing version-1 matches remain readable, and historical score results are not recalculated.

For **multiple Ron**, review each winner’s hand and use **Add Ron winner**. Enter all winners, then review and confirm the combined settlement. Every hand must use the same discarded tile and round context. Honba goes to the nearest eligible winner once. Riichi escrow follows the saved nearest-winner or split policy.

For **Pao**, enter exposed dragon/wind sets in original call order, or edit their order numbers. Kakan retains the original Pon’s provider/order. The responsible player pays according to the chosen preset; Sanma keeps its actual Tsumo shares.

For **draws**, open **Record draw**, select exhaustive/abortive/Nagashi, declare Tenpai/eligibility, confirm the circumstances, then review and settle. Draws preserve Riichi escrow until a later win or the final first-place award. Nagashi replaces Noten transfers and may have multiple qualifying players.

For **first-turn Yakuman**, select Tenhou/Chiihou and attest that the first draw was uninterrupted. Tenhou considers any initial-deal tile as the winning tile to maximize the hand. Declare Kan/Kita replacement type, robbed Ankan/Kita and other-player Kan count explicitly when relevant.

## Languages

Choose **English**, **繁體中文 (zh-TW)**, **简体中文 (zh-CN)** or **日本語 (ja)** in the header. English is the default;
the selected language is saved locally and works offline. Navigation, setup, scoring inputs,
validation, Yaku/Fu explanations, history, accessibility labels and dates are localized.
Player-entered names and saved scoring data are preserved. Translation strings live in
`apps/web/src/app/core/i18n/zh-tw.json`, `zh-cn.json` and `ja.json`; the scoring engine stays language-independent.
Traditional Chinese and Japanese are maintained directly. The generator derives Simplified Chinese
from `zh-tw.json`, so Traditional Chinese does not need a generation script. English uses the source
message keys. Japanese uses the standard language code `ja`.

## Checks

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
# One-time Chromium download; browsers live inside the ignored .playwright directory:
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.playwright"
npx.cmd playwright install chromium
npm.cmd run e2e
```

Playwright serves the production build on port 4300, separate from the development server on 4200. Mobile tests use a 375px Chromium viewport; they do not establish real iPhone Safari compatibility. See [feature coverage](docs/feature-coverage.md) for actual checks and gaps.

## Structure

Tile displays use locally bundled [FluffyStuff artwork](https://github.com/FluffyStuff/riichi-mahjong-tiles)
(CC0), including regular and dark variants. The header offers a persistent dark-mode toggle and
English, Traditional Chinese, Simplified Chinese, and Japanese. The initial theme follows the system setting.
After changing the Traditional Chinese catalog, run `npm.cmd run i18n:generate` to update the
Simplified Chinese catalog, then `npm.cmd run format`. Conversion uses OpenCC at development time;
player-entered names are preserved.

GitHub Pages setup and deployment: [hosting instructions](docs/github-pages.md).

```text
apps/web/                   Angular standalone, lazy routes, Signals, Tailwind
packages/mahjong-core/       Validated notation, tile identities, pure match ledger
packages/mahjong-rules/      Immutable, versioned 3P/4P presets and Dora cycles
packages/mahjong-scoring/    Validation, forms, Yaku, Fu, limits, payments
packages/mahjong-fixtures/   Deterministic test inputs
e2e/                        Production browser and offline checks
docs/                       Architecture, coverage, rule verification and notes
```

Use `npm.cmd run format` to format source, templates and documentation. The Angular template
parser preserves binding expressions and translation strings. See
[maintenance conventions](docs/maintenance.md) before extending a feature.

## Boundaries / next work

- **M.League** is available for four-player games, including its scoring and round progression
  differences. Final league points and penalties are excluded; see [rule verification](docs/rule-verification.md).
- Free recognition candidates and IndexedDB retention are covered in
  [recognition and storage notes](docs/recognition-and-storage.md), including API configuration.

- The previous unsupported-case gates for standard Yakuman, special waits, first-turn wins, Pao and Kita timing have been replaced with profile-aware scoring and explicit circumstance inputs.
- The app does not simulate the full wall/discard sequence. You declare legal Riichi/Furiten timing, Tenpai, Nagashi eligibility, original call chronology and revealed indicators. Consistency checks reject contradictory declarations.
- Local/nonstandard Yaku, chombo penalties, final Uma/Oka/return-point scoring and platform rank progression are outside the implemented presets.
- Photo recognition uses a configurable third-party API, with an optional local mock. Crop/rotate,
  image persistence, multiple-photo merging and an app-owned inference backend are not implemented.
- Initial seat/player names can be entered; editing an existing match’s players/seating and historical events is not supported. Undo the latest ledger event or start a new match.
- Reference provenance and remaining verification limits are documented in [rule verification](docs/rule-verification.md).

Angular compatibility reference: https://angular.dev/reference/versions

Final results show raw points, Oka, Uma, net chips and money when a table ends. Money is `(final score × rate) + (net chips × chip value)`, rounded to two decimals with any residual assigned to first place. Chip transfers for valid Ippatsu, actual red/ura tiles and configured Yakuman awards are recorded separately from points. Chip value 0 disables chips. Undo removes the latest event’s point transfers, chip changes and final penalties together. The app calculates balances and never sends payments. Custom rules and matches are local to this browser origin.
