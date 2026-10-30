# Local records and player analysis

Hand history uses the same result presentation on the live table and saved records. Each winner's Han/Fu, limit (Mangan, Haneman, Baiman, Sanbaiman, Yakuman or counted Yakuman), tiles and Yaku appear once in the expanded details. Multi-winner fields take precedence over mirrored single-winner fields. Older results without a saved limit derive its display from recorded Han/Fu and rule settings, including Kiriage and counted-Yakuman caps; stored payments are never rewritten.

## Entry points

Records lists **completed games only**. Click anywhere on a game card to open its saved result at
/records/:id; there is no continue/play action in Records. My table > Ongoing games lists unfinished
games and automatically resumes the selected game. Record results only sits beside that entry below
the setup card and stores final points plus a local game date, without inventing hand history.

The existing IndexedDB store is reused. Deleting a completed game removes its contribution to
player statistics. Removing a saved player name does not delete that person's historical games.

## Filters and sorting

Filters use inclusive local creation dates, player count/game length and a participant identity.
Game mode chips form one horizontally scrollable row with the filtered game count fixed on its right.
The long duration-estimation description is omitted. Sort is beside Filter records. Filter prompts
use draft values: Apply commits them, Close/Escape discards unapplied changes, Reset in the prompt
clears its draft, and Reset on the page clears applied filters. Invalid ranges disable Apply.
Mobile filter prompts are animated sheets; desktop prompts are centered. Shared sticky controls
retain the page gutter, and new tabs/filter chips reset scrolling.

Games sort by creation date. Cards show final standings, raw points and recorded duration. Timed
games exclude pauses; legacy games estimate duration from creation to the last recorded event.
Players aggregate completed games by `profileId`, retaining identity across display-name changes.
Matching names with different IDs remain separate; numbered names distinguish them without exposing IDs. Legacy games
without a profile ID use a game-and-seat identity rather than silently merging names. Selecting a
saved player in setup reuses their profile; new unsaved participants receive fresh identities.
A participant filter restricts the aggregate view to that person.

## Saved results

Manual Han entry wins retain their player-confirmed total Han/Fu, explicit Yakuman/Pao/chips and
the usual rule/round snapshot in `scoringInput.manualScore`. No complete concealed hand or inferred
Yaku/Dora breakdown is invented. History editing uses the stored mode and replays later payments;
the current device preference does not reinterpret older records. CSV and QR/ID transfer retain these
optional fields without changing existing complete-hand records.

- **Result:** compact standings or a metric-by-player comparison table that fits narrow screens. The comparison table shows names in its header and rank in a separate row; standings align the Player heading with player names.
  Raw points, converted point score, Uma, Oka and total score are shown; positive adjustments have a green + and deductions a red minus. There is no All players chip or per-player Details button in the comparison table.
  Each game in the records list also has a Total footer for points, final scores and money.
  When final results open inside the live-game dialog, the dialog heading stays outside the scrolling content;
  result tabs stick below it and retain their selected appearance.
  History uses divider-separated expandable lists without card backgrounds. Collapsed event rows include
  Ron/Tsumo, Han/Fu, limit names such as Mangan, and recorded Yaku when scoring metadata is available.
  A chevron expands each event. Its players share one horizontal row with vertical dividers;
  selecting a player shows their details in a compact shared panel below that row.
- **History:** expandable event details show points before/after, seats, Riichi, melds, winners and
  winning methods when those details were recorded.
- **Details:** score history and metric-grouped statistics; player chips filter both graph and cards.

The title/back/pencil/delete row and tab/layout controls are sticky; Details also keeps its player
filter row available. Pencil opens the shared final-point/date prompt. Point changes must conserve
the table total, recalculate rank/settlement and append a scoreAdjustment ledger event. Earlier hands
remain intact. Delete opens a confirmation. Save game/Discard game are offered for a just-ended live
game, not an already saved result. PNG sharing uses native file sharing or a download fallback.

Live-table History additionally offers Edit hand on each win/draw with a round snapshot. It restores
that hand into an in-memory draft for full outcome, player, call, tile and claim entry. Saving replays
later hands and final settlement in one version-checked write; Cancel preserves the original. Earlier
versions are retained in event revisions. Missing later scoring inputs or contradictory progression
blocks the save instead of deleting subsequent records. This action is distinct from the saved-result
pencil, which adjusts final points/date only.

## Player pages

Click a player row to open /records/player/:identity. Old name-only links resolve only when the name
identifies exactly one person. Overview, Statistics and Explore share dates and
player-count filters. Three-player and four-player samples remain separate.

Overview includes the last 16 chronological ranks, rank distribution, recent trend, winning-receipt
bins, playing tendencies, population rank variance/stability and M.League reference resemblance.
Statistics groups basic totals, rank rates, win/deal-in rates and scores by hand/opponent state,
open/Riichi/draw/dealer/Tenpai measures. Explore provides shared-opponent results, comparison curves,
shared game links and seat analysis. Fourth-place measures are unavailable in 3P.

Total points means final minus starting raw points; score means the saved Uma/Oka/rounding-adjusted
result. Money uses each game's saved betting/chip rules and stays separate per currency. Sorts use
name as their tie breaker. Missing legacy metadata is excluded from relevant denominators, not
counted as zero. Dama means closed without Riichi; an Ankan does not make a hand open. Corrections
and final penalties/escrow awards are not hand win/deal-in receipts. Tenpai uses recorded exhaustive
draws. See [live-table metric definitions](live-table.md) for state, stability and sample details.

## Transfer and limitations

CSV and QR/ID import/export is **under Others > Data**, with separate entries and game/player/date
selection; see [archive behavior](data-transfer.md). Imports automatically save players in the player library.
Saved players can be renamed from My table > Saved players without changing identity or historical snapshots.
No account, cloud synchronization or user-ID QR lookup
is implemented. Historical hand editing and a general existing-table name/seat editor remain absent.

Game-list metadata includes the latest completed hand's recorded round and Honba, using its before
snapshot rather than the next unplayed round. Result-only games and legacy records without that
snapshot omit the label instead of inventing a hand number. Live history uses a pencil beside the
chevron to edit a hand without first expanding it.

Each collapsed history summary includes its saved rule preset (Mahjong Soul, Tenhou, M.League or
the custom rule name) alongside player count, game length and round context. The game-list card
heading also shows the rule name beside player count and game length. It uses the latest completed hand's scoring/draw rule snapshot,
falling back to the saved game rules when metadata is absent. This is separate from the latest-hand
round/Honba metadata and never uses the currently applied global rules.

For non-scoring entries such as Match end, the history summary uses the latest preceding hand's
rule snapshot, falling back to the game rules when no scoring metadata is available.
