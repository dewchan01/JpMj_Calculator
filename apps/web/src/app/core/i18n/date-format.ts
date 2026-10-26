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
  return new Intl.DateTimeFormat(dateLocales[language], {
    ...(style !== 'time' ? { dateStyle: 'medium' as const } : {}),
    ...(style !== 'date'
      ? { timeStyle: style === 'time' ? ('short' as const) : ('medium' as const) }
      : {}),
  }).format(date);
}
