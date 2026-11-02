import { LobbyConnection } from './lobby-connection';
import { Service, computed, inject, signal } from '@angular/core';
import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr';
import { RoomTabAccess } from './room-tab-access';
import { OnlineApi, type RoomAccess, type RoomState } from './online-api';
import { Repository } from '../../features/matches/data-access/repository';
import { parseArchive, gameArchive } from '../../features/records/data-transfer/data-archive';
import {
  applyRoomAction,
  roomHandKey,
  settleRoomWins,
  type RoomAction,
} from '../../../../../../packages/mahjong-core/room-actions';
import type { Match } from '../../../../../../packages/mahjong-core/ledger';
import type { ScoringInput } from '../../../../../../packages/mahjong-scoring/index';
import { newId } from '../id/new-id';
import { parsePresence, type PresenceSnapshot } from './presence';
import { DiagnosticLog } from '../diagnostic-log';
import {
  defaultRoomPermissions,
  type RoomPermission,
  type RoomPermissions,
} from './room-permissions';

export interface RoomGame {
  host?: boolean;
  ownSeat?: number | null;
  closed?: boolean;
  seatRequests?: { id: string; requestedSeat: number }[] | null;
  occupiedSeats?: number[] | null;
  hasGame?: boolean;
  presence?: PresenceSnapshot | null;
  permissions?: RoomPermissions;
  revision: number;
  handKey: string;
  match: Match | null;
  actions: RoomAction[];
}

@Service()
export class RoomSession {
  private readonly api = inject(OnlineApi);
  private readonly lobbyConnection = inject(LobbyConnection);
  private readonly tabAccess = inject(RoomTabAccess);
  private readonly repo = inject(Repository);
  private readonly logs = inject(DiagnosticLog);
  private updateConnection(state: string): void {
    if (this.access() && this.connectionStatus() !== state)
      this.logs.add(
        state === 'Disconnected' || state === 'Reconnecting' ? 'warn' : 'info',
        `Room connection: ${state}.`,
        'room',
      );
    this.connectionStatus.set(state);
  }
  readonly access = signal<RoomAccess | null>(null);
  readonly state = signal<RoomGame | null>(null);
  readonly status = signal('');
  readonly error = signal('');
  readonly connectionStatus = signal('Disconnected');
  readonly presence = signal<PresenceSnapshot | null>(null);
  private acceptPresence(value: unknown): void {
    const snapshot = parsePresence(value);
    if (snapshot && this.access() && snapshot.version >= (this.presence()?.version ?? -1))
      this.presence.set(snapshot);
  }
  readonly permissions = computed(() => ({
    ...defaultRoomPermissions,
    ...this.state()?.permissions,
  }));
  can(permission: RoomPermission): boolean {
    return !!this.access()?.host || this.permissions()[permission];
  }
  async setPermission(permission: RoomPermission, enabled: boolean): Promise<void> {
    if (!this.access()?.host) throw new Error('Only the host can change shared table settings.');
    await this.api.request(
      `/api/rooms/${this.access()!.id}/permissions`,
      'PUT',
      { ...this.permissions(), [permission]: enabled },
      this.access()!.token,
    );
    await this.sync();
  }
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
  private readonly discardedLocal = new Set<string>();
  async saveLocalResult(match: Match): Promise<void> {
    const previous = await this.repo.get(match.id);
    await this.repo.save(match, previous?.updatedAt, true);
    this.discardedLocal.delete(match.id);
  }
  async discardLocalResult(match: Match): Promise<void> {
    this.discardedLocal.add(match.id);
    await this.repo.remove(match.id);
  }
  private retries = new Map<string, string>();
  changed: (match: Match) => void = () => {};
  canProcess: () => boolean = () => true;

