import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { toggleTheme } from './helpers/navigation';
import { playerAction, prompt, recordDraw } from './helpers/game';
for (const count of [3, 4])
  for (const width of [390, 1280]) {
    test(`${count}P interactive table at ${width}px stays compact in both themes`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      if (count === 3) await page.getByRole('button', { name: /3 players/ }).click();
      await page.getByRole('button', { name: /Start match/ }).click();
      const table = page.locator('app-table-summary');
      await expect(table.locator('.player-seat')).toHaveCount(count);
      await expect(table.locator('.player-seat.dealer')).toHaveCount(1);
      await expect(table.locator('.selected')).toHaveCount(0);
      await playerAction(page, 'Player 2');
      await prompt(page)
        .getByRole('button', { name: /Declare Riichi/ })
        .click();
      await expect(table.locator('.table-pot strong')).toHaveText('1,000');
      await expect(table.locator('.player-seat').nth(1).locator('.player-points')).toHaveText(
        count === 3 ? '34,000' : '24,000',
      );
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      await table.screenshot({ path: `artifacts/table-${count}p-${width}.png` });
      await toggleTheme(page);
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      await recordDraw(page, ['Player 2']);
      await expect(table.locator('.table-round')).toHaveText('east 2');
    });
  }
