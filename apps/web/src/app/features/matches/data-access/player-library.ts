import { Service, signal } from '@angular/core';
import { newId } from '../../../core/id/new-id';
export interface SavedPlayer {
  id: string;
  name: string;
}
@Service()
export class PlayerLibrary {
  readonly players = signal<SavedPlayer[]>([]);
  constructor() {
    try {
      const data: unknown = JSON.parse(localStorage.getItem('riichi-players-v1') ?? '[]');
      if (Array.isArray(data))
        this.players.set(
          data
            .filter(
              (p): p is SavedPlayer =>
                !!p && typeof p.id === 'string' && typeof p.name === 'string',
            )
            .slice(0, 500),
        );
    } catch {
      /* Manual setup remains available. */
    }
  }
  add(name: string): SavedPlayer {
    name = name.trim();
    if (!name || name.length > 40) throw new Error('Enter a player name of 1 to 40 characters.');
    const existing = this.players().find((p) => p.name === name);
    if (existing) return existing;
    const player = { id: newId(), name };
    const updated = [...this.players(), player];
    localStorage.setItem('riichi-players-v1', JSON.stringify(updated));
    this.players.set(updated);
    return player;
  }
  remove(id: string): void {
    const updated = this.players().filter((p) => p.id !== id);
    localStorage.setItem('riichi-players-v1', JSON.stringify(updated));
    this.players.set(updated);
  }
}
