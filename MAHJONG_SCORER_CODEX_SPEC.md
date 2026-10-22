# Mahjong Scorer — Codex Implementation Specification

> **Role for Codex:** Act as a senior full-stack engineer. Implement a maintainable, tested, mobile-first Japanese Riichi Mahjong scoring application based on this specification. **Do not stop at scaffolding or documentation.** Build working vertical slices, run tests, and report what works and what remains incomplete. Make reasonable decisions when a detail is unspecified; document those decisions rather than blocking on questions.

## 0. Product mission

Build a **photo-assisted, manually correctable Riichi Mahjong scoring app** supporting **Mahjong Soul-inspired ranked 4-player (Yonma) and 3-player (Sanma) rules**. Users should be able to:

1. Create a 3P or 4P match, set player names, assign seats, and track scores.
2. Take or upload photos of a winning player's tiles (plus exposed melds or other players' hands if desired).
3. Review individual tile recognition candidates; edit, reorder, add, or remove tiles without using AI.
4. Group tiles into **Chi, Pon, Daiminkan (open Kan), Ankan (concealed Kan), Kakan (added Kan)** and record the provider of the called tile, when applicable.
5. Enter win context: Ron/Tsumo, winner, discarder, winning tile, round/seat winds, Riichi, Ippatsu, indicators, honba, riichi sticks, special events, etc.
6. Calculate and explain **validity, Yaku, Fu, bonus Han, limits, individual payments, and updated player balances**.
7. Save, revisit, edit, and audit rounds and matches.
8. Work on **iPhone Safari, Android browsers, and desktop**; manual scoring and locally saved matches must work offline.

**Crucial:** A photo cannot reliably reveal Riichi, win method, concealed/open history, tile provider, dora indicators, or situational Yaku. Ask the user explicitly, never infer such facts as certain. The AI only suggests tiles; a **deterministic scoring engine** determines points.

## 1. Technology choices

### Frontend
- **Angular (current stable version compatible with installed toolchain)**, standalone components, lazy routes, strict TypeScript, Angular Signals; add **NgRx Signal Store** only if state complexity warrants it.
- Tailwind CSS; use Spartan UI for accessible controls where compatible, but avoid blocking development on UI library incompatibilities.
- Angular PWA / service worker; mobile-first responsive UI, with camera input (`accept="image/*" capture="environment"`) and regular file selection fallback. No Mac/Xcode required for Safari PWA.
- IndexedDB via a thin repository adapter (Dexie is acceptable) for local matches and draft capture data. Do not store large images in localStorage.
- A framework-neutral **TypeScript scoring domain package** shared with frontend tests. Scoring must run entirely client-side/offline.

### Backend (add once core UI + scoring works)
- ASP.NET Core Web API (supported LTS .NET version available in environment), EF Core, PostgreSQL for optional sync/history and metadata.
- Prefer a **modular monolith**. Do not introduce microservices, message brokers, auth, or cloud services for no reason.
- Optional image-recognition adapter/service: start with a **mock/manual detection adapter** and interface; implement real inference only once a suitable model/API is available. An optional Python FastAPI/OpenCV/YOLO worker may be added later, not as a blocker. Document licensing and privacy before using hosted image AI.
- The PWA must remain useful without backend connectivity. Don't require user accounts in MVP.

### Tests / quality
- TypeScript unit tests using the Angular-supported test runner; Playwright for critical E2E flows; xUnit for .NET API if present.
- ESLint/formatting, strict null checking, no `any` for domain types, accessible semantics.
- Keep all point math integer-based, deterministic, side-effect-free and independently testable.

## 2. Explicit MVP scope and phases

**Phase A — Working manual scorer, no server required (highest priority)**
- Create Angular PWA, accessible responsive navigation, 3P/4P setup, seat/player editor, local persistence.
- Build tile palette, editable concealed hand, winning tile indicator, meld grouping and source-player editor, dora inputs, North/Kita editor.
- Implement validated 4P/3P scoring engine: Yaku/Fu/limits/payments with a structured explanation. Begin with a vertical slice (common hands), then expand until supported standard rules are fully tested.
- Ron/Tsumo, dealer/non-dealer, honba, riichi sticks, one winner, score balance changes; explicit *unsupported-case* messages for any not-yet-implemented branch. No fake success.
- Hand-history CRUD and score audit trail.

