import { test, expect } from '@playwright/test';
import { musicFile, riichiTracks } from '../apps/web/src/app/core/sound/music-catalog';

test('additional riichi changes random riichi music without repeating', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('riichi-advanced-scoring', 'true');
    localStorage.setItem('riichi-riichi-music', 'random');
    const log: string[] = [];
    Object.defineProperty(window, 'musicLog', { value: log });
    Object.defineProperty(window, 'Audio', {
      value: class {
        paused = true;
        src: string;
        constructor(src: string) {
          this.src = src;
        }
        play() {
          this.paused = false;
          if (this.src.includes('/sounds/music/')) log.push(this.src);
          return Promise.resolve();
        }
        pause() {
          this.paused = true;
        }
      },
    });
  });
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const last = () => page.evaluate(() => Reflect.get(window, 'musicLog').at(-1));
  await page
    .locator('.player-seat')
    .filter({ hasText: 'Player 1' })
    .getByRole('button', { name: 'Riichi', exact: true })
    .click();
  const riichiFiles = riichiTracks.map(musicFile);
  const isRiichiTrack = async () => {
    const track = await last();
    return riichiFiles.some((file) => track?.endsWith('/' + file));
  };
  await expect.poll(isRiichiTrack).toBe(true);
  const first = await last();
  await page
    .locator('.player-seat')
    .filter({ hasText: 'Player 2' })
    .getByRole('button', { name: 'Riichi', exact: true })
    .click();
  await expect.poll(last).not.toBe(first);
  await expect.poll(isRiichiTrack).toBe(true);
});
