import { LobbyConnection } from '../../core/online/lobby-connection';
import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  input,
  output,
  type OnInit,
} from '@angular/core';
import { ruleName } from '../../../../../../packages/mahjong-rules/index';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr';
import { RoomTabAccess } from '../../core/online/room-tab-access';
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
import { ErrorNotice } from '../../shared/error-notice/error-notice';

@Component({
  selector: 'app-online',
  host: { '[class.embedded]': 'embedded()' },
  imports: [
    CopyButton,
    ErrorNotice,
    LoadingSpinner,
    QrScanner,
    ConnectionStatus,
    PlayerPresence,
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
  private readonly tabAccess = inject(RoomTabAccess);
  private readonly lobbyConnection = inject(LobbyConnection);
  private readonly repo = inject(Repository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly initializing = signal(true);
  readonly room = signal<RoomState | null>(null);
  readonly access = signal<RoomAccess | null>(null);
  readonly selectedSeat = signal<number | null>(null);
  private enteringTable = false;
  readonly qr = signal('');
  readonly games = signal<Match[]>([]);
  readonly game = signal<RoomGame | null>(null);
  readonly gameStarted = computed(() => this.game()?.hasGame ?? !!this.game()?.match?.id);
  readonly pendingGame = signal<Match | null>(null);
  readonly lobbyPlayers = computed(
    () =>
      this.game()?.match?.players ??
      this.pendingGame()?.players ??
      this.room()?.playerNames?.map((name) => ({ name })) ??
      [],
  );
  readonly lobbyFormat = computed(() => {
    const match = this.game()?.match ?? this.pendingGame();
    return {
      ruleLabel: match ? ruleName(match.rules) : this.room()?.ruleLabel,
      gameLength: match?.gameLength ?? this.room()?.gameLength,
      playerCount: match?.playerCount ?? this.room()?.playerCount,
    };
  });
  readonly selectedGame = new FormControl('', { nonNullable: true });
  readonly connectionStatus = signal('Disconnected');
  readonly presence = signal<PresenceSnapshot | null>(null);
  private acceptPresence(value: unknown): void {
    const snapshot = parsePresence(value);
    if (
      !this.destroyed &&
      !this.closing &&
      this.access() &&
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
      this.tabAccess.release(this.access()?.token);
      const access = this.access();
      if (access && !this.closing && !this.enteringTable) this.lobbyConnection.hold(access);
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
          !((this.entryMode() === 'join' || this.roomInvitation) && access.host) &&
          (!this.form.controls.code.value || this.form.controls.code.value === access.id) &&
          !(await this.tabAccess.inUse(access.token))
        ) {
          this.tabAccess.claim(access.token);
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
      const raw: unknown = JSON.parse(
        sessionStorage.getItem(this.storageKey()) ??
          (this.roomInvitation || this.entryMode() === 'join' || this.form.valid
            ? null
            : localStorage.getItem(this.storageKey())) ??
          'null',
      );
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
    this.tabAccess.claim(access.token);
    this.access.set(access);
    if (this.selectedSeat() === null) this.form.controls.seat.setValue(access.seat ?? -1);
    // The short PIN is never persisted; the random seat credential enables reconnects.
    const saved = { id: access.id, token: access.token, host: access.host, seat: access.seat };
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(saved));
      sessionStorage.setItem(this.storageKey(), JSON.stringify(saved));
      if (access.pin) sessionStorage.setItem(`${this.storageKey()}:${access.id}:pin`, access.pin);
    } catch {
      /* Session only. */
    }
  }
  async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.form.controls.seat.disable();
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
      this.form.controls.seat.enable();
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
    let hostSeat = 0;
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
        ruleLabel: match ? ruleName(match.rules) : undefined,
        gameLength: match?.gameLength,
        match: updated,
        pending: this.embedded() && !!updated,
        handKey: !this.embedded() && updated ? roomHandKey(updated) : undefined,
        hostSeat,
      },
    );
    if (this.destroyed) {
      await this.api.request(`/api/rooms/${access.id}`, 'DELETE', undefined, access.token);
      return;
    }
    if (match) await this.repo.linkRoom(match.id, access.id);
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
      if (this.game()?.match?.id) {
        this.enteringTable = true;
        await this.router.navigate(['/room', this.access()!.id]);
      }
    });
  }
  choosePlayer(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const seat = Number(select.value);
    this.selectedSeat.set(seat);
    void this.run(async () => {
      const access = this.access();
      if (!access || access.host) return;
      try {
        const receipt = await this.api.request<{ pending?: boolean } | undefined>(
          `/api/rooms/${access.id}/player`,
          'PUT',
          { seat },
          access.token,
        );
        if (receipt?.pending) {
          await this.refresh();
          return;
        }
      } catch (error) {
        await this.refresh().catch(() => undefined);
        throw error;
      }
      this.saveAccess({ ...access, seat });
      await this.connect();
    });
  }
  enterTable(): void {
    void this.run(() => this.openJoinedGame());
  }
  join(): void {
    void this.run(() => this.joinRoom());
  }
  private async joinRoom(): Promise<void> {
    if (this.form.invalid) return;
    const code = this.form.controls.code.value.toUpperCase();
    const pin = this.form.controls.pin.value;
    const saved = this.savedAccess();
    if (saved?.id === code && !saved.host && !(await this.tabAccess.inUse(saved.token))) {
      let valid = false;
      try {
        await this.api.request(`/api/rooms/${code}`, 'GET', undefined, saved.token);
        valid = true;
      } catch (error) {
        if (
          !(error instanceof Error) ||
          ![
            'Room credentials are incorrect or expired.',
            'This room or share has expired or was removed.',
          ].includes(error.message)
        )
          throw error;
      }
      if (valid) {
        this.form.controls.pin.setValue('');
        this.saveAccess({ ...saved, pin });
        await this.connect();
        return;
      }
    }
    const access = await this.api.request<RoomAccess>(`/api/rooms/${code}/join`, 'POST', {
      pin,
    });
    this.form.controls.pin.setValue('');
    this.saveAccess({ ...access, pin });
    await this.connect();
  }
  private async openJoinedGame(): Promise<void> {
    if (this.game()?.match?.ended) {
      await this.forget();
      return;
    }
    const access = this.access();
    if (
      !this.destroyed &&
      !this.enteringTable &&
      access &&
      !access.host &&
      this.gameStarted() &&
      !this.game()?.match?.ended
    ) {
      this.enteringTable = true;
      try {
        const seat = this.selectedSeat() ?? access.seat;
        if (seat === null || seat < 0)
          throw new Error('Choose an available player before entering the table.');
        const receipt = await this.api.request<{ pending?: boolean } | undefined>(
          `/api/rooms/${access.id}/player`,
          'PUT',
          { seat },
          access.token,
        );
        if (receipt?.pending) {
          await this.refresh();
          return;
        }
        this.selectedSeat.set(null);
        this.saveAccess({ ...access, seat });
        await this.router.navigate(['/room', access.id]);
      } finally {
        this.enteringTable = false;
      }
    }
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
    if (state.host && state.pendingMatch) this.pendingGame.set(state.pendingMatch);
    if (
      state.ownSeat !== undefined &&
      (state.ownSeat !== access.seat || state.host !== access.host)
    ) {
      this.saveAccess({ ...access, seat: state.ownSeat, host: state.host ?? access.host });
      if (this.connection?.state === 'Connected')
        await this.connection.invoke('RefreshRole', access.id, access.token);
    }
    if (state.assignment === 'rejected')
      this.error.set('The host rejected your seat request. Choose a player again.');
    if (this.selectedSeat() === null) this.form.controls.seat.setValue(this.access()?.seat ?? -1);
    this.game.set(
      await this.api.request<RoomGame>(
        `/api/rooms/${access.id}/game`,
        'GET',
        undefined,
        access.token,
      ),
    );
    if (this.access()?.host) {
      this.acceptPresence(this.game()?.presence);
      await this.prepareQr();
    }
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
  private async prepareQr(): Promise<void> {
    const access = this.access();
    if (!access?.host) {
      this.qr.set('');
      return;
    }
    if (this.qr()) return;
    const { default: qr } = await import('qrcode');
    this.qr.set(
      await qr.toDataURL(access.pin ? this.api.link('room', access.id, access.pin) : access.id, {
        width: 512,
        margin: 4,
      }),
    );
  }
  private async connect(initialState = false): Promise<void> {
    const access = this.access()!;
    await this.lobbyConnection.stop();
    this.tabAccess.claim(access.token);
    await this.prepareQr();
    if (this.destroyed) return;
    await this.connection?.stop();
    this.presence.set(null);
    this.connection = new HubConnectionBuilder()
      .withUrl(`${this.api.url()}/hubs/rooms`, { withCredentials: false })
      .configureLogging(LogLevel.None)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();
    this.connection.on('Closed', () => {
      if (!this.access() || this.access()?.host) return;
      this.closing = true;
      void this.forget().then(async () => {
        if (this.embedded()) this.dismissed.emit();
        else await this.router.navigate(['/'], { replaceUrl: true });
      });
    });
    this.connection.on('Changed', () => {
      if (this.destroyed) return;
      const waitingForStart = !this.gameStarted();
      const waitingForApproval = this.room()?.assignment === 'pending';
      void this.refresh()
        .then(() =>
          (waitingForStart || (waitingForApproval && this.access()?.seat != null)) && !this.busy()
            ? this.openJoinedGame()
            : undefined,
        )
        .catch((error) => {
          if (this.destroyed || this.closing || !this.access()) return;
          this.error.set(error.message);
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
  readonly dismissedSeatRequests = signal('');
  readonly seatRequestSignature = computed(() =>
    (this.game()?.seatRequests ?? []).map((r) => r.id).join(':'),
  );
  decideSeat(id: string, accept: boolean): void {
    void this.run(async () => {
      const access = this.access()!;
      await this.api.request(
        `/api/rooms/${access.id}/assignments/${id}`,
        'POST',
        { accept },
        access.token,
      );
      await this.refresh();
      this.dismissedSeatRequests.set(this.seatRequestSignature());
    });
  }
  leave(): void {
    void this.run(async () => {
      const access = this.access();
      const receipt = access
        ? await this.api.request<{ closed: boolean; match: Match | null }>(
            `/api/rooms/${access.id}/leave`,
            'POST',
            undefined,
            access.token,
          )
        : null;
      if (receipt?.closed && !receipt.match && this.pendingGame())
        await this.repo.remove(this.pendingGame()!.id);
      if (receipt?.match) {
        const previous = await this.repo.get(receipt.match.id);
        await this.repo.save(receipt.match, previous?.updatedAt);
      }
      await this.forget();
      if (this.embedded()) this.dismissed.emit();
      else
        await this.router.navigate(receipt?.match ? ['/score', receipt.match.id] : ['/'], {
          replaceUrl: true,
        });
    });
  }
  async forget(): Promise<void> {
    await this.connection?.stop();
    const token = this.access()?.token;
    this.tabAccess.release(token);
    try {
      sessionStorage.removeItem(`${this.storageKey()}:${this.access()?.id}:pin`);
      sessionStorage.removeItem(this.storageKey());
    } catch {
      /* Session storage may be unavailable. */
    }
    this.access.set(null);
    this.selectedSeat.set(null);
    this.qr.set('');
    this.room.set(null);
    this.game.set(null);
    this.pendingGame.set(null);
    this.games.set([]);
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(this.storageKey()) ?? 'null');
      if (saved && typeof saved === 'object' && 'token' in saved && saved.token === token)
        localStorage.removeItem(this.storageKey());
    } catch {
      /* Storage unavailable. */
    }
  }
}
