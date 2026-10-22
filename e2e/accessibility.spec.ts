import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('setup, custom rules, scoring and draw controls meet automated WCAG AA checks', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByText('Compare rules and view settings', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption('custom');
  const check = async (): Promise<void> => {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
  };
  await check();
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: /Try an example hand/ }).click();
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await check();
  await page.getByRole('button', { name: 'Record draw', exact: true }).click();
  await page.getByRole('combobox', { name: 'Draw type', exact: true }).selectOption('nagashi');
  await check();
  await page.getByRole('combobox', { name: 'Language / 語言' }).selectOption('zh-TW');
  await check();
});
