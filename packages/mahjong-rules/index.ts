import type { PlayerCount } from '../mahjong-core/index';
export type RulePreset = 'mahjong-soul' | 'tenhou' | 'm-league' | 'custom';
export interface RuleSettings {
  doubleYakuman: boolean;
  stackYakuman: boolean;
  kazoe: 'yakuman' | 'sanbaiman';
  multipleRon: 'all' | 'triple-draw' | 'head-bump';
  pao: 'component' | 'whole-hand' | 'off';
  kokushiAnkanRon: boolean;
  kitaRinshan: boolean;
  redFives: boolean;
}
export interface RuleProfile {
  readonly id: string;
  readonly version: number;
  readonly playerCount: PlayerCount;
  readonly startingPoints: number;
  readonly tsumo: 'loss' | 'north-bisection';
  readonly kiriage: boolean;
  readonly openTanyao: boolean;
  readonly preset?: RulePreset;
  readonly settings?: Readonly<RuleSettings>;
}
export function rankedRules(playerCount: PlayerCount): RuleProfile {
  return presetRules('mahjong-soul', playerCount);
}
export function presetRules(preset: RulePreset, playerCount: PlayerCount): RuleProfile {
  if (preset === 'm-league' && playerCount !== 4)
    throw new Error('M.League supports four players only.');
  return Object.freeze({
    id: `${preset}-${playerCount}p`,
    preset,
    version: 2,
    playerCount,
    startingPoints: playerCount === 4 ? 25000 : 35000,
    tsumo: 'loss',
    kiriage: preset === 'm-league',
    openTanyao: true,
    settings: Object.freeze({
      doubleYakuman: preset !== 'tenhou' && preset !== 'm-league',
      stackYakuman: true,
      kazoe: preset === 'm-league' ? 'sanbaiman' : 'yakuman',
      multipleRon:
        preset === 'm-league' ? 'head-bump' : preset === 'tenhou' ? 'triple-draw' : 'all',
      pao: preset === 'tenhou' ? 'whole-hand' : 'component',
      kokushiAnkanRon: preset !== 'tenhou' && preset !== 'm-league',
      kitaRinshan: true,
      redFives: true,
    }),
  });
}
/** Version-1 snapshots retain their identity; settings are resolved only for newly entered hands. */
export function ruleSettings(profile: RuleProfile): Readonly<RuleSettings> {
  return (
    profile.settings ?? presetRules(profile.preset ?? 'mahjong-soul', profile.playerCount).settings!
  );
}
export function ruleName(profile: RuleProfile): string {
  if (profile.preset === 'm-league') return 'M.League';
  return profile.preset === 'tenhou'
    ? 'Tenhou'
    : profile.preset === 'custom'
      ? 'Custom / house rules'
      : 'Mahjong Soul';
}
export function nextDora(index: number, playerCount: PlayerCount): number {
  if (playerCount === 3 && (index === 0 || index === 8)) return index === 0 ? 8 : 0;
  if (index < 27) return Math.floor(index / 9) * 9 + ((index + 1) % 9);
  if (index < 31) return 27 + ((index - 27 + 1) % 4);
  return 31 + ((index - 31 + 1) % 3);
}
