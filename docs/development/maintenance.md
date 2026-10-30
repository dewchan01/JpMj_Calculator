# Maintenance conventions

Follow the root `instructions.md` and local `docs/development/best-practices.md`. Keep component logic,
templates and styles in their respective TypeScript, HTML and CSS files.

## Responsibilities

`features/scoring/table-summary` renders the spatial match overview. Player positions follow the
initial seating order; seat winds and the dealer badge follow the current dealer. The center shows
round, honba and funded Riichi escrow. Three-player tables omit the fourth seat. Keep score and
ledger calculations in the domain layer; this component only displays the current snapshot.

Maintain translations in `core/i18n/zh-tw.json` and `ja.json`. Run `npm run i18n:generate` after
editing Traditional Chinese to regenerate `zh-cn.json`, then format. English source keys and
interpolation placeholders must match across catalogs; names and saved domain data stay unchanged.
Japanese uses `ja`; Korean uses `ko` and `ko.json`. Keep every catalog's keys and interpolation fields aligned. Korean music titles use the official `name_kr` values listed in [music titles](../guides/music-titles.md). Translation lookup code belongs in `messages.ts`, not catalog data.
English labels for internal call, win and ledger keys also live in `messages.ts`; render `ankan`
as `Ankan` rather than exposing a lowercase domain key. Keep saved enums unchanged.

The hand workspace collects all tiles through one palette, notation editor or photo review.
After collection, select tiles and assign them to Chi/Pon/Kan or extracted North in one undoable
operation. Unassigned tiles form the concealed hand. Groups can be returned to the collection
without another photo. Caller, called-tile position and call order remain explicit.
Dora/Ura retain separate targets. Replacing the full collection resets its assignments; Undo restores them.

`tiles/tile-entry-dialog` lazily opens the shared entry tools in a native modal: a bottom sheet on
mobile and a centered dialog on desktop. Keep palette, text and photo entry behind one button per tile field.
Mobile sheets support downward drag dismissal from the top, short-drag snap-back and reduced-motion
preferences. Content scrolling, interactive controls, Done and Escape remain separate from dragging.
The separate Add meld form is removed; use collection assignments instead.
The hand toolbar's Delete a tile mode removes individual tiles and supports Undo.
Undo/Redo buttons are omitted from Enter tiles; keyboard shortcuts remain outside text fields.
Enter tiles sits inside the green hand tray. Winning-tile, Delete and Clear controls appear in an
attached footer only when hand tiles exist. Assigned groups remain in the hand workspace. There is
no separate verification checkbox: edits invalidate results, and structure/claim validation runs
before settlement. Indicator fields use compact entry controls. Storage usage appears on Others
below the grouped options; home and scoring pages omit the panel.

`tiles/tile-picker` renders the image palette shared by the hand and `tiles/tile-input` fields.
Meld/Dora/Ura inputs show selected tile images with removal controls; notation is an optional
advanced editor. Keep new tile-valued fields on these components instead of adding raw-text-only
entry. Provider settings are read exclusively from `config.json`.

Organize files by feature, giving each component its own folder. Keep its TypeScript, HTML,
CSS and any component specs together. Name unit tests `*.spec.ts`; Vitest runs the application
and domain specs, while Playwright runs the separate `e2e/*.spec.ts` suite. Do not add empty
component specs just to fill out a folder; test meaningful behavior.

```text
apps/web/src/app/
  app.ts / app.html / app.routes.ts       Shell and lazy route definitions
  app-router.ts / app-router.pages.ts     Router scrolling and Pages hash-location providers
  core/i18n/                             App-wide locale service, catalog and tests
  features/
    matches/                             Match setup and saved tables
      home/                              home.ts, home.html, home.css
      data-access/                       Match and draft repository
    records/
      player-profile/                    Component files, analysis helpers and specs
      record-result/                     Saved-game results component
      data-transfer/                     Component files, archive helpers and specs
    scoring/                             Hand editor and settlement orchestration
      scorer/                            scorer.ts, scorer.html, scorer.css
      capture/                           Recognition contract and mock adapter
        photo-capture/                   Photo component files
      tiles/
        tile-input/                      Tile input component files
        tile-picker/                     Tile picker component files
        tile-entry-dialog/               Tile editor dialog component files
      score-result/                      Single-hand explanation
      round-review/                      Multi-winner and draw review
      match-history/                     Settlement audit view
    about/                               Coverage and limitations
  shared/rules/rule-picker/              Rule picker used by setup and scoring
```

