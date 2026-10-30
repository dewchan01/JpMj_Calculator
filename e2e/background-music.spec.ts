import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { enterLiveTiles, prompt, recordDraw } from './helpers/game';
import {
  gameTracks,
  lobbyTracks,
  musicFile,
  riichiTracks,
} from '../apps/web/src/app/core/sound/music-catalog';

test('all selected music recordings load as playable audio', async ({ page }) => {
  await page.goto('/');
  const files = [...lobbyTracks, ...gameTracks, ...riichiTracks].map(musicFile);
  for (const file of files) {
    const duration = await page.evaluate(
      (file) =>
        new Promise<number>((resolve, reject) => {
          const audio = document.createElement('audio');
          const timer = setTimeout(() => reject(new Error(file + ' timed out')), 10000);
          audio.preload = 'metadata';
          audio.onloadedmetadata = () => {
            clearTimeout(timer);
            resolve(audio.duration);
            audio.removeAttribute('src');
            audio.load();
          };
          audio.onerror = () => {
            clearTimeout(timer);
            reject(new Error(file + ' failed'));
          };
          audio.src = '/sounds/music/' + file;
        }),
      file,
    );
    expect(duration, file).toBeGreaterThan(30);
  }
});

test('lobby selection persists, gameplay switches after riichi and mute stops music', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const log: string[] = [];
    Object.defineProperty(window, 'musicLog', { value: log });
    Object.defineProperty(window, 'Audio', {
      value: class {
        paused = true;
        loop = false;
        volume = 1;
        constructor(private src: string) {}
        play() {
          this.paused = false;
          log.push('play:' + new URL(this.src).pathname);
          return Promise.resolve();
        }
        pause() {
          this.paused = true;
          log.push('pause:' + new URL(this.src).pathname);
        }
      },
    });
  });
  const played = () =>
    page.evaluate(() =>
      (window as unknown as { musicLog: string[] }).musicLog.filter((entry) =>
        entry.startsWith('play:/sounds/music/'),
      ),
    );
  await page.goto('/others/sound');
  expect(await played()).toEqual([]);
  await page
    .getByRole('combobox', { name: 'Lobby music', exact: true })
    .selectOption('Lobby Autumn');
  await page
    .getByRole('combobox', { name: 'Lobby music', exact: true })
    .selectOption('Zhongxialvdong');
  await expect
    .poll(async () => (await played()).at(-1))
    .toBe('play:/sounds/music/zhongxialvdong.mp3');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Lobby music', exact: true })).toHaveValue(
    'Zhongxialvdong',
  );
  await page.locator('.audio-mute:not(.audio-effects-mute)').click();
  const muted = (await played()).length;
  await page
    .getByRole('combobox', { name: 'Lobby music', exact: true })
    .selectOption('Lobby Winter');
  expect((await played()).length).toBe(muted);
  await page.locator('.audio-mute:not(.audio-effects-mute)').click();
  await expect
    .poll(async () => (await played()).at(-1))
    .toBe('play:/sounds/music/lobby-winter.mp3');
  await page.getByRole('navigation').getByRole('link', { name: 'My table', exact: true }).click();
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await enterLiveTiles(page, 'Dora indicators', '1m');
  await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
  await expect
    .poll(async () => (await played()).at(-1))
    .toMatch(new RegExp('/(' + gameTracks.map(musicFile).join('|') + ')$'));
  const riichi = page
    .locator('.player-seat')
    .filter({ hasText: 'Player 2' })
    .getByRole('button', { name: 'Riichi', exact: true });
  await riichi.click();
  await expect
    .poll(async () => (await played()).at(-1))
    .toMatch(new RegExp('/(' + riichiTracks.map(musicFile).join('|') + ')$'));
  await recordDraw(page, ['Player 2']);
  await expect
    .poll(async () => (await played()).at(-1))
    .toMatch(new RegExp('/(' + gameTracks.map(musicFile).join('|') + ')$'));
  if (await prompt(page).isVisible())
    await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('link', { name: 'Riichi / table', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Others', exact: true }).click();
  await expect
    .poll(async () => (await played()).at(-1))
    .toBe('play:/sounds/music/lobby-winter.mp3');
});
