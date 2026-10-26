import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1280]) {
  test(`rule chooser and empty player library at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Saved players', exact: true }).click();
    const players = page.getByRole('dialog', { name: 'Saved players', exact: true });
    await expect(players.getByRole('searchbox')).toBeVisible();
    await expect(players.getByRole('combobox', { name: 'Filter players' })).toBeVisible();
    await expect(players.getByRole('textbox', { name: 'Player name', exact: true })).toHaveCount(0);
    await players.getByRole('button', { name: 'New player', exact: true }).click();
    await players.getByRole('textbox', { name: 'Player name', exact: true }).fill('Alice');
    await players.getByRole('button', { name: 'Add player', exact: true }).click();
    await expect(players.locator('.player-result')).toContainText('Alice');
    await players.getByRole('button', { name: 'Close', exact: true }).click();
    await page
      .locator('app-rule-picker')
      .getByRole('button', { name: 'Rules', exact: true })
      .click();
    const rules = page.locator('.rules-dialog');
    await expect(rules).toBeVisible();
    await expect(rules.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    const gear = (await rules.getByRole('link', { name: 'Settings', exact: true }).boundingBox())!;
    const close = (await rules.getByRole('button', { name: 'Close', exact: true }).boundingBox())!;
    expect(gear.x + gear.width).toBeLessThan(close.x);
    expect(gear.y).toBe(close.y);
    await expect(rules.locator('details, select, input')).toHaveCount(0);
    await expect(rules.getByRole('button', { name: 'M.League', exact: true })).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/rule-choice-${width}.png` });
    await rules.getByRole('button', { name: 'Tenhou', exact: true }).click();
    await expect(rules).not.toBeVisible();
    await expect(page.locator('.rules-heading strong')).toHaveText('Tenhou');
    await page.reload();
    await expect(page.locator('.rules-heading strong')).toHaveText('Tenhou');
    await page.locator('.quick-score-link').click();
    await page
      .locator('app-rule-picker')
      .getByRole('button', { name: 'Rules', exact: true })
      .click();
    await rules.getByRole('button', { name: 'Mahjong Soul', exact: true }).click();
    await expect(page.locator('.rules-heading strong')).toHaveText('Mahjong Soul');
    await page.locator('.quick-score-back').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.setup-card .step')).toHaveCount(0);
  });
}
