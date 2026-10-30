import { test, expect } from '@playwright/test';
import { enterLiveTiles, playerAction, prompt, recordDraw } from './helpers/game';

test('all six downloaded MP3 files load and decode locally', async ({ page }) => {
  await page.goto('/');
  const durations = await page.evaluate(async () => {
    return Promise.all(
      ['pon', 'chi', 'kan', 'riichi', 'ron', 'tsumo'].map(
        (call) =>
          new Promise<number>((resolve, reject) => {
            const audio = document.createElement('audio');
            const timeout = setTimeout(
              () => reject(new Error('Audio load timed out: ' + call)),
              5000,
            );
            audio.onloadedmetadata = () => {
              clearTimeout(timeout);
              resolve(audio.duration);
              audio.removeAttribute('src');
              audio.load();
            };
            audio.onerror = () => {
              clearTimeout(timeout);
              reject(new Error('Invalid MP3: ' + call));
            };
            audio.src = new URL('sounds/ichihime/' + call + '.mp3', document.baseURI).href;
            audio.load();
          }),
      ),
    );
  });
  expect(durations).toHaveLength(6);
  for (const duration of durations) expect(duration).toBeGreaterThan(0);
});

test('sound previews, persistent mute and successful live declarations', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    Object.defineProperty(window, 'playedCalls', { value: calls });
    Object.defineProperty(window, 'Audio', {
      value: class {
        constructor(private src: string) {}
        pause() {}
        play() {
          if (!this.src.includes('/sounds/music/')) calls.push(new URL(this.src).pathname);
          return Promise.resolve();
        }
      },
    });
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class {
        constructor(public text: string) {}
      },
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [{ lang: 'ja-JP', localService: true }],
        cancel: () => undefined,
        speak: (utterance: { text: string }) => calls.push(utterance.text),
      },
    });
  });
  const played = () =>
    page.evaluate(() => (window as unknown as { playedCalls: string[] }).playedCalls);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Others', exact: true }).click();
  await page.getByRole('link', { name: 'Sound effects', exact: true }).click();
  const previews = page.locator('.sound-previews button');
  await expect(previews).toHaveCount(10);
  for (const button of await previews.all()) await button.click();
  expect(await played()).toHaveLength(10);
  await page.locator('.audio-mute').click();
  await page.reload();
  await expect(page.locator('.audio-mute')).toHaveText('Unmute audio');
  await expect(previews.first()).toBeDisabled();
  await page.locator('.audio-mute').click();
  await page.getByRole('navigation').getByRole('link', { name: 'My table', exact: true }).click();
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await enterLiveTiles(page, 'Dora indicators', '1m');
  await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
  const riichi = page
    .locator('.player-seat')
    .filter({ hasText: 'Player 2' })
    .getByRole('button', { name: 'Riichi', exact: true });
  await riichi.click();
  await expect.poll(played).toEqual(['/sounds/ichihime/riichi.mp3']);
  await riichi.click();
  expect(await played()).toEqual(['/sounds/ichihime/riichi.mp3']);
  const expected = ['/sounds/ichihime/riichi.mp3'];
  for (const [label, recording] of [
    ['Chi', 'chi'],
    ['Pon', 'pon'],
    ['Open Kan', 'kan'],
    ['Concealed Kan', 'kan'],
  ]) {
    if (label === 'Concealed Kan') {
      await playerAction(page, 'Player 1');
    } else {
      if (await prompt(page).isVisible())
        await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
      await page
        .locator('.player-seat')
        .filter({ hasText: 'Player 1' })
        .getByRole('button', { name: 'Call', exact: true })
        .click();
    }
    await prompt(page).getByRole('button', { name: label, exact: true }).click();
    expected.push('/sounds/ichihime/' + recording + '.mp3');
    await expect.poll(played).toEqual(expected);
    await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  }
  await playerAction(page, 'Player 2');
  await prompt(page).getByRole('button', { name: 'Tsumo · self draw', exact: true }).click();
  expected.push('/sounds/ichihime/tsumo.mp3');
  await expect.poll(played).toEqual(expected);
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await playerAction(page, 'Player 1');
  await prompt(page).getByRole('button', { name: 'Ron · discard', exact: true }).click();
  expected.push('/sounds/ichihime/ron.mp3');
  await expect.poll(played).toEqual(expected);
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await recordDraw(page, ['Player 2']);
  await expect.poll(played).toEqual(expected);
  await page.reload();
  expect(await played()).toEqual([]);
});
