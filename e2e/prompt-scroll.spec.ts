import { test, expect } from '@playwright/test';
import { gameMenu, prompt } from './helpers/game';

test('desktop prompts keep the heading fixed and use one contained vertical scrollbar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await gameMenu(page, 'In-game settings');
  const modal = prompt(page);
  await expect(page.locator('html')).toHaveCSS('overflow-y', 'hidden');
  const body = modal.locator('.prompt-body');
  await expect(body).toHaveCSS('overflow-y', 'auto');
  await expect(body).toHaveCSS('scrollbar-width', 'thin');
  const heading = (await modal.locator('.prompt-heading').boundingBox())!;
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const after = (await modal.locator('.prompt-heading').boundingBox())!;
  expect(after.y).toBe(heading.y);
  expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await modal.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await modal.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/desktop-prompt-scroll.png' });
});

test('phone double-taps do not zoom while pinch zoom remains enabled', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 740 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('http://localhost:4300/');
  await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.locator('html')).toHaveCSS('touch-action', 'manipulation');
  const heading = (await page
    .getByRole('heading', { name: 'Settings', exact: true })
    .boundingBox())!;
  await page.touchscreen.tap(heading.x + 20, heading.y + 10);
  await page.touchscreen.tap(heading.x + 20, heading.y + 10);
  expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
  expect(await page.locator('meta[name="viewport"]').getAttribute('content')).not.toMatch(
    /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/,
  );
  await context.close();
});
