import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { choosePlayer } from './helpers/players';
import {
  beginWin,
  finishWin,
  gameMenu,
  playerAction,
  prompt,
  enterLiveTiles,
} from './helpers/game';

for (const width of [390, 1280])
  for (const count of [3, 4]) {
    test(`${count}P live table at ${width}px records actions, pauses, settles and swaps display seats`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/');
      await page.getByRole('button', { name: new RegExp(count + ' players') }).click();
      await page.getByRole('button', { name: /Start match/ }).click();
      await expect(page.locator('.game-shell')).toBeVisible();
      await expect(
        page.locator('.table-center').getByRole('button', { name: 'End this hand', exact: true }),
      ).toBeVisible();
      await expect(page.locator('.table-center .table-round')).toHaveCount(0);
      await expect(page.locator('.round-status')).toBeVisible();
      const layout = (await page.locator('.table-layout').boundingBox())!;
      for (const seat of await page
        .locator('.player-seat, .seat-actions button, .difference-button')
        .all()) {
        const box = (await seat.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(layout.x);
        expect(box.x + box.width).toBeLessThanOrEqual(layout.x + layout.width);
        expect(box.y).toBeGreaterThanOrEqual(layout.y);
        expect(box.y + box.height).toBeLessThanOrEqual(layout.y + layout.height);
      }
      await expect(page.locator('.app-navigation')).toBeHidden();
      await expect(page.locator('.workspace')).toHaveCSS('margin-left', '0px');
      await expect(page.locator('.workspace')).toHaveCSS('padding-bottom', '0px');
      await expect(page.getByRole('button', { name: /Calculate score/ })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
        true,
      );
      await page
        .locator('.player-seat')
        .filter({ hasText: 'Player 2' })
        .getByRole('button', { name: 'Riichi', exact: true })
        .click();
      await expect(page.locator('.table-pot strong')).toHaveText('1,000');
      await expect(page.locator('.riichi-stick')).toHaveCount(1);
      const lane = (await page.locator('.slot-right .riichi-lane').boundingBox())!;
      const stick = (await page.locator('.riichi-stick').boundingBox())!;
      expect(Math.abs(stick.x + stick.width / 2 - (lane.x + lane.width / 2))).toBeLessThanOrEqual(
        1.1,
      );
      expect(
        await page.locator('.slot-right').evaluate((e) => {
          const m = new DOMMatrix(getComputedStyle(e).transform);
          return [m.a, m.b, m.c, m.d];
        }),
      ).toEqual([0, -1, 1, 0]);
      await playerAction(page, 'Player 3');
      if (count === 3) {
        await prompt(page).getByRole('button', { name: 'North extraction', exact: true }).click();
        await expect(
          prompt(page).getByRole('button', { name: 'Record action', exact: true }),
        ).toHaveCount(0);
        await expect(prompt(page).locator('.mini-tiles app-tile-art')).toHaveCount(1);
        await expect(prompt(page).locator('.north-count')).toHaveText('1');
        const northControls = await prompt(page).locator('.north-controls').boundingBox();
        await expect(prompt(page).locator('.north-controls button').first()).toHaveAttribute(
          'aria-label',
          'Remove one North',
        );
        await prompt(page).getByRole('button', { name: 'Add one North', exact: true }).click();
        await expect(prompt(page).locator('.mini-tiles app-tile-art')).toHaveCount(2);
        await expect(prompt(page).locator('.north-count')).toHaveText('2');
        const addedControls = await prompt(page).locator('.north-controls').boundingBox();
        expect(addedControls!.x).toBe(northControls!.x);
        expect(addedControls!.y).toBe(northControls!.y);
        await prompt(page).getByRole('button', { name: 'Remove one North', exact: true }).click();
        await expect(prompt(page).locator('.mini-tiles app-tile-art')).toHaveCount(1);
        await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
        await expect(
          page.locator('.seat-actions').getByRole('button', { name: /Kita/ }),
        ).toHaveCount(0);
      } else {
        await prompt(page).getByRole('button', { name: 'Pon', exact: true }).click();
        await enterLiveTiles(page, 'Meld tiles', '111z');
        await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
      }
      if (count === 4)
        await expect(
          page
            .locator('.player-seat')
            .filter({ hasText: 'Player 3' })
            .getByRole('button', { name: 'Call 1', exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.call-status')).toHaveCount(0);
      await page.getByRole('button', { name: 'Point differences Player 2', exact: true }).hover();
      await page.mouse.down();
      await expect(prompt(page)).not.toBeVisible();
      await expect(page.locator('.point-difference')).toHaveCount(count - 1);
      await expect(
        page.locator('.player-seat').filter({ hasText: 'Player 1' }).locator('.player-points'),
      ).toHaveText('+1,000');
      await page.mouse.move(1, 1);
      await page.mouse.up();
      await expect(page.locator('.point-difference')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Point differences', exact: true }),
      ).toHaveCount(0);
      await expect(
        page.locator('.slot-right').getByRole('button', { name: 'Riichi', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.riichi-lane')).toHaveCount(count);
      await gameMenu(page, 'Pause game');
      await expect(page.getByRole('button', { name: 'Game timer', exact: true })).toContainText(
        'Paused',
      );
      await page.reload();
      await expect(page.getByRole('button', { name: 'Game timer', exact: true })).not.toContainText(
        'Paused',
      );

      await gameMenu(page, 'Change seats');
      await prompt(page).getByRole('button', { name: 'Swap positions', exact: true }).click();
      await expect(page.locator('.player-seat').filter({ hasText: 'Player 1' })).toHaveClass(
        /seat-right/,
      );
      await expect(page.locator('.player-seat.dealer')).toContainText('Player 1');
      await beginWin(page);
      await finishWin(page, count === 3 ? '123p456p789s234s55p' : undefined);
      await expect(prompt(page)).not.toBeVisible();
      const points = await page.locator('.player-points').allTextContents();
      expect(points).not.toContain(count === 3 ? '34,000' : '24,000');
      await gameMenu(page, 'History');
      await expect(page.locator('.history-event')).toHaveCount(2);
      await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Dice', exact: true }).click();
      await expect(prompt(page).locator('.dice')).toHaveClass(/rolling/);
      await expect(
        prompt(page).getByRole('button', { name: 'Roll two dice', exact: true }),
      ).toBeDisabled();
      await expect(prompt(page).getByRole('status')).toHaveText(
        /[1-6] \+ [1-6] = (?:[2-9]|1[0-2])/,
      );
      await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      await page.screenshot({ path: `artifacts/live-table-${count}p-${width}.png` });
      await gameMenu(page, 'End entire match');
      await prompt(page).getByRole('button', { name: 'End entire match', exact: true }).click();
      await expect(page.locator('app-final-results')).toBeVisible();
      await gameMenu(page, 'History');
      await prompt(page)
        .getByRole('button', { name: 'Undo last ledger event', exact: true })
        .click();
      await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByRole('button', { name: 'End this hand', exact: true })).toBeVisible();
      expect(errors).toEqual([]);
      await page.locator('.floating-menu').click();
      await prompt(page).getByRole('button', { name: 'My table', exact: true }).click();
      await expect(page.locator('.app-navigation')).toBeVisible();
    });
  }

test('saved player library survives reload and fills a chosen seat', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saved players', exact: true }).click();
  await page.getByRole('button', { name: 'New player', exact: true }).click();
  await page.getByRole('textbox', { name: 'Player name', exact: true }).fill('Alice');
  await page.getByRole('button', { name: 'Add player', exact: true }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('dialog[aria-labelledby="players-title"]')).not.toBeVisible();
  await page.reload();
  await choosePlayer(page, 'East', 'Alice');
  await expect(page.getByRole('button', { name: 'Choose player East', exact: true })).toHaveText(
    'Alice',
  );
  await page.getByRole('button', { name: /Start match/ }).click();
  await expect(page.locator('.player-seat.dealer')).toContainText('Alice');
});

test('Chi infers the previous seat and a selected Riichi can be cancelled after other declarations', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  for (const name of ['Player 2', 'Player 3']) {
    await page
      .locator('.player-seat')
      .filter({ hasText: name })
      .getByRole('button', { name: 'Riichi', exact: true })
      .click();
  }
  await playerAction(page, 'Player 1');
  await prompt(page).getByRole('button', { name: 'Chi', exact: true }).click();
  await expect(
    prompt(page).getByRole('combobox', { name: 'Call source', exact: true }),
  ).toHaveCount(0);
  await enterLiveTiles(page, 'Meld tiles', '123m');
  await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
  await expect(prompt(page)).not.toBeVisible();
  await page
    .locator('.player-seat')
    .filter({ hasText: 'Player 2' })
    .getByRole('button', { name: 'Riichi', exact: true })
    .click();
  await expect(page.locator('.table-pot strong')).toHaveText('1,000');
  await expect(
    page.locator('.player-seat').filter({ hasText: 'Player 2' }).locator('.player-points'),
  ).toHaveText('25,000');
  await expect(
    page.locator('.player-seat').filter({ hasText: 'Player 3' }).locator('.player-points'),
  ).toHaveText('24,000');
  await page.reload();
  await playerAction(page, 'Player 1');
  await expect(prompt(page).locator('.recorded-call app-tile-art')).toHaveCount(3);
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await playerAction(page, 'Player 2');
  await expect(
    prompt(page).getByRole('button', { name: 'Double Riichi', exact: true }),
  ).toBeEnabled();
});

test('table buttons offer visible actions and undo restores declarations and one-tile calls after reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  const seat = page.locator('.player-seat').filter({ hasText: 'Player 2' });
  await seat.getByRole('button', { name: 'Riichi', exact: true }).click();
  await expect(prompt(page)).not.toBeVisible();
  await expect(page.locator('.table-pot strong')).toHaveText('1,000');
  await page.reload();
  await gameMenu(page, 'Undo previous action');
  await expect(page.locator('.table-pot strong')).toHaveText('0');
  await expect(seat.locator('.player-points')).toHaveText('25,000');
  await seat.getByRole('button', { name: 'Call', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Pon', exact: true }).click();
  await enterLiveTiles(page, 'Meld tiles', '0p');
  await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
  await playerAction(page, 'Player 2');
  await expect(prompt(page).locator('.recorded-call app-tile-art')).toHaveCount(3);
  await page.reload();
  await gameMenu(page, 'Undo previous action');
  await playerAction(page, 'Player 2');
  await expect(prompt(page).locator('.recorded-call')).toHaveCount(0);
});

for (const width of [360, 390]) {
  test(`short phone tables at ${width}px keep player actions inside their cards without overlapping the centre`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 667 });
    for (const count of [3, 4]) {
      await page.goto('/');
      await page.getByRole('button', { name: new RegExp(count + ' players') }).click();
      await page.getByRole('button', { name: /Start match/ }).click();
      await expect(page.locator('.game-shell')).toBeVisible();
      const boxes = await page.locator('.player-seat, .table-center').evaluateAll((elements) =>
        elements.map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        }),
      );
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i],
            b = boxes[j];
          expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y).toBe(true);
        }
      const centre = boxes[0];
      const gaps = [
        boxes[1].y - centre.bottom,
        boxes[2].x - centre.right,
        count === 3 ? centre.x - boxes[3].right : centre.y - boxes[3].bottom,
      ];
      if (count === 4) gaps.push(centre.x - boxes[4].right);
      expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1);
      expect(Math.min(...gaps)).toBeGreaterThan(0);
      const iconsClear = await page.locator('app-table-summary').evaluate((table) => {
        const obstacles = Array.from(
          table.querySelectorAll('.riichi-lane, .player-seat, .table-center'),
        ).map((element) => element.getBoundingClientRect());
        return Array.from(table.querySelectorAll('.yakitori-label img')).every((image) => {
          const icon = image.getBoundingClientRect();
          return (
            icon.width <= 18.1 &&
            icon.height <= 18.1 &&
            Math.min(icon.width, icon.height) <= 10.1 &&
            obstacles.every(
              (box) =>
                icon.right <= box.left ||
                box.right <= icon.left ||
                icon.bottom <= box.top ||
                box.bottom <= icon.top,
            )
          );
        });
      });
      expect(iconsClear).toBe(true);
      const seatGaps = await page.locator('.player-seat').evaluateAll((seats) =>
        seats.map((seat) => {
          const marker = seat.querySelector('.seat-label > abbr')!.getBoundingClientRect();
          const stick = seat.querySelector('.riichi-lane')!.getBoundingClientRect();
          return Math.max(
            marker.left - stick.right,
            stick.left - marker.right,
            marker.top - stick.bottom,
            stick.top - marker.bottom,
          );
        }),
      );
      expect(Math.min(...seatGaps)).toBeGreaterThanOrEqual(1.9);
      expect(
        await page
          .locator('.seat-actions button')
          .evaluateAll((buttons) => buttons.every((b) => b.scrollWidth <= b.clientWidth)),
      ).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
        true,
      );
      await page.screenshot({ path: `artifacts/live-table-short-${count}p-${width}.png` });
    }
  });
}

