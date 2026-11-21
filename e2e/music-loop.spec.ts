import { test, expect } from '@playwright/test';

test('music restarts from zero after the recording ends', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src?: string) {
        super(src);
        Reflect.set(window, 'backgroundAudio', this);
      }
    };
  });
  await page.goto('/others/sound');
  const selection = page.getByRole('combobox', { name: 'Lobby music', exact: true });
  for (const track of ['Lobby Autumn', 'Lobby Winter']) {
    await selection.selectOption(track);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const audio = Reflect.get(window, 'backgroundAudio') as HTMLAudioElement;
          return !!audio && !audio.paused && Number.isFinite(audio.duration);
        }),
      )
      .toBe(true);
    await page.evaluate(() => {
      const audio = Reflect.get(window, 'backgroundAudio') as HTMLAudioElement;
      Reflect.set(window, 'musicEndedCount', 0);
      audio.addEventListener('ended', () => Reflect.set(window, 'musicEndedCount', 1), {
        once: true,
      });
      if (audio.loop) throw new Error('Music must explicitly restart from zero');
      audio.currentTime = audio.duration - 0.2;
    });
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'musicEndedCount'))).toBe(1);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const audio = Reflect.get(window, 'backgroundAudio') as HTMLAudioElement;
          return !audio.paused && audio.currentTime < 2;
        }),
      )
      .toBe(true);
  }
});
