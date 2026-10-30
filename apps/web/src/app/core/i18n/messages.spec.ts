import { describe, expect, it } from 'vitest';
import { translate, zhTW } from './messages';
import zhCN from './zh-cn.json';
import ja from './ja.json';
import ko from './ko.json';
import { readFileSync, readdirSync } from 'node:fs';

describe('zh-TW catalog', () => {
  it('formats internal call, win and ledger keys for English interfaces', () => {
    for (const [key, label] of Object.entries({
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
      multipleRon: 'Multiple Ron',
      matchEnd: 'Match ended',
    }))
      expect(translate(key, 'en')).toBe(label);
    expect(translate('alice', 'en')).toBe('alice');
  });
  it('capitalizes English wind labels without changing domain keys', () => {
    expect(['east', 'south', 'west', 'north'].map((wind) => translate(wind, 'en'))).toEqual([
      'East',
      'South',
      'West',
      'North',
    ]);
  });
  it('contains no corrupted translation text', () => {
    for (const catalog of [zhTW, zhCN, ja, ko]) {
      for (const [key, value] of Object.entries(catalog)) {
        expect(value, key).not.toMatch(/\?{2,}|\uFFFD/);
      }
    }
  });
  it('translates live-call and ledger action names in every supported catalog', () => {
    for (const key of [
      'chi',
      'pon',
      'daiminkan',
      'ankan',
      'kakan',
      'kita',
      'win',
      'multipleRon',
      'exhaustiveDraw',
      'abortiveDraw',
      'nagashi',
      'riichiDeposit',
      'matchEnd',
      'scoreAdjustment',
    ]) {
      for (const catalog of [zhTW, zhCN, ja, ko]) {
        expect(catalog, key).toHaveProperty(key);
      }
    }
  });
  it('has complete Japanese keys and preserves all interpolation fields', () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(zhTW).sort());
    for (const [key, value] of Object.entries(ja)) {
      const fields = (text: string) =>
        [...text.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort();
      expect(fields(value), key).toEqual(fields(key));
      expect(value.trim(), key).not.toBe('');
    }
    expect(translate('3 Han · 40 Fu', 'ja')).toBe('3翻・40符');
    expect(translate('Expected 11 concealed tiles, including the winning tile.', 'ja')).toBe(
      '和了牌を含む手牌は11枚必要です。',
    );
    expect(translate('points to 陳萬發', 'ja')).toBe('陳萬發の受取点');
  });
  it('has complete Korean translations and preserves dynamic names and placeholders', () => {
    expect(Object.keys(ko).sort()).toEqual(Object.keys(zhTW).sort());
    const fields = (text: string) => [...text.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort();
    for (const [key, value] of Object.entries(ko)) {
      expect(fields(value), key).toEqual(fields(key));
      expect(value.trim(), key).not.toBe('');
      expect(value, key).not.toMatch(/ZXQ|⟦\d+⟧/);
    }
    expect(translate('My table', 'ko')).toBe('내 테이블');
    expect(translate('riichi', 'ko')).toBe('리치');
    expect(translate('doubleRiichi', 'ko')).toBe('더블 리치');
    expect(translate('points to Alice', 'ko')).toBe('Alice 획득 점수');
    expect(translate('Sakura', 'ko')).toBe('이른 봄의 꽃놀이');
    expect(translate('On the Edge', 'ko')).toBe('일촉즉발');
    expect(translate('Unknown message', 'ko')).toBe('Unknown message');
  });
  it('has a matching Simplified Chinese catalog and preserves names', () => {
    expect(Object.keys(zhCN).sort()).toEqual(Object.keys(zhTW).sort());
    expect(translate('Saturday afternoon', 'zh-CN')).toBe('周六下午的牌局');
    expect(translate('points to 陳萬發', 'zh-CN')).toBe('陳萬發 获得的点数');
  });
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
    ['Select Tenpai players', '選擇聽牌玩家'],
    ['Select eligible Nagashi players', '選擇符合流局滿貫的玩家'],
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
