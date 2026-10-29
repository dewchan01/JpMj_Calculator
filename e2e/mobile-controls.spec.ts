import { test, expect, type Locator, type Page } from '@playwright/test';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

async function swipe(
  page: Page,
  control: Locator,
  direction: 'left' | 'right' | 'down',
): Promise<void> {
  const box = (await control.boundingBox())!;
  const x = box.x + box.width * (direction === 'right' ? 0.25 : 0.75);
  const y = box.y + box.height / 2;
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x:
            x + (direction === 'left' ? -box.width / 2 : direction === 'right' ? box.width / 2 : 0),
          y: y + (direction === 'down' ? 100 : 0),
        },
      ],
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
}

test('touch swipes switch adjacent segmented options in both directions', async ({ page }) => {
  await page.goto('/records');
  const records = page.locator('.segmented[aria-label="Record view"]');
  await swipe(page, records, 'left');
  await expect(records.getByRole('button', { name: 'Players', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await records.getByRole('button', { name: 'Games', exact: true }).click();
  await expect(records.getByRole('button', { name: 'Games', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await swipe(page, records, 'left');
  await expect(records.getByRole('button', { name: 'Players', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await swipe(page, records, 'right');
  await expect(records.getByRole('button', { name: 'Games', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await swipe(page, records, 'down');
  await expect(records.getByRole('button', { name: 'Games', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goto('/settings');
  const players = page.locator('.settings-sticky .segmented');
  await swipe(page, players, 'left');
  await expect(players.getByRole('button', { name: '3 players', exact: true })).toHaveClass(
    /selected/,
  );
  await swipe(page, players, 'right');
  await expect(players.getByRole('button', { name: '4 players', exact: true })).toHaveClass(
    /selected/,
  );
});

test('shared startup X and backdrop dismiss the entire flow', async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await page.getByRole('button', { name: 'Host game', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Host game', exact: true })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await page.mouse.click(2, 2);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});
