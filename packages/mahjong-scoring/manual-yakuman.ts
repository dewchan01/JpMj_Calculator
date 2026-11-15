import { ruleSettings, type RuleProfile } from '../mahjong-rules';
/** Optional descriptions for player-confirmed Yakuman; the multiplier remains explicit. */
export const manualYakumanNames = [
  'Thirteen orphans (Kokushi musou)',
  'Thirteen-sided orphans (Kokushi 13 wait)',
  'Four concealed triplets (Suuankou)',
  'Single-wait concealed triplets (Suuankou tanki)',
  'Big three dragons (Daisangen)',
  'Little four winds (Shousuushii)',
  'Big four winds (Daisuushii)',
  'All honors (Tsuuiisou)',
  'All terminals (Chinroutou)',
  'All green (Ryuuiisou)',
  'Four Kans (Suukantsu)',
  'Nine gates (Chuuren poutou)',
  'Pure nine gates (Junsei chuuren)',
  'Blessing of heaven (Tenhou)',
  'Blessing of earth (Chiihou)',
];
export function namedYakuman(names: readonly string[], rules: RuleProfile) {
  const settings = ruleSettings(rules);
  const doubles = new Set([
    manualYakumanNames[1],
    manualYakumanNames[3],
    manualYakumanNames[6],
    manualYakumanNames[12],
  ]);
  return [...new Set(names)]
    .filter((name) => manualYakumanNames.includes(name))
    .map((name) => ({
      id: 'manual-yakuman-' + manualYakumanNames.indexOf(name),
      name,
      yakumanMultiplier: settings.doubleYakuman && doubles.has(name) ? 2 : 1,
    }));
}
export function yakumanFamily(name: string): string {
  const index = manualYakumanNames.indexOf(name);
  return String(index === 1 ? 0 : index === 3 ? 2 : index === 12 ? 11 : index);
}
export function toggleNamedYakuman(current: string[], name: string, rules: RuleProfile): string[] {
  if (current.includes(name)) return current.filter((value) => value !== name);
  const names = ruleSettings(rules).stackYakuman
    ? [...current.filter((value) => yakumanFamily(value) !== yakumanFamily(name)), name]
    : [name];
  return namedYakuman(names, rules).reduce((sum, entry) => sum + entry.yakumanMultiplier, 0) <= 6
    ? names
    : current;
}
