import { describe, expect, it } from 'vitest';
import { presetRules } from '../../../../../../packages/mahjong-rules/index';
import type { Match } from '../../../../../../packages/mahjong-core/ledger';
import {
  mapImportedPlayers,
  playerIdentity,
  mergePlayersByName,
  identityLabel,
} from './player-identity';
import { playerRecords } from './record-stats';
import { analyzePlayer } from './player-profile/player-analysis';

function game(id: string, profileId?: string, name = 'Alice'): Match {
  return {
    id,
    name: id,
    schemaVersion: 1,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
    rules: presetRules('custom', 3),
    playerCount: 3,
    ended: true,
    players: [
      { id: 'p0', name, ...(profileId ? { profileId } : {}) },
      { id: 'p1', name: 'Bob', profileId: 'bob' },
      { id: 'p2', name: 'Carol', profileId: 'carol' },
    ],
    initialBalances: { p0: 35000, p1: 35000, p2: 35000 },
    dealerId: 'p0',
    initialDealerId: 'p0',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    events: [
      {
        id: 'e',
        timestamp: '2026-10-01',
        type: 'exhaustiveDraw',
        payments: [{ from: 'p1', to: 'p0', amount: 1000, reason: 'test' }],
      },
    ],
  };
}
describe('player identity and explicit import mapping', () => {
  it('uses names and ordinals without exposing identity values', () => {
    const people = [
      { id: 'secret-one', name: 'Alice' },
      { id: 'secret-two', name: 'Alice' },
    ];
    expect(identityLabel(people[0], people)).toBe('Alice');
    expect(identityLabel(people[1], people)).toBe('Alice (1)');
  });
  it('merges unambiguous matching names and preserves people seated together', () => {
    const source = game('one', 'incoming');
    const mapping = mergePlayersByName([source], [{ id: 'saved', name: 'alice' }]);
    expect(mapImportedPlayers([source], mapping)[0].players[0].profileId).toBe('saved');
    source.players[1].name = 'Alice';
    const separate = mergePlayersByName([source], []);
    expect(
      new Set(mapImportedPlayers([source], separate)[0].players.map((player) => player.profileId))
        .size,
    ).toBe(3);
  });
  it('does not guess between multiple existing players with the same name', () => {
    expect(
      mergePlayersByName(
        [game('one', 'new')],
        [
          { id: 'a', name: 'Alice' },
          { id: 'b', name: 'Alice' },
        ],
      ),
    ).toEqual({});
  });
  it('separates legacy players even when their names and table seat IDs match', () => {
    const a = game('a'),
      b = game('b');
    expect(playerIdentity(a, a.players[0])).not.toBe(playerIdentity(b, b.players[0]));
    expect(playerRecords([a, b]).filter((row) => row.name === 'Alice')).toHaveLength(2);
  });
  it('combines the same profile across renamed players, but never same-name different profiles', () => {
    const a = game('a', 'one'),
      b = game('b', 'one', 'Renamed');
    const other = game('c', 'other');
    expect(playerRecords([a, b, other]).find((row) => row.id === 'one')?.games).toBe(2);
    expect(playerRecords([a, b, other]).find((row) => row.id === 'other')?.games).toBe(1);
    expect(analyzePlayer([a, b, other], 'one', 3).games).toHaveLength(2);
  });
  it('preserves seat IDs, scores and history when explicitly mapping a different-name import', () => {
    const source = game('incoming', 'new-id', 'Different name');
    const mapped = mapImportedPlayers([source], { 'new-id': 'existing-id' })[0];
    expect(mapped.players[0]).toMatchObject({
      id: 'p0',
      profileId: 'existing-id',
      name: 'Different name',
    });
    expect(mapped.events).toEqual(source.events);
    expect(mapped.initialBalances).toEqual(source.initialBalances);
    expect(source.players[0].profileId).toBe('new-id');
    expect(
      playerRecords([game('old', 'existing-id'), mapped]).find((row) => row.id === 'existing-id')
        ?.games,
    ).toBe(2);
  });
  it('does not allow merging two seats in the same game into one person', () => {
    expect(() => mapImportedPlayers([game('a', 'alice')], { alice: 'bob' })).toThrow(
      'Two players in one game',
    );
  });
  it('uses identity IDs for opponents with identical display names', () => {
    const source = game('a', 'alice');
    source.players[1].name = 'Alice';
    const analysis = analyzePlayer([source], 'alice', 3);
    expect(analysis.games).toHaveLength(1);
    expect(analysis.chemistry.find((row) => row.id === 'bob')?.name).toBe('Alice');
  });
  it('gives legacy imports a stable profile without changing their original identity key', () => {
    const source = game('a');
    const id = playerIdentity(source, source.players[0]);
    const mapped = mapImportedPlayers([source], {})[0];
    expect(playerIdentity(mapped, mapped.players[0])).toBe(id);
  });
  it('resolves explicit mapping chains and rejects cycles before importing', () => {
    const source = game('a', 'new');
    expect(
      mapImportedPlayers([source], { new: 'other-incoming', 'other-incoming': 'existing' })[0]
        .players[0].profileId,
    ).toBe('existing');
    expect(() =>
      mapImportedPlayers([source], { new: 'other-incoming', 'other-incoming': 'new' }),
    ).toThrow('Player mappings contain a cycle.');
  });
});
