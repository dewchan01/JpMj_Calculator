import { describe, expect, it } from 'vitest';
import { historyEvents } from './history-events';
import { balances, type Match } from '../../../../../../../packages/mahjong-core/ledger';
import { presetRules } from '../../../../../../../packages/mahjong-rules/index';

function game(): Match {
  return {
    id: 'history',
    schemaVersion: 1,
    name: 'test',
    createdAt: '',
    updatedAt: '',
    playerCount: 3,
    rules: presetRules('mahjong-soul', 3),
    players: ['a', 'b', 'c'].map((id) => ({ id, name: id })),
    initialBalances: { a: 35000, b: 35000, c: 35000 },
    initialDealerId: 'a',
    dealerId: 'b',
    roundWind: 'east',
    handNumber: 2,
    honba: 0,
    events: [
      {
        id: 'riichi-a',
        type: 'riichiDeposit',
        timestamp: '1',
        payments: [{ from: 'a', to: 'table', amount: 1000, reason: 'Riichi deposit' }],
      },
      {
        id: 'riichi-b',
        type: 'riichiDeposit',
        timestamp: '2',
        payments: [{ from: 'b', to: 'table', amount: 1000, reason: 'Riichi deposit' }],
      },
      {
        id: 'draw',
        type: 'exhaustiveDraw',
        timestamp: '3',
        payments: [],
        before: { dealerId: 'a', roundWind: 'east', handNumber: 1, honba: 0 },
      },
      { id: 'next', type: 'exhaustiveDraw', timestamp: '4', payments: [] },
    ],
  };
}
describe('hand history presentation', () => {
  it('groups Riichi with the following hand in ledger order without changing balances or source', () => {
    const match = game();
    const original = structuredClone(match);
    const events = historyEvents(match);
    expect(events.map((event) => event.id)).toEqual(['draw', 'next']);
    expect(events[0].payments).toHaveLength(2);
    expect(events[1].payments).toHaveLength(0);
    expect(balances({ ...match, events })).toEqual(balances(match));
    expect(match).toEqual(original);
  });
  it('keeps pending Riichi in one current-hand row rather than hiding it', () => {
    const match = { ...game(), events: game().events.slice(0, 2) };
    const events = historyEvents(match);
    expect(events).toHaveLength(1);
    expect(events[0].before?.handNumber).toBe(2);
    expect(events[0].payments).toHaveLength(2);
    expect(balances({ ...match, events })).toEqual(balances(match));
  });
});
