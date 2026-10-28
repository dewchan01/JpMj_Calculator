import { openQuickScore } from './helpers/navigation';
import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setSavedRound } from './helpers/match-state';

async function enter(page: Page, notation: string) {
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.getByText('Type compact tile notation', { exact: true }).click();
  await page
    .getByRole('textbox', { name: 'All tiles, including melds and North', exact: true })
    .fill(notation);
  await page.getByRole('button', { name: 'Replace tile collection', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function drag(page: Page, source: Locator, target: Locator, touch: boolean) {
  await source.evaluate((element) =>
    element.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  const start = (await source.boundingBox())!;
  expect(await source.evaluate((element) => getComputedStyle(element).touchAction)).toBe('none');
  expect(
    await source.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
      );
    }),
  ).toBe(true);
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;
  const session = touch ? await page.context().newCDPSession(page) : undefined;
  let position = { x, y };
  const move = async (nextX: number, nextY: number) => {
    if (session) {
      for (let step = 1; step <= 6; step++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {
              x: position.x + ((nextX - position.x) * step) / 6,
              y: position.y + ((nextY - position.y) * step) / 6,
            },
          ],
        });
        await page.evaluate(() => new Promise(requestAnimationFrame));
      }
    } else await page.mouse.move(nextX, nextY, { steps: 5 });
    position = { x: nextX, y: nextY };
    await page.evaluate(() => new Promise(requestAnimationFrame));
  };
  if (session)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  else {
    await page.mouse.move(x, y);
    await page.mouse.down();
  }
  const bottomNavigation = page.locator('.app-navigation');
  const height =
    page.viewportSize()!.width <= 700 && (await bottomNavigation.count())
      ? (await bottomNavigation.boundingBox())!.y
      : page.viewportSize()!.height;
  if ((await target.boundingBox())!.y + (await target.boundingBox())!.height / 2 > height - 70) {
    await move(x, height - 10);
    await expect
      .poll(
        async () => {
          const box = (await target.boundingBox())!;
          return box.y + box.height / 2;
        },
        { intervals: [16, 32, 50], timeout: 10000 },
      )
      .toBeLessThan(height - 70);
  }
  const destination = (await target.boundingBox())!;
  await move(destination.x + destination.width / 2, destination.y + destination.height / 2);
  const adjusted = (await target.boundingBox())!;
  await move(adjusted.x + adjusted.width / 2, adjusted.y + adjusted.height / 2);
  await expect(target).toHaveClass(/tile-drop-active/);
  const preview = page.locator('.tile-drag-preview');
  await expect(preview).toBeVisible();
  await expect(preview.locator('img')).toBeVisible();
  await expect(preview).toHaveCSS('opacity', '1');
  const previewBox = (await preview.boundingBox())!;
  expect(Math.abs(previewBox.x + previewBox.width / 2 - position.x)).toBeLessThan(2);
  expect(Math.abs(previewBox.y + previewBox.height / 2 - position.y)).toBeLessThan(2);
  if (session)
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await page.mouse.up();
  await expect(preview).toHaveCount(0);
  if ((await target.getAttribute('data-tile-drop-target')) === 'meld') {
    const prompt = page.getByRole('dialog', { name: 'Assign selected tiles', exact: true });
    await expect(prompt).toBeVisible();
    await prompt.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
    await expect(prompt).not.toBeVisible();
  }
}

for (const width of [390, 1280]) {
  test(`drag tiles directly to melds, concealed Kan and North at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await openQuickScore(page);
    await page
      .getByRole('combobox', { name: 'Rules', exact: true })
      .selectOption({ label: '3P · Sanma' });
    await enter(page, '555z1111p4z');
    const tiles = page.locator('.hand-tiles > button.tile');
    await drag(page, tiles.nth(0), page.locator('[data-tile-drop-target="meld"]'), width === 390);
    await expect(page.locator('.meld-row')).toHaveCount(1);
    await expect(tiles).toHaveCount(5);
    await drag(page, tiles.nth(0), page.locator('[data-tile-drop-target="ankan"]'), width === 390);
    await expect(page.locator('.meld-row')).toHaveCount(2);
    await expect(
      page
        .locator('.meld-section')
        .filter({ has: page.getByRole('heading', { name: 'Open melds', exact: true }) })
        .locator('.meld-row'),
    ).toHaveCount(1);
    await expect(
      page
        .locator('.meld-section')
        .filter({ has: page.getByRole('heading', { name: 'Concealed Kan', exact: true }) })
        .locator('.meld-row'),
    ).toHaveCount(1);
    await expect(tiles).toHaveCount(1);
    await drag(page, tiles.nth(0), page.locator('[data-tile-drop-target="kita"]'), width === 390);
    await expect(tiles).toHaveCount(0);
    await expect(page.locator('.kita-row')).toContainText('Extracted North · 1');
    await expect(page.getByRole('checkbox', { name: /I have checked these tiles/ })).toHaveCount(0);
    await page.mouse.move(0, 0);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page
      .locator('app-tile-drop-zones')
      .screenshot({ path: `artifacts/drop-zones-${width}.png` });
    await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
    await page.getByRole('dialog', { name: 'Enter tiles', exact: true }).press('Control+z');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(tiles).toHaveCount(1);
    await expect(page.locator('.kita-row')).toHaveCount(0);
  });
}

test('drop zones offer keyboard alternatives, nearby validation and no North in 4P', async ({
  page,
}) => {
  await page.goto('/');
  await openQuickScore(page);
  await enter(page, '555z');
  await expect(page.locator('[data-tile-drop-target="kita"]')).toHaveCount(0);
  const tiles = page.locator('.hand-tiles > button.tile');
  await tiles.nth(0).click();
  await tiles.nth(1).click();
  await page.getByRole('button', { name: 'Move selected tiles to melds', exact: true }).click();
  const prompt = page.getByRole('dialog', { name: 'Assign selected tiles', exact: true });
  await prompt.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await expect(prompt.getByRole('alert')).toContainText('Enter three tiles');
  await prompt.getByRole('button', { name: 'Cancel', exact: true }).click();
  await tiles.nth(2).click();
  await page.getByRole('button', { name: 'Move selected tiles to melds', exact: true }).click();
  await prompt.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await expect(page.locator('.meld-row')).toHaveCount(1);
  await expect(tiles).toHaveCount(0);
});

test('ongoing matches use saved round context while Quick score retains manual fields', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  // The live table reads the current match context on reload.
  await setSavedRound(page, { dealerId: 'p2', roundWind: 'south', handNumber: 3, honba: 2 });
  await page.reload();
  await expect(page.locator('.round-status .table-round')).toHaveText('south 3');
  await expect(page.locator('.round-status .table-honba')).toHaveText('Honba 2');
  await expect(page.getByRole('combobox', { name: 'Dealer', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Round wind', exact: true })).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: 'Honba', exact: true })).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: 'Hand number', exact: true })).toHaveCount(0);
  await openQuickScore(page);
  await expect(page.getByRole('combobox', { name: 'Dealer', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Round wind', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Honba', exact: true })).toBeVisible();
});
