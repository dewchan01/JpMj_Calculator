import { describe, expect, it } from 'vitest';
import { nextRoller } from './next-roller';

const players = ['A', 'B', 'C', 'D'].map((id) => ({ id, name: id }));
describe('next dice roller', () => {
  it('counts East as one and cycles all possible four-player totals', () => {
    const expected = [
      'south',
      'west',
      'north',
      'east',
      'south',
      'west',
      'north',
      'east',
      'south',
      'west',
      'north',
    ];
    for (let total = 2; total <= 12; total++)
      expect(nextRoller(players, 'A', total)?.wind).toBe(expected[total - 2]);
  });
  it('uses the current dealer and player names, independent of view rotation', () => {
    expect(nextRoller(players, 'C', 7)).toEqual({ name: 'A', wind: 'west' });
    expect(nextRoller(players, 'C', 5)).toEqual({ name: 'C', wind: 'east' });
  });
  it('cycles the three occupied winds in a three-player game', () => {
    expect(nextRoller(players.slice(0, 3), 'B', 7)).toEqual({ name: 'B', wind: 'east' });
  });
  it('does not suggest a player without a table or valid dice result', () => {
    expect(nextRoller([], '', 7)).toBeNull();
    expect(nextRoller(players, 'A', 0)).toBeNull();
  });
});
