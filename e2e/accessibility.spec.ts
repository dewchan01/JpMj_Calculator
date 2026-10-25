import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { applyPreset } from './helpers/settings';
import { prompt } from './helpers/game';

test('setup, table and condition prompts meet automated WCAG AA checks', async ({ page }) => {
  await page.goto('/');
  await applyPreset(page, 'custom');
  const check = async () =>
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  await check();
  await page.getByRole('button', { name: /Start match/ }).click();
  await check();
  await page.getByRole('button', { name: 'End this hand', exact: true }).click();
  await check();
  await prompt(page).getByRole('button', { name: 'Record draw', exact: true }).click();
  await prompt(page)
    .getByRole('combobox', { name: 'Draw type', exact: true })
    .selectOption('nagashi');
  await check();
});