test('Pon upgrades retain the called tile and Kan actions reveal additional indicator controls', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await playerAction(page, 'Player 3');
  await prompt(page).getByRole('button', { name: 'Pon', exact: true }).click();
  await enterLiveTiles(page, 'Meld tiles', '1z');
  await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
  await expect(prompt(page)).not.toBeVisible();
  await playerAction(page, 'Player 3');
  await prompt(page).getByRole('button', { name: 'Added Kan', exact: true }).click();
  await enterLiveTiles(page, 'Fourth tile', '1z');
  await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
  await expect(
    prompt(page).getByRole('heading', { name: 'Dora indicators', level: 2, exact: true }),
  ).toBeVisible();
  await enterLiveTiles(page, 'Dora indicators', '2z3z');
  await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
  await expect(page.locator('.indicator-preview app-tile-art')).toHaveCount(2);
  await page.reload();
  await playerAction(page, 'Player 3');
  await expect(prompt(page).locator('.recorded-call app-tile-art')).toHaveCount(4);
  await prompt(page).getByRole('button', { name: 'Concealed Kan', exact: true }).click();
  await enterLiveTiles(page, 'Meld tiles', '1s');
  await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
  await expect(
    prompt(page).getByRole('heading', { name: 'Dora indicators', level: 2, exact: true }),
  ).toBeVisible();
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await beginWin(page);
  await finishWin(page);
  await gameMenu(page, 'History');
  await page.locator('.history-event > summary').click();
  await expect(prompt(page)).toContainText('Actions during this hand');
});
