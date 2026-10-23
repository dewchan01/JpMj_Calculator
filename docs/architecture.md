# Architecture

The Angular shell lazy-loads home, scorer and coverage screens. Angular Signals hold asynchronous match/results state; plain form fields hold local editor state. No state library or backend is needed for this slice. Tailwind is available through PostCSS; most visual styling uses scoped-purpose global CSS classes. No runtime font, image or analytics services are used.

The domain packages import no Angular/browser APIs. `score` validates physical tiles and context, enumerates normal/special interpretations and concealed winning-tile placements, evaluates Yaku/Fu, counts bonus tiles, applies integer limits and profile-specific liability, then selects the highest payment. Standard special waits and first-turn Yakuman are implemented rather than blocked. Tenhou considers every possible initial-deal winning tile when the Tenhou claim is declared.

Player arrays represent turn order. Dealer-relative seat winds are derived for each score. 3P uses East/South/West. The preceding array player is the legal Chi source. Physical tile IDs distinguish copies and maintain Kakan provenance. Original Pon snapshots reference the same physical tiles and are not counted a second time.

The pure ledger replays nonnegative integer transfers between players and named table escrow. Deposits remove player money once; awards spend existing escrow. All accounts reconcile to initial balances. Duplicate event IDs and unfunded pot awards are rejected. Match writes use an IndexedDB transaction and an expected `updatedAt` value to detect concurrent-tab changes. Failed writes leave the previously stored match intact. Each win stores its full scoring input, profile snapshot and result for audit. Historical edits are blocked; latest-event undo replays remaining transfers.

`rounds.ts` combines multiple Ron without double-awarding honba/escrow, checks cross-hand physical inventory, and settles exhaustive/abortive/Nagashi draws from declared circumstances. `settleRound` stores the before/after round state in the same event as payments and any final escrow award. Undo restores both balances and progression. Bankruptcy, extension rounds and first-place dealer finish use integer raw balances before final escrow allocation.

Version-2 profiles contain the selected platform/house settings. Setup and Quick score use a shared rule-picker model; fixed match profiles are read-only. Older snapshots retain their identity and historical results; new scores resolve missing settings to the original Soul-inspired defaults. Rule, review, setup and shell templates live in separate HTML files in accordance with the repository guidance.

Dexie schema version 1 stores matches and manual drafts. Future schema changes must add explicit Dexie migrations. Draft writes are serialized and flushed before clearing after a settlement. Tile edits retain in-memory undo/redo snapshots; those edit stacks do not survive reload. Storage unavailability is visible and does not get reported as successful persistence.

The production Angular service worker prefetches the app shell and lazy routes. Scoring and IndexedDB require no network. HTTPS hosting with SPA fallback is required for deployment. The local preview serves the service-worker shell; the Angular development server disables it.

The recognizer interface returns normalized boxes and candidate arrays. The capture feature owns API
requests and independent editable previews; the scorer only receives an explicitly confirmed tile
list for a named target. A singleton configuration loader validates public `config.json` once per
app load. API endpoints are not user-editable or read from browser preferences.
`ApiTileRecognizer` posts raw base64 JSON to a configurable endpoint, validates the response and
normalizes center-based pixel boxes. Timeout, cancellation and stale-response guards protect the
editor. API mode uploads the selected image; the optional mock performs no upload. Photos and
suggestions stay in memory and are not stored with matches. Manual tiles are never replaced by an
API response. See [API configuration](recognition-and-storage.md).

English, zh-TW, zh-CN and Japanese (ja) use runtime translation catalogs and a Signal-based locale service. The
translate pipe updates text without reloading or resetting the editor. Domain strings remain
canonical English in saved results and are translated at display time, including history. User
names are never run through the catalog. English is the initial default regardless of browser
language; a saved selection takes precedence. The locale service updates document language/title
and continues in memory if localStorage is unavailable. Angular Chinese locale and extra day-period
data localize dates, including the `B` time-format token.

## Installation, support, and build details

The home page offers installation in a popup that follows the light or dark theme and hides it when running in standalone PWA mode. Next time (or Escape) dismisses it for this visit; it returns on reload or the next home-page visit. Close stores a permanent dismissal in this browser’s local storage. Clearing site data restores the reminder. On iOS, use Share → Add to Home Screen. The Install button appears when the browser provides an installation prompt.

Set the top-level `supportEmail` field in `apps/web/public/config.json` to your support address. Leave it empty to hide the footer contact link. This file is public; do not put private credentials in it.

`npm start` and `npm run build` generate `version.json` from the package version and Git commit. A footer asterisk means the build included local changes. Source archives without Git metadata show an unknown commit.

Photo recognition requires internet access. Manual tile entry and scoring work offline after the app has cached successfully. Drag collected tiles to reorder them; keyboard users can focus a tile and press Alt + Left/Right. Tap a collected tile to remove it, and use Undo to recover it.

Table labels distinguish the selected hand-entry winner from the dealer and point totals. Yakitori means no recorded hand win (`win` or effective `multipleRon` winner); it is informational and applies no penalty. Draws, including Nagashi settlements, do not clear this label. Undoing a settlement recalculates the labels.

## Action feedback

Scoring errors are associated with the action that produced them: tile notation, meld assignment, a specific Pon upgrade, North extraction, Riichi deposit, calculation, settlement, or history undo. Each message appears once beside those controls instead of being repeated at the top or in unrelated cards. Assignment errors clear when the selected tiles change or are kept concealed.

The shared `ErrorNotice` component in `shared/error-notice` announces the translated message, focuses it for keyboard and screen-reader users, and brings it into view when it would be offscreen or behind sticky navigation. Input errors inside the tile-entry dialog remain within that dialog.

All error panels use `ErrorNotice`, including home, installation, recognition, manual input, scoring and round validation. The component accepts a single message or a list, with the same padding, border, typography and light/dark colors. Action feedback focuses and scrolls into view; background configuration notices use the same presentation with automatic focus disabled.

Quick score (`/score`) is independent of saved matches (`/score/:id`). It has its own rules and temporary hand state and cannot save settlements into an ongoing match. Match drafts remain keyed by match ID in IndexedDB. Navigation highlights My table while a saved match is open and Quick score only for the standalone calculator. An end-to-end test switches between a 4P Tenhou game and a 3P quick calculation and checks the original draft, balances, escrow and ledger afterward.
