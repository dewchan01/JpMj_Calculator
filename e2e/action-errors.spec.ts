import { prompt } from './helpers/game';
import { openQuickScore } from './helpers/navigation';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function enter(page: Page, notation: string) {
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.getByText('Type compact tile notation', { exact: true }).click();
  await page
    .getByRole('textbox', { name: 'All tiles, including melds and North', exact: true })
    .fill(notation);
  await page.getByRole('button', { name: 'Replace tile collection', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
}

for (const width of [390, 1280]) {
  test(`assignment and Kan errors stay beside their actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    await openQuickScore(page);
    await enter(page, '444z');
    const tiles = page.locator('.hand-tiles > button.tile');
    await tiles.nth(0).click();
    await tiles.nth(1).click();
    await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Assign selected tiles', exact: true });
    await panel.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
    const error = panel.getByRole('alert');
    await expect(error).toHaveText('Enter three tiles for Chi/Pon or four for Kan.');
    await expect(error).toBeFocused();
    await expect(page.getByRole('alert')).toHaveCount(1);
    await panel.screenshot({ path: `artifacts/assignment-error-${width}.png` });
    expect(
      await error.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.top >= element.closest('dialog')!.getBoundingClientRect().top &&
          rect.bottom <= innerHeight
        );
      }),
    ).toBe(true);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await tiles.nth(2).click();
    await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
    await expect(error).toHaveCount(0);
    await panel.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
    await expect(page.locator('.meld-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'Upgrade to Kan', exact: true }).click();
    const upgradeError = page
      .locator('.card')
      .filter({ has: page.locator('.meld-row') })
      .getByRole('alert');
    await expect(upgradeError).toContainText('Select the fourth matching tile');
    await expect(upgradeError).toBeFocused();
    await expect(page.getByRole('alert')).toHaveCount(1);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
  });
}

test('notation errors remain inside the dialog and deposit errors below the deposit button', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await openQuickScore(page);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByText('Type compact tile notation', { exact: true }).click();
  await editor
    .getByRole('textbox', { name: 'All tiles, including melds and North', exact: true })
    .fill('bad');
  await editor.getByRole('button', { name: 'Replace tile collection', exact: true }).click();
  await expect(editor.getByRole('alert')).toBeFocused();
  await editor.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'My table', exact: true }).click();
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.getByRole('button', { name: 'End this hand', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Win', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(prompt(page).getByRole('alert')).toBeFocused();
  await expect(prompt(page).getByRole('alert')).toContainText('Choose winners');
});
