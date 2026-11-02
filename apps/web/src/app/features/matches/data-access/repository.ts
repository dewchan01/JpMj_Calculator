import { inject, Injectable } from '@angular/core';
import { StorageUsageMonitor } from '../../../core/storage/storage-usage';
import { DiagnosticLog } from '../../../core/diagnostic-log';
import { RecordRetention } from '../../../core/record-retention';
import Dexie, { type Table } from 'dexie';
import type { Match } from '../../../../../../../packages/mahjong-core/ledger';
import { mergePlayerRecords } from './merge-players';
import type { PlayerIdentity } from '../../records/player-identity';
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
  private readonly retention = inject(RecordRetention);
  private readonly storage = inject(StorageUsageMonitor);
  private readonly logs = inject(DiagnosticLog);
  private storageFailure(message: string): (error: unknown) => never {
    return (error) => {
      if (
        error instanceof Error &&
        error.message === 'This match changed in another tab. Reopen it before saving.'
      )
        this.logs.userMessage(error.message);
      else this.logs.add('error', message, 'storage');
      throw error;
    };
  }
  private readonly db = new LocalDatabase();
  async mergePlayers(source: string, target: PlayerIdentity): Promise<number> {
    const count = await this.db.transaction('rw', this.db.matches, this.db.drafts, async () => {
      const changed = mergePlayerRecords(await this.db.matches.toArray(), source, target);
      for (const match of changed)
        if (!match.ended && (await this.db.drafts.get('shared-room:' + match.id)))
          throw new Error('Finish the shared game before merging these players.');
      await this.db.matches.bulkPut(changed);
      return changed.length;
    });
    void this.storage.refresh();
    return count;
  }
  async list(): Promise<Match[]> {
    return this.db.matches
      .orderBy('updatedAt')
      .reverse()
      .toArray()
      .catch(this.storageFailure('Could not load match.'));
  }
  async get(id: string): Promise<Match | undefined> {
    return this.db.matches.get(id).catch(this.storageFailure('Could not load match.'));
  }
  async linkRoom(matchId: string, roomId: string): Promise<void> {
    await this.saveDraft('shared-room:' + matchId, roomId);
  }
  async roomForMatch(matchId: string): Promise<string | undefined> {
    return this.draft('shared-room:' + matchId);
  }
  async save(match: Match, expectedUpdatedAt?: string, keep = false): Promise<void> {
    await this.db
      .transaction('rw', this.db.matches, this.db.drafts, async () => {
        const previous = await this.db.matches.get(match.id);
        if (previous && previous.updatedAt !== expectedUpdatedAt)
          throw new Error('This match changed in another tab. Reopen it before saving.');
        const retained = 'retained-result:' + match.id;
        if (keep) await this.db.drafts.put({ id: retained, value: 'true' });
        if (
          match.ended &&
          !previous?.ended &&
          this.retention.autoDelete() &&
          !keep &&
          !(await this.db.drafts.get(retained))
        ) {
          await this.db.matches.delete(match.id);
          return;
        }
        await this.db.matches.put(structuredClone(match));
      })
      .catch(this.storageFailure('Could not save match.'));
    void this.storage.refresh();
  }
  async remove(id: string): Promise<void> {
    await this.db.drafts.delete('shared-room:' + id);
    await this.db.matches.delete(id).catch(this.storageFailure('Could not delete match.'));
    await this.db.drafts.delete(id).catch(this.storageFailure('Could not delete draft.'));
    void this.storage.refresh();
  }
  async importGames(matches: Match[], updateExisting = false): Promise<number> {
    const count = await this.db
      .transaction('rw', this.db.matches, async () => {
        const existing = new Map(
          (await this.db.matches.toArray()).map((match) => [match.id, match]),
        );
        const added = matches.filter(
          (match) =>
            !existing.has(match.id) ||
            (updateExisting && JSON.stringify(existing.get(match.id)) !== JSON.stringify(match)),
        );
        if (updateExisting) await this.db.matches.bulkPut(structuredClone(added));
        else await this.db.matches.bulkAdd(structuredClone(added));
        return added.length;
      })
      .catch(this.storageFailure('Could not import games.'));
    void this.storage.refresh();
    return count;
  }
  async draft(id: string): Promise<string | undefined> {
    return (await this.db.drafts.get(id).catch(this.storageFailure('Could not load draft.')))
      ?.value;
  }
  async saveDraft(id: string, value: string): Promise<void> {
    await this.db.drafts.put({ id, value }).catch(this.storageFailure('Could not save draft.'));
    void this.storage.refresh();
  }
  async clearDraft(id: string): Promise<void> {
    await this.db.drafts.delete(id).catch(this.storageFailure('Could not delete draft.'));
    void this.storage.refresh();
  }
  async clearRecords(): Promise<void> {
    await this.db
      .transaction('rw', this.db.matches, this.db.drafts, async () => {
        await this.db.matches.clear();
        await this.db.drafts.clear();
      })
      .catch(this.storageFailure('Could not delete match.'));
    void this.storage.refresh();
  }
}
