import { test, expect } from '@playwright/test';
import { openQuickScore } from './helpers/navigation';
import { playerAction, prompt } from './helpers/game';

for (const count of [4, 3]) {
  test(`${count}P red fives have a separate row in the shared tile panel`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 740 });
    await page.goto('/');
    await openQuickScore(page);
    if (count === 3)
      await page
        .getByRole('combobox', { name: 'Rules', exact: true })
        .selectOption({ label: '3P · Sanma' });
    await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Enter tiles', exact: true });
    const rows = sheet.locator('app-tile-picker .palette-row');
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(0).locator('button')).toHaveCount(count === 4 ? 9 : 2);
    await expect(rows.nth(1).locator('button')).toHaveCount(9);
    await expect(rows.nth(2).locator('button')).toHaveCount(9);
    await expect(rows.nth(4).locator('button')).toHaveCount(count === 4 ? 3 : 2);
    const positions = await rows
      .nth(1)
      .locator('button')
      .evaluateAll((tiles) => tiles.map((tile) => tile.getBoundingClientRect().y));
    expect(new Set(positions).size).toBe(1);
    await rows.nth(4).getByRole('button', { name: /^0p:/ }).click();
    await expect(sheet.locator('.entry-preview .tile')).toHaveCount(1);
    await page.screenshot({ path: `artifacts/shared-red-tiles-${count}p.png` });
  });
}

test('live indicators, calls and winning-hand sheets share a separate red row', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  for (const [label, red] of [['Dora indicators', /^0p:/]] as const) {
    await page.locator('.indicator-bar').getByRole('button', { name: label, exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Enter ' + label, exact: true });
    await expect(sheet.locator('.palette-row')).toHaveCount(5);
    await expect(sheet.getByRole('button', { name: /^0[mps]:/ })).toHaveCount(3);
    await sheet.getByRole('button', { name: red }).click();
    await sheet.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(sheet).not.toBeVisible();
    await expect(
      page
        .locator('.indicator-bar')
        .getByRole('button', { name: label, exact: true })
        .locator('app-tile-art'),
    ).toHaveCount(1);
  }
  await playerAction(page, 'Player 3');
  await prompt(page).getByRole('button', { name: 'Pon', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Enter Meld tiles', exact: true }).click();
  const call = page.getByRole('dialog', { name: 'Enter Meld tiles', exact: true });
  await expect(call.locator('.palette-row')).toHaveCount(5);
  await call.locator('.palette-row').last().getByRole('button', { name: /^0p:/ }).click();
  await call.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(call).not.toBeVisible();
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await playerAction(page, 'Player 2');
  await prompt(page).getByRole('button', { name: 'Tsumo · self draw', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Enter The winning hand', exact: true }).click();
  const hand = page.getByRole('dialog', { name: 'Enter The winning hand', exact: true });
  await expect(hand.locator('.palette-row')).toHaveCount(5);
  await expect(hand.locator('.palette-row').last().getByRole('button')).toHaveCount(3);
});

test('disabling red fives removes the red row from shared entry', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption('custom');
  await page.getByRole('textbox', { name: 'Custom rule name', exact: true }).fill('No red fives');
  await page.getByRole('checkbox', { name: 'Red fives enabled', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Use these rules', exact: true }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await openQuickScore(page);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Enter tiles', exact: true });
  await expect(sheet.locator('.palette-row')).toHaveCount(4);
  await expect(sheet.getByRole('button', { name: /^0[mps]:/ })).toHaveCount(0);
});
