import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const catalog = (locale: string): Record<string, string> => {
  const file = ({ 'zh-TW': 'zh-tw', 'zh-CN': 'zh-cn', ja: 'ja' } as Record<string, string>)[locale];
  return file
    ? JSON.parse(
        readFileSync(
          new URL('../../apps/web/src/app/core/i18n/' + file + '.json', import.meta.url),
          'utf8',
        ),
      )
    : {};
};

export const prompt = (page: Page) => page.locator('dialog.game-prompt');
export async function gameMenu(page: Page, action: string): Promise<void> {
  const locale = (await page.locator('html').getAttribute('lang')) ?? 'en';
  const title = catalog(locale)[action] ?? action;
  if (await prompt(page).isVisible()) await prompt(page).locator('.close-prompt').click();
  await page.locator('.floating-menu').click();
  await prompt(page)
    .getByRole('button', {
      name: action === 'History' ? new RegExp('^' + title) : title,
      exact: true,
    })
    .click();
  if (action === 'Pause game' || action === 'Resume game')
    await expect(prompt(page)).not.toBeVisible();
}
export async function playerAction(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Player actions ' + name, exact: true }).click();
}
export async function enterLiveTiles(page: Page, label: string, notation: string): Promise<void> {
  const input = page.locator(`app-tile-input[data-label="${label}"]`);
  const editor = page.getByRole('dialog', { name: 'Enter ' + label, exact: true });
  if (
    !(await editor.isVisible()) &&
    (await input.getByRole('button', { name: 'Enter ' + label, exact: true }).count())
  )
    await input.getByRole('button', { name: 'Enter ' + label, exact: true }).click();
  await editor.getByText('Type tile notation instead', { exact: true }).click();
  await editor.getByRole('textbox', { name: label, exact: true }).fill(notation);
  await editor.getByRole('button', { name: 'Apply notation', exact: true }).click();
  await editor.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(editor).not.toBeVisible();
}
export async function beginWin(
  page: Page,
  winner = 'Player 2',
  method: 'ron' | 'tsumo' = 'ron',
  discarder = 'p0',
): Promise<void> {
  await page.getByRole('button', { name: 'End this hand', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Win', exact: true }).click();
  await prompt(page)
    .getByRole('combobox', { name: 'Win method', exact: true })
    .selectOption(method);
  await prompt(page).getByRole('checkbox', { name: winner, exact: true }).check();
  if (method === 'ron')
    await prompt(page)
      .getByRole('combobox', { name: 'Discarder', exact: true })
      .selectOption(discarder);
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
}
export async function finishWin(
  page: Page,
  notation = '123m456m789p234s55p',
  index = 11,
  save = true,
): Promise<void> {
  await enterLiveTiles(page, 'The winning hand', notation);
  await prompt(page)
    .getByRole('combobox', { name: 'Winning tile', exact: true })
    .selectOption({ index: index + 1 });
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await expect(
    prompt(page).getByRole('button', { name: 'Confirm & save settlement', exact: true }),
  ).toBeVisible();
  if (save)
    await prompt(page)
      .getByRole('button', { name: 'Confirm & save settlement', exact: true })
      .click();
}

export async function recordDraw(page: Page, tenpai: string[] = []): Promise<void> {
  await page.getByRole('button', { name: 'End this hand', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Record draw', exact: true }).click();
  for (const player of tenpai)
    await prompt(page).getByRole('checkbox', { name: player, exact: true }).check();
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await prompt(page)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  await expect(prompt(page)).not.toBeVisible();
}
