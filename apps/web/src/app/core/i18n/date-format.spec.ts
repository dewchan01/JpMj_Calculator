import { describe, expect, it } from 'vitest';
import { localizedDate, localDateTimeInput } from './date-format';

describe('automatic date localization', () => {
  const date = new Date(2026, 0, 2, 13, 4, 5);
  it('uses regional date conventions for the selected language', () => {
    expect(localizedDate(date, 'en', 'date')).toBe('2 Jan 2026');
    expect(localizedDate(date, 'ja', 'date')).toBe('2026/01/02');
    expect(localizedDate(date, 'ko', 'date')).toBe('2026. 1. 2.');
    expect(localizedDate(date, 'zh-TW', 'date')).toBe('2026年1月2日');
    expect(localizedDate(date, 'zh-CN', 'date')).toBe('2026年1月2日');
  });
  it('formats timestamps and time-only values without a separate preference', () => {
    expect(localizedDate(date, 'en')).toContain('1:04:05 pm');
    expect(localizedDate(date, 'en', 'time')).toBe('1:04 pm');
    expect(localizedDate(date, 'ja', 'time')).toBe('13:04');
    expect(localizedDate(date, 'ko', 'time')).toBe('오후 1:04');
    expect(localizedDate(date, 'zh-TW')).toContain('2026年1月2日');
  });
  it('leaves absent or invalid dates empty', () => {
    for (const value of [null, undefined, '', 'not a date'])
      expect(localizedDate(value, 'en')).toBe('');
  });
  it('preserves calendar-only reference dates in local time', () => {
    expect(localizedDate('2026-10-26', 'ja', 'date')).toBe('2026/10/26');
  });
  it('prepares local game date/time inputs without shifting the time to UTC', () => {
    expect(localDateTimeInput(new Date(2026, 0, 2, 10, 30))).toBe('2026-01-02T10:30');
    expect(localDateTimeInput('invalid')).toBe('');
  });
});
