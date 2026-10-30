import { describe, expect, it, vi } from 'vitest';
import { localizedDate, localDateTimeInput } from './date-format';
import type { Language } from './messages';

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
    expect(localizedDate(new Date(2026, 0, 2, 1, 4, 5), 'ko', 'time')).toBe('오전 1:04');
    expect(localizedDate(date, 'zh-TW')).toContain('2026年1月2日');
  });
  it.each([
    [0, '오전 12:04'],
    [11, '오전 11:04'],
    [12, '오후 12:04'],
    [23, '오후 11:04'],
  ] as const)(
    'forces Korean day periods at hour %i even with Latin ICU labels',
    (hour, expected) => {
      const original = Intl.DateTimeFormat.prototype.formatToParts;
      const spy = vi
        .spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
        .mockImplementation(function (this: Intl.DateTimeFormat, value) {
          return original
            .call(this, value)
            .map((part) =>
              part.type === 'dayPeriod' ? { ...part, value: hour < 12 ? 'AM' : 'PM' } : part,
            );
        });
      try {
        const value = new Date(2026, 0, 2, hour, 4, 5);
        expect(localizedDate(value, 'ko', 'time')).toBe(expected);
        expect(localizedDate(value, 'ko')).toContain(expected + ':05');
      } finally {
        spy.mockRestore();
      }
    },
  );
  it.each([
    ['en', ['12:04 am', '11:04 am', '12:04 pm', '11:04 pm']],
    ['zh-TW', ['上午12:04', '上午11:04', '下午12:04', '下午11:04']],
    ['zh-CN', ['00:04', '11:04', '12:04', '23:04']],
    ['ja', ['0:04', '11:04', '12:04', '23:04']],
    ['ko', ['오전 12:04', '오전 11:04', '오후 12:04', '오후 11:04']],
  ] satisfies [Language, string[]][])(
    'keeps %s clock conventions at midnight, morning, noon and night',
    (language, expected) => {
      for (const [index, hour] of [0, 11, 12, 23].entries()) {
        const value = new Date(2026, 0, 2, hour, 4, 5);
        expect(localizedDate(value, language, 'time')).toBe(expected[index]);
        expect(localizedDate(value, language)).toContain(expected[index].replace(':04', ':04:05'));
      }
    },
  );
  it.each(['en', 'zh-TW', 'ko'] as const)(
    'normalizes unexpected day-period text and nonbreaking spaces for %s',
    (language) => {
      const baselineTime = localizedDate(date, language, 'time');
      const baselineDateTime = localizedDate(date, language);
      const original = Intl.DateTimeFormat.prototype.formatToParts;
      const spy = vi
        .spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
        .mockImplementation(function (this: Intl.DateTimeFormat, value) {
          return original
            .call(this, value)
            .map((part) =>
              part.type === 'dayPeriod'
                ? { ...part, value: 'runtime-specific PM' }
                : part.type === 'literal'
                  ? { ...part, value: part.value.replaceAll(' ', '\u202f') }
                  : part,
            );
        });
      try {
        expect(localizedDate(date, language, 'time')).toBe(baselineTime);
        expect(localizedDate(date, language)).toBe(baselineDateTime);
      } finally {
        spy.mockRestore();
      }
    },
  );
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
