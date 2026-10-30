import traditionalChinese from './zh-tw.json';
import zhCN from './zh-cn.json';
import ja from './ja.json';
import ko from './ko.json';
export type Language = 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko';
export const zhTW: Readonly<Record<string, string>> = traditionalChinese;
const englishLabels: Readonly<Record<string, string>> = {
  east: 'East',
  south: 'South',
  west: 'West',
  north: 'North',
  chi: 'Chi',
  pon: 'Pon',
  ankan: 'Ankan',
  daiminkan: 'Open Kan',
  kakan: 'Added Kan',
  kita: 'North extraction',
  riichi: 'Riichi',
  doubleRiichi: 'Double Riichi',
  ron: 'Ron',
  tsumo: 'Tsumo',
  concealed: 'Concealed',
  standard: 'Standard hand',
  win: 'Win',
  multipleRon: 'Multiple Ron',
  riichiDeposit: 'Riichi deposit',
  matchEnd: 'Match ended',
  scoreAdjustment: 'Score adjustment',
  exhaustiveDraw: 'Exhaustive draw',
  abortiveDraw: 'Abortive draw',
  nagashi: 'Nagashi Mangan',
};
const patterns = Object.keys(zhTW)
  .filter((key) => key.includes('{'))
  .map((key) => {
    const fields: string[] = [];
    const escaped = key
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\{(\w+)\\\}/g, (_, name: string) => {
        fields.push(name);
        return name === 'tile' ? '([^·]+?)' : '(.+?)';
      });
    return { regex: new RegExp(`^${escaped}$`), fields, key };
  });
export function translate(source: string | null | undefined, language: Language): string {
  if (!source) return '';
  if (language === 'en') return englishLabels[source] ?? source;
  const catalog: Readonly<Record<string, string>> =
    language === 'ko' ? ko : language === 'ja' ? ja : language === 'zh-CN' ? zhCN : zhTW;
  if (catalog[source]) return catalog[source];
  const label = englishLabels[source];
  if (label && catalog[label]) return catalog[label];
  for (const { regex, fields, key } of patterns) {
    const match = regex.exec(source);
    if (match)
      return fields.reduce(
        (text, field, i) =>
          text.replaceAll(
            `{${field}}`,
            ['seat', 'field', 'wind'].includes(field)
              ? (catalog[match[i + 1]] ?? match[i + 1])
              : match[i + 1],
          ),
        catalog[key] ?? key,
      );
  }
  if (source.includes(' · '))
    return source
      .split(' · ')
      .map((part) => translate(part, language))
      .join('・');
  return source;
}
