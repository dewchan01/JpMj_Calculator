import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerLibrary } from './player-library';

describe('saved player import and rename', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('saves imported identities and numbers name conflicts without merging them', () => {
    const library = new PlayerLibrary();
    library.importPlayers([
      { id: 'first', name: 'Alice' },
      { id: 'second', name: 'Alice' },
    ]);
    expect(library.players()).toEqual([
      { id: 'first', name: 'Alice' },
      { id: 'second', name: 'Alice (1)' },
    ]);
    library.importPlayers([{ id: 'first', name: 'Old name' }]);
    expect(library.players()).toHaveLength(2);
    expect(library.players()[0].name).toBe('Alice');
  });
  it('renames without changing identity and persists the change', () => {
    const library = new PlayerLibrary();
    library.importPlayers([{ id: 'same', name: 'Alice' }]);
    library.rename('same', 'Alicia');
    expect(new PlayerLibrary().players()).toEqual([{ id: 'same', name: 'Alicia' }]);
  });
  it('rejects empty or duplicate names without overwriting players', () => {
    const library = new PlayerLibrary();
    library.importPlayers([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
    expect(() => library.rename('a', ' ')).toThrow();
    expect(() => library.rename('a', 'Bob')).toThrow();
    expect(library.players()[0].name).toBe('Alice');
  });
});
