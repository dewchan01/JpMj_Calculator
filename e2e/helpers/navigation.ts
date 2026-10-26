import { type Page } from '@playwright/test';
import { gameMenu } from './game';

export async function leaveGame(page: Page): Promise<boolean> {
  if (!(await page.locator('.game-shell').isVisible())) return false;
  const dialog = page.locator('dialog.game-prompt');
  if (await dialog.isVisible()) await dialog.locator('.close-prompt').click();
  await page.locator('.floating-menu').click();
  await dialog.locator('.return-table').click();
  return true;
}

export async function openQuickScore(page: Page): Promise<void> {
  await leaveGame(page);
  await page.locator('.app-navigation a').first().click();
  await page.locator('.quick-score-link').click();
}

export async function openRules(page: Page): Promise<void> {
  await leaveGame(page);
  await page.locator('.app-navigation a[href$="/others"]').click();
  await page.locator('.other-list a[href$="/others/rules"]').click();
}

export async function setLanguage(page: Page, language: string): Promise<void> {
  const header = page.locator('.header-tools select');
  if (await header.isVisible()) {
    await header.selectOption(language);
    return;
  }
  const wasRunning =
    (await page.locator('.game-shell').isVisible()) &&
    !(await page.locator('.clock small').isVisible());
  const wasGame = await leaveGame(page);
  await page.locator('.app-navigation a[href$="/others"]').click();
  await page.locator('.other-list a[href$="/others/language"]').click();
  await page.locator('.other-detail select').selectOption(language);
  await page.goBack();
  await page.goBack();
  if (wasGame) {
    await page.goBack();
    if (wasRunning) await gameMenu(page, 'Resume game');
  }
}

export async function toggleTheme(page: Page): Promise<void> {
  const header = page.locator('.theme-toggle');
  if (await header.isVisible()) {
    await header.click();
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    return;
  }
  const wasRunning =
    (await page.locator('.game-shell').isVisible()) &&
    !(await page.locator('.clock small').isVisible());
  const wasGame = await leaveGame(page);
  await page.locator('.app-navigation a[href$="/others"]').click();
  await page.locator('.other-list a[href$="/others/theme"]').click();
  await page.locator('.theme-choices button[aria-pressed="false"]').click();
  await page.goBack();
  await page.goBack();
  if (wasGame) {
    await page.goBack();
    if (wasRunning) await gameMenu(page, 'Resume game');
  }
}