  async start(code: string): Promise<void> {
    await this.lobbyConnection.stop();
    const generation = this.generation + 1;
    await this.stop();
    await this.api.ready;
    if (generation !== this.generation) return;
    let access: RoomAccess | null = null;
    try {
      access = JSON.parse(
        sessionStorage.getItem(`riichi-room:${this.api.url()}`) ??
          localStorage.getItem(`riichi-room:${this.api.url()}`) ??
          'null',
      );
    } catch {
      /* No saved access. */
    }
    if (!access || access.id !== code || typeof access.token !== 'string')
      throw new Error('Join the room before opening its table.');
    if (await this.tabAccess.inUse(access.token))
      throw new Error('Join the room before opening its table.');
    const membership = await this.api.request<RoomState>(
      `/api/rooms/${code}`,
      'GET',
      undefined,
      access.token,
    );
    if (membership.host === false && membership.ownSeat == null)
      throw new Error('Choose an available player before entering the table.');
    if (membership.ownSeat !== undefined)
      access = { ...access, seat: membership.ownSeat, host: membership.host ?? access.host };
    this.tabAccess.claim(access.token);
    this.access.set(access);
    try {
      const pin = sessionStorage.getItem(`riichi-room:${this.api.url()}:${code}:pin`);
      if (pin && /^\d{6}$/.test(pin)) this.access.set({ ...access, pin });
    } catch {
      /* Session storage may be unavailable. */
    }
    this.updateConnection('Connecting');
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
    this.connection.on('Presence', (value: unknown) => {
      if (generation === this.generation) this.acceptPresence(value);
    });
    this.connection.onreconnecting(() => {
      if (generation === this.generation) {
        this.presence.set(null);
        this.updateConnection('Reconnecting');
        this.startPolling();
      }
    });
    this.connection.onclose(() => {
      if (generation === this.generation) {
        this.presence.set(null);
        this.updateConnection('Disconnected');
        this.startPolling();
      }
    });
    this.connection.onreconnected(async () => {
      if (generation !== this.generation) return;
      this.presence.set(null);
      try {
        const presence = await this.connection?.invoke<unknown>('Join', access.id, access.token);
        if (generation !== this.generation) return;
        this.acceptPresence(presence);
        this.stopPolling();
        await this.sync();
        this.updateConnection('Connected');
      } catch {
        if (generation !== this.generation) return;
        this.startPolling();
        this.updateConnection('Disconnected');
        this.error.set('Room credentials are incorrect or expired.');
      }
    });
    try {
      await this.connection.start();
      if (generation !== this.generation) return;
      const presence = await this.connection.invoke<unknown>('Join', access.id, access.token);
      if (generation !== this.generation) return;
      this.acceptPresence(presence);
      this.stopPolling();
      await this.sync();
      this.updateConnection('Connected');
    } catch {
      if (generation !== this.generation) return;
      this.startPolling();
      this.updateConnection('Disconnected');
      this.status.set('Live connection unavailable. Refreshing periodically.');
    }
  }
  async setAway(away: boolean): Promise<void> {
    if (this.connection?.state === 'Connected') await this.connection.invoke('SetAway', away);
  }
  async stop(): Promise<void> {
    this.generation++;
    this.stopPolling();
    this.syncQueued = false;
    const connection = this.connection;
    this.connection = undefined;
    this.tabAccess.release(this.access()?.token);
    this.access.set(null);
    this.presence.set(null);
    this.state.set(null);
    this.error.set('');
    this.status.set('');
    this.updateConnection('Disconnected');
    this.retries.clear();
    this.backedUpRevision = -1;
    await connection?.stop();
  }
  private path(): string {
    return `/api/rooms/${this.access()!.id}/game`;
  }
  private requestSync(): void {
    const generation = this.generation;
    void this.sync().catch(async (error) => {
      if (generation !== this.generation) return;
      if (
        [
          'Room credentials are incorrect or expired.',
          'This room or share has expired or was removed.',
          'This room has ended.',
        ].includes(error.message)
      )
        await this.stop();
      this.error.set(error.message);
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
    if (state.host !== undefined && this.access()?.host !== state.host) {
      const access = { ...this.access()!, host: state.host };
      this.access.set(access);
      try {
        sessionStorage.setItem(`riichi-room:${this.api.url()}`, JSON.stringify(access));
      } catch {
        /* The live role remains authoritative. */
      }
      if (this.connection?.state === 'Connected')
        await this.connection.invoke('RefreshRole', access.id, access.token);
    }
    if (state.ownSeat !== undefined)
      this.access.update((access) => (access ? { ...access, seat: state.ownSeat ?? null } : null));
    if (state.host === false && state.ownSeat === null && state.hasGame)
      this.error.set('Choose an available player before entering the table.');
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
      if (state.presence) this.acceptPresence(state.presence);
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
      if (
        state.match &&
        (this.access()?.host || state.match.ended) &&
        this.backedUpRevision !== state.revision
      ) {
        await this.backup(state.match);
        this.backedUpRevision = state.revision;
      }
      if (state.match) this.changed(state.match);
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
    operation?: string,
  ): Promise<void> {
    await this.api.request(
      this.path(),
      'PUT',
      { revision, handKey: roomHandKey(match), match, decisions, operation },
      this.access()!.token,
    );
  }
  // Also backs up snapshots recovered after an acknowledgement was lost in transit.
  private async backup(match: Match): Promise<void> {
    if (this.discardedLocal.has(match.id)) return;
    try {
      if (this.access()) await this.repo.linkRoom(match.id, this.access()!.id);
      const previous = await this.repo.get(match.id);
      await this.repo.save(match, previous?.updatedAt);
    } catch {
      this.error.set(
        'The room was saved, but its local backup failed. Export the game before closing the room.',
      );
    }
  }
  async save(match: Match, operation?: RoomPermission): Promise<void> {
    if (!this.access()?.host && (!operation || !this.can(operation)))
      throw new Error('This action is not permitted by the host.');
    if (this.syncing || this.saving) throw new Error('The room is synchronizing. Try again.');
    if (this.wins().length)
      throw new Error('Settle or reject pending wins before changing the table.');
    this.saving = true;
    try {
      await this.write(match, [], this.state()!.revision, operation);
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
    if (!this.can('settle')) throw new Error('This action is not permitted by the host.');
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
        'settle',
      );
    } finally {
      this.saving = false;
    }
    await this.sync();
  }
  async settleWith(inputs: ScoringInput[]): Promise<void> {
    if (!this.can('settle')) throw new Error('This action is not permitted by the host.');
    if (this.syncing || this.saving) throw new Error('The room is synchronizing. Try again.');
    const state = this.state()!;
    const wins = this.wins();
    if (!state.match) return;
    const own: RoomAction[] = inputs.map((input) => ({
      id: newId(),
      seat: state.match!.players.findIndex((player) => player.id === input.win.winnerId),
      handKey: state.handKey,
      kind: 'win',
      payload: { input },
      status: 'pending',
      error: '',
      createdAt: Date.now(),
    }));
    this.saving = true;
    try {
      const match = settleRoomWins(state.match, [...wins, ...own], newId);
      await this.write(
        match,
        wins.map((action) => ({ id: action.id, error: '' })),
        state.revision,
        'settle',
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
  async decideSeat(id: string, accept: boolean): Promise<void> {
    const access = this.access()!;
    if (!access.host) throw new Error('Only the host can change shared table settings.');
    await this.api.request(
      `/api/rooms/${access.id}/assignments/${id}`,
      'POST',
      { accept },
      access.token,
    );
    await this.sync();
  }
  async transferHost(seat: number): Promise<void> {
    const access = this.access()!;
    if (!access.host) throw new Error('Only the host can change shared table settings.');
    await this.api.request(`/api/rooms/${access.id}/host`, 'POST', { seat }, access.token);
    await this.sync();
  }
  async leave(): Promise<Match | null> {
    const access = this.access()!;
    const receipt = await this.api.request<{ closed: boolean; match: Match | null }>(
      `/api/rooms/${access.id}/leave`,
      'POST',
      undefined,
      access.token,
    );
    const match = receipt.match
      ? parseArchive(JSON.stringify(gameArchive([receipt.match]))).matches[0]
      : null;
    if (match) await this.saveLocalResult(match);
    try {
      sessionStorage.removeItem(`riichi-room:${this.api.url()}`);
      sessionStorage.removeItem(`riichi-room:${this.api.url()}:${access.id}:pin`);
      const saved = JSON.parse(localStorage.getItem(`riichi-room:${this.api.url()}`) ?? 'null');
      if (saved?.token === access.token) localStorage.removeItem(`riichi-room:${this.api.url()}`);
    } catch {
      /* The server has already revoked membership. */
    }
    await this.stop();
    return match;
  }
}
