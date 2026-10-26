import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { choosePlayer } from './helpers/players';

for (const width of [390, 1280]) {
  test(`setup tools at ${width}px swap and randomize active players and open animated dice`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript(() =>
      localStorage.setItem(
        'riichi-players-v1',
        JSON.stringify(['Alice', 'Bob', 'Cara', 'Dana'].map((name, i) => ({ id: 'p' + i, name }))),
      ),
    );
    await page.goto('/');
    const tools = page.getByRole('group', { name: 'Table tools', exact: true });
    await expect(tools).toBeVisible();
    await expect(tools.getByRole('button')).toHaveCount(4);
    expect(
      await tools
        .getByRole('button')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label'))),
    ).toEqual(['Saved players', 'Quick swap', 'Random positions', 'Dice']);
    await expect(page.locator('.setup-card .setup-tools')).toHaveCount(0);
    expect(
      await tools
        .getByRole('button')
        .evaluateAll(
          (buttons) =>
            new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().y))).size,
        ),
    ).toBe(1);
    const toolBox = (await tools.boundingBox())!;
    const countBox = (await page.locator('.segmented').boundingBox())!;
    expect(toolBox.y + toolBox.height).toBeLessThanOrEqual(countBox.y);
    const seats = ['East', 'South', 'West', 'North'];
    for (const [index, name] of ['Alice', 'Bob', 'Cara', 'Dana'].entries()) {
      await choosePlayer(page, seats[index], name);
    }
    await page.getByRole('button', { name: /3 players/ }).click();
    await tools.getByRole('button', { name: 'Quick swap', exact: true }).click();
    const swap = page.getByRole('dialog', { name: 'Quick swap', exact: true });
    await swap
      .getByRole('combobox', { name: 'First seat', exact: true })
      .selectOption({ label: 'South · Bob' });
    await expect(swap.getByRole('button', { name: 'Swap positions', exact: true })).toBeDisabled();
    await swap
      .getByRole('combobox', { name: 'Second seat', exact: true })
      .selectOption({ label: 'West · Cara' });
    await swap.getByRole('button', { name: 'Swap positions', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Choose player South', exact: true })).toHaveText(
      'Cara',
    );
    await expect(page.getByRole('button', { name: 'Choose player West', exact: true })).toHaveText(
      'Bob',
    );
    await tools.getByRole('button', { name: 'Random positions', exact: true }).click();
    await expect
      .poll(() =>
        page
          .locator('.seat-choice strong')
          .evaluateAll((names) => names.map((name) => name.textContent!.trim()).sort()),
      )
      .toEqual(['Alice', 'Bob', 'Cara']);
    await page.getByRole('button', { name: /4 players/ }).click();
    await expect(page.getByRole('button', { name: 'Choose player North', exact: true })).toHaveText(
      'Dana',
    );
    await tools.getByRole('button', { name: 'Dice', exact: true }).click();
    const dice = page.getByRole('dialog', { name: 'Dice', exact: true });
    await expect(dice.locator('.dice')).toHaveClass(/rolling/);
    await expect(dice.getByRole('status')).toHaveText(/[1-6] \+ [1-6] = (?:[2-9]|1[0-2])/);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/setup-dice-${width}.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await dice.getByRole('button', { name: 'Roll two dice', exact: true }).click();
    await expect(dice.locator('.dice')).not.toHaveClass(/rolling/);
    await expect(dice.locator('.die').first()).toHaveCSS('animation-name', 'none');
    await dice.getByRole('button', { name: 'Close', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
