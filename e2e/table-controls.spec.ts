import { test, expect } from '@playwright/test';
import { enterLiveTiles, gameMenu, prompt } from './helpers/game';

test('point comparison works while held by touch or keyboard and always releases', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  const compare = page.getByRole('button', { name: 'Point differences Player 2', exact: true });
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const bounds = (await compare.boundingBox())!;
  const touch = [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 }];
  for (const type of ['touchEnd', 'touchCancel'] as const) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch });
    await expect(page.locator('.point-difference')).toHaveCount(3);
    await expect(compare).toHaveAttribute('aria-pressed', 'true');
    await session.send('Input.dispatchTouchEvent', { type, touchPoints: [] });
    await expect(page.locator('.point-difference')).toHaveCount(0);
  }
  await compare.focus();
  await page.keyboard.down('Space');
  await expect(page.locator('.point-difference')).toHaveCount(3);
  await page.keyboard.up('Space');
  await expect(page.locator('.point-difference')).toHaveCount(0);
  await page.keyboard.down('Enter');
  await expect(page.locator('.point-difference')).toHaveCount(3);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('.point-difference')).toHaveCount(0);
  await page.keyboard.up('Enter');
  await expect(page.locator('.center-action')).toHaveText('');
  await expect(page.locator('.yakitori-label img')).toHaveCount(4);
});

test('match settings show the saved rules and returning to My table pauses the clock', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await expect(page.locator('.game-shell')).toBeVisible();
  const matchUrl = page.url();
  await gameMenu(page, 'In-game settings');
  await expect(
    prompt(page).getByRole('button', { name: 'Show point differences on the table', exact: true }),
  ).toHaveCount(0);
  await expect(prompt(page).locator('.saved-rule-group')).toHaveCount(6);
  expect(await prompt(page).locator('.saved-rule-group dt').count()).toBeGreaterThan(30);
  const score = prompt(page)
    .locator('.saved-rule-group')
    .filter({ has: page.getByText('Score settings', { exact: true }) });
  await expect(prompt(page).locator('.saved-rule-group summary')).toHaveCount(0);
  await expect(score.locator('dl')).toBeVisible();
  await expect(
    score.locator('dl > div').filter({ hasText: 'Starting points' }).locator('dd'),
  ).toHaveText('25,000');
  await gameMenu(page, 'My table');
  await expect(page).toHaveURL(/\/$/);
  await page.goto(matchUrl);
  await expect(page.getByRole('button', { name: 'Game timer', exact: true })).not.toContainText(
    'Paused',
  );
  await expect(page.locator('.difference-strip')).toHaveCount(0);
});

test('Riichi and indicator dialogs contain only their selected operation and preserve the other indicators', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page
    .locator('.player-seat')
    .filter({ hasText: 'Player 2' })
    .getByRole('button', { name: 'Riichi', exact: true })
    .click();
  await expect(prompt(page)).not.toBeVisible();
  await page
    .locator('.player-seat')
    .filter({ hasText: 'Player 2' })
    .getByRole('button', { name: 'Riichi', exact: true })
    .click();
  await expect(prompt(page)).not.toBeVisible();
  await expect(page.locator('.table-pot strong')).toHaveText('0');
  await expect(
    page.locator('.player-seat').filter({ hasText: 'Player 2' }).locator('.player-points'),
  ).toHaveText('25,000');
  for (const [label, other, notation] of [
    ['Dora indicators', 'Ura indicators', '1z'],
    ['Ura indicators', 'Dora indicators', '2z'],
  ] as const) {
    await page.locator('.indicator-bar').getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Enter ' + label, exact: true })).toBeVisible();
    await expect(prompt(page)).not.toBeVisible();
    await expect(prompt(page).locator(`app-tile-input[data-label="${other}"]`)).toHaveCount(0);
    await enterLiveTiles(page, label, notation);
    await expect(prompt(page)).not.toBeVisible();
  }
  await page.reload();
  for (const label of ['Dora indicators', 'Ura indicators'])
    await expect(
      page
        .locator('.indicator-bar')
        .getByRole('button', { name: label, exact: true })
        .locator('app-tile-art'),
    ).toHaveCount(1);
  const header = (await page.locator('.game-heading').boundingBox())!;
  const tools = (await page.locator('.game-tools').boundingBox())!;
  expect(tools.y).toBeGreaterThan(header.y + header.height);
  await expect(page.locator('.game-heading .dice-icon')).toHaveCount(0);
});
