import type { RuleProfile } from './index';

export interface TableRules {
  extension: 'none' | 'one-round';
  bankruptcy: 'negative' | 'nonpositive' | 'off';
  returnPoints: number;
  notenPool: number;
  honbaRon: number;
  honbaTsumo: number;
  yakitoriPenalty: number;
  uma: number[];
  rounding: 'none' | 'nearest' | 'floor' | 'ceil';
  tiedRanks: 'seat-order' | 'share';
  bettingRate: number;
  currency: string;
  chipValue: number;
  chipRed: number;
  chipUra: number;
  chipIppatsu: number;
  chipYakuman: number;
  chipsOnOpenHands: boolean;
  tsumoMode: 'loss' | 'no-loss' | 'equal' | 'equal-dealer';
  paymentUnit: 100 | 1000;
  waremeMultiplier: number;
  allowNegativeRiichi: boolean;
  dealerPassAfterWin: boolean;
  dealerFinish: boolean;
  riichiReceiver: 'nearest' | 'split';
  finalRiichiReceiver: 'first' | 'split-top';
}

/** Missing settings preserve existing version-1/2 match snapshots. */
export function tableRules(profile: RuleProfile): TableRules {
  const league = profile.preset === 'm-league';
  return {
    extension: league ? 'none' : 'one-round',
    bankruptcy: league ? 'off' : 'negative',
    returnPoints: profile.playerCount === 3 ? 40000 : 30000,
    notenPool: profile.playerCount === 3 ? 2000 : 3000,
    honbaRon: profile.playerCount === 3 ? 200 : 300,
    honbaTsumo: 100,
    yakitoriPenalty: 0,
    uma: league ? [30, 10, -10, -30] : Array<number>(profile.playerCount).fill(0),
    rounding: 'none',
    tiedRanks: league ? 'share' : 'seat-order',
    bettingRate: 0,
    currency: '',
    chipValue: 0,
    chipRed: 1,
    chipUra: 1,
    chipIppatsu: 1,
    chipYakuman: 0,
    chipsOnOpenHands: false,
    tsumoMode: profile.tsumo === 'north-bisection' ? 'no-loss' : 'loss',
    paymentUnit: 100,
    waremeMultiplier: 1,
    allowNegativeRiichi: league,
    dealerPassAfterWin: false,
    dealerFinish: !league,
    riichiReceiver: 'nearest',
    finalRiichiReceiver: league ? 'split-top' : 'first',
    ...profile.table,
    // Arrays are copied so editing a form cannot mutate a saved rule snapshot.
    ...(profile.table?.uma ? { uma: [...profile.table.uma] } : {}),
  };
}

export function validateProfile(profile: RuleProfile): string[] {
  const errors: string[] = [];
  const t = tableRules(profile);
  if (![3, 4].includes(profile.playerCount)) errors.push('Choose three or four players.');
  if (profile.preset === 'm-league' && profile.playerCount !== 4)
    errors.push('M.League supports four players only.');
  for (const value of [profile.startingPoints, t.returnPoints])
    if (!Number.isSafeInteger(value) || value < 1000 || value > 100000)
      errors.push('Starting and return points must be integers from 1,000 to 100,000.');
  for (const value of [t.notenPool, t.honbaRon, t.honbaTsumo, t.yakitoriPenalty])
    if (!Number.isSafeInteger(value) || value < 0 || value > 100000 || value % 100)
      errors.push('Point payments must be multiples of 100 from 0 to 100,000.');
  if (t.notenPool % (profile.playerCount === 4 ? 600 : 200))
    errors.push('Noten pool must divide into whole 100-point shares for every Tenpai count.');
  if (
    !Array.isArray(t.uma) ||
    t.uma.length !== profile.playerCount ||
    t.uma.some((value) => !Number.isFinite(value) || Math.abs(value) > 1000) ||
    Math.abs(t.uma.reduce((sum, value) => sum + value, 0)) > 0.000001
  )
    errors.push('Enter one Uma value per player; the total must be zero.');
  if (
    typeof t.currency !== 'string' ||
    t.currency.length > 16 ||
    [
      t.allowNegativeRiichi,
      t.dealerPassAfterWin,
      t.dealerFinish,
      t.chipsOnOpenHands,
      profile.kiriage,
      profile.openTanyao,
    ].some((value) => typeof value !== 'boolean') ||
    !['loss', 'north-bisection'].includes(profile.tsumo)
  )
    errors.push('Choose a valid rule option.');
  if (
    [t.bettingRate, t.chipValue].some(
      (value) => !Number.isFinite(value) || value < 0 || value > 100000,
    )
  )
    errors.push('Betting and chip values must be between 0 and 100,000.');
  if (![1, 2, 4].includes(t.waremeMultiplier))
    errors.push('Choose a Wareme multiplier of 1, 2 or 4.');
  if (
    ![100, 1000].includes(t.paymentUnit) ||
    !['loss', 'no-loss', 'equal', 'equal-dealer'].includes(t.tsumoMode)
  )
    errors.push('Choose a valid payment method.');
  if (
    [t.chipRed, t.chipUra, t.chipIppatsu, t.chipYakuman].some(
      (value) => !Number.isSafeInteger(value) || value < 0 || value > 1000,
    )
  )
    errors.push('Chip counts must be integers from 0 to 1,000.');
  if (
    !['none', 'one-round'].includes(t.extension) ||
    !['negative', 'nonpositive', 'off'].includes(t.bankruptcy) ||
    !['none', 'nearest', 'floor', 'ceil'].includes(t.rounding) ||
    !['seat-order', 'share'].includes(t.tiedRanks) ||
    !['nearest', 'split'].includes(t.riichiReceiver) ||
    !['first', 'split-top'].includes(t.finalRiichiReceiver)
  )
    errors.push('Choose a valid rule option.');
  return [...new Set(errors)];
}
