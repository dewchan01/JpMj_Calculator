import { kindIndex, WINDS } from '../mahjong-core/index';
import type { ScoringInput } from './types';
import { ruleSettings, tableRules, validateProfile } from '../mahjong-rules/index';
export function validate(input: ScoringInput): string[] {
  const { rules, hand, win, players } = input;
  const errors: string[] = [...validateProfile(rules)];
  if (
    tableRules(rules).waremeMultiplier !== 1 &&
    !players.some((player) => player.id === input.waremePlayerId)
  )
    errors.push('Select the Wareme player for this hand.');
  if (rules.preset === 'm-league' && rules.playerCount !== 4)
    errors.push('M.League supports four players only.');
  const settings = ruleSettings(rules);
  const ids = players.map((p) => p.id);
  const open = hand.melds.some((m) => m.type !== 'ankan');
  if (
    players.length !== rules.playerCount ||
    new Set(ids).size !== ids.length ||
    ids.includes('table')
  )
    errors.push('Provide distinct players for every seat (table is reserved).');
  if (!ids.includes(win.winnerId) || hand.playerId !== win.winnerId)
    errors.push('The hand must belong to a seated winner.');
  if (!ids.includes(input.dealerId)) errors.push('Select a seated dealer.');
  if (!WINDS.includes(input.roundWind)) errors.push('Select a valid round wind.');
  if (!['ron', 'tsumo'].includes(win.method)) errors.push('Select Ron or Tsumo.');
  if (
    win.method === 'ron' &&
    (!win.discarderId || !ids.includes(win.discarderId) || win.discarderId === win.winnerId)
  )
    errors.push('Ron requires another seated player as discarder.');
  if (win.method === 'tsumo' && win.discarderId) errors.push('Tsumo has no discarder.');
  if (
    hand.melds.length > 4 ||
    (!input.manualScore && hand.concealedTiles.length !== 14 - 3 * hand.melds.length)
  )
    errors.push(
      `Expected ${14 - 3 * hand.melds.length} concealed tiles, including the winning tile.`,
    );
  if (!input.manualScore && !hand.concealedTiles.some((t) => t.id === win.winningTileId))
    errors.push('Designate a concealed tile as the winning tile.');
  for (const [label, value] of [
    ['Honba', input.honba],
    ['Riichi sticks', input.riichiSticks],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 100)
      errors.push(`${label} must be an integer from 0 to 100.`);
  }
  const all = [
    ...hand.concealedTiles,
    ...hand.melds.flatMap((m) => m.tiles),
    ...hand.extractedNorthTiles,
    ...input.doraIndicators,
    ...input.uraIndicators,
  ];
  if (new Set(all.map((t) => t.id)).size !== all.length)
    errors.push('Each physical tile must have a unique ID.');
  const counts = Array<number>(34).fill(0),
    reds = Array<number>(34).fill(0);
  for (const tile of all) {
    const i = kindIndex(tile.kind);
    if (i < 0 || i > 33 || !Number.isInteger(i)) {
      errors.push('Invalid tile kind.');
      continue;
    }
    counts[i]++;
    if (tile.isRed) {
      reds[i]++;
      if (i >= 27 || i % 9 !== 4) errors.push('Only suited fives can be red.');
    }
    if (rules.playerCount === 3 && i >= 1 && i <= 7)
      errors.push('Sanma excludes 2m–8m, including red 5m.');
  }
  if (counts.some((c) => c > 4))
    errors.push(
      'A tile kind cannot have more than four physical copies, including indicators and Kita.',
    );
  if (!settings.redFives && reds.some((c) => c > 0))
    errors.push('Red fives are disabled in this rule profile.');
  if (reds.some((c) => c > 1)) errors.push('Only one red five per suit is available.');
  if (
    settings.redFives &&
    [4, 13, 22].some((i) => (rules.playerCount === 4 || i !== 4) && counts[i] - reds[i] > 3)
  )
    errors.push('Each suit has three ordinary fives and one red five.');
  if (rules.playerCount === 4 && hand.extractedNorthTiles.length)
    errors.push('Kita is available only in Sanma.');
  if (hand.extractedNorthTiles.some((t) => kindIndex(t.kind) !== 30))
    errors.push('Only North tiles can be extracted.');
  if (new Set(hand.melds.map((m) => m.id)).size !== hand.melds.length)
    errors.push('Meld IDs must be unique.');
  for (const meld of hand.melds) {
    const kinds = meld.tiles.map((t) => kindIndex(t.kind)).sort((a, b) => a - b);
    if (!['chi', 'pon', 'daiminkan', 'ankan', 'kakan'].includes(meld.type))
      errors.push('Unsupported meld type.');
    if (meld.tiles.length !== (meld.type === 'chi' || meld.type === 'pon' ? 3 : 4))
      errors.push('Chi/Pon require three tiles; Kan requires four.');
    if (meld.type === 'chi') {
      if (rules.playerCount === 3) errors.push('Chi is prohibited in Sanma.');
      if (
        kinds[0] >= 27 ||
        Math.floor(kinds[0] / 9) !== Math.floor(kinds[2] / 9) ||
        kinds[1] !== kinds[0] + 1 ||
        kinds[2] !== kinds[0] + 2
      )
        errors.push('Chi must be three consecutive tiles in one suit.');
      const preceding = ids[(ids.indexOf(hand.playerId) + ids.length - 1) % ids.length];
      if (meld.fromPlayerId !== preceding) errors.push('Chi must come from the preceding player.');
    } else if (kinds.some((i) => i !== kinds[0]))
      errors.push('Pon/Kan tiles must have the same kind.');
    if (meld.type === 'ankan') {
      if (meld.fromPlayerId || meld.calledTileId)
        errors.push('Ankan has no source player or called tile.');
    } else {
      if (
        !meld.fromPlayerId ||
        !ids.includes(meld.fromPlayerId) ||
        meld.fromPlayerId === hand.playerId
      )
        errors.push('A called meld needs another seated source player.');
      if (!meld.tiles.some((t) => t.id === meld.calledTileId))
        errors.push('Identify the called tile within the meld.');
    }
    if (meld.type === 'kakan') {
      const pon = meld.originalPon;
      if (
        !pon ||
        pon.id !== meld.upgradedFromMeldId ||
        pon.id === meld.id ||
        pon.tiles.length !== 3 ||
        pon.calledTileId !== meld.calledTileId ||
        pon.fromPlayerId !== meld.fromPlayerId ||
        new Set(pon.tiles.map((t) => t.id)).size !== 3 ||
        !pon.tiles.some((t) => t.id === pon.calledTileId) ||
        pon.tiles.some(
          (t) =>
            !meld.tiles.some(
              (u) =>
                u.id === t.id && kindIndex(u.kind) === kindIndex(t.kind) && u.isRed === t.isRed,
            ),
        )
      )
        errors.push('Kakan must retain a valid original Pon, its tiles, called tile and source.');
    }
  }
  if (open && (win.riichi || win.doubleRiichi || win.ippatsu))
    errors.push('Riichi/Ippatsu require a closed hand.');
  if (win.riichi && win.doubleRiichi) errors.push('Select Riichi or double Riichi, not both.');
  if (win.ippatsu && !win.riichi && !win.doubleRiichi)
    errors.push('Ippatsu requires Riichi or double Riichi.');
  const kanCount = hand.melds.filter((m) =>
    ['ankan', 'daiminkan', 'kakan'].includes(m.type),
  ).length;
  const otherKans = input.otherPlayerKans ?? 0;
  if (!Number.isInteger(otherKans) || otherKans < 0 || otherKans + kanCount > 4)
    errors.push('The table can contain at most four Kans; enter a valid other-player Kan count.');
  if (
    win.rinshan &&
    (win.method !== 'tsumo' ||
      (win.replacement === 'kita'
        ? rules.playerCount !== 3 || !hand.extractedNorthTiles.length || !settings.kitaRinshan
        : !kanCount))
  )
    errors.push('Rinshan requires Tsumo and the declared Kan/Kita replacement draw.');
  if (
    (win.haitei && win.method !== 'tsumo') ||
    ((win.houtei || win.chankan) && win.method !== 'ron')
  )
    errors.push('Situational claims conflict with the win method.');
  if ([win.rinshan, win.chankan, win.haitei, win.houtei].filter(Boolean).length > 1)
    errors.push('These special win circumstances cannot be combined.');
  if (win.ippatsu && win.rinshan) errors.push('A Kan interrupts Ippatsu.');
  if (win.tenhou || win.chiihou) {
    if (
      (win.tenhou && win.chiihou) ||
      win.method !== 'tsumo' ||
      !win.firstTurnUninterrupted ||
      hand.melds.length ||
      hand.extractedNorthTiles.length ||
      otherKans ||
      win.riichi ||
      win.doubleRiichi ||
      win.ippatsu ||
      win.rinshan ||
      win.chankan ||
      win.haitei ||
      win.houtei
    )
      errors.push(
        'First-turn Yakuman requires an uninterrupted first draw, no calls/Kita, and no conflicting claims.',
      );
    if (
      (win.tenhou && win.winnerId !== input.dealerId) ||
      (win.chiihou && win.winnerId === input.dealerId)
    )
      errors.push('Tenhou is dealer-only; Chiihou is non-dealer-only.');
  }
  if (win.robbed === 'kita') {
    if (
      rules.playerCount !== 3 ||
      win.method !== 'ron' ||
      kindIndex(
        hand.concealedTiles.find((t) => t.id === win.winningTileId)?.kind ?? {
          type: 'wind',
          wind: 'east',
        },
      ) !== 30 ||
      win.chankan ||
      win.houtei
    )
      errors.push('Robbing Kita requires Ron on North; it does not award Chankan or Houtei.');
  } else if (win.robbed) {
    if (!win.chankan || win.method !== 'ron')
      errors.push('Robbing a Kan requires the Chankan claim and Ron.');
    if (
      win.robbed === 'ankan' &&
      (!settings.kokushiAnkanRon ||
        hand.melds.length ||
        !isKokushi(hand.concealedTiles.map((t) => kindIndex(t.kind))))
    )
      errors.push('This profile permits robbing Ankan only for Kokushi when enabled.');
  }
  if (input.doraIndicators.length > 1 + kanCount + otherKans)
    errors.push('Dora indicator count exceeds one plus the declared table Kans.');
  if (input.uraIndicators.length && !win.riichi && !win.doubleRiichi)
    errors.push('Ura dora requires Riichi.');
  if (input.uraIndicators.length && input.uraIndicators.length !== input.doraIndicators.length)
    errors.push('Supply one ura indicator for each visible dora indicator.');
  return [...new Set(errors)];
}
function isKokushi(kinds: number[]): boolean {
  const needed = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  return (
    kinds.length === 14 &&
    needed.every((i) => kinds.includes(i)) &&
    kinds.every((i) => needed.includes(i))
  );
}
