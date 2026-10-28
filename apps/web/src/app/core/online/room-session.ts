import { Service, computed, inject, signal } from '@angular/core';
import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr';
import { OnlineApi, type RoomAccess } from './online-api';
import { Repository } from '../../features/matches/data-access/repository';
import { parseArchive, gameArchive } from '../../features/records/data-transfer/data-archive';
import {
  applyRoomAction,
  roomHandKey,
  settleRoomWins,
  type RoomAction,
} from '../../../../../../packages/mahjong-core/room-actions';
import type { Match } from '../../../../../../packages/mahjong-core/ledger';
import { newId } from '../id/new-id';

export interface RoomGame {
  revision: number;
  handKey: string;
  match: Match | null;
  actions: RoomAction[];
}

@Service()
export class RoomSession {
  private readonly api = inject(OnlineApi);
  private readonly repo = inject(Repository);
  readonly access = signal<RoomAccess | null>(null);
  readonly state = signal<RoomGame | null>(null);
  readonly status = signal('');
  readonly error = signal('');
  readonly connectionStatus = signal('Disconnected');
  readonly wins = computed(
    () =>
      this.state()?.actions.filter(
        (action) => action.status === 'pending' && action.kind === 'win',
      ) ?? [],
  );
  private connection?: HubConnection;
  private timer?: ReturnType<typeof setInterval>;
  private syncing = false;
  private syncQueued = false;
  private saving = false;
  private generation = 0;
  private backedUpRevision = -1;
  private retries = new Map<string, string>();
  changed: (match: Match) => void = () => {};
  canProcess: () => boolean = () => true;

