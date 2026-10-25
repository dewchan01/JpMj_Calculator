import { expect, type Page } from '@playwright/test';
import { openQuickScore } from './navigation';

export async function applyPreset(page: Page, preset: string, count: 3 | 4 = 4): Promise<void> {
  const quick = new URL(page.url()).pathname === '/score';
  await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: count + ' players', exact: true }).click();
  await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption(preset);
  if (preset === 'custom')
    await page
      .getByRole('textbox', { name: 'Custom rule name', exact: true })
      .fill('Custom / house rules');
  await page.getByRole('button', { name: 'Use these rules', exact: true }).click();
  await expect(page.getByRole('status')).toBeVisible();
  if (quick) await openQuickScore(page);
  else
    await page.getByRole('navigation').getByRole('link', { name: 'My table', exact: true }).click();
}

export async function expectApplied(page: Page, preset: string): Promise<void> {
  const names: Record<string, string> = {
    'mahjong-soul': 'Mahjong Soul',
    tenhou: 'Tenhou',
    'm-league': 'M.League',
    custom: 'Custom / house rules',
  };
  await expect(page.locator('.rules-heading strong, .table-caption > span')).toContainText(
    names[preset] ?? preset,
  );
}
