# Rule verification register

Reviewed 2026-10-22. Platform-labelled presets are independent implementations. Custom settings are explicitly house rules.

## Primary references

- [Official Tenhou manual](https://tenhou.net/man/#RULE), rules/Yaku sections: single special-wait Yakuman, triple-Ron abort, whole-hand Pao, and progression. The red/open-Tanyao lobby variant is selected.
- [Official Mahjong Soul FAQ](https://mahjongsoul.com/faq). Its public [FAQ data](https://mahjongsoul.com/api/faq/list) was fetched because the rendered page is JavaScript-only. Answers confirm adopted Yaku, first-turn wins, special forms, four Kans, Kokushi robbery of Ankan, Nagashi eligibility, abortive categories, Tsumo-loss and Pao. Temporary downloads were removed.

## Corroboration

- [Mahjong Soul wiki](https://riichi.wiki/index.php?mobileaction=toggle_view_desktop&title=Mahjong_Soul): indexed excerpts available; direct fetch returns 403. Used with the supplied spec for double-Yakuman multipliers, component Pao and Kita.
- [Mahjong Sushi](https://mahjongsushi.com/rules/): secondary implementation comparison, not platform authority.
- [Published single-wait 64,000 example](https://www.reddit.com/r/mahjongsoul/comments/veujik): indexed player report corroborates a double-Yakuman payment. The original image was not fetched or converted into a tile-level fixture.

## Implemented differences

| Setting                        | Mahjong Soul            | Tenhou                  |
| ------------------------------ | ----------------------- | ----------------------- |
| Special waits / big four winds | Double                  | Single                  |
| Separate Yakuman               | Stack                   | Stack                   |
| Triple Ron                     | All winners             | Abortive draw           |
| Double Ron                     | Both winners            | Both winners            |
| Multi-Ron honba / escrow       | Nearest winner only     | Nearest winner only     |
| Dragon/wind responsibility     | Liable component        | Whole combined hand     |
| Kokushi robbing Ankan          | Allowed                 | Disallowed              |
| Four-Kan Pao                   | None                    | None                    |
| Sanma Tsumo                    | Existing opponents only | Existing opponents only |
| Kiriage                        | Off                     | Off                     |

Both profiles retain the supplied 3P Ron honba benchmark of 200 and Tsumo 100/payer. Some secondary sites disagree about Soul's 3P Ron honba; the explicit spec benchmark is retained pending a directly reproducible platform example. This was not independently reconfirmed.

## Declarations and verification limits

Users attest to first-draw continuity, legal Riichi/Furiten timing, draw/Nagashi eligibility, Tenpai, revealed indicators and call order. Structural and mathematical consistency is checked. Earlier extracted North does not itself disprove later timing claims. Robbing Kita gives no Chankan; replacement type is explicit.

Pao uses original exposed-set order and retains the Pon provider through Kakan. It redistributes existing Sanma Tsumo shares; honba is paid by the liable player. Unrelated Soul Yakuman components retain ordinary payments.

Nagashi replaces Noten transfers, supports simultaneous qualifiers, retains sticks, and repeats the dealer according to Tenpai. Final escrow goes to first place, initial seating breaking ties. Progression uses configured game length, target 30,000/40,000, an extension wind, bankruptcy below zero and first-place dealer finish.

Numerical fixtures are hand-authored, not imported platform replays. Full timing/rare-edge certification remains unfinished, particularly composite Pao and simultaneous Nagashi. This is documented without blanket-rejecting scoreable hands.

## M.League preset

Checked the [official competition rules](https://m-league.jp/about/) on 2026-10-22.
The four-player preset uses 25,000 starting points, red fives, head-bump Ron, Kiriage Mangan,
single special-wait Yakuman, stacked distinct Yakuman, and a Sanbaiman cap for ordinary hands.
Double-wind pairs receive two Fu. Ankan robbery, abortive draws and Nagashi Mangan are excluded.
Pao includes the fourth Daiminkan after three Kans, and concealed honor Kans count toward exposure
for the relevant liability decision. Recorded call order is required.

Matches use East/South rounds, continue through negative balances, and have no first-place dealer
finish or extension. Final tied leaders share remaining escrow; three-way ties use a 400/300/300
split per stick by initial seat order. Final league placement points, league/team standings and referee penalties remain outside
the app. This is a scoring and settlement preset, not a complete competition management system.
