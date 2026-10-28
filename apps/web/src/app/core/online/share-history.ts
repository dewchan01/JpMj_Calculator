import { Injectable, inject, signal } from '@angular/core';
import { OnlineApi, type ShareReceipt } from './online-api';

import { parseShareHistory, type SavedShare } from './share-history-data';
export type { SavedShare } from './share-history-data';

@Injectable({ providedIn: 'root' })
export class ShareHistory {
  private readonly api = inject(OnlineApi);
  readonly entries = signal<SavedShare[]>([]);
  private key(): string {
    return `riichi-share-history:${this.api.url()}`;
  }
  load(): void {
    try {
      this.entries.set(parseShareHistory(localStorage.getItem(this.key())));
      this.persist();
    } catch {
      this.entries.set([]);
    }
  }
  add(receipt: ShareReceipt, title: string, gameCount: number): boolean {
    this.load();
    this.entries.update((entries) =>
      [
        { ...receipt, title: title.slice(0, 200), gameCount, createdAt: new Date().toISOString() },
        ...entries.filter((entry) => entry.id !== receipt.id),
      ].slice(0, 100),
    );
    return this.persist();
  }
  remove(id: string): void {
    this.load();
    this.entries.update((entries) => entries.filter((entry) => entry.id !== id));
    this.persist();
  }
  private persist(): boolean {
    try {
      localStorage.setItem(this.key(), JSON.stringify(this.entries()));
      return true;
    } catch {
      return false;
    }
  }
}
