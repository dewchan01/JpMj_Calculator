import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ locale: 'ja-JP' });
test('Japanese saved matches and history format dates without changing names', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Language / 語言' }).selectOption('ja');
  await page.getByRole('textbox', { name: '対局名', exact: true }).fill('陳萬發');
  await page.getByRole('button', { name: /対局を開始/ }).click();
  await page.getByRole('button', { name: /サンプル手牌/ }).click();
  await page.getByRole('checkbox', { name: '牌を確認しました', exact: true }).check();
  await page.getByRole('button', { name: '点数を計算', exact: true }).click();
  await page.getByRole('button', { name: '精算を確定して保存', exact: true }).click();
  await expect(page.locator('.history-event summary')).toContainText('和了');
  await page.getByRole('link', { name: 'マイ卓', exact: true }).click();
  await expect(page.getByText('陳萬發', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('Japanese translates scoring and saved preference; indicator palettes start open', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('combobox', { name: 'Language / 語言' }).selectOption('ja');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('heading', { name: '対局を作成', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '点数計算', exact: true }).click();
  await page.getByRole('button', { name: /サンプル手牌/ }).click();
  await page.getByRole('button', { name: '点数を計算', exact: true }).click();
  await expect(page.getByText('平和', { exact: true })).toBeVisible();
  await expect(page.getByText('1翻・30符', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('combobox', { name: 'Language / 語言' })).toHaveValue('ja');
  await page.getByRole('button', { name: 'ドラ表示牌を入力', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'ドラ表示牌を入力', exact: true });
  await expect(dialog.locator('.picker')).toHaveJSProperty('open', true);
  await expect(dialog.getByRole('button', { name: '2p: 2筒を追加', exact: true })).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/japanese-entry.png' });
});