Keep feature-specific helpers within their owning feature. Put code in `shared` only when multiple
features use it. Scoring uses the match repository through `matches/data-access`; it does not depend
on the match setup page. Domain packages remain outside the Angular application.

- `home.ts` owns match setup and saved-match actions. Its typed Signal Form holds match names,
  player names and game length; the rule profile remains an independent signal model.
- `scorer.ts` coordinates editing, scoring, draft persistence and settlement. Keep score calculations
  in the pure domain packages rather than duplicating them in templates.
- `score-result.ts` displays a single scoring result and emits a confirmation request. It does not
  write to storage or calculate payments.
- `match-history.ts` displays saved events, derives their reverse chronological order with
  `computed()`, and emits export/undo requests. Historical rule snapshots remain authoritative.
- `rule-picker.ts` owns preset selection and custom settings; `round-review.ts` presents combined
  settlements. Both remain reusable independently of the scorer page.
- `repository.ts` owns IndexedDB access and concurrent-write checks.

Use signal inputs and outputs for component boundaries and `model()` for two-way values. Prefer
Signal Forms for new forms. The existing scorer and rule-picker forms still use `ngModel`; migrate
those as cohesive features rather than mixing form systems on a control.

## Safe changes

Keep domain functions independent of Angular and browser APIs. Preserve integer payment arithmetic,
tile identities, original-call provenance and stored rule snapshots when refactoring scoring.

Draft restoration explicitly lists editor fields. Do not assign stored objects onto a component:
that can replace services, signals or methods. Optional fields need defaults so older drafts still
load. Include new editor fields in both snapshot creation and restoration, including undo/redo.

Shared visual styles live in `apps/web/src/styles.css`. Put feature-specific styles in a component
CSS file when introducing a new component; avoid inline styles and unexplained global selectors.

## Shared interaction and diagnostics

Keep mobile prompt animation and centered desktop behavior in `shared/responsive-sheet.ts`, and
backdrop rules in `shared/dialog-backdrop.ts`. Nested prompts retain their parent. Player search
and filter controls sit outside the independently scrolling results list. There is no pagination.

`shared/tab-scroll.ts` resets the appropriate scroll container for new tabs/filter chips. Sticky
controls share the top-gutter treatment in `styles.css`. Use `action-cancel` for neutral outlined
cancellation and `action-delete` for destructive controls; cancellation precedes confirmation.
The global ripple service respects `data-no-ripple`, used only on the developer-brand hidden trigger.

`core/diagnostic-log.ts` holds up to 200 categorized/redacted session entries. Expected validation
does not become a system error. Triple-clicking the developer brand opens the log sheet. Logs are
not uploaded or persisted; detailed recognition Console output is development-only. See the
[diagnostic policy](frontend-diagnostics.md).

## Verification

Backend configuration tests use an isolated content root and the tracked
`apps/api/appsettings.Development.example.json` template. They never require an ignored local
Development file. Cases cover Development overrides, Production ignoring that file, and fallback
to base settings when it is absent. GitHub Actions uploads TRX results as `backend-test-results`,
including failed runs. `A total of 1 test files matched...` means one test assembly was discovered;
the failing test name and assertion below it identify the actual failure.

Run `npm.cmd run format`, then `npm.cmd run format:check`, `npm.cmd run lint`,
`npm.cmd run typecheck`, `npm.cmd test` and `npm.cmd run build`.
After changing forms or templates, run `npm.cmd run e2e` against that new build. Browser checks
include English/zh-TW, mobile layout, offline persistence, settlements and axe accessibility scans.

The translation catalog test discovers component templates recursively, including new feature
folders. Preserve complete translation strings when wrapping HTML.
