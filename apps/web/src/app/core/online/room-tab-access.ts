import { DestroyRef, Service, inject } from '@angular/core';

/** Keeps copied tab storage from silently representing another connected player. */
@Service()
export class RoomTabAccess {
  private readonly channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('riichi-room-access');
  private token: string | null = null;
  private readonly pending = new Map<string, () => void>();
  constructor() {
    this.channel?.addEventListener('message', ({ data }) => {
      if (data?.kind === 'query' && this.token && data.token === this.token)
        this.channel?.postMessage({ kind: 'occupied', id: data.id });
      if (data?.kind === 'occupied') this.pending.get(data.id)?.();
    });
    inject(DestroyRef).onDestroy(() => this.channel?.close());
  }
  claim(token: string): void {
    this.token = token;
  }
  release(token: string | undefined): void {
    if (this.token === token) this.token = null;
  }
  async inUse(token: string): Promise<boolean> {
    if (!this.channel) return false;
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve(false);
      }, 150);
      this.pending.set(id, () => {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve(true);
      });
      this.channel!.postMessage({ kind: 'query', id, token });
    });
  }
}
