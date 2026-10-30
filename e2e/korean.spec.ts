import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { musicTitles } from '../apps/web/src/app/core/sound/music-catalog';

const korean: Record<string, string> = JSON.parse(
  readFileSync(new URL('../apps/web/src/app/core/i18n/ko.json', import.meta.url), 'utf8'),
);
const t = (key: string) => korean[key] ?? key;

test('Korean switches immediately, preserves names, persists, and localizes music and validation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Match name', exact: true }).fill('Alice East 서울');
  await page.locator('.header-tools select').selectOption('ko');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(page).toHaveTitle('Riichi / table — 리치 마작 점수 계산기');
  await expect(page.getByRole('textbox', { name: t('Match name'), exact: true })).toHaveValue(
    'Alice East 서울',
  );
  await expect(
    page.getByRole('navigation').getByRole('link', { name: t('My table'), exact: true }),
  ).toBeVisible();
  await page.goto('/others/sound');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('Sound effects'));
  const music = page.getByRole('combobox', { name: t('Lobby music'), exact: true });
  for (const track of [
    'Lobby',
    'Lobby Autumn',
    'Lobby Winter',
    'Lobby Bd',
    'Lobby 2303wenquan',
    'Zhongxialvdong',
  ]) {
    await expect(music.locator(`option[value="${track}"]`)).toHaveText(t(musicTitles[track]));
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await page.goto('/score');
  await page.getByRole('button', { name: t('Calculate score'), exact: true }).click();
  await expect(
    page.getByText('화료패를 포함한 손패는 14장이어야 합니다.', { exact: true }),
  ).toBeVisible();
});

test('mobile language settings support Korean and localized tile names', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/others/language');
  await page.locator('main select').selectOption('ko');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await page.reload();
  await expect(page.locator('main select')).toHaveValue('ko');
  await page.goto('/score');
  await expect(page.getByRole('button', { name: t('Calculate score'), exact: true })).toBeVisible();
  await page.getByRole('button', { name: t('Enter tiles'), exact: true }).click();
  const editor = page.getByRole('dialog', { name: t('Enter tiles'), exact: true });
  for (const tile of ['1만', '1통', '1삭', '적5만', '백', '발', '중']) {
    await expect(editor.getByRole('button', { name: new RegExp(tile) }).first()).toBeVisible();
  }
  await page.screenshot({ path: 'artifacts/korean-scorer-mobile.png', fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
