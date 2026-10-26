import { test, expect } from '@playwright/test';
import { beginWin, finishWin } from './helpers/game';

test('sound previews, persistent mute and successful live declarations', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    Object.defineProperty(window, 'playedCalls', { value: calls });
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
  await page.getByRole('checkbox', { name: 'Sound effects', exact: true }).uncheck();
  await page.reload();
  await expect(
    page.getByRole('checkbox', { name: 'Sound effects', exact: true }),
  ).not.toBeChecked();
  await expect(previews.first()).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Sound effects', exact: true }).check();
  await page.getByRole('navigation').getByRole('link', { name: 'My table', exact: true }).click();
  await page.getByRole('button', { name: /Start match/ }).click();
  const riichi = page
    .locator('.player-seat')
    .filter({ hasText: 'Player 2' })
    .getByRole('button', { name: 'Riichi', exact: true });
  await riichi.click();
  await expect.poll(played).toEqual(['リーチ']);
  await riichi.click();
  expect(await played()).toEqual(['リーチ']);
  await beginWin(page);
  await finishWin(page);
  await expect.poll(played).toEqual(['リーチ', 'ロン']);
  await page.reload();
  expect(await played()).toEqual([]);
});
