import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { presetRules, tableRules } from '../packages/mahjong-rules/index';
import { parseTiles } from '../packages/mahjong-core/index';
import type { WinEvent } from '../packages/mahjong-core/index';
import type { Match, LedgerEvent } from '../packages/mahjong-core/ledger';
import { emptyLive } from '../packages/mahjong-core/live';

const name = 'Alice / 陳';
function fixtures(): Match[] {
  const ids = ['a', 'b', 'c', 'd'];
  const rules = presetRules('custom', 4);
  const games = Array.from({ length: 20 }, (_, index): Match => {
    const live = emptyLive();
    for (const id of ids) live.players[id] = { riichi: 'none', kita: [], melds: [] };
    const mode = index % 4;
    const winnerId = mode === 1 ? 'b' : 'a';
    const method = mode === 3 ? 'tsumo' : 'ron';
    if (mode === 1 || mode === 3) live.players[winnerId].riichi = 'riichi';
    if (mode === 1 || (mode === 2 && index % 3 === 0))
      live.players.a.melds = [
        { id: 'pon', type: 'pon', tiles: parseTiles('111p'), fromPlayerId: 'd' },
      ];
    const win: WinEvent = {
      winnerId,
      method,
      discarderId: mode === 1 ? 'a' : 'b',
      winningTileId: 'tile',
      riichi: mode === 1 || mode === 3,
      doubleRiichi: false,
      ippatsu: false,
      rinshan: false,
      chankan: false,
      haitei: false,
      houtei: false,
      tenhou: false,
      chiihou: false,
    };
    const timestamp = new Date(2026, 0, index + 1, 14).toISOString();
    const before = {
      dealerId: ids[index % 4],
      roundWind: 'east' as const,
      handNumber: (index % 4) + 1,
      honba: 0,
    };
    const event: LedgerEvent = {
      id: 'event-' + index,
      timestamp,
      type: mode === 2 ? 'exhaustiveDraw' : 'win',
      liveBefore: live,
      winnerIds: mode === 2 ? [] : [winnerId],
      win: mode === 2 ? undefined : win,
      payments:
        mode === 2
          ? []
          : mode === 3
            ? ids
                .filter((id) => id !== 'a')
                .map((id) => ({ from: id, to: 'a', amount: 2000, reason: 'Tsumo' }))
            : [
                {
                  from: win.discarderId!,
                  to: winnerId,
                  amount: mode === 1 ? 5000 : 8000,
                  reason: 'Ron',
                },
              ],
      before,
      after: { ...before, dealerId: ids[(index + 1) % 4] },
      chipDeltas: { a: 1, b: -1 },
    };
    if (mode === 2)
      event.drawInput = {
        rules,
        players: ids.map((id) => ({ id, name: id })),
        dealerId: before.dealerId,
        honba: 0,
        type: 'exhaustive',
        tenpaiIds: index % 8 === 2 ? ['a'] : ['b'],
        nagashiIds: [],
        circumstancesConfirmed: true,
      };
    return {
      id: 'game-' + index,
      schemaVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Game ' + (index + 1),
      playerCount: 4,
      rules: {
        ...rules,
        table: {
          ...tableRules(rules),
          bettingRate: 1,
          chipValue: 2,
          currency: index % 2 ? 'JPY' : 'USD',
        },
      },
      players: ids.map((id, i) => ({
        id,
        name: [name, 'Bob', 'Carol with a very long player name', 'Dana'][i],
        profileId: ['Alice', 'Bob', 'Carol', 'Dana'][i],
      })),
      initialBalances: { a: 25000, b: 25000, c: 25000, d: 25000 },
      initialDealerId: ids[index % 4],
      dealerId: before.dealerId,
      roundWind: 'east',
      handNumber: 1,
      honba: 0,
      ended: true,
      events: [event],
      gameLength: 'south',
    };
  });
  games.push({
    ...games[0],
    id: 'three-player',
    playerCount: 3,
    rules: presetRules('custom', 3),
    players: games[0].players.slice(0, 3),
    initialBalances: { a: 35000, b: 35000, c: 35000 },
    events: [],
  });
  games.push({ ...games[0], id: 'unfinished', ended: false });
  return games;
}
for (const width of [390, 1280]) {
  test(`player rows open analysis, comparisons, chemistry and seats at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Start match/ })).toBeVisible();
    await page.evaluate(async (games) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('riichi-table');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('matches', 'readwrite');
        const store = tx.objectStore('matches');
        store.clear();
        games.forEach((game) => store.put(game));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, fixtures());
    await page.locator('.app-navigation a[href$="/records"]').click();
    await page.getByRole('button', { name: 'Players', exact: true }).click();
    const row = page
      .locator('.player-record-row')
      .filter({ has: page.getByRole('rowheader', { name, exact: true }) });
    await row.click();
    await expect(page).toHaveURL(/\/records\/player\/Alice/);
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.locator('.profile-sample')).toContainText('20 completed games');
    await expect(page.locator('.rank-dot')).toHaveCount(16);
    await expect(page.locator('.histogram-column')).toHaveCount(4);
    await page.evaluate(() => scrollTo(0, 600));
    const controls = page.locator('.profile-sticky');
    const stickyTop = await controls.evaluate((element) =>
      parseFloat(getComputedStyle(element).top),
    );
    expect((await controls.boundingBox())!.y).toBeCloseTo(stickyTop, 0);
    await expect(page.locator('.profile-heading')).toBeInViewport();
    await page.screenshot({ path: `artifacts/profile-sticky-${width}.png` });
    await page.evaluate(() => scrollTo(0, 0));
    await expect(page.locator('.resemblance-row')).toHaveCount(3);
    await page.getByRole('button', { name: 'Filter records', exact: true }).click();
    const filters = page.getByRole('dialog', { name: 'Filter records', exact: true });
    await expect(filters).toBeVisible();
    const lengthControl = filters.getByRole('combobox', { name: 'Game length', exact: true });
    await lengthControl.focus();
    await expect(lengthControl).toHaveCSS('outline-style', 'none');
    await filters.getByLabel('From date', { exact: true }).fill('2026-01-20');
    await filters.getByLabel('To date', { exact: true }).fill('2026-01-10');
    await expect(
      filters.getByRole('button', { name: 'Apply filters', exact: true }),
    ).toBeDisabled();
    await filters.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await filters.getByLabel('From date', { exact: true }).fill('2026-01-11');
    await expect(page.locator('.profile-sample')).toContainText('20 completed games');
    await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect(filters).not.toBeVisible();
    await expect(page.locator('.profile-sample')).toContainText('10 completed games');
    await page.getByRole('button', { name: 'Filter records', exact: true }).click();
    await filters.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect(page.locator('.profile-sample')).toContainText('20 completed games');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/player-overview-${width}.png`, fullPage: true });
    await page.evaluate(() => scrollTo(0, 800));
    await page.getByRole('button', { name: 'Statistics', exact: true }).click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect(page.locator('.stats-group')).toHaveCount(11);
    await expect(
      page
        .locator('.stats-group')
        .filter({ has: page.getByRole('heading', { name: 'Key rates', exact: true }) }),
    ).toContainText('25%');
    await page.getByRole('combobox', { name: 'Compare with', exact: true }).selectOption('Bob');
    await expect(page.locator('.comparison-value')).not.toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Money stats', exact: true }).locator('..'),
    ).toContainText('USD');
    await expect(
      page.getByRole('heading', { name: 'Money stats', exact: true }).locator('..'),
    ).toContainText('JPY');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/player-stats-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(page.locator('.compare-line')).toBeVisible();
    await expect(page.locator('.chemistry-card')).toHaveCount(3);
    await page.getByRole('combobox', { name: 'Shared opponent', exact: true }).selectOption('Bob');
    await expect(page.locator('.chemistry-card')).toHaveCount(1);
    await expect(page.locator('.chemistry-card')).toContainText('20');
    await expect(page.locator('.seat-card')).toHaveCount(4);
    await page.getByText('Shared game history', { exact: true }).click();
    await expect(page.locator('.game-links li')).toHaveCount(20);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/player-explore-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: '3 players', exact: true }).click();
    await expect(page.locator('.profile-sample')).toContainText('1 completed games');
    await expect(page.locator('.seat-card')).toHaveCount(3);
    await page.getByRole('button', { name: 'Statistics', exact: true }).click();
    const rank = page
      .locator('.stats-group')
      .filter({ has: page.getByRole('heading', { name: 'Rank stats', exact: true }) });
    await expect(rank.locator('dl > div').filter({ hasText: '4th rate' })).toContainText('—');
    if (width > 700) {
      await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
      await page.locator('.language-select').selectOption('zh-TW');
      await expect(page.getByRole('heading', { name: '基本統計', exact: true })).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      await page.screenshot({ path: 'artifacts/player-stats-dark-zh-tw.png', fullPage: true });
      await page.locator('.language-select').selectOption('en');
      await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    }
    await page.getByRole('link', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/\/records\?/);
    await expect(page.getByRole('button', { name: 'Players', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
}
