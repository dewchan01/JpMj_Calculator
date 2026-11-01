import { test, expect } from '@playwright/test';
import { enterLiveTiles, prompt } from './helpers/game';

for (const count of [3, 4]) {
  test(`${count}P actual shared table keeps every action inside its visible panel`, async ({
    page,
  }) => {
    const api = process.env['RIICHI_API_TEST_URL'];
    test.skip(!api, 'Requires the local API.');
    await page.route('**/config.json', (route) =>
      route.fulfill({ json: { backend: { apiUrl: api } } }),
    );
    await page.setViewportSize({ width: 1280, height: 768 });
    await page.goto('/');
    if (count === 3) await page.getByRole('button', { name: /3 players/ }).click();
    await page.getByRole('button', { name: /Start match/ }).click();
    await page.getByRole('button', { name: 'Start shared game', exact: true }).click();
    await page.getByRole('button', { name: 'Host game', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Room code', exact: true })).toBeVisible();
    await page
      .locator('app-online')
      .getByRole('button', { name: 'Start game', exact: true })
      .click();
    await enterLiveTiles(page, 'Dora indicators', '7z');
    await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
    await expect(prompt(page)).toBeHidden();
    const table = page.locator('app-table-summary');
    await expect
      .poll(() =>
        table.evaluate((element) => {
          const frame = element.querySelector('.table-summary')!.getBoundingClientRect();
          return [...element.querySelectorAll('.seat-actions button, .player-seat')].every(
            (node) => {
              const box = node.getBoundingClientRect();
              return (
                box.left >= frame.left &&
                box.right <= frame.right &&
                box.top >= frame.top &&
                box.bottom <= frame.bottom
              );
            },
          );
        }),
      )
      .toBe(true);
    await table.screenshot({ path: `artifacts/actual-shared-${count}p-contained.png` });
  });
  test(`${count}P desktop seats and actions fit inside local and shared tables`, async ({
    page,
  }) => {
    await page.route('**/config.json', (route) =>
      route.fulfill({ json: { backend: { apiUrl: '' } } }),
    );
    await page.goto('/');
    if (count === 3) await page.getByRole('button', { name: /3 players/ }).click();
    await page.getByRole('button', { name: /Start match/ }).click();
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    const table = page.locator('app-table-summary');
    await expect(table.locator('.player-seat')).toHaveCount(count);
    await enterLiveTiles(page, 'Dora indicators', '7z');
    await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
    await expect(prompt(page)).toBeHidden();
    for (const shared of [false, true]) {
      await table.evaluate((element, shared) => {
        element.classList.toggle('room-table', shared);
        element.closest('.game-shell')?.classList.toggle('room-game', shared);
        const caption = element.querySelector<HTMLElement>('.table-caption');
        if (caption) caption.style.display = shared ? 'none' : '';
      }, shared);
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 1280, height: 768 },
        { width: 1280, height: 600 },
        { width: 900, height: 600 },
        { width: 1920, height: 1080 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        await page.evaluate(async () => {
          for (let i = 0; i < 3; i++)
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        });
        const geometry = await table.evaluate((element) => {
          const box = (node: Element) => {
            const rect = node.getBoundingClientRect();
            return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
          };
          return {
            cards: [...element.querySelectorAll('.player-seat')].map(box),
            actions: [...element.querySelectorAll('.seat-actions')].map(box),
            hub: box(element.querySelector('.table-center')!),
            frame: box(element.querySelector('.table-layout')!),
            visible: box(element.querySelector('.table-summary')!),
          };
        });
        const overlap = (a: typeof geometry.hub, b: typeof geometry.hub) =>
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        for (const item of [...geometry.cards, ...geometry.actions, geometry.hub]) {
          expect(item.left).toBeGreaterThanOrEqual(
            Math.max(geometry.frame.left, geometry.visible.left) - 1,
          );
          expect(item.right).toBeLessThanOrEqual(
            Math.min(geometry.frame.right, geometry.visible.right) + 1,
          );
          expect(item.top).toBeGreaterThanOrEqual(
            Math.max(geometry.frame.top, geometry.visible.top) - 1,
          );
          expect(item.bottom).toBeLessThanOrEqual(
            Math.min(geometry.frame.bottom, geometry.visible.bottom) + 1,
          );
        }
        for (let i = 0; i < geometry.cards.length; i++) {
          expect(overlap(geometry.cards[i], geometry.hub)).toBe(false);
          for (let j = i + 1; j < geometry.cards.length; j++)
            expect(overlap(geometry.cards[i], geometry.cards[j])).toBe(false);
          for (const card of geometry.cards) expect(overlap(geometry.actions[i], card)).toBe(false);
        }
        if (shared && viewport.width === 1280 && viewport.height === 600)
          await table.screenshot({ path: `artifacts/desktop-shared-${count}p-contained.png` });
      }
    }
  });
}
