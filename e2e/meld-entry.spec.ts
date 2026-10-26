import { test, expect } from '@playwright/test';
import { playerAction, prompt } from './helpers/game';

test('meld editor explains one-tile completion and validates inside the editor', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await playerAction(page, 'Player 1');
  await prompt(page).getByRole('button', { name: 'Pon', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Enter Meld tiles', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Enter Meld tiles', exact: true });
  await expect(editor.getByRole('status')).toContainText('Choose one tile');
  await expect(editor.getByRole('button', { name: 'Done', exact: true })).toBeDisabled();
  await editor.getByText('Type tile notation instead', { exact: true }).click();
  const notation = editor.getByRole('textbox', { name: 'Meld tiles', exact: true });
  await notation.fill('55p');
  await editor.getByRole('button', { name: 'Apply notation', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Choose one tile for automatic matching');
  await expect(editor.getByRole('button', { name: 'Done', exact: true })).toBeDisabled();
  await notation.fill('0p');
  await editor.getByRole('button', { name: 'Apply notation', exact: true }).click();
  await expect(editor.getByRole('alert')).toHaveCount(0);
  await expect(editor.getByRole('button', { name: 'Done', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'artifacts/meld-guidance-390.png' });
  await editor.getByRole('button', { name: 'Done', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
  await expect(prompt(page)).not.toBeVisible();
});
