import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 900 }, hasTouch: true });

test('mobile sheet snaps back, dismisses past threshold, and preserves tile edits', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Quick score', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Enter tiles', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '2p: Add 2 pin', exact: true }).click();
  const drag = async (distance: number, scrolled = false) =>
    dialog.evaluate(
      async (element, options) => {
        element.scrollTop = options.scrolled ? 100 : 0;
        const target = options.scrolled ? element : element.querySelector('.sheet-grip')!;
        const point = (y: number) => new Touch({ identifier: 1, target, clientX: 100, clientY: y });
        target.dispatchEvent(
          new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [point(100)] }),
        );
        target.dispatchEvent(
          new TouchEvent('touchmove', {
            bubbles: true,
            cancelable: true,
            touches: [point(100 + options.distance)],
          }),
        );
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        const offset = (element as HTMLElement).style.transform;
        target.dispatchEvent(
          new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [] }),
        );
        return offset;
      },
      { distance, scrolled },
    );
  expect(await drag(40)).toBe('translateY(40px)');
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveClass(/dragging/);
  await expect
    .poll(() => dialog.evaluate((element) => (element as HTMLElement).style.transform))
    .toBe('');
  await drag(180, true);
  await expect(dialog).toBeVisible();
  await drag(180);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator('.hand-tiles > button.tile')).toHaveCount(1);
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});
