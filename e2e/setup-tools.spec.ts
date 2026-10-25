import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1280]) {
  test(`setup tools at ${width}px swap and randomize active players and open animated dice`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const tools = page.getByRole('group', { name: 'Table tools', exact: true });
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
      await page
        .getByRole('textbox', { name: seats[index] + ' player name', exact: true })
        .fill(name);
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
    await expect(page.getByRole('textbox', { name: 'South player name', exact: true })).toHaveValue(
      'Cara',
    );
    await expect(page.getByRole('textbox', { name: 'West player name', exact: true })).toHaveValue(
      'Bob',
    );
    await tools.getByRole('button', { name: 'Random positions', exact: true }).click();
    await expect
      .poll(() =>
        page
          .locator('.players-grid input')
          .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value).sort()),
      )
      .toEqual(['Alice', 'Bob', 'Cara']);
    await page.getByRole('button', { name: /4 players/ }).click();
    await expect(page.getByRole('textbox', { name: 'North player name', exact: true })).toHaveValue(
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
    await dice.getByRole('button', { name: 'Return', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
