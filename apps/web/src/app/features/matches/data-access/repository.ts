import { inject, Injectable } from '@angular/core';
import { StorageUsageMonitor } from '../../../core/storage/storage-usage';
import Dexie, { type Table } from 'dexie';
import type { Match } from '../../../../../../../packages/mahjong-core/ledger';
class LocalDatabase extends Dexie {
  matches!: Table<Match, string>;
  drafts!: Table<{ id: string; value: string }, string>;
  constructor() {
    super('riichi-table');
    this.version(1).stores({ matches: 'id, updatedAt', drafts: 'id' });
  }
}
@Injectable({ providedIn: 'root' })
export class Repository {
  private readonly storage = inject(StorageUsageMonitor);
  private readonly db = new LocalDatabase();
  async list(): Promise<Match[]> {
    return this.db.matches.orderBy('updatedAt').reverse().toArray();
  }
  async get(id: string): Promise<Match | undefined> {
    return this.db.matches.get(id);
  }
  async save(match: Match, expectedUpdatedAt?: string): Promise<void> {
    await this.db.transaction('rw', this.db.matches, async () => {
      const previous = await this.db.matches.get(match.id);
      if (previous && previous.updatedAt !== expectedUpdatedAt)
        throw new Error('This match changed in another tab. Reopen it before saving.');
      await this.db.matches.put(structuredClone(match));
    });
    void this.storage.refresh();
  }
  async remove(id: string): Promise<void> {
    await this.db.matches.delete(id);
    await this.db.drafts.delete(id);
    void this.storage.refresh();
  }
  async draft(id: string): Promise<string | undefined> {
    return (await this.db.drafts.get(id))?.value;
  }
  async saveDraft(id: string, value: string): Promise<void> {
    await this.db.drafts.put({ id, value });
    void this.storage.refresh();
  }
  async clearDraft(id: string): Promise<void> {
    await this.db.drafts.delete(id);
    void this.storage.refresh();
  }
}
