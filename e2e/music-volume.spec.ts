import { test, expect } from '@playwright/test';

test('volume slider uses gain when native media volume ignores changes', async ({ page }) => {
  await page.addInitScript(() => {
    const gains: { gain: { value: number } }[] = [];
    Object.defineProperty(window, 'volumeGains', { value: gains });
    Object.defineProperty(window, 'Audio', {
      value: class {
        paused = true;
        get volume() {
          return 1;
        }
        set volume(_value: number) {}
        play() {
          this.paused = false;
          return Promise.resolve();
        }
        pause() {
          this.paused = true;
        }
      },
    });
    Object.defineProperty(window, 'AudioContext', {
      value: class {
        state = 'running';
        destination = {};
        createGain() {
          const node = { gain: { value: 1 }, connect() {}, disconnect() {} };
          gains.push(node);
          return node;
        }
        createMediaElementSource() {
          return { connect() {}, disconnect() {} };
        }
        resume() {
          return Promise.resolve();
        }
        close() {
          return Promise.resolve();
        }
      },
    });
  });
  await page.goto('/others/sound');
  const slider = page.getByRole('slider', { name: 'Music volume' });
  await slider.fill('0.6');
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'volumeGains')[0]?.gain.value))
    .toBe(0.6);
  await slider.fill('0.1');
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'volumeGains')[0]?.gain.value))
    .toBe(0.1);
  await slider.fill('0');
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'volumeGains')[0]?.gain.value))
    .toBe(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('riichi-music-volume')))
    .toBe('0');
  await slider.fill('0.45');
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'volumeGains')[0]?.gain.value))
    .toBe(0.45);
  await page.reload();
  await expect(slider).toHaveValue('0.45');
});
