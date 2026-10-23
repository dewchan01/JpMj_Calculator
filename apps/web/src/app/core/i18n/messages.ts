import traditionalChinese from './zh-tw.json';
import zhCN from './zh-cn.json';
import ja from './ja.json';
export type Language = 'en' | 'zh-TW' | 'zh-CN' | 'ja';
export const zhTW: Readonly<Record<string, string>> = traditionalChinese;
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
  if (language === 'en') return source;
  const catalog: Readonly<Record<string, string>> =
    language === 'ja' ? ja : language === 'zh-CN' ? zhCN : zhTW;
  if (catalog[source]) return catalog[source];
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
