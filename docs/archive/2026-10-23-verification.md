# Historical pre-deployment verification — 23 October 2026

This is the 2026-10-23 report, not the current release state. Subsequent changes include records/analysis, JSON transfer, dialogs, diagnostics and component/spec reorganization. See [current feature coverage](../planning/feature-coverage.md) and rerun [maintenance checks](../development/maintenance.md#verification) for a new deployment.

No blocking issues were found in the checks below at that time. This is local verification; nothing was committed, pushed, or deployed.

| Check                                      | Result                                        |
| ------------------------------------------ | --------------------------------------------- |
| ESLint                                     | Passed                                        |
| TypeScript typecheck                       | Passed                                        |
| Prettier formatting                        | Passed                                        |
| Unit tests                                 | 158 passed across 7 files                     |
| Full production browser regression suite   | 56 passed                                     |
| Additional Quick score/game isolation test | Passed                                        |
| Accessibility after navigation change      | Passed                                        |
| Regular production build                   | Passed                                        |
| GitHub Pages production build              | Passed with `/JpMj_Calculator/` base path     |
| Pages-path browser smoke test              | Passed                                        |
| Live restored Roboflow model smoke test    | Passed; two inferences with one model startup |

The full browser suite covered rule presets, 3P/4P scoring, multiple Ron, Pao, draws, settlement and undo, saved drafts, reload/offline behavior, four languages, themes, install reminder choices, tile input and touch/mouse reordering, nearby error messages and icons, storage warnings, and automated WCAG accessibility checks. These are regression checks, not proof of every possible hand or rule combination.

The Pages-path test served the artifact under the repository directory and checked hash navigation, direct reload, manifest scope, configuration/version/artwork entries in the service-worker cache, scoring, the error icon, offline route reload and cached tile artwork. The live model test used the public app icon as a non-sensitive sample; it established initialization, inference and warm-worker reuse. It did not measure physical-tile recognition accuracy or confirm that the configured key will work from every deployed origin.

## Quick score and ongoing games

Quick score has separate rules and temporary input, without a saved match attached. The new isolation test created a 4P Tenhou match with a saved hand and Riichi deposit, switched to a 3P standalone calculation, and then verified that the original match's rules, hand draft, balances, escrow and ledger were unchanged. My table is highlighted for ongoing games; Quick score has a separate entry link.

## Configuration and remaining limits

- Recognition is restored to `mahjong-baq4s-q6hto`, version 1, with its original suit/honor mappings.
- A publishable key and support email are configured; their values are omitted from this report.
- Both builds report existing CommonJS optimization warnings from `inferencejs` dependencies (`node-fetch` and `util`). They do not fail the build or its bundle budgets.
- Browser tests use Chromium, including mobile viewport/touch emulation. Native installation on a real iPhone/Android device and other browser engines were not tested here.
- Physical-photo accuracy and red-five recognition remain for future evaluation, as agreed.

For a later release, include all component moves, route/spec changes and configuration updates as well as the `shared/error-notice` component and navigation changes. GitHub Actions publishes committed repository content, not uncommitted local files. The deployment workflow was reviewed but not triggered.

Temporary Pages smoke-test setup and screenshots are under the ignored `artifacts/` directory. Regular browser regression tests, including Quick score isolation, remain under `e2e/`.
