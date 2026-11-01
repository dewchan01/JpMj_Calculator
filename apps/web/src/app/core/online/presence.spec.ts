import { describe, it, expect } from 'vitest';
import { parsePresence, playerConnectionStates } from './presence';

describe('presence snapshots', () => {
  it('uses the verified connection for self while unknown peers stay neutral', () => {
    expect(playerConnectionStates(4, null, 3, 'Connected')).toEqual([
      'Unknown',
      'Unknown',
      'Unknown',
      'Connected',
    ]);
    expect(playerConnectionStates(4, [0, 3], 3, 'Connected')).toEqual([
      'Connected',
      'Disconnected',
      'Disconnected',
      'Connected',
    ]);
    expect(playerConnectionStates(4, [0, 3], 3, 'Reconnecting')).toEqual([
      'Unknown',
      'Unknown',
      'Unknown',
      'Reconnecting',
    ]);
    expect(playerConnectionStates(4, [0, 3], 3, 'Disconnected')).toEqual([
      'Unknown',
      'Unknown',
      'Unknown',
      'Disconnected',
    ]);
    expect(playerConnectionStates(3, null, null, 'Connected')).toEqual([
      'Unknown',
      'Unknown',
      'Unknown',
    ]);
  });
  it('marks connected members away without treating them as disconnected', () => {
    expect(playerConnectionStates(3, [0, 1], 0, 'Connected', [1])).toEqual([
      'Connected',
      'Away',
      'Disconnected',
    ]);
  });
  it('accepts versions and bounded distinct seat indexes', () => {
    expect(parsePresence({ version: 4, seats: [0, 1, 1] })).toEqual({
      version: 4,
      seats: [0, 1],
      awaySeats: [],
    });
    for (const value of [
      null,
      { version: -1, seats: [] },
      { version: 1, seats: [4] },
      { version: '1', seats: [0] },
    ])
      expect(parsePresence(value)).toBeNull();
  });
});
