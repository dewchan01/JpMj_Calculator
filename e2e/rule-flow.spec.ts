import { test, expect, type Page } from '@playwright/test';

test('rule and indicator changes require renewed verification and disable forbidden Ankan robbery', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Quick score', exact: true }).click();
  await page.getByRole('button', { name: /Try an example hand/ }).click();
  const verified = page.getByRole('checkbox', { name: /I have checked these tiles/ });
  await verified.check();
  await page.getByRole('combobox', { name: 'Ron circumstance', exact: true }).selectOption('ankan');
  await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption('tenhou');
  await expect(verified).not.toBeChecked();
  const circumstance = page.getByRole('combobox', { name: 'Ron circumstance', exact: true });
  await expect(circumstance).toHaveValue('kakan');
  await expect(circumstance.locator('option[value="ankan"]')).toHaveJSProperty('disabled', true);
  await verified.check();
  const dora = page.locator('app-tile-input[data-label="Dora indicators"]');
  await dora.getByRole('button', { name: 'Enter Dora indicators', exact: true }).click();
  await expect(dora.locator('.picker')).toHaveJSProperty('open', true);
  await dora.getByRole('button', { name: '2p: Add 2 pin', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(verified).not.toBeChecked();
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

for (const preset of ['mahjong-soul', 'tenhou', 'm-league', 'custom']) {
  for (const count of [3, 4]) {
    if (preset === 'm-league' && count === 3) continue;
    test(`${preset} ${count}P: setup, verification, settlement, draw and reload`, async ({
      page,
    }) => {
      await page.goto('/');
      if (count === 3) await page.getByRole('button', { name: /3 players/ }).click();
      await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption(preset);
      await page.getByRole('button', { name: /Start match/ }).click();
      await expect(page.locator('.entry-column .step')).toHaveText(['01', '02', '03']);
      await expect(page.getByRole('combobox', { name: 'Rule preset', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: /Try an example hand/ }).click();
      await page.getByRole('combobox', { name: 'Win method', exact: true }).selectOption('tsumo');
      await page.getByRole('button', { name: /Calculate score/ }).click();
      await expect(page.getByText('2 Han · 20 Fu', { exact: true })).toBeVisible();
      const save = page.getByRole('button', { name: 'Confirm & save settlement', exact: true });
      await expect(save).toBeDisabled();
      await page.getByRole('checkbox', { name: /I have checked these tiles/ }).check();
      await page.getByRole('button', { name: /Calculate score/ }).click();
      await save.click();
      await expect(page.locator('app-table-summary')).toContainText('east 2');
      await expect(page.locator('.player-seat').nth(1).locator('.player-points')).toHaveText(
        count === 3 ? '36,100' : '26,500',
      );
      await page.reload();
      await expect(page.getByRole('combobox', { name: 'Rule preset', exact: true })).toHaveValue(
        preset,
      );
      await expect(page.locator('app-table-summary')).toContainText('east 2');
      await page.getByRole('button', { name: 'Record draw', exact: true }).click();
      const draw = page.getByRole('combobox', { name: 'Draw type', exact: true });
      if (preset === 'm-league') {
        await expect(draw.locator('option[value="abortive"]')).toHaveJSProperty('disabled', true);
        await expect(draw.locator('option[value="nagashi"]')).toHaveJSProperty('disabled', true);
      } else {
        await draw.selectOption('abortive');
        const reasons = page.getByRole('combobox', { name: 'Abortive draw reason', exact: true });
        await expect(reasons.locator('option[value="triple-ron"]')).toHaveCount(
          count === 4 && preset === 'tenhou' ? 1 : 0,
        );
        await expect(reasons.locator('option[value="four-winds"]')).toHaveCount(
          count === 4 ? 1 : 0,
        );
        await draw.selectOption('exhaustive');
      }
      await page
        .getByRole('checkbox', {
          name: 'I confirm the draw circumstances and player declarations.',
          exact: true,
        })
        .check();
      await page.getByRole('button', { name: 'Review draw settlement', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm round settlement', exact: true }).click();
      await expect(page.locator('app-table-summary')).toContainText('east 3');
    });
  }
}

test('Chi caller is restricted and Pon upgrade consumes the existing red tile', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Quick score', exact: true }).click();
  await enter(page, '123m5550p');
  const tiles = page.locator('.hand-tray > .hand-tiles > button.tile');
  for (let index = 0; index < 3; index++) await tiles.nth(index).click();
  await page.getByRole('combobox', { name: 'Assign as', exact: true }).selectOption('chi');
  const source = page.getByRole('combobox', { name: 'Called from', exact: true });
  await expect(source.locator('option')).toHaveCount(1);
  await expect(source).toHaveValue('p0');
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  for (let index = 0; index < 3; index++) await tiles.nth(index).click();
  await page.getByRole('combobox', { name: 'Assign as', exact: true }).selectOption('pon');
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await expect(tiles).toHaveCount(1);
  await page.getByRole('button', { name: 'Upgrade to Kan', exact: true }).click();
  await expect(tiles).toHaveCount(0);
  await expect(page.locator('.meld-row').nth(1).locator('.mini-tiles app-tile-art')).toHaveCount(4);
  await expect(page.locator('.meld-row').nth(1).locator('.mini-tiles .red-ink')).toHaveCount(1);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.getByRole('button', { name: 'Undo tile edit', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(tiles).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Upgrade to Kan', exact: true })).toBeVisible();
});

test('custom settings persist through player-count changes and old tile undo is cleared', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Quick score', exact: true }).click();
  await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption('custom');
  await page.getByText('Compare rules and view settings', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Red fives enabled', exact: true }).uncheck();
  await enter(page, '123m');
  await page
    .getByRole('combobox', { name: 'Rules', exact: true })
    .selectOption({ label: '3P · Sanma' });
  await expect(
    page.getByRole('checkbox', { name: 'Red fives enabled', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo tile edit', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '2m: Add 2 man', exact: true })).toHaveCount(0);
});
