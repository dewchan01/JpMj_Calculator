import { describe, expect, it } from 'vitest';
import { translate, zhTW } from './messages';
import { readFileSync, readdirSync } from 'node:fs';

describe('zh-TW catalog', () => {
  it('contains every static template translation key', () => {
    const appDirectory = new URL('../../', import.meta.url);
    const templates = readdirSync(appDirectory, { recursive: true, encoding: 'utf8' }).filter(
      (file) => file.endsWith('.html'),
    );
    expect(templates.length).toBeGreaterThan(0);
    for (const file of templates) {
      const source = readFileSync(new URL(file.replaceAll('\\', '/'), appDirectory), 'utf8');
      // Inspect complete bindings so a dynamic suffix such as `seat + ' seat'`
      // is not mistaken for a standalone catalog key after formatting.
      for (const binding of source.matchAll(/{{([\s\S]*?)}}|\[[^\]]+\]="([^"]*)"/g)) {
        const expression = (binding[1] ?? binding[2]).trim();
        const literal = /^'([^']+)'\s*\|\s*t\b/.exec(expression);
        if (literal) expect(zhTW, `${file}: ${literal[1]}`).toHaveProperty(literal[1]);
      }
    }
  });
  it.each([
    ['Expected 11 concealed tiles, including the winning tile.', '暗手應有 11 張牌（含和牌張）。'],
    ['3 Han · 40 Fu', '3 番・40 符'],
    ['4P · 2 events', '4 人・2 筆紀錄'],
    ['Honba must be an integer from 0 to 100.', '本場數必須為 0 到 100 的整數。'],
    ['East seat', '東家'],
    ['Player 2', '玩家 2'],
    ['2× Yakuman', '2 倍役滿'],
    ['Win · East', '和牌・East'],
    ['points to Riichi', 'Riichi 獲得的點數'],
    ['sequence 1m · open triplet P · pair 5p', '順子 1m・明刻子 P・雀頭 5p'],
  ])('translates dynamic message %s', (source, expected) =>
    expect(translate(source, 'zh-TW')).toBe(expected),
  );
  it('preserves English results and unknown messages', () => {
    expect(translate('3 Han · 40 Fu', 'en')).toBe('3 Han · 40 Fu');
    expect(translate('Unexpected storage error', 'zh-TW')).toBe('Unexpected storage error');
    expect(translate(undefined, 'zh-TW')).toBe('');
  });
});
