import { expect, test, type Page } from '@playwright/test';

async function enter(page: Page, notation: string): Promise<void> {
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.getByText('Type compact tile notation', { exact: true }).click();
  await page
    .getByRole('textbox', { name: 'All tiles, including melds and North', exact: true })
    .fill(notation);
  await page.getByRole('button', { name: 'Replace tile collection', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
}

test('M.League is four-player only and persists its match profile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption('m-league');
  await expect(page.getByText(/M.League: four players/)).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Game length', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.waitForURL('**/score/*');
  await expect(page.getByRole('combobox', { name: 'Rule preset', exact: true })).toHaveValue(
    'm-league',
  );
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Rule preset', exact: true })).toHaveValue(
    'm-league',
  );
  await page.getByRole('link', { name: 'My table', exact: true }).click();
  await page.getByRole('button', { name: /3 players/ }).click();
  await expect(page.locator('option[value="m-league"]')).toHaveJSProperty('disabled', true);
});
test('presets explain differences, change Yakuman score, and expose custom settings', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Quick score', exact: true }).click();
  await enter(page, '222m333p444s11155z');
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.getByText('Single-wait concealed triplets (Suuankou tanki)')).toBeVisible();
  await expect(page.locator('.score-total>span')).toHaveText('64,000');
  await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption('tenhou');
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.score-total>span')).toHaveText('32,000');
  await page.getByText('Compare rules and view settings', { exact: true }).click();
  await expect(
    page.getByText(
      'Special waits award single Yakuman; triple Ron draws; Pao covers the whole combined Yakuman hand.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Double Yakuman for special forms', exact: true }),
  ).toBeDisabled();
  await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption('custom');
  await page
    .getByRole('checkbox', { name: 'Double Yakuman for special forms', exact: true })
    .uncheck();
  await page.getByRole('checkbox', { name: 'Red fives enabled', exact: true }).uncheck();
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.score-total>span')).toHaveText('32,000');
  await expect(page.getByRole('button', { name: /Add Red 5 man/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('chosen rules persist, draws advance the round, and undo restores it', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption('tenhou');
  await page.getByRole('combobox', { name: 'Game length', exact: true }).selectOption('east');
  await page.getByRole('button', { name: /Start match/ }).click();
  await expect(page.getByRole('combobox', { name: 'Rule preset', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Record draw', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Player 2', exact: true }).check();
  await page
    .getByRole('checkbox', {
      name: 'I confirm the draw circumstances and player declarations.',
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'Review draw settlement', exact: true }).click();
  await expect(page.getByText('Dealer rotates', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm round settlement', exact: true }).click();
  await expect(page.locator('app-table-summary')).toContainText('east 2');
  await page.locator('.history-event summary').click();
  await expect(page.getByText('Tenhou · v2')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Rule preset', exact: true })).toHaveValue(
    'tenhou',
  );
  await expect(page.locator('app-table-summary')).toContainText('east 2');
  await page.getByRole('button', { name: /History/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Undo last ledger event', exact: true }).click();
  await expect(page.locator('app-table-summary')).toContainText('east 1');
  await page.screenshot({ path: 'artifacts/rules-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('double Ron queue settles both hands and stores the explanations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('combobox', { name: 'Discarder', exact: true }).selectOption('p3');
  await page.getByRole('combobox', { name: 'Winner', exact: true }).selectOption('p0');
  await enter(page, '123456789m123p44z');
  await page.getByRole('checkbox', { name: /I have checked these tiles/ }).check();
  await page.getByRole('button', { name: 'Add verified Ron winner', exact: true }).click();
  await page.getByRole('combobox', { name: 'Winner', exact: true }).selectOption('p1');
  await enter(page, '123456789p123s44z');
  await page.getByRole('checkbox', { name: /I have checked these tiles/ }).check();
  await page.getByRole('button', { name: 'Add verified Ron winner', exact: true }).click();
  await page.getByRole('button', { name: 'Review all Ron winners', exact: true }).click();
  await expect(
    page.locator('app-round-review').getByText('Pure straight (Ittsu)', { exact: true }),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'Confirm round settlement', exact: true }).click();
  await expect(page.locator('.history-event summary')).toContainText('Player 1, Player 2');
  await page.locator('.history-event summary').click();
  await expect(page.getByText('Pure straight (Ittsu)', { exact: true })).toHaveCount(2);
  await expect(page.locator('app-table-summary')).toContainText('east 1');
});

test('exposed Daisangen uses original call order and selected Pao policy', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Quick score', exact: true }).click();
  await enter(page, '11122z555666777z');
  for (const source of ['p0', 'p0', 'p3']) {
    const tiles = page.locator('.hand-tray > .hand-tiles > button.tile');
    for (let index = 5; index < 8; index++) await tiles.nth(index).click();
    await page.getByRole('combobox', { name: 'Called from', exact: true }).selectOption(source);
    await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  }
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.score-total>span')).toHaveText('64,000');
  await expect(page.getByText('Responsibility: half of Ron', { exact: true })).toBeVisible();
  await expect(page.locator('.payment-row')).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption('tenhou');
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.payment-row')).toHaveCount(2);
  await expect(page.locator('.payment-row>strong')).toHaveText(['32,000', '32,000']);
});

test('last-hand finish ends the match and undo reopens it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: /Try an example hand/ }).click();
  await page.getByRole('combobox', { name: 'Dealer', exact: true }).selectOption('p3');
  await page.getByRole('combobox', { name: 'Round wind', exact: true }).selectOption('south');
  await page.getByRole('spinbutton', { name: 'Hand number', exact: true }).fill('4');
  await page.getByRole('checkbox', { name: 'Riichi', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Ippatsu', exact: true }).check();
  const doraInput = page.locator('app-tile-input[data-label="Dora indicators"]');
  await doraInput.getByRole('button', { name: 'Enter Dora indicators', exact: true }).click();
  await expect(doraInput.locator('.picker')).toHaveJSProperty('open', true);
  await doraInput.getByRole('button', { name: '4p: Add 4 pin', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('checkbox', { name: /I have checked these tiles/ }).check();
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await page.getByRole('button', { name: 'Confirm & save settlement', exact: true }).click();
  await expect(page.getByText('Match ended · Match complete')).toBeVisible();
  await expect(page.locator('app-table-summary')).toContainText('south 4');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Undo last ledger event', exact: true }).click();
  await expect(page.getByText('Match ended · Match complete')).toHaveCount(0);
});