  async start(code: string): Promise<void> {
    const generation = this.generation + 1;
    await this.stop();
    await this.api.ready;
    if (generation !== this.generation) return;
    let access: RoomAccess | null = null;
    try {
      access = JSON.parse(localStorage.getItem(`riichi-room:${this.api.url()}`) ?? 'null');
    } catch {
      /* No saved access. */
    }
    if (!access || access.id !== code || typeof access.token !== 'string')
      throw new Error('Join the room before opening its table.');
    this.access.set(access);
    this.connectionStatus.set('Connecting');
    await this.sync();
    if (generation !== this.generation) return;
    this.connection = new HubConnectionBuilder()
      .withUrl(`${this.api.url()}/hubs/rooms`, { withCredentials: false })
      .configureLogging(LogLevel.None)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();
    this.connection.on('Changed', () => {
      if (generation === this.generation) this.requestSync();
    });
    this.connection.onreconnecting(() => {
      if (generation === this.generation) {
        this.connectionStatus.set('Reconnecting');
        this.startPolling();
      }
    });
    this.connection.onclose(() => {
      if (generation === this.generation) {
        this.connectionStatus.set('Disconnected');
        this.startPolling();
      }
    });
    this.connection.onreconnected(async () => {
      if (generation !== this.generation) return;
      try {
        await this.connection?.invoke('Join', access.id, access.token);
        if (generation !== this.generation) return;
        this.stopPolling();
        await this.sync();
        this.connectionStatus.set('Connected');
      } catch {
        if (generation !== this.generation) return;
        this.startPolling();
        this.connectionStatus.set('Disconnected');
        this.error.set('Room credentials are incorrect or expired.');
      }
    });
    try {
      await this.connection.start();
      if (generation !== this.generation) return;
      await this.connection.invoke('Join', access.id, access.token);
      if (generation !== this.generation) return;
      this.stopPolling();
      await this.sync();
      this.connectionStatus.set('Connected');
    } catch {
      if (generation !== this.generation) return;
      this.startPolling();
      this.connectionStatus.set('Disconnected');
      this.status.set('Live connection unavailable. Refreshing periodically.');
    }
  }
  async stop(): Promise<void> {
    this.generation++;
    this.stopPolling();
    this.syncQueued = false;
    const connection = this.connection;
    this.connection = undefined;
    this.access.set(null);
    this.state.set(null);
    this.error.set('');
    this.status.set('');
    this.connectionStatus.set('Disconnected');
    this.retries.clear();
    this.backedUpRevision = -1;
    await connection?.stop();
  }
  private path(): string {
    return `/api/rooms/${this.access()!.id}/game`;
  }
  private requestSync(): void {
    const generation = this.generation;
    void this.sync().catch((error) => {
      if (generation === this.generation) this.error.set(error.message);
    });
  }
  private startPolling(): void {
    if (this.timer || !this.access()) return;
    this.timer = setInterval(() => this.requestSync(), 2500);
  }
  private stopPolling(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
  private async read(): Promise<RoomGame> {
    const previous = this.state();
    const state = await this.api.request<RoomGame | undefined>(
      this.path() + (previous ? `?revision=${previous.revision}` : ''),
      'GET',
      undefined,
      this.access()!.token,
    );
    if (!state) return previous!;
    if (state.match && 'id' in state.match)
      state.match = parseArchive(JSON.stringify(gameArchive([state.match]))).matches[0];
    else state.match = null;
    return state;
  }
  async sync(): Promise<void> {
    if (!this.access()) return;
    if (this.syncing || this.saving) {
      this.syncQueued = true;
      return;
    }
    this.syncQueued = false;
    this.syncing = true;
    const generation = this.generation;
    try {
      let state = await this.read();
      if (generation !== this.generation) return;
      this.state.set(state);
      if (this.access()?.host && state.match && this.canProcess()) {
        let match = state.match;
        const decisions: { id: string; error: string }[] = [];
        const pending = state.actions
          .filter((action) => action.status === 'pending')
          .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
        const firstWin = pending.find((action) => action.kind === 'win');
        for (const action of pending.filter((action) => action.kind !== 'win').slice(0, 64)) {
          try {
            if (firstWin && action.createdAt > firstWin.createdAt)
              throw new Error('A win is awaiting settlement.');
            match = applyRoomAction(match, action, newId);
            decisions.push({ id: action.id, error: '' });
          } catch (error) {
            decisions.push({
              id: action.id,
              error: error instanceof Error ? error.message : 'Invalid online request.',
            });
          }
        }
        if (decisions.length) {
          await this.write(match, decisions, state.revision);
          if (generation !== this.generation) return;
          state = await this.read();
          if (generation !== this.generation) return;
          this.state.set(state);
        }
      }
      if (state.match) this.changed(state.match);
      if (state.match && this.access()?.host && this.backedUpRevision !== state.revision) {
        await this.backup(state.match);
        this.backedUpRevision = state.revision;
      }
      if (!this.access()?.host) {
        const last = [...state.actions].sort((a, b) => b.createdAt - a.createdAt)[0];
        if (last) {
          this.status.set(
            last.status === 'pending'
              ? 'Waiting for the host to accept the declaration.'
              : last.status === 'accepted'
                ? 'Declaration accepted.'
                : 'Declaration rejected.',
          );
          this.error.set(last.error);
        }
      }
    } finally {
      this.syncing = false;
      if (this.syncQueued && generation === this.generation) this.requestSync();
    }
  }
  private async write(
    match: Match,
    decisions: { id: string; error: string }[],
    revision: number,
  ): Promise<void> {
    await this.api.request(
      this.path(),
      'PUT',
      { revision, handKey: roomHandKey(match), match, decisions },
      this.access()!.token,
    );
  }
  // Also backs up snapshots recovered after an acknowledgement was lost in transit.
  private async backup(match: Match): Promise<void> {
    try {
      const previous = await this.repo.get(match.id);
      await this.repo.save(match, previous?.updatedAt);
    } catch {
      this.error.set(
        'The room was saved, but its local backup failed. Export the game before closing the room.',
      );
    }
  }
  async save(match: Match): Promise<void> {
    if (!this.access()?.host) throw new Error('Only the host can change shared table settings.');
    if (this.syncing || this.saving) throw new Error('The room is synchronizing. Try again.');
    if (this.wins().length)
      throw new Error('Settle or reject pending wins before changing the table.');
    this.saving = true;
    try {
      await this.write(match, [], this.state()!.revision);
    } finally {
      this.saving = false;
    }
    await this.sync();
  }
  async submit(
    kind: RoomAction['kind'],
    payload: Record<string, unknown>,
    seat?: number,
  ): Promise<void> {
    const state = this.state();
    if (!state?.match) throw new Error('The host has not attached a game yet.');
    const key = JSON.stringify([state.handKey, kind, payload, seat]);
    const id = this.retries.get(key) ?? newId();
    this.retries.set(key, id);
    await this.api.request(
      `${this.path()}/actions`,
      'POST',
      { id, handKey: state.handKey, kind, payload, seat },
      this.access()!.token,
    );
    this.retries.delete(key);
    this.status.set('Waiting for the host to accept the declaration.');
    await this.sync();
  }
  async settleWins(): Promise<void> {
    if (!this.access()?.host) throw new Error('Only the host can change shared table settings.');
    if (this.syncing || this.saving) throw new Error('The room is synchronizing. Try again.');
    const state = this.state()!;
    const wins = this.wins();
    if (!state.match) return;
    this.saving = true;
    try {
      const match = settleRoomWins(state.match, wins, newId);
      await this.write(
        match,
        wins.map((action) => ({ id: action.id, error: '' })),
        state.revision,
      );
    } finally {
      this.saving = false;
    }
    await this.sync();
  }
  async reject(id: string): Promise<void> {
    if (!this.access()?.host) throw new Error('Only the host can change shared table settings.');
    if (this.syncing || this.saving) throw new Error('The room is synchronizing. Try again.');
    this.saving = true;
    try {
      await this.write(
        this.state()!.match!,
        [{ id, error: 'The host rejected this declaration.' }],
        this.state()!.revision,
      );
    } finally {
      this.saving = false;
    }
    await this.sync();
  }
}
