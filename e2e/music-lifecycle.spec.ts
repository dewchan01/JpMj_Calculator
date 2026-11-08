import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
test('music starts without a tap and stops synchronously when the app leaves', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('riichi-music', 'on');
    localStorage.setItem('riichi-music-volume', '0.25');
    const state = { playing: false, starts: 0 };
    Object.defineProperty(window, 'musicLifecycle', { value: state });
    Object.defineProperty(window, 'Audio', {
      value: class {
        paused = true;
        play() {
          this.paused = false;
          state.playing = true;
          state.starts++;
          return Promise.resolve();
        }
        pause() {
          this.paused = true;
          state.playing = false;
        }
      },
    });
  });
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'musicLifecycle').playing))
    .toBe(true);
  const stopped = await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    return !Reflect.get(window, 'musicLifecycle').playing;
  });
  expect(stopped).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')));
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'musicLifecycle').playing))
    .toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'musicLifecycle').playing))
    .toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'musicLifecycle').playing))
    .toBe(true);
});