**Phase B — Robust game flow**
- Draws (exhaustive and abortive where applicable), tenpai/noten transfers, dealer repeat/rotation, double/multiple Ron, responsibility payments, special hands, match-end conditions.
- Regression fixtures for Sanma special cases.

**Phase C — Photo capture and AI assistance**
- Camera/upload + crop/rotate/preview; detection adapter contract returning per-tile bounding boxes, label and confidence.
- Integrate real detector once chosen. Never claim model inference is implemented if only a stub exists.
- Human-in-the-loop corrections and ability to override each box/label; save raw suggestions separately from confirmed hand data.

**Phase D — Optional backend/sync**
- ASP.NET Core API, PostgreSQL schema/migrations, sync conflict strategy, photo storage policy; auth only when required.

Do not trade scoring correctness for appearance. If you cannot finish all phases, ship a coherent, working Phase A and explain coverage gaps.

## 3. Navigation and user flow

1. **Home:** New match / Resume / Quick score / Recent matches.
2. **Game Setup:** Select Mahjong Soul 3P Ranked or 4P Ranked, East-only/South game, player names and initial seating; show editable advanced house rules separately from canonical presets.
3. **Round Screen:** Show winds, dealer, honba, table riichi pot, player balances; select Win, Draw or Edit.
4. **Capture/Manual Entry:** Photo capture is optional. Provide a persistent **Enter tiles manually** action. Display confirmed tile chips/artwork and groups.
5. **Meld Editor:** Choose meld type, specific tiles, *called tile index*, *source player*, and exposed/concealed state. A Chi must come from the preceding player's discard; Pon/Open Kan from another player; Ankan has no external provider; Kakan references an existing Pon and retains its original provider.
6. **Win Details:** Choose winner(s), Ron/Tsumo, discarder for Ron, winning tile, winds, situational claims, Riichi/double Riichi/Ippatsu, dora/ura/kan indicators, red tiles, extracted North, honba/riichi pot.
7. **Review & Result:** Highlight validation errors, show decomposition chosen, Yaku with han values, fu breakdown, bonus han, limit name, payments **per payer**, delta per player, updated balances; Confirm / Edit / Save.
8. **Match History:** List and review previously saved events; editing a previous round must replay subsequent deltas deterministically, or be blocked with a clear explanation until supported.

Design touch targets for mobile, high contrast on tile artwork, undo/redo for tile edits, and a prominent status distinction among `recognized`, `corrected`, and `verified` tiles.

## 4. Domain model (strongly typed)

Do not model tile identity as an unchecked free-form string internally. Use validated 34 tile kinds plus a red-five flag; 3P removes 2m–8m and red 5m. Tiles require physical identity/IDs when provenance and edit history matter. Model concealed tiles, melds and extracted North separately.

```typescript
type PlayerCount = 3 | 4;
type Wind = 'east' | 'south' | 'west' | 'north';
type Suit = 'man' | 'pin' | 'sou';
type Dragon = 'white' | 'green' | 'red';
type TileKind =
  | { type: 'suited'; suit: Suit; rank: 1|2|3|4|5|6|7|8|9 }
  | { type: 'wind'; wind: Wind }
  | { type: 'dragon'; dragon: Dragon };
interface Tile { id: string; kind: TileKind; isRed: boolean; }
type MeldType = 'chi'|'pon'|'daiminkan'|'ankan'|'kakan';
interface Meld {
  id: string;
  type: MeldType;
  tiles: Tile[];
  calledTileId?: string;
  fromPlayerId?: string;
  upgradedFromMeldId?: string;
}
interface Hand {
  playerId: string;
  concealedTiles: Tile[]; // winning tile can be separately designated by ID
  melds: Meld[];
  extractedNorthTiles: Tile[];
}
type WinMethod = 'ron' | 'tsumo';
interface WinEvent {
  winnerId: string;
  method: WinMethod;
  discarderId?: string;
  winningTileId: string;
  riichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  rinshan: boolean;
  chankan: boolean;
  haitei: boolean;
  houtei: boolean;
  tenhou: boolean;
  chiihou: boolean;
}
interface Payment {
  from: string; // player ID or named table pot account
  to: string;
  amount: number; // nonnegative integer points
  reason: string;
}
interface ScoreResult {
  isValid: boolean;
  errors: string[];
  yaku: { id: string; name: string; han?: number; yakumanMultiplier?: number }[];
  bonusHan: { source: string; count: number }[];
  fu: number;
  fuBreakdown: { reason: string; value: number }[];
  han: number;
  limitName?: string;
  payments: Payment[];
  playerDeltas: Record<string, number>;
}
```

