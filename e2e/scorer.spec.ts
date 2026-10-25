import { beginWin, finishWin, playerAction, gameMenu, prompt } from './helpers/game';
import { openQuickScore } from './helpers/navigation';
import { expect, test } from '@playwright/test';
test('mobile match, draft, verified settlement, escrow, history, reload and offline', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Match name').fill('Test table');
  await page.getByRole('button', { name: /Start match/ }).click();
  await playerAction(page, 'Player 2');
  await prompt(page)
    .getByRole('button', { name: /Declare Riichi/ })
    .click();
  await expect(page.locator('.table-pot strong')).toHaveText('1,000');
  await page.reload();
  await expect(page.locator('.table-pot strong')).toHaveText('1,000');
  await beginWin(page);
  await finishWin(page);
  await gameMenu(page, 'History');
  await expect(page.locator('.history-event')).toHaveCount(2);
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Test table', exact: true })).toBeVisible();
  await gameMenu(page, 'History');
  await expect(page.locator('.history-event')).toHaveCount(2);
  expect(errors).toEqual([]);
});
test('quick score rejects incomplete hands, supports Sanma and manual camera fallback', async ({
  page,
}) => {
  await page.goto('/');
  await openQuickScore(page);
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.getByText(/Expected 14 concealed tiles/)).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Rules', exact: true })
    .selectOption({ label: '3P · Sanma' });
  await page.getByRole('button', { name: /Try an example hand/ }).click();
  await page.getByLabel('Win method').selectOption('tsumo');
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.getByText('2 Han · 20 Fu', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  const capture = page.locator('app-photo-capture').first();
  await capture.locator('details.photo-card > summary').click();
  await expect(capture.locator('input[capture="environment"]')).toHaveAttribute(
    'accept',
    'image/*',
  );
  await capture.getByRole('textbox', { name: 'Edit preview tiles' }).fill('123p');
  await capture.getByRole('button', { name: 'Update preview' }).click();
  await expect(page.getByText('14 concealed · expected 14')).toBeVisible();
  await capture.getByRole('button', { name: 'Apply reviewed tiles' }).click();
  await expect(page.getByText('3 concealed · expected 14')).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.getByRole('button', { name: 'Undo tile edit' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByText('14 concealed · expected 14')).toBeVisible();
  await page.screenshot({ path: 'artifacts/scorer-desktop.png', fullPage: true });
});
