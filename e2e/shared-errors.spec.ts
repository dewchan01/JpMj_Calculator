import { openQuickScore, toggleTheme } from './helpers/navigation';
import { test, expect, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function appearance(notice: Locator) {
  return notice.evaluate((element) => {
    const style = getComputedStyle(element);
    return [
      style.backgroundColor,
      style.color,
      style.borderColor,
      style.borderRadius,
      style.padding,
      style.fontSize,
      style.lineHeight,
    ];
  });
}
for (const dark of [false, true]) {
  test(`single and multiple errors share a design in ${dark ? 'dark' : 'light'} mode`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.route('**/config.json', (route) =>
      route.fulfill({ json: { recognition: { provider: 'mock' } } }),
    );
    await page.goto('/');
    if (dark) await toggleTheme(page);
    await openQuickScore(page);
    await page.getByRole('button', { name: /Calculate score/ }).click();
    const validation = page.locator('app-score-result .error-notice');
    await expect(validation).toBeFocused();
    expect(
      (await validation.boundingBox())!.y + (await validation.boundingBox())!.height,
    ).toBeLessThanOrEqual((await page.locator('.app-navigation').boundingBox())!.y);
    await expect(validation.locator('svg.error-icon')).toBeVisible();
    await expect(validation.locator('svg.error-icon')).toHaveAttribute('aria-hidden', 'true');
    expect(await validation.locator('li').count()).toBeGreaterThan(1);
    const design = await appearance(validation);
    await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('Type compact tile notation', { exact: true }).click();
    await dialog
      .getByRole('textbox', { name: 'All tiles, including melds and North', exact: true })
      .fill('bad');
    await dialog.getByRole('button', { name: 'Replace tile collection', exact: true }).click();
    const notation = dialog.locator('.notation .error-notice');
    await expect(notation).toBeFocused();
    expect(await appearance(notation)).toEqual(design);
    const capture = dialog.locator('app-photo-capture');
    await capture.locator('summary').click();
    await capture.getByRole('textbox', { name: 'Edit preview tiles', exact: true }).fill('bad');
    await capture.getByRole('button', { name: 'Update preview', exact: true }).click();
    await expect(capture.getByRole('alert')).toBeFocused();
    expect(await appearance(capture.locator('.error-notice'))).toEqual(design);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('navigation').getByRole('link', { name: 'My table', exact: true }).click();
    await page.getByRole('button', { name: /Start match/ }).click();
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await page.getByRole('button', { name: 'End this hand', exact: true }).click();
    const game = page.locator('.game-prompt');
    await game.getByRole('button', { name: 'Win', exact: true }).click();
    await game.getByRole('button', { name: 'Next', exact: true }).click();
    const draw = game.locator('.error-notice');
    await expect(draw).toBeFocused();
    expect(await appearance(draw)).toEqual(design);
  });
}
