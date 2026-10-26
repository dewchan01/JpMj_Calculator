import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`home prompts animate only as mobile sheets at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    const opening = await page
      .getByRole('button', { name: 'Saved players', exact: true })
      .evaluate((button) => {
        button.click();
        const dialog = document.querySelector<HTMLDialogElement>(
          '#main dialog[aria-labelledby="players-title"]',
        )!;
        return dialog
          .getAnimations()
          .map((animation) => (animation.effect as KeyframeEffect).getKeyframes());
      });
    if (width <= 700) expect(opening[0][0].transform).toBe('translateY(100%)');
    else expect(opening).toEqual([]);
    const dialog = page.getByRole('dialog', { name: 'Saved players', exact: true });
    await expect.poll(() => dialog.evaluate((element) => element.getAnimations().length)).toBe(0);
    const closing = await dialog.evaluate((element) => {
      (element.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click();
      return {
        open: (element as HTMLDialogElement).open,
        animations: element
          .getAnimations()
          .map((animation) => (animation.effect as KeyframeEffect).getKeyframes()),
      };
    });
    if (width <= 700) {
      expect(closing.open).toBe(true);
      expect(closing.animations[0].at(-1)!.transform).toBe('translateY(100%)');
    } else expect(closing.open).toBe(false);
    await expect(dialog).not.toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Saved players', exact: true }).click();
    expect(await dialog.evaluate((element) => element.getAnimations().length)).toBe(0);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).not.toBeVisible();
  });
}