Additional persisted entities:
- `RuleProfile` (id, version, mode, immutable snapshot of settings).
- `Match`, `MatchPlayer` (stable user identity versus seat per hand), `Round` (round wind, hand number, dealer, honba, riichi pot, pre-event balances).
- `Capture` + `TilePrediction` (image reference, geometry, confidence, raw model/version output, confirmed mapping).
- `RoundEvent` discriminated union (`win`, `exhaustiveDraw`, `abortiveDraw`, `riichiDeposit`, adjustments).
- `ScoreTransaction` ledger with stable event id for audit and replay.
- Timestamp/schema version fields and migrations for IndexedDB.

**Invariants:** Never allow >4 copies of a tile kind across a known complete physical set; red five replaces, not supplements, a normal five. Respect 3P tile restrictions, 4 melds + pair (or supported exceptions), Kan tile accounting and extracted North outside the hand. Validate no duplicate IDs and no self-sourced calls. Validate a complete hand before scoring; do not silently fill missing tiles.

## 5. Scoring engine design

Place pure modules in an independent package:

```text
packages/mahjong-core/       tile types, validation, set operations
packages/mahjong-rules/      versioned 3P/4P Mahjong Soul settings
packages/mahjong-scoring/    winning forms, yaku, fu, dora, limit, payment
packages/mahjong-fixtures/   known cases and golden expected results
```

Pipeline:

```text
verify input / rules / hand completeness
  -> enumerate ALL legal winning interpretations (including special hands)
  -> evaluate Yaku + Yakuman / validity (bonus tiles alone are NOT Yaku)
  -> compute fu with proper exceptions and winning-tile placement
  -> count dora, ura, aka, kan dora, Kita where applicable
  -> compute limit/base score using integer arithmetic
  -> compute payer-by-payer Ron/Tsumo with 3P profile behavior
  -> apply honba, riichi escrow, pao if applicable
  -> select highest valid scoring interpretation under profile
  -> issue auditable settlement and calculate next state
```

Important details:
- Same tile pattern may have multiple legal decompositions; choose the legal interpretation most beneficial to the winner, **not** simply the one with maximum han.
- Separate Yaku Han and Dora Han. Yakuman rules must not accidentally combine with regular Yaku where prohibited by profile.
- Support Pinfu and Chiitoitsu fu exceptions, wait fu, open/closed Ron distinctions, closed/open triplets and Kan, value pair, fu rounding, and limit tiers (Mangan/Haneman/Baiman/Sanbaiman/Yakuman).
- Use integer-only `ceilTo100`. Normal raw base points = `fu * 2^(han+2)` with cap/limit handling; **high-han limits and yakuman must be applied before naive exponentiation overflows.**
- Basic regular Ron = ceil100(base × [6 if dealer else 4]). 4P Tsumo: dealer winner takes ceil100(base×2) from each other player; non-dealer winner takes ceil100(base×2) from dealer and ceil100(base) from each non-dealer. 3P **ranked Tsumo-loss**: only the two existing opponents pay those respective shares; no phantom fourth-player contribution. Add North-Bisection as **separate configurable alternative**, not 3P default.
- Riichi sticks are table escrow already removed from declarers when declared. Winning a pot moves money from table escrow to winner; never double-charge the players. The conservation check must include escrow (and distinguish any external score adjustments).
- Open Tanyao is allowed by default. Kiriage Mangan disabled in the default ranked preset; optional setting may enable it.
- Clearly label unsupported cases instead of returning a plausible but incorrect score.

