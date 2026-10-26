import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1280]) {
  test(`player picker at ${width}px searches, sorts, scrolls, creates and prevents duplicate seats`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.addInitScript(() =>
      localStorage.setItem(
        'riichi-players-v1',
        JSON.stringify(
          [
            'Zephyr',
            'Alice',
            'Cara',
            'Dana',
            'Bob',
            'Hana',
            'Ian',
            'Faye',
            'Gus',
            'Jin',
            'Kai',
            'Lyn',
            ...Array.from({ length: 60 }, (_, i) => 'Saved ' + String(i).padStart(2, '0')),
          ].map((name, i) => ({ id: 'saved-' + i, name })),
        ),
      ),
    );
    await page.goto('/');
    await expect(page.locator('.players-grid input, .players-grid select')).toHaveCount(0);
    const tools = (await page.locator('.setup-tools').boundingBox())!;
    const card = (await page.locator('.setup-card').boundingBox())!;
    expect(card.y - tools.y - tools.height).toBeGreaterThanOrEqual(4);
    expect(card.y - tools.y - tools.height).toBeLessThanOrEqual(16);
    await page.getByRole('button', { name: 'Choose player East', exact: true }).click();
    const picker = page.locator('dialog[aria-labelledby="players-title"]');
    await expect(picker.locator('.player-select')).toHaveCount(24);
    await expect(picker.locator('.player-select').first()).toHaveText('Alice');
    await picker.getByRole('combobox', { name: 'Sort players', exact: true }).selectOption('desc');
    await expect(picker.locator('.player-select').first()).toHaveText('Zephyr');
    await expect(picker.locator('.player-pagination')).toHaveCount(0);
    await picker
      .locator('.player-results')
      .evaluate((panel) => (panel.scrollTop = panel.scrollHeight));
    await expect(picker.locator('.player-select')).toHaveCount(48);
    await picker
      .locator('.player-results')
      .evaluate((panel) => (panel.scrollTop = panel.scrollHeight));
    await expect(picker.locator('.player-select')).toHaveCount(72);
    await picker
      .locator('.player-results')
      .evaluate((panel) => (panel.scrollTop = panel.scrollHeight));
    await expect(picker.getByRole('button', { name: 'Alice', exact: true })).toBeInViewport();
    await expect.poll(() => picker.evaluate((dialog) => dialog.getAnimations().length)).toBe(0);
    const box = (await picker.boundingBox())!;
    if (width <= 700) expect(box.y + box.height).toBeCloseTo(740, 0);
    else expect(box.y + box.height / 2).toBeCloseTo(370, 0);
    await picker.getByRole('searchbox', { name: 'Search players', exact: true }).fill('Bob');
    await expect(picker.locator('.player-select')).toHaveCount(1);
    await picker.getByRole('button', { name: 'Bob', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Choose player East', exact: true })).toHaveText(
      'Bob',
    );
    await page.getByRole('button', { name: 'Choose player South', exact: true }).click();
    await picker.getByRole('searchbox', { name: 'Search players', exact: true }).fill('Bob');
    await expect(picker.locator('.player-select')).toBeDisabled();
    await picker.getByRole('searchbox', { name: 'Search players', exact: true }).fill('');
    expect(await picker.evaluate((dialog) => dialog.scrollHeight <= dialog.clientHeight)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/player-picker-${width}.png` });
    await picker.getByRole('button', { name: 'New player', exact: true }).click();
    const add = page.getByRole('dialog', { name: 'New player', exact: true });
    await expect(add).toBeVisible();
    await expect(page.locator('dialog[open]')).toHaveCount(2);
    await expect(add.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    const cancelBounds = (await add
      .getByRole('button', { name: 'Cancel', exact: true })
      .boundingBox())!;
    const addBounds = (await add
      .getByRole('button', { name: 'Add player', exact: true })
      .boundingBox())!;
    expect(cancelBounds.x + cancelBounds.width + 12).toBeLessThanOrEqual(addBounds.x);
    await expect(add.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
    expect(
      (await add.getByRole('button', { name: 'Cancel', exact: true }).boundingBox())!.y,
    ).toBeGreaterThan(
      (await add.getByRole('textbox', { name: 'Player name', exact: true }).boundingBox())!.y,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/add-player-stacked-${width}.png` });
    await add.getByRole('textbox', { name: 'Player name', exact: true }).fill('Eve');
    await add.getByRole('button', { name: 'Add player', exact: true }).click();
    await expect(add).not.toBeVisible();
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Choose player South', exact: true })).toHaveText(
      'Eve',
    );
    await page.getByRole('button', { name: 'Saved players', exact: true }).click();
    await picker.getByRole('searchbox', { name: 'Search players', exact: true }).fill('Eve');
    await expect(picker.locator('.player-result')).toHaveText('Eve');
    await picker
      .getByRole('combobox', { name: 'Filter players', exact: true })
      .selectOption('available');
    await expect(picker.locator('.player-result')).toHaveCount(0);
    await picker
      .getByRole('combobox', { name: 'Filter players', exact: true })
      .selectOption('seated');
    await expect(picker.locator('.player-result')).toHaveText('Eve');
  });
}
