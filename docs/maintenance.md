# Maintenance conventions

Follow `instructions.md` and `best-practices.md` at the repository root. Keep component logic,
templates and styles in their respective TypeScript, HTML and CSS files.

## Responsibilities

`features/scoring/table-summary` renders the spatial match overview. Player positions follow the
initial seating order; seat winds and the dealer badge follow the current dealer. The center shows
round, honba and funded Riichi escrow. Three-player tables omit the fourth seat. Keep score and
ledger calculations in the domain layer; this component only displays the current snapshot.

Maintain translations in `core/i18n/zh-tw.json` and `ja.json`. Run `npm run i18n:generate` after
editing Traditional Chinese to regenerate `zh-cn.json`, then format. English source keys and
interpolation placeholders must match across catalogs; names and saved domain data stay unchanged.
Japanese uses `ja`. Translation lookup code belongs in `messages.ts`, not catalog data.

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
Undo and Redo appear inside Enter tiles, keeping the main hand toolbar focused on Delete and Clear.
Enter tiles sits inside the green hand tray. Winning-tile, Delete and Clear controls appear in an
attached footer only when hand tiles exist. Melds/North use a separate step-02 card, with a compact
verification checkbox after the summary. Edits clear verification, and settlement still requires it.
Indicator fields use compact entry controls. Storage usage appears only on the Rule coverage page;
home and scoring pages omit the panel.

`tiles/tile-picker` renders the image palette shared by the hand and `tiles/tile-input` fields.
Meld/Dora/Ura inputs show selected tile images with removal controls; notation is an optional
advanced editor. Keep new tile-valued fields on these components instead of adding raw-text-only
entry. Provider settings are read exclusively from `config.json`.

Organize files by feature, keeping each component's template beside its TypeScript file:

```text
apps/web/src/app/
  app.ts / app.html / app.routes.ts       Shell and lazy route definitions
  core/i18n/                             App-wide locale service, catalog and tests
  features/
    matches/                             Match setup and saved tables
      data-access/                       Match and draft repository
    scoring/                             Hand editor and settlement orchestration
      capture/                           Recognition contract and mock adapter
      score-result/                      Single-hand explanation
      round-review/                      Multi-winner and draw review
      match-history/                     Settlement audit view
    about/                               Coverage and limitations
  shared/rules/                          Rule picker used by setup and scoring
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

## Verification

Run `npm.cmd run format`, then `npm.cmd run format:check`, `npm.cmd run lint`,
`npm.cmd run typecheck`, `npm.cmd test` and `npm.cmd run build`.
After changing forms or templates, run `npm.cmd run e2e` against that new build. Browser checks
include English/zh-TW, mobile layout, offline persistence, settlements and axe accessibility scans.

The translation catalog test discovers component templates recursively, including new feature
folders. Preserve complete translation strings when wrapping HTML.
