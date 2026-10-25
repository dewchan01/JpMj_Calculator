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
    await expect(page).toHaveURL(/\/score\/[^/]+$/);
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
        { id: 'c', name: 'Carol' },
      ],
      initialBalances: { a: 35000, b: 35000, c: 35000 },
      initialDealerId: 'a',
      dealerId: 'a',
      roundWind: 'east',
      handNumber: 1,
      honba: 0,
      gameLength: 'east',
      ended: true,
      events: [
        {
          id: 'e',
          timestamp: '2026-10-01T13:30:00',
          type: 'exhaustiveDraw',
          payments: [{ from: 'b', to: 'a', amount: 6000, reason: 'test' }],
        },
      ],
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
    await expect(page.locator('.game-card')).toHaveCount(3);
    await expect(page.locator('.game-card h2').first()).toHaveText('Ongoing friends');
    await page.getByRole('combobox', { name: 'Sort games', exact: true }).selectOption('oldest');
    await expect(page.locator('.game-card h2').first()).toHaveText('September friends');
    await expect(page.getByLabel('From date', { exact: true })).not.toBeVisible();
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
    await page.getByLabel('From date', { exact: true }).fill('2026-10-01');
    await page.getByLabel('To date', { exact: true }).fill('2026-10-01');
    await page.getByRole('combobox', { name: 'Game mode', exact: true }).selectOption('3-east');
    await page.getByRole('combobox', { name: 'Participant', exact: true }).selectOption('Alice');
    await expect(page.locator('.game-card')).toHaveCount(3);
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect(dialog).not.toBeVisible();
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
    await expect(alice.locator('td').first()).toContainText('2');
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
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/records-games-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'October friends', exact: true }).click();
    await expect(page).toHaveURL(/\/score\/october$/);
    await nav.getByRole('link', { name: 'Records', exact: true }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete October friends', exact: true }).click();
    await expect(page.locator('.game-card')).toHaveCount(2);
    await page.getByRole('button', { name: 'Filter records', exact: true }).click();
    await page.getByLabel('From date', { exact: true }).fill('2026-10-02');
    await page.getByLabel('To date', { exact: true }).fill('2026-10-01');
    await expect(page.getByRole('alert')).toContainText('From date must not be after to date.');
    await expect(page.getByRole('button', { name: 'Apply filters', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.game-card')).toHaveCount(2);
    await page.getByRole('button', { name: 'Filter records', exact: true }).click();
    await expect(page.getByLabel('From date', { exact: true })).toHaveValue('');
  });
}
