# Local records

The Records navigation tab replaces the saved-table list on the home page. All existing IndexedDB matches appear automatically; no migration is needed. Open or delete tables from the Games view.

Filters open in a compact modal with a two-column layout and a sticky action row. Changes stay in a draft until Apply filters is pressed. Close or Escape discards unapplied changes; Reset filters inside the modal clears the draft, while the reset button on the page clears applied filters. Invalid date ranges keep Apply disabled.

Filters use the local calendar date when the table was created, inclusive of both endpoints. Game mode combines player count (3P/4P) and game length (East-only/East and South). Participant matches a stored name exactly. Games sort by creation date, newest or oldest first.

Games show current standings, raw points, recorded duration, and final scores/money for completed tables. New live tables use their saved play timer, excluding pauses. Legacy tables without a timer estimate elapsed time from creation to the final recorded event, including breaks.

Players aggregate completed games only. Existing player IDs belong to each table, so trimmed, case-sensitive names identify people across tables. Using the same name for different people combines their statistics. A participant filter limits the player view to that person.

Total points are the sum of final minus starting balances. Total score includes each game's saved Uma, Oka and rounding rules. Average rank uses the saved tie policy. Money uses the saved betting/chip rules and remains separate by currency; monetary sorting selects one currency rather than adding currencies together. Names sort ascending; game count, points, score and money sort descending; average rank sorts ascending. Name breaks sorting ties.

Unfinished games appear in Games but do not contribute to player statistics. Deleting a completed table removes its contribution on reload.
