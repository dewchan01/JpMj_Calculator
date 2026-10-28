import { test, expect } from '@playwright/test';
import { gameMenu, prompt } from './helpers/game';

test('end-match and final-result actions align to the right on phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page.locator('.game-shell')).toBeVisible();
  await gameMenu(page, 'End entire match');
  const finish = prompt(page).locator('.finish-actions');
  const finishBox = (await finish.boundingBox())!;
  const end = prompt(page).getByRole('button', { name: 'End entire match', exact: true });
  const endBox = (await end.boundingBox())!;
  expect(Math.abs(finishBox.x + finishBox.width - endBox.x - endBox.width)).toBeLessThan(1);
  await end.click();
  const actions = page.locator('.result-actions');
  await expect(actions.getByRole('button', { name: 'Save game', exact: true })).toBeVisible();
  const groupBox = (await actions.boundingBox())!;
  const lastBox = (await actions
    .getByRole('button', { name: 'Discard game', exact: true })
    .boundingBox())!;
  expect(Math.abs(groupBox.x + groupBox.width - lastBox.x - lastBox.width)).toBeLessThan(1);
  await actions.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/result-actions-right-390.png' });
});
