import { beginWin, finishWin, recordDraw } from './helpers/game';
import { openQuickScore } from './helpers/navigation';
import { test, expect, type Page } from '@playwright/test';
import { applyPreset, expectApplied } from './helpers/settings';

test('rule and indicator changes invalidate the score and disable forbidden Ankan robbery', async ({
  page,
}) => {
  await page.goto('/');
  await openQuickScore(page);
  await page.getByRole('button', { name: /Try an example hand/ }).click();
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.score-total')).toBeVisible();
  await page.getByRole('combobox', { name: 'Ron circumstance', exact: true }).selectOption('ankan');
  await applyPreset(page, 'tenhou');
  await expect(page.locator('.score-total')).toHaveCount(0);
  const circumstance = page.getByRole('combobox', { name: 'Ron circumstance', exact: true });
  await expect(circumstance).toHaveValue('kakan');
  await expect(circumstance.locator('option[value="ankan"]')).toHaveJSProperty('disabled', true);
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.score-total')).toBeVisible();
  const dora = page.locator('app-tile-input[data-label="Dora indicators"]');
  await dora.getByRole('button', { name: 'Enter Dora indicators', exact: true }).click();
  await expect(dora.locator('.picker')).toHaveJSProperty('open', true);
  await dora.getByRole('button', { name: '2p: Add 2 pin', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.score-total')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /I have checked these tiles/ })).toHaveCount(0);
});

async function enter(page: Page, text: string) {
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.getByText('Type compact tile notation', { exact: true }).click();
  await page
    .getByRole('textbox', { name: 'All tiles, including melds and North', exact: true })
    .fill(text);
  await page.getByRole('button', { name: 'Replace tile collection', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
}

for (const preset of ['mahjong-soul', 'tenhou', 'm-league', 'custom'])
  for (const count of [3, 4]) {
    if (preset === 'm-league' && count === 3) continue;
    test(preset + ' ' + count + 'P live setup, settlement, draw and reload', async ({ page }) => {
      await page.goto('/');
      await applyPreset(page, preset, count as 3 | 4);
      await page.getByRole('button', { name: /Start match/ }).click();
      await beginWin(page, 'Player 2', 'tsumo');
      await finishWin(page, count === 3 ? '123p456p789s234s55p' : undefined);
      await expect(page.locator('.table-round')).toHaveText('east 2');
      await page.reload();
      await expectApplied(page, preset);
      await recordDraw(page);
      await expect(page.locator('.table-round')).toHaveText('east 3');
    });
  }

test('Chi caller is restricted and Pon upgrade consumes the existing red tile', async ({
  page,
}) => {
  await page.goto('/');
  await openQuickScore(page);
  await enter(page, '123m5550p');
  const tiles = page.locator('.hand-tray > .hand-tiles > button.tile');
  for (let index = 0; index < 3; index++) await tiles.nth(index).click();
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await page.getByRole('combobox', { name: 'Assign as', exact: true }).selectOption('chi');
  const source = page.getByRole('combobox', { name: 'Called from', exact: true });
  await expect(source.locator('option')).toHaveCount(1);
  await expect(source).toHaveValue('p0');
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  for (let index = 0; index < 3; index++) await tiles.nth(index).click();
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await page.getByRole('combobox', { name: 'Assign as', exact: true }).selectOption('pon');
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await expect(tiles).toHaveCount(1);
  await page.getByRole('button', { name: 'Upgrade to Kan', exact: true }).click();
  await expect(tiles).toHaveCount(0);
  await expect(page.locator('.meld-row').nth(1).locator('.mini-tiles app-tile-art')).toHaveCount(4);
  await expect(page.locator('.meld-row').nth(1).locator('.mini-tiles .red-ink')).toHaveCount(1);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.getByRole('dialog', { name: 'Enter tiles', exact: true }).press('Control+z');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(tiles).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Upgrade to Kan', exact: true })).toBeVisible();
});

test('custom settings persist through player-count changes and old tile undo is cleared', async ({
  page,
}) => {
  await page.goto('/');
  await openQuickScore(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Custom rule name', exact: true })
    .fill('Four-player custom');
  await page.getByRole('checkbox', { name: 'Red fives enabled', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Use these rules', exact: true }).click();
  await openQuickScore(page);
  await enter(page, '123m');
  await page
    .getByRole('combobox', { name: 'Rules', exact: true })
    .selectOption({ label: '3P · Sanma' });
  await expectApplied(page, 'mahjong-soul');
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo tile edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '2m: Add 2 man', exact: true })).toHaveCount(0);
});
