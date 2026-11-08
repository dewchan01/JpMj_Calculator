import { test, expect } from '@playwright/test';
import { gameMenu, prompt } from './helpers/game';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
test('only an active visible table keeps the screen awake', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('riichi-advanced-scoring', 'true');
    const state = { active: 0, requests: 0 };
    Object.defineProperty(window, 'screenAwakeState', { value: state });
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        async request() {
          state.requests++;
          state.active++;
          return new (class extends EventTarget {
            released = false;
            async release() {
              if (!this.released) {
                this.released = true;
                state.active--;
                this.dispatchEvent(new Event('release'));
              }
            }
          })();
        },
      },
    });
  });
  await page.goto('/');
  expect(await page.evaluate(() => Reflect.get(window, 'screenAwakeState').requests)).toBe(0);
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const active = () => page.evaluate(() => Reflect.get(window, 'screenAwakeState').active);
  await expect.poll(active).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect.poll(active).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')));
  await expect.poll(active).toBe(1);
  await gameMenu(page, 'End entire match');
  await prompt(page).getByRole('button', { name: 'End entire match', exact: true }).click();
  await expect(page.locator('app-final-results')).toBeVisible();
  await expect.poll(active).toBe(0);
});
