import type { Language } from './messages';

export function localDateTimeInput(value: string | number | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const dateLocales: Record<Language, string> = {
  en: 'en-SG',
  'zh-TW': 'zh-TW',
  'zh-CN': 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
};
const dayPeriods: Partial<Record<Language, readonly [string, string]>> = {
  en: ['am', 'pm'],
  'zh-TW': ['上午', '下午'],
  ko: ['오전', '오후'],
};
export function localizedDate(
  value: string | number | Date | null | undefined,
  language: Language,
  style: 'dateTime' | 'date' | 'time' = 'dateTime',
): string {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00' : value,
  );
  if (!Number.isFinite(date.getTime())) return '';
  const periods = dayPeriods[language];
  const formatter = new Intl.DateTimeFormat(dateLocales[language], {
    ...(style !== 'time' ? { dateStyle: 'medium' as const } : {}),
    ...(style !== 'date'
      ? { timeStyle: style === 'time' ? ('short' as const) : ('medium' as const) }
      : {}),
    ...(style !== 'date' ? { hourCycle: periods ? ('h12' as const) : ('h23' as const) } : {}),
  });
  if (style === 'date') return formatter.format(date);
  // Keep day-period labels and spacing stable across ICU/CLDR versions.
  return formatter
    .formatToParts(date)
    .map((part) =>
      part.type === 'dayPeriod' && periods
        ? periods[date.getHours() < 12 ? 0 : 1]
        : part.type === 'literal'
          ? part.value.replace(/[\u00a0\u202f]/g, ' ')
          : part.value,
    )
    .join('');
}
