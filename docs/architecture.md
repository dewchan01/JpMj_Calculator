# Architecture

Layout adapts to viewport width using the same URLs: screens up to 700px hide the desktop header and use fixed bottom navigation; wider screens use a permanently expanded sidebar. The four tabs are My table, Settings, Records and Others. Quick score is reached from My table. Resizing preserves the active form and match ID. Header offsets, bottom-navigation clearance, safe-area padding, error scrolling and drag auto-scroll account for the fixed navigation.

The Angular shell lazy-loads home, live table, Quick score, records, player analysis, settings and Others. Signals hold reactive state, with Signal Forms, reactive forms and existing template-driven editors used as appropriate. Components keep TypeScript, HTML and CSS together in a component folder; pure helpers and `*.spec.ts` tests stay with their owning feature. Vitest runs application/domain specs; Playwright runs `e2e/` separately. Tailwind is available through PostCSS, with component CSS and shared global controls. No backend or runtime font/analytics service is required.

The domain packages import no Angular/browser APIs. `score` validates physical tiles and context, enumerates normal/special interpretations and concealed winning-tile placements, evaluates Yaku/Fu, counts bonus tiles, applies integer limits and profile-specific liability, then selects the highest payment. Standard special waits and first-turn Yakuman are implemented rather than blocked. Tenhou considers every possible initial-deal winning tile when the Tenhou claim is declared.

Player arrays represent turn order. Dealer-relative seat winds are derived for each score. 3P uses East/South/West. The preceding array player is the legal Chi source. Physical tile IDs distinguish copies and maintain Kakan provenance. Original Pon snapshots reference the same physical tiles and are not counted a second time.

The pure ledger replays nonnegative integer transfers between players and named table escrow. Deposits remove player money once; awards spend existing escrow. All accounts reconcile to initial balances. Duplicate event IDs and unfunded pot awards are rejected. Match writes use an IndexedDB transaction and an expected `updatedAt` value to detect concurrent-tab changes. Failed writes leave the previously stored match intact. Each win stores its full scoring input, profile snapshot and result for audit. Historical hand editing is blocked; latest-event undo replays remaining transfers. Final-point/date correction is separate: it preserves total points and appends a `scoreAdjustment` event without rewriting earlier hands.

`rounds.ts` combines multiple Ron without double-awarding honba/escrow, checks cross-hand physical inventory, and settles exhaustive/abortive/Nagashi draws from declared circumstances. `settleRound` stores the before/after round state in the same event as payments and any final escrow award. Undo restores both balances and progression. Bankruptcy, extension rounds and first-place dealer finish use integer raw balances before final escrow allocation.

Settings at `/settings` owns preset selection and the named 3P/4P rule library. The library persists separate applied profiles in localStorage; setup and Quick score use the shared rule-picker prompt. Active matches keep their saved snapshots. New custom snapshots include table progression, payment, final result and chip settings. Editing the library never mutates existing matches. Table names and scratch hands survive a visit to Settings through separate in-memory services. Older snapshots retain their identity and historical results; new scores resolve missing settings to the original Soul-inspired defaults.

Dexie schema version 1 stores matches and manual drafts. Future indexed-store changes must add explicit Dexie migrations. The live table adds optional clock, current-hand actions and display-position fields to the existing match records without changing indexes. `/score/:id` owns the compact live table and condition prompts; `/score` retains the independent manual scorer. The shared timer helpers and final-payment path are pure core functions. Saved player names use a separate localStorage library. See [Live table flow](live-table.md).

Quick-score tile edits retain in-memory undo/redo snapshots; those edit stacks do not survive reload. Storage unavailability is visible and does not get reported as successful persistence. Live saves use the repository's optimistic timestamp check, so a stale tab cannot overwrite a later settlement.

The production Angular service worker prefetches the app shell and lazy routes. Scoring and IndexedDB require no network. HTTPS hosting with SPA fallback is required for deployment. The local preview serves the service-worker shell; the Angular development server disables it.

The recognizer interface returns normalized boxes and candidate arrays. API, Roboflow browser-worker
and offline mock adapters implement the same interface; the factory selects only the configured provider.
The capture feature owns API
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
and continues in memory if localStorage is unavailable. The shared Intl date formatter selects
en-SG, zh-TW, zh-CN or ja-JP. Local date inputs are converted without shifting the entered local time.

