# Riichi / table

An offline-first Angular PWA for manually scoring Japanese Riichi Mahjong, with Mahjong Soul, Tenhou and Custom presets. Includes manual scoring, draw/multiple-winner settlement and match progression. Photo recognition remains a clearly labelled mock. This independent application is not affiliated with either platform.

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

The development server intentionally does not enable the service worker. Load the production app online once before going offline. Serve the `dist/web/browser` directory over HTTPS when deploying. Hosting must fall back to `index.html` for Angular routes. Camera and PWA features on an iPhone require HTTPS outside localhost; an ordinary HTTP LAN address is insufficient for full PWA behavior. No Docker, backend, database server, account or API key is needed.

## Try a hand

1. Start a 3P/4P match, or open Quick score. Choose Mahjong Soul, Tenhou or Custom, compare the descriptions, and select an East-only or East/South match.
2. Use **Try an example hand**, the palette, or compact notation (`123m456m789p234s55p`). The concealed hand includes the winning tile.
3. Tick the winning-tile selector and tap the actual winning tile. Add separate melds and their providers if needed.
4. Enter dealer, round wind, Ron/Tsumo, discarder, indicators and claims.
5. Check the tiles, press **I have checked these tiles**, then calculate. Read Yaku, bonus Han, Fu and individual payments.
6. In a match, record Riichi deposits before settlement. Confirm and save; reopen History to audit or undo the latest event.

Data and drafts stay in IndexedDB on this browser. JSON export provides a backup; import is not yet implemented. Site-data deletion removes local matches. Dealer rotation, honba, round wind, extension rounds, bankruptcy and first-place dealer finish are automatic after settlement. Undo restores points and the preceding round state.

## Rule presets and advanced conditions

- **Mahjong Soul:** double Yakuman for Kokushi thirteen-wait, Suuankou tanki, pure Chuuren and Daisuushii; triple Ron wins; Pao applies to the liable Yakuman component.
- **Tenhou:** those special forms remain single Yakuman; triple Ron is an abortive draw; Pao covers the whole combined Yakuman hand. The preset selects open Tanyao and red fives.
- **Custom:** configure starting points, red fives, open Tanyao, Kiriage, Yakuman stacking/special multipliers, counted limit, multiple Ron/head-bump, Pao, Kokushi robbery of Ankan, Kita replacement Rinshan and Sanma Tsumo-loss/North-bisection.

Settings are saved as a versioned snapshot when creating a match. Existing matches keep their snapshots; switching Quick score presets preserves entered tiles. Existing version-1 matches remain readable, and historical score results are not recalculated.

For **multiple Ron**, verify each winner’s hand and use **Add verified Ron winner**. Enter all winners, then review and confirm the combined settlement. Every hand must use the same discarded tile and round context. Honba and table sticks go to the nearest eligible winner once.

For **Pao**, enter exposed dragon/wind sets in original call order, or edit their order numbers. Kakan retains the original Pon’s provider/order. The responsible player pays according to the chosen preset; Sanma keeps its actual Tsumo shares.

For **draws**, open **Record draw**, select exhaustive/abortive/Nagashi, declare Tenpai/eligibility, confirm the circumstances, then review and settle. Draws preserve Riichi escrow until a later win or the final first-place award. Nagashi replaces Noten transfers and may have multiple qualifying players.

For **first-turn Yakuman**, select Tenhou/Chiihou and attest that the first draw was uninterrupted. Tenhou considers any initial-deal tile as the winning tile to maximize the hand. Declare Kan/Kita replacement type, robbed Ankan/Kita and other-player Kan count explicitly when relevant.

## Languages

Choose **English** or **繁體中文 (zh-TW)** in the header. The selection is saved locally and works offline; first-time users with a Chinese browser language default to Traditional Chinese. Navigation, setup, scoring inputs, validation, Yaku/Fu explanations, history, accessibility labels and dates are localized. Player-entered names and saved scoring data are preserved. Translation strings live in `apps/web/src/app/core/i18n/messages.ts`; the scoring engine stays language-independent.

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
  [recognition and storage notes](docs/recognition-and-storage.md). Photo recognition remains a mock.

- The previous unsupported-case gates for standard Yakuman, special waits, first-turn wins, Pao and Kita timing have been replaced with profile-aware scoring and explicit circumstance inputs.
- The app does not simulate the full wall/discard sequence. You declare legal Riichi/Furiten timing, Tenpai, Nagashi eligibility, original call chronology and revealed indicators. Consistency checks reject contradictory declarations.
- Local/nonstandard Yaku, chombo penalties, final Uma/Oka/return-point scoring and platform rank progression are outside the implemented presets.
- A fixed photo mock demonstrates capture and editable suggestions. No image inference, crop/rotate, image persistence, multiple-photo merging or backend is implemented.
- Initial seat/player names can be entered; editing an existing match’s players/seating and historical events is not supported. Undo the latest ledger event or start a new match.
- Reference provenance and remaining verification limits are documented in [rule verification](docs/rule-verification.md).

Angular compatibility reference: https://angular.dev/reference/versions
