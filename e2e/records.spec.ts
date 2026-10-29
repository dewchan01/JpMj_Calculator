import { leaveGame } from './helpers/navigation';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { presetRules, tableRules } from '../packages/mahjong-rules/index';
import type { Match } from '../packages/mahjong-core/ledger';

for (const width of [320, 390, 1280]) {
  test(`records filter games, aggregate players and reopen/delete at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByText('Saved tables', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /Start match/ }).click();
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await expect(page).toHaveURL(/\/score\/[^/]+$/);
    await leaveGame(page);
    const base = presetRules('custom', 3);
    const rules = { ...base, table: { ...tableRules(base), bettingRate: 2, currency: 'USD' } };

    const game: Match = {
      id: 'october',
      schemaVersion: 1,
      name: 'October friends',
      createdAt: '2026-10-01T12:00:00',
      updatedAt: '2026-10-01T13:30:00',
      rules,
      playerCount: 3,
      players: [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
        { id: 'c', name: 'Carol with a very long player name' },
      ],
      initialBalances: { a: 35000, b: 35000, c: 35000 },
      initialDealerId: 'a',
      dealerId: 'c',
      roundWind: 'east',
      handNumber: 3,
      honba: 2,
      gameLength: 'east',
      ended: true,
      events: [
        {
          id: 'e',
          timestamp: '2026-10-01T13:30:00',
          type: 'exhaustiveDraw',
          before: { dealerId: 'b', roundWind: 'east', handNumber: 2, honba: 1 },
          after: { dealerId: 'c', roundWind: 'east', handNumber: 3, honba: 2, ended: true },
          payments: [{ from: 'b', to: 'a', amount: 6000, reason: 'test' }],
        },
      ],
    };
    game.events[0].drawInput = {
      rules: presetRules('tenhou', 3),
      players: game.players,
      dealerId: 'b',
      honba: 1,
      type: 'exhaustive',
      tenpaiIds: ['a'],
      nagashiIds: [],
      circumstancesConfirmed: true,
    };
    await page.evaluate(async (game) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('riichi-table');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('matches', 'readwrite');
        const store = tx.objectStore('matches');
        store.clear();
        store.put(game);
        store.put({
          ...game,
          id: 'september',
          name: 'September friends',
          createdAt: '2026-09-01T12:00:00',
          events: [],
          ended: true,
        });
        store.put({
          ...game,
          id: 'ongoing',
          name: 'Ongoing friends',
          createdAt: '2026-10-02T12:00:00',
          events: [],
          ended: false,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, game);
    const nav = page.getByRole('navigation');
    await nav.getByRole('link', { name: 'Records', exact: true }).click();
    await expect(page.locator('.game-card')).toHaveCount(2);
    await expect(page.locator('.game-card .eyebrow').first()).toContainText('Tenhou');
    await expect(page.locator('.mode-filter-row .game-count')).toContainText('games found');
    await expect(page.locator('.records-summary')).toHaveCount(0);
    await expect(page.locator('.game-card .game-meta').first()).toContainText(
      'Latest hand: East 2 · Honba 1',
    );
    await expect(page.locator('.game-card tfoot').first()).toContainText('Total');
    await expect(page.locator('.game-card tfoot td').first()).toHaveText('105,000');
    const rankedRows = page.locator('.game-card').first().locator('tbody tr');
    await expect(rankedRows.first().locator('.score-breakdown')).toContainText('Oka');
    await expect(rankedRows.nth(1).locator('.score-breakdown')).not.toContainText('Oka');
    await expect(rankedRows.nth(2).locator('.score-breakdown')).not.toContainText('Oka');
    await expect(page.locator('.game-card thead th').nth(1)).toHaveCSS('text-align', 'left');
    await expect(page.locator('.game-card .player-name').first()).toHaveCSS('text-align', 'left');
    const controls = await page.locator('.records-controls').boundingBox();
    expect(controls!.height).toBeLessThan(240);
    await page.evaluate(() => window.scrollTo(0, 200));
    const scrolledControls = await page.locator('.records-controls').boundingBox();
    expect(Math.abs(scrolledControls!.y - controls!.y)).toBeLessThan(1);
    expect(scrolledControls!.x).toBe(controls!.x);
    await page.evaluate(() => window.scrollTo(0, 0));
    const filter = await page
      .getByRole('button', { name: 'Filter records', exact: true })
      .boundingBox();
    const sort = await page
      .getByRole('combobox', { name: 'Sort games', exact: true })
      .boundingBox();
    expect(Math.abs(filter!.y - sort!.y)).toBeLessThan(2);
    expect(sort!.x).toBeGreaterThan(filter!.x);
    await expect(page.locator('.mode-chips')).toHaveCSS('overflow-x', 'auto');
    await expect(page.locator('.game-card-link')).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Open table', exact: true })).toHaveCount(0);
    await expect(page.locator('.game-card h2').first()).toHaveText('October friends');
    await page.getByRole('combobox', { name: 'Sort games', exact: true }).selectOption('oldest');
    await expect(page.locator('.game-card h2').first()).toHaveText('September friends');
    await expect(
      page
        .locator('dialog[aria-labelledby="filter-title"]')
        .getByLabel('From date', { exact: true }),
    ).not.toBeVisible();
    await page.getByRole('button', { name: 'Filter records', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Filter records', exact: true });
    await expect(dialog).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.height).toBeLessThan(600);
    await page.screenshot({ path: `artifacts/records-filter-${width}.png` });
    await page
      .locator('dialog[aria-labelledby="filter-title"]')
      .getByLabel('From date', { exact: true })
      .fill('2026-10-01');
    await page
      .locator('dialog[aria-labelledby="filter-title"]')
      .getByLabel('To date', { exact: true })
      .fill('2026-10-01');
    await page.getByRole('combobox', { name: 'Participant', exact: true }).selectOption('Alice');
    await expect(page.locator('.game-card')).toHaveCount(2);
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole('button', { name: '3P East-only', exact: true }).click();
    await expect(page.locator('.mode-filter-row .filter-reset')).toHaveCSS(
      'border-top-width',
      '0px',
    );
    await expect(page.locator('.mode-filter-row .filter-reset')).toHaveCSS(
      'color',
      'rgb(140, 80, 27)',
    );
    await expect(page.locator('.game-card')).toHaveCount(1);
    await expect(page.locator('.game-card')).toContainText('90 minutes');
    await expect(page.locator('.game-card tbody tr').first()).toContainText('41,000');
    await page.getByRole('button', { name: 'Players', exact: true }).click();
    await expect(page.locator('.player-card tbody tr')).toHaveCount(1);
    await expect(page.locator('.player-card tbody tr')).toContainText('6,000');
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await expect(page.locator('.player-card tbody tr')).toHaveCount(3);
    const alice = page
      .locator('.player-card tbody tr')
      .filter({ has: page.getByRole('rowheader', { name: 'Alice', exact: true }) });
    await expect(alice.locator('.player-game-count strong')).toHaveText('2');
    await expect(page.locator('.player-card thead th')).toHaveCount(5);
    if (width <= 700) {
      expect(
        await page.locator('.player-card td').evaluateAll((cells) =>
          cells.every((cell) => {
            const bounds = cell.getBoundingClientRect();
            return (
              bounds.left >= 0 && bounds.right <= innerWidth && cell.scrollWidth <= cell.clientWidth
            );
          }),
        ),
      ).toBe(true);
    }
    await page.getByRole('combobox', { name: 'Sort players', exact: true }).selectOption('points');
    await expect(page.locator('.player-card tbody tr').first()).toContainText('Alice');
    await page.getByRole('combobox', { name: 'Sort players', exact: true }).selectOption('rank');
    await expect(page.locator('.player-card tbody tr').first()).toContainText('Alice');
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/records-players-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Games', exact: true }).click();
    expect(
      await page
        .locator('.game-card .table-scroll')
        .evaluateAll((tables) => tables.every((table) => table.scrollWidth <= table.clientWidth)),
    ).toBe(true);
    const longName = page
      .locator('.game-card .player-name')
      .filter({ hasText: 'Carol with a very long player name' })
      .first();
    await expect(longName).toHaveCSS('text-overflow', 'ellipsis');
    if (width <= 700)
      expect(await longName.evaluate((cell) => cell.scrollWidth > cell.clientWidth)).toBe(true);
    const card = page.locator('.game-card').first();
    const table = (await card.locator('table').boundingBox())!;
    const date = (await card.locator('.game-meta .hint').boundingBox())!;
    await expect(page.locator('.game-status')).toHaveCount(0);
    await expect(page.locator('.game-card .game-actions')).toHaveCount(0);
    if (width > 700) {
      await page.locator('.language-select').selectOption('ja');
      await expect(page.locator('.game-meta .hint').first()).toContainText('2026/09/01');
      await page.locator('.language-select').selectOption('zh-TW');
      await expect(page.locator('.game-meta .hint').first()).toContainText('2026年9月1日');
      await page.locator('.language-select').selectOption('en');
    }
    expect(date.y + date.height).toBeLessThanOrEqual(table.y);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/records-games-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Final results: October friends', exact: true }).click();
    await expect(page).toHaveURL(/\/records\/october$/);
    await expect(page.locator('app-final-results')).toBeVisible();
    await page
      .locator('app-final-results')
      .getByRole('button', { name: 'History', exact: true })
      .click();
    await expect(page.locator('.history-event > summary .event-mode')).toContainText(['Tenhou']);
    await expect(page.locator('app-game-table')).toHaveCount(0);
    await page
      .locator('.record-management')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: 'Delete', exact: true })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(page).toHaveURL(/\/records$/);
    await expect(page.locator('.game-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Filter records', exact: true }).click();
    await page
      .locator('dialog[aria-labelledby="filter-title"]')
      .getByLabel('From date', { exact: true })
      .fill('2026-10-02');
    await page
      .locator('dialog[aria-labelledby="filter-title"]')
      .getByLabel('To date', { exact: true })
      .fill('2026-10-01');
    await expect(page.getByRole('alert')).toContainText('From date must not be after to date.');
    await expect(page.getByRole('button', { name: 'Apply filters', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.game-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Filter records', exact: true }).click();
    await expect(
      page
        .locator('dialog[aria-labelledby="filter-title"]')
        .getByLabel('From date', { exact: true }),
    ).toHaveValue('');
  });
}