## Installation, support, and build details

The home page offers installation in a popup that follows the light or dark theme and hides it when running in standalone PWA mode. Next time (or Escape) dismisses it for this visit; it returns on reload or the next home-page visit. Close stores a permanent dismissal in this browser’s local storage. Clearing site data restores the reminder. On iOS, use Share → Add to Home Screen. The Install button appears when the browser provides an installation prompt.

Set top-level `supportEmail` and `developerName` in `apps/web/public/config.json`. Others groups Rules, Version, Developer, Terms and conditions, License, Language and Theme. The email link is inside Developer and is hidden when empty. Data provides separate Import JSON and Export JSON prompts. Triple-clicking the developer brand opens session diagnostics; logs stay in memory and the trigger alone suppresses ripple. This configuration file is public; do not put private credentials in it.

Rules moved from `/about` to `/others/rules`; the old URL redirects. Language and theme preferences are shared with the desktop header. Version reads generated build metadata. Formal terms and the application's own license are not supplied in this repository, so their pages explicitly say so. Tile artwork attribution and CC0 text remain available; the postbuild step copies generated dependency license notices into the deployed browser directory.

`npm start` and `npm run build` generate `version.json` from the package version and Git commit. A commit asterisk means the build included local changes. Source archives without Git metadata show an unknown commit.

Photo recognition requires internet access. Manual tile entry and scoring work offline after the app has cached successfully. Drag collected tiles to reorder them; keyboard users can focus a tile and press Alt + Left/Right. Tap a collected tile to remove it, and use Undo to recover it.

Table labels distinguish the selected hand-entry winner from the dealer and point totals. Yakitori means no recorded win, including effective multiple-Ron and Nagashi winners. A configured per-opponent penalty is appended to the final reversible ledger event; the default remains informational. Undoing a settlement recalculates the labels.

## Action feedback

Scoring errors are associated with the action that produced them: tile notation, meld assignment, a specific Pon upgrade, North extraction, Riichi deposit, calculation, settlement, or history undo. Each message appears once beside those controls instead of being repeated at the top or in unrelated cards. Assignment errors clear when the selected tiles change or are kept concealed.

The shared `ErrorNotice` component in `shared/error-notice` announces the translated message, focuses it for keyboard and screen-reader users, and brings it into view when it would be offscreen or behind sticky navigation. Input errors inside the tile-entry dialog remain within that dialog.

All error panels use `ErrorNotice`, including home, installation, recognition, manual input, scoring and round validation. The component accepts a single message or a list, with the same padding, border, typography and light/dark colors. Action feedback focuses and scrolls into view; background configuration notices use the same presentation with automatic focus disabled.

Quick score (`/score`) is independent of saved matches (`/score/:id`). It has its own rules and temporary hand state and cannot save settlements into an ongoing match. Match drafts remain keyed by match ID in IndexedDB. Navigation highlights My table for the live table and standalone Quick score; Quick score has a dedicated entry link. An end-to-end test switches between a 4P Tenhou game and a 3P quick calculation and checks the original draft, balances, escrow and ledger afterward.

## Direct tile assignment and automatic game context

`TileDropZones` presents open-meld, concealed-Kan and optional 3P North targets. `TileReorder` emits pointer drops as well as reorder events, isolates nested entry-dialog drags, and scrolls near viewport/dialog edges. Zone buttons provide a non-drag alternative. Scorer assignment reuses existing validation and physical tile IDs, undo and draft persistence. Open-meld drops open a native dialog for call details; concealed Kan and North are assigned directly. A complete matching triplet or quad can be selected from a single dragged tile; Chi and ambiguous groups require explicit selection. Assigned groups and their actions remain in the first hand card, with call-order editing collapsed by default.

For active games, round controls are hidden and the saved match is authoritative, including when restoring old drafts. Quick score retains manual round controls. Tile-verification status remains readable in old drafts, but no checkbox or verified-status requirement gates settlement or multiple-Ron queuing. Valid structure, claims, scoring fingerprints and explicit save actions remain in place.