### Canonical rule-profile starting values

| Setting | 4P Mahjong Soul Ranked | 3P Mahjong Soul Ranked |
|---|---|---|
| Players | 4 | 3 |
| Starting points | 25,000 | 35,000 |
| Tile set | Standard 136 | 108, no manzu 2–8 |
| Red fives | 5m, 5p, 5s | 5p, 5s |
| Chi | Yes | No |
| Pon, Kan | Yes | Yes |
| Kita / North extraction | No | Yes (bonus, not Yaku) |
| Tsumo payment | Standard 4P | **Tsumo-loss enabled** |
| Noten pool on exhaustive draw | 3,000 | 2,000 |
| Honba | Ron +300; Tsumo +100/payer | Ron +200; Tsumo +100/payer |
| Open Tanyao | Enabled | Enabled |
| Kiriage Mangan | Disabled | Verify against ranked references; make configurable |

For 3P, when a 1m dora indicator appears, the next manzu dora is 9m (and vice versa), not a removed tile. North extraction has its own eligibility/robbed-Kita edge cases; keep rules behind profile and tests.

**Verification gate:** Before implementing all optional/rare mechanics (multi-Ron, responsibility, draw conditions, Kita + special conditions, double Yakuman and match-end), confirm precise Mahjong Soul behavior from cited rules references and golden in-game examples. Put uncertainties in `docs/rule-verification.md`, do not assert guesses as canonical rules.

**Do not conflate:** points exchanged during a hand, accumulated raw table points, match-final uma/oka/return-point adjustment, and Mahjong Soul *rank* progression. For MVP, prioritize **hand settlement/raw balances**. Match-final placement score can be a separate clearly labeled module.

## 6. Photo recognition integration contract

```typescript
interface TilePrediction {
  box: { x: number; y: number; width: number; height: number }; // normalized 0..1
  candidates: Array<{ tile: TileKind; isRed: boolean; confidence: number }>;
  orientationDegrees?: number;
  predictedGroupId?: string;
}
interface TileRecognizer {
  recognize(input: Blob, options: { playerCount: PlayerCount }): Promise<{
    modelName: string;
    modelVersion: string;
    predictions: TilePrediction[];
  }>;
}
```

- Implement `MockTileRecognizer` for demo/testing with clearly labeled mock results; no fake AI inference claims.
- Add a real recognizer only if credentials/model artifacts/configuration are available. Keep image upload consent, retention and error handling explicit.
- Do not send photos to a third-party API without describing it and requiring the user's action/consent.
- Persist both raw predictions and user-confirmed tiles. Manual corrections override AI permanently unless the user chooses to re-run recognition.
- Support multiple photographs per hand and manual merging, but do not automatically assume an image contains an entire 14-tile hand.

## 7. Backend API (Phase D; not required for offline MVP)

Version REST paths under `/api/v1`:
- `GET/POST /matches`, `GET/PATCH /matches/{id}`
- `GET/POST /matches/{id}/rounds`, `GET/PATCH /rounds/{id}`
- `POST /rounds/{id}/calculate` (optional server-side audit/check; frontend remains source of local computation)
- `POST /captures` (opt-in image upload) and `POST /captures/{id}/recognize`
- `GET /rule-profiles`

Use DTO validation, EF Core migrations, structured errors (Problem Details), optimistic concurrency and idempotent event writes. Make server storage optional; local device must function without API.

## 8. Testing requirements / golden cases

Create table-driven tests with explicit expected Yaku, Han, Fu and **payer-by-payer amounts**:

1. 4P dealer/non-dealer Ron/Tsumo including normal hand, Mangan, Haneman, Baiman, Sanbaiman, Yakuman.
2. 3P Ron and Tsumo-loss (dealer/non-dealer), 3P honba, alternate North-Bisection setting.
3. A **non-dealer 3P Mangan Tsumo** gets 4,000 from dealer and 2,000 from the one non-dealer: **6,000 total before honba/sticks**.
4. 4P non-dealer 3 Han 40 Fu Ron = 5,200; dealer = 7,700.
5. Pinfu Tsumo; Chiitoitsu fixed 25 Fu; double wind pair; open/closed Kan differences.
6. Red dora, dora/ura/kan indicators, 3P North extraction; dora-only hand rejected.
7. Invalid tile counts, >4 same tiles, red tile rules, prohibited 3P manzu, 3P Chi, invalid meld provider, incorrect Kakan history.
8. Riichi pot conservation, double settlement prevention, undo/edit and transaction replay.
9. Multiple candidate forms: select highest **payment** result under rules.
10. Photo mock result editing, manual fallback, offline data survival, iPhone-sized viewport and camera file fallback.

Mark tests for unimplemented advanced rules as `todo` with reason; **never claim full rules coverage if some are skipped**. Maintain a clear feature/coverage matrix.

## 9. UX and accessibility requirements

- Design for 375px width upward; avoid horizontal overflow and tiny touch targets.
- Show player identification by name **and** wind; seat winds rotate between hands.
- Tile UI should be usable by tap, not drag-and-drop only. Include keyboard/manual text notation as an advanced shortcut.
- Visible validation banners; show exact missing or contradictory inputs.
- Review screen should distinguish Yaku vs Dora and explain how each payer's amount was derived.
- Screen reader labels on tile, meld and camera buttons; accessible contrast and focus states.
- Localized English labels initially, Japanese names in parentheses; design text through an i18n-friendly dictionary for future Japanese/Chinese.

## 10. Repository conventions / deliverables

Recommended structure:

```text
apps/web/                  Angular PWA
apps/api/                  ASP.NET Core API (Phase D)
packages/mahjong-core/
packages/mahjong-rules/
packages/mahjong-scoring/
packages/mahjong-fixtures/
docs/architecture.md
docs/rule-verification.md
docs/feature-coverage.md
README.md
```

If a workspace or existing repository is provided, **inspect and respect it first** instead of overwriting it. Prefer incremental coherent commits/changes. Keep API keys out of git. Include a `.env.example` only if needed.

### Mandatory Codex execution order
1. Inspect project/repo and environment; pick stable dependency versions actually available.
2. Write a concise actionable plan in the working notes and implement **Phase A** first.
3. Build domain types, rules profiles, validation and scoring with tests **before** integrating AI.
4. Build game setup, editable hand/meld UI, win input, results and IndexedDB storage.
5. Run lint, typecheck, unit tests, build, and E2E tests when tooling permits; fix failures.
6. Add capture UI and mock detection adapter; label limitations truthfully.
7. If time and dependencies permit, complete Phase B, then C/D in order.
8. Update README with setup/run/test commands, feature coverage, known gaps and next actions.

### Definition of done for working Phase A
- A user on an iPhone in Safari can launch the deployed PWA, start 3P/4P match, manually compose a complete winning hand with melds, enter round metadata, calculate a valid supported score, inspect payer breakdown, confirm settlement, and reopen it later without an account.
- Invalid/incomplete hands cannot be settled.
- Known 3P/4P benchmark cases match expected integer payments.
- All balances and table-escrow ledger entries reconcile; no round can be settled twice.
- No online recognition/backend is required for these actions.

## 11. References and source-of-truth policy

Use these references as starting points, not as a substitute for verifying disputed Mahjong Soul-specific edge cases:

- Mahjong Soul overview/rules and 3P notes: https://riichi.wiki/index.php?title=Mahjong_Soul
- Popular Riichi ruleset comparison (Mahjong Soul columns): https://riichi.wiki/Comparison_of_popular_rulesets
- 4P Mahjong Soul-inspired rule summary: https://mahjongsushi.com/rules/

If these sources disagree on rare scoring mechanics, log the discrepancy and require an in-game golden case or more authoritative evidence before shipping that rule as verified. The user wants **Mahjong Soul as the default**, not a claim that this product is officially affiliated with Mahjong Soul.

---

**Start implementation now.** Deliver runnable code, not just an architecture essay. Prioritize accurate manual scoring and mobile UX; treat photo AI and cloud sync as extensions. At the end, state exactly which requirements work, which are mocked, which are unimplemented, and the commands to run and test the project.
