import { Component, DestroyRef, inject, signal, input, output, type OnInit } from '@angular/core';
import { MusicSettings } from '../../shared/music-settings/music-settings';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr';
import { OnlineApi, type RoomAccess, type RoomState } from '../../core/online/online-api';
import { TranslatePipe } from '../../core/i18n/i18n';
import { LocalDatePipe } from '../../core/i18n/local-date';
import { CopyButton } from '../../shared/copy-button/copy-button';
import { ConnectionStatus } from '../../shared/connection-status/connection-status';
import { Repository } from '../matches/data-access/repository';
import { roomHandKey } from '../../../../../../packages/mahjong-core/room-actions';
import { initialLive, clockAt } from '../../../../../../packages/mahjong-core/live';
import type { Match } from '../../../../../../packages/mahjong-core/ledger';
import type { RoomGame } from '../../core/online/room-session';
import { parsePresence, type PresenceSnapshot } from '../../core/online/presence';
import { PlayerPresence } from '../../shared/player-presence/player-presence';
import { Toast } from '../../shared/toast/toast';
import { QrScanner } from '../../shared/qr/qr-scanner';
import { LoadingSpinner } from '../../shared/loading-spinner/loading-spinner';

@Component({
  selector: 'app-online',
  host: { '[class.embedded]': 'embedded()' },
  imports: [
    MusicSettings,
    LoadingSpinner,
    QrScanner,
    ConnectionStatus,
    PlayerPresence,
    CopyButton,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    LocalDatePipe,
  ],
  templateUrl: './online.html',
  styleUrl: './online.css',
})
export class Online implements OnInit {
  readonly toast = inject(Toast);
  readonly dismissed = output<void>();
  readonly embedded = input(false);
  readonly entryMode = input<'host' | 'join' | ''>('');
  readonly attachGameId = input('');
  readonly playerCount = input(4);
  readonly prepareGame = input<(() => Promise<string>) | undefined>();
  readonly api = inject(OnlineApi);
  private readonly repo = inject(Repository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly initializing = signal(true);
  readonly room = signal<RoomState | null>(null);
  readonly access = signal<RoomAccess | null>(null);
  readonly qr = signal('');
  readonly games = signal<Match[]>([]);
  readonly game = signal<RoomGame | null>(null);
  readonly pendingGame = signal<Match | null>(null);
  readonly selectedGame = new FormControl('', { nonNullable: true });
  readonly connectionStatus = signal('Disconnected');
  readonly presence = signal<PresenceSnapshot | null>(null);
  private acceptPresence(value: unknown): void {
    const snapshot = parsePresence(value);
    if (
      !this.destroyed &&
      !this.closing &&
      this.access()?.host &&
      snapshot &&
      snapshot.version >= (this.presence()?.version ?? -1)
    )
      this.presence.set(snapshot);
  }
  readonly shareId = this.route.snapshot.queryParamMap.get('share');
  readonly roomInvitation = this.route.snapshot.queryParamMap.has('room');
  readonly form = new FormGroup({
    code: new FormControl(this.route.snapshot.queryParamMap.get('room') ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Fa-f0-9]{10}$/)],
    }),
    pin: new FormControl(this.route.snapshot.queryParamMap.get('pin') ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
    seat: new FormControl(0, { nonNullable: true }),
    count: new FormControl(4, { nonNullable: true }),
  });
  private connection?: HubConnection;
  private destroyed = false;
  private closing = false;
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      void this.connection?.stop();
    });
  }
  ngOnInit(): void {
    this.form.controls.count.setValue(this.playerCount());
    void this.run(async () => {
      await this.api.ready;
      if (this.destroyed) return;
      if (this.embedded() && this.entryMode() === 'host' && this.api.url()) {
        await this.createRoom();
        return;
      }
      if (!this.embedded() && !this.shareId && this.form.valid) {
        await this.joinRoom();
        return;
      }
      if (this.shareId) {
        if (!/^[a-f0-9]{64}$/.test(this.shareId)) throw new Error('Invalid game archive.');
        await this.router.navigate(['/others/data/import'], {
          queryParams: { share: this.shareId },
          replaceUrl: true,
        });
      } else {
        const access = this.entryMode() ? null : this.savedAccess();
        if (
          access &&
          !(this.entryMode() === 'join' && access.host) &&
          (!this.form.controls.code.value || this.form.controls.code.value === access.id)
        ) {
          this.access.set(access);
          try {
            const pin = sessionStorage.getItem(`${this.storageKey()}:${access.id}:pin`);
            if (access.host && pin && /^\d{6}$/.test(pin)) this.access.set({ ...access, pin });
          } catch {
            /* Session storage may be unavailable. */
          }
          await this.connect();
          if (this.game()?.match?.ended) await this.forget();
          else await this.openJoinedGame();
        }
      }
    }).finally(() => this.initializing.set(false));
  }
  private savedAccess(): RoomAccess | null {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(this.storageKey()) ?? 'null');
      if (
        raw &&
        typeof raw === 'object' &&
        'id' in raw &&
        'token' in raw &&
        'host' in raw &&
        'seat' in raw &&
        typeof raw.id === 'string' &&
        /^[A-F0-9]{10}$/.test(raw.id) &&
        typeof raw.token === 'string' &&
        /^[a-f0-9]{64}$/.test(raw.token) &&
        typeof raw.host === 'boolean'
      )
        return raw as RoomAccess;
    } catch {
      /* Device storage may be disabled. */
    }
    return null;
  }
  private storageKey(): string {
    return `riichi-room:${this.api.url()}`;
  }
  private saveAccess(access: RoomAccess): void {
    this.access.set(access);
    // The short PIN is never persisted; the random seat credential enables reconnects.
    const saved = { id: access.id, token: access.token, host: access.host, seat: access.seat };
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(saved));
      if (access.pin) sessionStorage.setItem(`${this.storageKey()}:${access.id}:pin`, access.pin);
    } catch {
      /* Session only. */
    }
  }
  async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      if (this.destroyed || this.closing) return;
      this.error.set(
        error instanceof Error ? error.message : 'Could not connect to the online service.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  create(): void {
    void this.run(() => this.createRoom());
  }
  private async createRoom(): Promise<void> {
    const gameId = this.prepareGame() ? await this.prepareGame()!() : this.attachGameId();
    if (this.prepareGame() && !gameId) return;
    const match = gameId ? await this.repo.get(gameId) : undefined;
    if (gameId && !match) throw new Error('Could not load match.');
    const updated = match
      ? {
          ...match,
          live: initialLive(match),
          clock: clockAt(match.clock ?? { elapsedMs: 0, runningSince: null, handStartMs: 0 }, true),
        }
      : undefined;
    let hostSeat: number | undefined;
    if (match) {
      try {
        const view: unknown = JSON.parse(localStorage.getItem(`riichi-view:${match.id}`) ?? 'null');
        hostSeat = Array.isArray(view)
          ? match.players.findIndex((player) => player.id === view[0])
          : 0;
        if (hostSeat < 0) hostSeat = 0;
      } catch {
        hostSeat = 0;
      }
    }
    const access = await this.api.request<RoomAccess & { room?: RoomState; game?: RoomGame }>(
      '/api/rooms',
      'POST',
      {
        playerCount: this.form.controls.count.value,
        playerNames: match?.players.map((player) => player.name),
        match: this.embedded() ? undefined : updated,
        handKey: !this.embedded() && updated ? roomHandKey(updated) : undefined,
        hostSeat,
      },
    );
    if (this.destroyed) {
      await this.api.request(`/api/rooms/${access.id}`, 'DELETE', undefined, access.token);
      return;
    }
    this.saveAccess(access);
    if (access.room && access.game) {
      this.room.set(access.room);
      this.game.set(access.game);
    }
    await this.connect(!!access.room && !!access.game);
    if (this.destroyed || this.closing) return;
    if (gameId && !access.game?.match) {
      this.selectedGame.setValue(gameId);
      this.pendingGame.set(match ?? null);
      if (!this.embedded()) await this.attachSelected();
    }
  }
  startGame(): void {
    void this.run(async () => {
      await this.attachSelected();
      if (this.game()?.match?.id) await this.router.navigate(['/room', this.access()!.id]);
    });
  }
  choosePlayer(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const seat = Number(select.value);
    void this.run(async () => {
      const access = this.access();
      if (!access || access.host || seat === access.seat) return;
      await this.api.request(`/api/rooms/${access.id}/player`, 'PUT', { seat }, access.token);
      this.saveAccess({ ...access, seat });
      await this.connect();
    }).finally(() => (select.value = String(this.access()?.seat ?? 0)));
  }
  join(): void {
    void this.run(() => this.joinRoom());
  }
  private async joinRoom(): Promise<void> {
    if (this.form.invalid) return;
    const code = this.form.controls.code.value.toUpperCase();
    const access = await this.api.request<RoomAccess>(`/api/rooms/${code}/join`, 'POST', {
      pin: this.form.controls.pin.value,
    });
    this.form.controls.pin.setValue('');
    this.saveAccess(access);
    await this.connect();
    await this.openJoinedGame();
  }
  private async openJoinedGame(): Promise<void> {
    if (this.game()?.match?.ended) {
      await this.forget();
      return;
    }
    const access = this.access();
    if (
      !this.destroyed &&
      access &&
      !access.host &&
      this.game()?.match?.id &&
      !this.game()?.match?.ended
    )
      await this.router.navigate(['/room', access.id]);
  }
  async refresh(): Promise<void> {
    const access = this.access();
    if (!access) return;
    const state = await this.api.request<RoomState>(
      `/api/rooms/${access.id}`,
      'GET',
      undefined,
      access.token,
    );
    if (this.destroyed || this.access()?.id !== access.id) return;
    this.room.set(state);
    this.game.set(
      await this.api.request<RoomGame>(
        `/api/rooms/${access.id}/game`,
        'GET',
        undefined,
        access.token,
      ),
    );
    if (access.host && !this.games().length)
      this.games.set(
        (await this.repo.list()).filter(
          (match) => !match.ended && match.playerCount === this.room()!.playerCount,
        ),
      );
  }
  attach(): void {
    void this.run(() => this.attachSelected());
  }
  private async attachSelected(): Promise<void> {
    const access = this.access()!;
    const match =
      this.pendingGame() ?? this.games().find((match) => match.id === this.selectedGame.value);
    if (!match) return;
    const current = await this.api.request<RoomGame>(
      `/api/rooms/${access.id}/game`,
      'GET',
      undefined,
      access.token,
    );
    const updated = {
      ...match,
      live: initialLive(match),
      clock: clockAt(match.clock ?? { elapsedMs: 0, runningSince: null, handStartMs: 0 }, true),
    };
    await this.api.request(
      `/api/rooms/${access.id}/game`,
      'PUT',
      {
        revision: current.revision,
        handKey: roomHandKey(updated),
        match: updated,
        decisions: [],
      },
      access.token,
    );
    await this.refresh();
  }
  private async connect(initialState = false): Promise<void> {
    const access = this.access()!;
    const { default: qr } = await import('qrcode');
    const invitation = access.pin ? this.api.link('room', access.id, access.pin) : access.id;
    this.qr.set(await qr.toDataURL(invitation, { width: 512, margin: 4 }));
    if (this.destroyed) return;
    await this.connection?.stop();
    this.presence.set(null);
    this.connection = new HubConnectionBuilder()
      .withUrl(`${this.api.url()}/hubs/rooms`, { withCredentials: false })
      .configureLogging(LogLevel.None)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();
    this.connection.on('Changed', () => {
      void this.refresh()
        .then(() => this.openJoinedGame())
        .catch((error) => {
          if (this.destroyed || this.closing || !this.access()) return;
          this.error.set(error.message);
          this.room.set(null);
        });
    });
    this.connection.on('Presence', (value: unknown) => this.acceptPresence(value));
    this.connection.onreconnecting(() => {
      this.presence.set(null);
      this.connectionStatus.set('Reconnecting');
    });
    this.connection.onclose(() => {
      this.presence.set(null);
      this.connectionStatus.set('Disconnected');
    });
    this.connection.onreconnected(async () => {
      this.presence.set(null);
      try {
        this.acceptPresence(
          await this.connection!.invoke<unknown>('Join', access.id, access.token),
        );
        await this.refresh();
        this.connectionStatus.set('Connected');
      } catch {
        this.connectionStatus.set('Disconnected');
        this.error.set('Room credentials are incorrect or expired.');
        await this.connection?.stop();
      }
    });
    this.connectionStatus.set('Connecting');
    try {
      await this.connection.start();
      if (this.destroyed) {
        await this.connection.stop();
        return;
      }
      this.acceptPresence(await this.connection.invoke<unknown>('Join', access.id, access.token));
      if (!initialState) await this.refresh();
      this.connectionStatus.set('Connected');
    } catch {
      this.connectionStatus.set('Disconnected');
      throw new Error('Could not connect to the online service.');
    }
  }
  reconnect(): void {
    void this.run(() => this.connect());
  }
  async scanRoom(text: string): Promise<void> {
    await this.run(async () => {
      let code = text.trim();
      let pin = '';
      try {
        const invitation: unknown = JSON.parse(code);
        if (
          invitation &&
          typeof invitation === 'object' &&
          'format' in invitation &&
          invitation.format === 'riichi-room' &&
          'version' in invitation &&
          invitation.version === 1 &&
          'code' in invitation &&
          typeof invitation.code === 'string' &&
          'pin' in invitation &&
          typeof invitation.pin === 'string' &&
          /^\d{6}$/.test(invitation.pin)
        ) {
          code = invitation.code;
          pin = invitation.pin;
        }
      } catch {
        /* Older room QR codes contain only a room code or URL. */
      }
      if (!/^[a-f0-9]{10}$/i.test(code)) {
        try {
          const url = new URL(code);
          const hashParams = new URLSearchParams(url.hash.split('?')[1]);
          code = url.searchParams.get('room') ?? hashParams.get('room') ?? '';
          const scannedPin = url.searchParams.get('pin') ?? hashParams.get('pin') ?? '';
          if (/^\d{6}$/.test(scannedPin)) pin = scannedPin;
        } catch {
          code = '';
        }
      }
      if (!/^[a-f0-9]{10}$/i.test(code)) {
        this.toast.error('No room QR code found. Try another image or enter the code.');
        return;
      }
      this.form.controls.code.setValue(code.toUpperCase());
      if (pin) {
        this.form.controls.pin.setValue(pin);
        await this.joinRoom();
      } else {
        this.toast.show('Room code scanned. Enter the passcode to join.');
      }
    });
  }
  release(seat: number): void {
    void this.run(async () => {
      const access = this.access()!;
      await this.api.request(
        `/api/rooms/${access.id}/seats/${seat}`,
        'DELETE',
        undefined,
        access.token,
      );
      await this.refresh();
    });
  }
  close(): void {
    void this.run(async () => {
      const access = this.access()!;
      this.closing = true;
      await this.connection?.stop();
      try {
        await this.api.request(`/api/rooms/${access.id}`, 'DELETE', undefined, access.token);
      } catch (error) {
        this.closing = false;
        throw error;
      }
      await this.forget();
      this.error.set('');
      this.dismissed.emit();
    });
  }
  leave(): void {
    void this.run(async () => {
      await this.forget();
      if (this.embedded()) this.dismissed.emit();
      else await this.router.navigate(['/'], { replaceUrl: true });
    });
  }
  async forget(): Promise<void> {
    await this.connection?.stop();
    try {
      sessionStorage.removeItem(`${this.storageKey()}:${this.access()?.id}:pin`);
    } catch {
      /* Session storage may be unavailable. */
    }
    this.access.set(null);
    this.room.set(null);
    this.qr.set('');
    this.game.set(null);
    this.pendingGame.set(null);
    this.games.set([]);
    try {
      localStorage.removeItem(this.storageKey());
    } catch {
      /* Storage unavailable. */
    }
  }
}
