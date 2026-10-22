# Maintenance conventions

Follow `instructions.md` and `best-practices.md` at the repository root. Keep component logic,
templates and styles in their respective TypeScript, HTML and CSS files.

## Responsibilities

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
