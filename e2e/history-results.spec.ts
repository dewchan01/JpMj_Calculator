import { expect, test } from '@playwright/test';
import { fixture } from '../packages/mahjong-fixtures';
import { score } from '../packages/mahjong-scoring';
import type { Match } from '../packages/mahjong-core/ledger';

test('saved history shows a legacy Haneman once when single and multi-result fields coexist', async ({
  page,
}) => {
  const input = fixture();
  input.manualScore = { han: 6, fu: 30 };
  const result = { ...score(input), limitName: undefined };
  const match: Match = {
    id: 'history-regression',
    schemaVersion: 1,
    name: 'History regression',
    createdAt: '2026-10-29T10:00:00Z',
    updatedAt: '2026-10-29T11:00:00Z',
    playerCount: 4,
    players: input.players,
    rules: input.rules,
    initialBalances: { a: 25000, b: 25000, c: 25000, d: 25000 },
    initialDealerId: 'a',
    dealerId: 'a',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    gameLength: 'east',
    ended: true,
    events: [
      {
        id: 'deposit',
        timestamp: '2026-10-29T10:30:00Z',
        type: 'riichiDeposit',
        payments: [{ from: 'b', to: 'table', amount: 1000, reason: 'Riichi deposit' }],
      },
      {
        id: 'win',
        timestamp: '2026-10-29T11:00:00Z',
        type: 'win',
        before: { dealerId: 'a', roundWind: 'east', handNumber: 1, honba: 0 },
        durationMs: 60000,
        payments: result.payments,
        hand: input.hand,
        win: input.win,
        result,
        results: [result],
        scoringInput: input,
        scoringInputs: [input],
        winnerIds: ['b'],
      },
      {
        id: 'draw',
        timestamp: '2026-10-29T11:30:00Z',
        type: 'exhaustiveDraw',
        payments: [],
        before: { dealerId: 'b', roundWind: 'east', handNumber: 2, honba: 0 },
      },
    ],
  };
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Start match/ })).toBeVisible();
  await page.evaluate(async (game) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('riichi-table');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('matches', 'readwrite');
      transaction.objectStore('matches').put(game);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, match);
  await page.goto('/records/history-regression');
  const results = page.locator('app-final-results');
  await results.getByRole('button', { name: 'History', exact: true }).click();
  await expect(results.locator('.history-event')).toHaveCount(2);
  await expect(results.locator('.event-type-chip')).toHaveText(['Win', 'Exhaustive draw']);
  await expect(results.locator('.event-type-chip.win')).toHaveCount(1);
  await expect(results.locator('.event-type-chip.draw')).toHaveCount(1);
  await expect(results.locator('.event-title > span:last-child')).toContainText([
    'East 1 · Honba 0',
    'East 2 · Honba 0',
  ]);
  await expect(results.locator('.history-start')).toContainText('Game started');
  await expect(results.locator('summary')).not.toContainText(['Mahjong Soul', 'Riichi deposit']);
  const hand = results.locator('.history-event').first();
  await expect(hand.locator('.outcome-mark')).toContainText('Haneman');
  await hand.locator('summary').click();
  await expect(hand.locator('.hand-score-summary')).toHaveCount(1);
  await expect(hand.locator('.hand-score-summary')).toContainText('Haneman');
  await expect(hand.locator('.mini-tiles')).toHaveCount(1);
  const player = hand
    .locator('.hand-player')
    .filter({ hasText: input.players.find((player) => player.id === 'b')!.name });
  await expect(player.locator('.player-marks')).toContainText('Riichi');
  expect(
    await hand
      .locator('.event-timestamp')
      .evaluate((element) => element.nextElementSibling?.textContent),
  ).toContain('Recorded play time');
});
