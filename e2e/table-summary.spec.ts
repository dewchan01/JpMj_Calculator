import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const count of [3, 4])
  for (const width of [390, 1280]) {
    test(`${count}P table summary at ${width}px updates balances and shows accessible details`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      if (count === 3) await page.getByRole('button', { name: /3 players/ }).click();
      await page.getByRole('button', { name: /Start match/ }).click();
      const table = page.locator('app-table-summary');
      await expect(table.locator('.player-seat')).toHaveCount(count);
      await expect(table.locator('.seat-label small')).toHaveText('Dealer');
      await expect(table.locator('.table-round')).toHaveText('east 1');
      await expect(table.locator('.table-honba')).toHaveText('Honba 0');
      await expect(table.locator('.table-pot strong')).toHaveText('0');
      await page.locator('.escrow > summary').click();
      await page.getByRole('button', { name: 'Deposit 1,000', exact: true }).click();
      await expect(table.locator('.table-pot strong')).toHaveText('1,000');
      await expect(table.locator('.player-seat').nth(1).locator('.player-points')).toHaveText(
        count === 3 ? '34,000' : '24,000',
      );
      expect(await table.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
      await table.screenshot({ path: `artifacts/table-${count}p-${width}.png` });
      await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
      await table.screenshot({ path: `artifacts/table-${count}p-${width}-dark.png` });
      const dark = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        dark.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
    });
  }
