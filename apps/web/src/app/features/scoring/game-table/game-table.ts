import { roomPermissionItems, type RoomPermission } from '../../../core/online/room-permissions';
import { gamesCsv } from '../../records/data-transfer/data-csv';
import { ConnectionStatus } from '../../../shared/connection-status/connection-status';
import { playerConnectionStates } from '../../../core/online/presence';
import { recordCall } from '../../../../../../../packages/mahjong-core/record-call';
import { RoomSession } from '../../../core/online/room-session';
import type { RoomAction } from '../../../../../../../packages/mahjong-core/room-actions';
import { DialogBackdrop } from '../../../shared/dialog-backdrop';
import { GameSounds } from '../../../core/sound/game-sounds';
import { BackgroundMusic } from '../../../core/sound/background-music';
import { MusicSettings } from '../../../shared/music-settings/music-settings';
import { ScoringMode } from '../../../core/scoring-mode';
import { handEditDraft, finishHandEdit } from './hand-edit';
import { DiceSimulator } from '../../../shared/dice-simulator/dice-simulator';
import { TileChoice } from '../tiles/tile-choice/tile-choice';
import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { settingGroups, type SettingField } from '../../../shared/rules/settings-fields';
import { newId } from '../../../core/id/new-id';
import { I18n, TranslatePipe } from '../../../core/i18n/i18n';
import { Repository } from '../../matches/data-access/repository';
import { TableSummary } from '../table-summary/table-summary';
import { TileInput } from '../tiles/tile-input/tile-input';
import { MatchHistory } from '../match-history/match-history';
import { FinalResults } from '../final-results/final-results';
import { ErrorNotice } from '../../../shared/error-notice/error-notice';
import { TileArt } from '../../../shared/tile-art/tile-art';
import {
  balances,
  settleRound,
  undoLastEvent,
  finishMatch,
  type Match,
  type LedgerEvent,
} from '../../../../../../../packages/mahjong-core/ledger';
import {
  clockAt,
  elapsedMs,
  emptyLive,
  livePlayer,
  declareRiichi,
  cancelRiichi,
  validateRevealed,
  initialLive,
  rememberLiveAction,
  undoLiveAction,
} from '../../../../../../../packages/mahjong-core/live';
import {
  parseTiles,
  kindIndex,
  type Meld,
  type WinEvent,
  type Tile,
} from '../../../../../../../packages/mahjong-core/index';
import {
  tableRules,
  ruleSettings,
  ruleName,
} from '../../../../../../../packages/mahjong-rules/index';
import { score, type ScoringInput } from '../../../../../../../packages/mahjong-scoring/index';
import {
  multipleRon,
  drawSettlement,
  type DrawInput,
  type RoundSettlement,
  type AbortiveReason,
} from '../../../../../../../packages/mahjong-scoring/rounds';
import { handChips } from '../../../../../../../packages/mahjong-scoring/chips';

type Panel =
  | 'music'
  | 'menu'
  | 'perspective'
  | 'player'
  | 'call'
  | 'indicators'
  | 'outcome'
  | 'win'
  | 'hand'
  | 'details'
  | 'review'
  | 'draw'
  | 'history'
  | 'finish'
  | 'info'
  | 'settings'
  | 'help'
  | 'difference'
  | 'dice'
  | 'results'
  | 'permissions'
  | 'declarations'
  | 'notice';
@Component({
  imports: [
    MusicSettings,
    ConnectionStatus,
    DialogBackdrop,
    FormsModule,
    DecimalPipe,
    TranslatePipe,
    TableSummary,
    TileInput,
    TileArt,
    MatchHistory,
    FinalResults,
    DiceSimulator,
    TileChoice,
    ErrorNotice,
  ],
  templateUrl: './game-table.html',
  styleUrl: './game-table.css',
})
export class GameTable {
  private readonly music = inject(BackgroundMusic);
  readonly scoringMode = inject(ScoringMode);
  readonly permissionItems = roomPermissionItems;
  readonly viewOrder = signal<string[]>([]);
  private resultShown = '';
  private pendingSignature = '';
  private noticedError = '';
  private resumeCall: Meld['type'] | null = null;
  private pendingKan: Match | null = null;
  private pendingCallPayload: Record<string, unknown> | null = null;
  requiredIndicators = 0;
  indicatorResume: 'hand' | 'details' | null = null;
  can(permission: RoomPermission): boolean {
    return !this.roomCode || this.room.can(permission);
  }
  readonly saveLocalResult = (match: Match) => this.room.saveLocalResult(match);
  readonly discardLocalResult = (match: Match) => this.room.discardLocalResult(match);
  async changePermission(key: RoomPermission, enabled: boolean): Promise<void> {
    await this.act(() => this.room.setPermission(key, enabled));
  }
  initializeView(match: Match): void {
    if (this.viewOrder().length) return;
    const ids = match.players.map((player) => player.id);
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('riichi-view:' + match.id) ?? 'null');
      if (
        Array.isArray(stored) &&
        stored.length === ids.length &&
        new Set(stored).size === ids.length &&
        stored.every((id) => ids.includes(id))
      ) {
        this.viewOrder.set(stored);
        return;
      }
    } catch {
      /* Use the assigned player as the viewing origin. */
    }
    const first = this.roomCode ? (this.room.access()?.seat ?? 0) : 0;
    this.viewOrder.set([...ids.slice(first), ...ids.slice(0, first)]);
  }
  rotateView(clockwise: boolean): void {
    const order = [...this.viewOrder()];
    if (!order.length) return;
    if (clockwise) order.push(order.shift()!);
    else order.unshift(order.pop()!);
    this.viewOrder.set(order);
    localStorage.setItem('riichi-view:' + this.match()!.id, JSON.stringify(order));
  }
  showResultsIfEnded(match: Match): void {
    if (!match.ended || this.resultShown === match.id) return;
    setTimeout(() => {
      if (!this.match()?.ended || this.resultShown === match.id) return;
      if (this.busy()) {
        this.showResultsIfEnded(match);
        return;
      }
      this.resultShown = match.id;
      this.open('results');
    }, 50);
  }
  get indicatorsComplete(): boolean {
    try {
      return (
        !this.requiredIndicators ||
        parseTiles(this.indicatorKind() === 'dora' ? this.dora : this.ura).length ===
          this.requiredIndicators
      );
    } catch {
      return false;
    }
  }
  get requiredDoraCount(): number {
    const match = this.pendingKan ?? this.match();
    return (
      1 +
      Object.values(match?.live?.players ?? {})
        .flatMap((player) => player.melds)
        .filter((meld) => !['chi', 'pon'].includes(meld.type)).length
    );
  }
  requireIndicators(kind: 'dora' | 'ura', resume: 'hand' | 'details'): void {
    this.indicatorResume = resume;
    this.requiredIndicators = this.requiredDoraCount;
    this.indicatorKind.set(kind);
    this.navigatePanel('indicators');
  }

  readonly manualEntry = signal(false);
  manualHan = 3;
  manualFu = 40;
  manualYakuman = 0;
  manualChips = 0;
  manualPayer = '';
  manualResponsibleYakuman = 1;
  readonly fuOptions = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
  readonly yakumanOptions = [1, 2, 3, 4, 5, 6];
  get concealedKanEntries() {
    return this.currentPlayer.melds
      .map((meld, index) => ({ meld, index }))
      .filter(({ meld }) => meld.type === 'ankan');
  }
  get playerMeldGroups() {
    const entries = this.currentPlayer.melds.map((meld, index) => ({ meld, index }));
    return [
      { label: 'Open melds', entries: entries.filter(({ meld }) => meld.type !== 'ankan') },
    ].filter(
      (group) =>
        group.entries.length &&
        (this.playerMode() !== 'calls' || group.label !== 'Concealed Kan') &&
        (this.playerMode() !== 'ankan' || group.label === 'Concealed Kan'),
    );
  }
  private readonly router = inject(Router);
  readonly settingGroups = settingGroups;
  readonly savedSettings = computed<Record<string, string | number | boolean>>(() => {
    const m = this.match();
    if (!m) return {};
    const { uma, ...table } = tableRules(m.rules);
    return {
      ...table,
      ...ruleSettings(m.rules),
      startingPoints: m.rules.startingPoints,
      kiriage: m.rules.kiriage,
      openTanyao: m.rules.openTanyao,
      ...Object.fromEntries(uma.map((value, i) => ['uma' + (i + 1), value])),
    };
  });
  settingValue(field: SettingField): string {
    const value = this.savedSettings()[field.key];
    if (typeof value === 'boolean') return this.i18n.t(value ? 'Enabled' : 'Disabled');
    const option = field.options?.find((option) => option.value === value);
    if (option) return this.i18n.t(option.label);
    return typeof value === 'number'
      ? new Intl.NumberFormat(this.i18n.locale()).format(value)
      : value || '—';
  }
  readonly indicatorKinds = ['dora'] as const;
  readonly indicatorKind = signal<'dora' | 'ura'>('dora');
  readonly i18n = inject(I18n);
  private readonly repo = inject(Repository);
  private readonly sounds = inject(GameSounds);
  private readonly route = inject(ActivatedRoute);
  readonly room = inject(RoomSession);
  readonly roomCode = this.route.snapshot.paramMap.get('room');
  readonly remotePlayer = computed(() => !!this.roomCode && !this.room.access()?.host);
  readonly roomPlayerId = computed(
    () => this.match()?.players[this.room.access()?.seat ?? -1]?.id ?? '',
  );
  roomWinSummary(action: RoomAction): string {
    const input = action.payload['input'] as ScoringInput | undefined;
    if (!input) return '';
    try {
      const result = score(input);
      return `${this.i18n.t(input.win.method === 'tsumo' ? 'Tsumo · self draw' : 'Ron · discard')} · ${result.han} ${this.i18n.t('Han')} · ${result.fu} ${this.i18n.t('Fu')}`;
    } catch {
      return this.i18n.t('Invalid online request.');
    }
  }
  async settleRoomDeclarations(): Promise<void> {
    await this.act(() => this.room.settleWins());
    if (!this.error()) {
      this.close();
      if (this.match()?.ended) this.open('results');
    }
  }
  async rejectRoomDeclaration(id: string): Promise<void> {
    await this.act(() => this.room.reject(id));
  }
  readonly match = signal<Match | null>(null);
  readonly playerPresence = computed(() => {
    if (!this.roomCode || !this.room.access()?.host) return null;
    const players = this.match()?.players ?? [];
    const states = playerConnectionStates(
      players.length,
      this.room.presence()?.seats ?? null,
      this.room.access()?.seat ?? null,
      this.room.connectionStatus(),
    );
    return Object.fromEntries(players.map((player, index) => [player.id, states[index]]));
  });
  readonly error = signal('');
  readonly busy = signal(false);
  readonly now = signal(Date.now());
  readonly editingHand = signal<string | null>(null);
  private originalMatch?: Match;
  readonly directIndicator = signal<'dora' | 'ura' | null>(null);
  editHand(eventId: string): void {
    if (!this.can('history')) {
      this.error.set('This action is not permitted by the host.');
      return;
    }
    if (this.busy() || this.editingHand()) return;
    try {
      const original = this.match()!;
      const draft = handEditDraft(original, eventId);
      this.originalMatch = original;
      this.editingHand.set(eventId);
      this.match.set(draft);
      this.dora = draft.live?.dora ?? '';
      this.ura = draft.live?.ura ?? '';
      this.panelParents.set([]);
      this.startOutcome();
    } catch (error) {
      this.fail(error);
    }
  }
  cancelHandEdit(): void {
    if (this.originalMatch) this.match.set(this.originalMatch);
    this.originalMatch = undefined;
    this.editingHand.set(null);
  }
  onPromptClosed(): void {
    this.pendingKan = null;
    this.pendingCallPayload = null;
    this.resumeCall = null;
    this.requiredIndicators = 0;
    this.indicatorResume = null;
    if (this.editingHand()) this.cancelHandEdit();
    this.error.set('');
  }
  async finishDirectIndicator(confirmed: boolean): Promise<void> {
    this.directIndicator.set(null);
    if (!confirmed) {
      this.dora = this.match()?.live?.dora ?? '';
      this.ura = this.match()?.live?.ura ?? '';
      return;
    }
    const dora = this.dora,
      ura = this.ura;
    await this.saveIndicators();
    if (this.error()) {
      const error = this.error();
      this.open('indicators');
      this.dora = dora;
      this.ura = ura;
      this.error.set(error);
    }
  }
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('prompt');
  readonly panel = signal<Panel>('menu');
  readonly panelParents = signal<Panel[]>([]);
  readonly canDismissPrompt = () => !this.busy();
  navigatePanel(panel: Panel): void {
    if (panel === 'permissions' && !this.room.access()?.host) return;
    if (panel === this.panel()) return;
    this.panelParents.update((parents) => [...parents, this.panel()]);
    this.panel.set(panel);
    this.error.set('');
  }
  backPanel(): void {
    const parents = this.panelParents();
    if (this.panel() === 'indicators' && this.requiredIndicators) {
      this.pendingKan = null;
      this.pendingCallPayload = null;
      this.resumeCall = null;
      this.requiredIndicators = 0;
      this.indicatorResume = null;
    }
    const previous = parents.at(-1);
    if (!previous) {
      this.close();
      return;
    }
    this.panelParents.set(parents.slice(0, -1));
    this.panel.set(previous);
    this.error.set('');
  }
  readonly playerMode = signal('all');
  readonly book = computed(() =>
    this.match() ? balances(this.match()!) : { players: {}, table: 0 },
  );
  readonly elapsed = computed(() => elapsedMs(this.match()?.clock, this.now()));
  readonly paused = computed(() => !this.match()?.clock?.runningSince);
  readonly statuses = computed(() =>
    Object.fromEntries(
      (this.match()?.players ?? []).map((p) => {
        const state = livePlayer(this.match()!, p.id);
        return [
          p.id,
          [
            state.riichi !== 'none'
              ? this.i18n.t(state.riichi === 'double' ? 'Double Riichi' : 'Riichi')
              : '',
            state.melds.length ? `${state.melds.length} ${this.i18n.t('Melds')}` : '',
            state.kita.length ? `${state.kita.length} ${this.i18n.t('North')}` : '',
          ]
            .filter(Boolean)
            .join(' · '),
        ];
      }),
    ),
  );
  readonly riichiPlayers = computed(() =>
    Object.fromEntries(
      (this.match()?.players ?? [])
        .filter((p) => livePlayer(this.match()!, p.id).riichi !== 'none')
        .map((p) => [
          p.id,
          this.i18n.t(
            livePlayer(this.match()!, p.id).riichi === 'double' ? 'Double Riichi' : 'Riichi',
          ),
        ]),
    ),
  );
  readonly callCounts = computed(() =>
    Object.fromEntries(
      (this.match()?.players ?? []).map((p) => {
        return [
          p.id,
          livePlayer(this.match()!, p.id).melds.filter((meld) => meld.type !== 'ankan').length,
        ];
      }),
    ),
  );
  readonly northCounts = computed(() =>
    Object.fromEntries(
      (this.match()?.players ?? []).map((p) => [p.id, livePlayer(this.match()!, p.id).kita.length]),
    ),
  );
  readonly concealedKanCounts = computed(() =>
    Object.fromEntries(
      (this.match()?.players ?? []).map((p) => [
        p.id,
        livePlayer(this.match()!, p.id).melds.filter((meld) => meld.type === 'ankan').length,
      ]),
    ),
  );
  selected = '';
  basis = '';
  readonly comparisonPlayer = signal('');
  callType: Meld['type'] | 'kita' = 'pon';
  callText = '';
  callSource = '';
  called = 0;
  upgradeId = '';
  dora = '';
  ura = '';
  doubleRiichi = false;
  firstTurn = false;
  method: 'ron' | 'tsumo' = 'ron';
  winners: Record<string, boolean> = {};
  playerWinSelected = false;
  private winSoundPlayed = false;
  discarder = '';
  handText = '';
  winningIndex = -1;
  winnerIndex = 0;
  inputs: ScoringInput[] = [];
  claims: Record<string, boolean> = {};
  replacement: 'kan' | 'kita' = 'kan';
  robbed: 'kakan' | 'ankan' | 'kita' = 'kakan';
  wareme = '';
  round: RoundSettlement | null = null;
  drawType: DrawInput['type'] = 'exhaustive';
  tenpai: Record<string, boolean> = {};
  nagashi: Record<string, boolean> = {};
  abortive: AbortiveReason = 'nine-terminals';
  drawInput?: DrawInput;
  editName = '';
  editNames: string[] = [];
  readonly diceRequest = signal(0);
  readonly ruleName = ruleName;
  readonly tableRules = tableRules;
  readonly abortiveReasons: AbortiveReason[] = [
    'nine-terminals',
    'four-winds',
    'four-riichi',
    'four-kans',
    'triple-ron',
  ];
  constructor() {
    effect(() => {
      const match = this.match();
      if (!match || match.ended) {
        this.music.setScene('lobby');
        return;
      }
      const riichi = match.players.some((player) => livePlayer(match, player.id).riichi !== 'none');
      this.music.setScene(
        riichi ? 'riichi' : 'game',
        `${match.id}:${match.roundWind}:${match.handNumber}:${match.honba}`,
      );
    });
    const interval = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => {
      this.music.setScene('lobby');
      clearInterval(interval);
      if (this.roomCode) void this.room.stop();
    });
    this.room.canProcess = () => !this.busy() && !this.editingHand();
    this.room.changed = (match) => {
      if (!this.editingHand()) {
        const kans = (value: Match | null) =>
          Object.values(value?.live?.players ?? {})
            .flatMap((player) => player.melds)
            .filter((meld) => !['pon', 'chi'].includes(meld.type)).length;
        const previous = this.match();
        this.match.set(match);
        this.initializeView(match);
        this.showResultsIfEnded(match);
        const signature = this.room
          .wins()
          .map((action) => action.id)
          .join(':');
        if (
          signature &&
          signature !== this.pendingSignature &&
          this.can('settle') &&
          !this.busy() &&
          !match.ended
        )
          queueMicrotask(() => {
            if (!this.dialog().nativeElement.open) this.open('declarations');
          });
        this.pendingSignature = signature;
        if (
          previous &&
          this.room.access()?.host &&
          !this.scoringMode.advanced() &&
          kans(match) > kans(previous) &&
          !this.busy() &&
          !this.dialog().nativeElement.open
        )
          this.openIndicators('dora');
      }
    };
    effect(() => {
      const error = this.room.error();
      if (
        error &&
        error !== this.noticedError &&
        error !== 'Could not connect to the online service.'
      ) {
        this.noticedError = error;
        queueMicrotask(() => {
          this.open('notice');
          this.error.set(error);
        });
      }
      if (!error) this.noticedError = '';
    });
    void this.load();
  }
  get players() {
    return this.match()?.players ?? [];
  }
  get activeWinner(): string {
    return this.players.filter((p) => this.winners[p.id])[this.winnerIndex]?.id ?? '';
  }
  get settings() {
    return this.match() ? ruleSettings(this.match()!.rules) : null;
  }
  get tiles(): Tile[] {
    try {
      return parseTiles(this.handText, 'winning-' + this.activeWinner);
    } catch {
      return [];
    }
  }
  get currentPlayer() {
    return this.match()
      ? livePlayer(this.match()!, this.selected)
      : { melds: [], kita: [], riichi: 'none' };
  }
  get winnerState() {
    return livePlayer(this.match()!, this.activeWinner);
  }
  name(id: string): string {
    return this.players.find((p) => p.id === id)?.name ?? id;
  }
  panelTitle(): string {
    if (this.panel() === 'player' && this.playerMode() === 'ankan') return 'Concealed Kan';
    if (this.panel() === 'indicators')
      return this.indicatorKind() === 'dora' ? 'Dora indicators' : 'Ura indicators';
    if (this.panel() === 'player' && this.playerMode() === 'riichi') return 'Riichi';
    const titles: Record<Panel, string> = {
      music: 'Music settings',
      menu: 'Game menu',
      player: 'Player actions',
      call: 'Record call',
      indicators: 'Dora / Ura',
      outcome: 'End this hand',
      win: this.playerWinSelected ? 'Win method' : 'Who won this hand?',
      hand: this.manualEntry() ? 'Manual Han entry' : 'The winning hand',
      details: 'Winning conditions',
      review: 'Review settlement',
      draw: 'Record draw',
      history: 'History',
      finish: 'End entire match',
      info: 'Edit game info',
      settings: 'In-game settings',
      perspective: 'Adjust view',
      help: 'Help',
      difference: 'Point differences',
      dice: 'Dice',
      results: 'Final results',
      permissions: 'Player permissions',
      declarations: 'Winning declarations',
      notice: 'Notice',
    };
    return titles[this.panel()];
  }
  hasPon(): boolean {
    return this.currentPlayer.melds.some((m) => m.type === 'pon');
  }
  callTiles(): Tile[] {
    try {
      return parseTiles(this.callText, 'call-preview');
    } catch {
      return [];
    }
  }
  indicatorTiles(kind: 'dora' | 'ura' = 'dora'): Tile[] {
    try {
      return parseTiles(this.match()?.live?.[kind] ?? '', 'table-indicator-' + kind);
    } catch {
      return [];
    }
  }
  waremeEnabled(): boolean {
    return !!this.match() && tableRules(this.match()!.rules).waremeMultiplier !== 1;
  }
  async removeCall(index: number): Promise<void> {
    await this.act(async () => {
      const m = this.match()!,
        live = structuredClone(m.live ?? emptyLive()),
        state = structuredClone(livePlayer(m, this.selected));
      state.melds.splice(index, 1);
      live.players[this.selected] = state;
      await this.persist({ ...m, live }, true);
    });
  }
  async removeNorth(): Promise<void> {
    await this.act(async () => {
      const m = this.match()!,
        live = structuredClone(m.live ?? emptyLive()),
        state = structuredClone(livePlayer(m, this.selected));
      state.kita.pop();
      live.players[this.selected] = state;
      await this.persist({ ...m, live }, true);
    });
  }
  time(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 3600)
      .toString()
      .padStart(2, '0')}:${Math.floor((seconds / 60) % 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  async load(): Promise<void> {
    try {
      if (this.roomCode) {
        await this.room.start(this.roomCode);
        const match = this.room.state()?.match;
        if (!match) throw new Error('The host has not attached a game yet.');
        this.match.set(match);
        this.initializeView(match);
        this.showResultsIfEnded(match);
        this.basis = match.players[0].id;
        this.promptStartingIndicator();
        return;
      }
      const match = await this.repo.get(this.route.snapshot.paramMap.get('id') ?? '');
      if (!match) throw new Error('Match not found. Return to My table.');
      this.match.set(match);
      this.initializeView(match);
      this.showResultsIfEnded(match);
      if (!match.clock || !match.live)
        await this.persist({
          ...match,
          clock: match.clock ?? {
            elapsedMs: 0,
            runningSince: match.ended ? null : new Date().toISOString(),
            handStartMs: 0,
          },
          live: initialLive(match),
        });
      const current = this.match()!;
      if (!current.ended && current.clock && !current.clock.runningSince)
        await this.persist({ ...current, clock: clockAt(current.clock, true) });
      this.basis = match.players[0].id;
      this.promptStartingIndicator();
    } catch (e) {
      this.fail(e);
    }
  }
  private promptStartingIndicator(): void {
    const match = this.match();
    if (
      !match ||
      match.ended ||
      this.scoringMode.advanced() ||
      (this.roomCode && !this.room.access()?.host) ||
      parseTiles(match.live?.dora ?? '').length
    )
      return;
    this.open('indicators');
    this.indicatorKind.set('dora');
    this.requiredIndicators = this.requiredDoraCount;
  }
  private fail(e: unknown): void {
    this.error.set(e instanceof Error ? e.message : 'Could not save match.');
  }
  private async persist(
    updated: Match,
    remember = false,
    operation?: RoomPermission,
  ): Promise<void> {
    const previous = this.match();
    if (previous && remember && !(this.remotePlayer() && operation === 'indicators'))
      updated = rememberLiveAction(previous, updated);
    else if (
      previous &&
      updated.events !== previous.events &&
      updated.events.some(
        (e) => !previous.events.some((p) => p.id === e.id) && e.type !== 'riichiDeposit',
      )
    )
      updated = { ...updated, liveUndo: [] };
    updated.updatedAt = new Date().toISOString();
    if (!this.editingHand()) {
      if (this.roomCode) await this.room.save(updated, operation);
      else await this.repo.save(updated, previous?.updatedAt);
    }
    this.match.set(updated);
    this.now.set(Date.now());
  }
  private async act(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.sounds.unlock();
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }
  open(panel: Panel, player?: string): void {
    if (this.remotePlayer() && !this.editingHand() && player && player !== this.roomPlayerId()) {
      this.error.set('Declare only for your own seat.');
      return;
    }
    if (
      this.remotePlayer() &&
      ((panel === 'indicators' && !this.can('indicators')) ||
        (panel === 'outcome' && !this.can('settle')) ||
        (panel === 'finish' && !this.can('finish')) ||
        ['info', 'permissions'].includes(panel))
    ) {
      this.error.set('Only the host can change shared table settings.');
      return;
    }
    this.playerMode.set('all');
    this.error.set('');
    this.panelParents.set([]);
    this.panel.set(panel);
    if (player) {
      this.selected = player;
      this.doubleRiichi = false;
      this.firstTurn = false;
    }
    const m = this.match();
    if (m) {
      this.dora = m.live?.dora ?? '';
      this.ura = m.live?.ura ?? '';
      this.editName = m.name;
      this.editNames = m.players.map((p) => p.name);
    }
    if (!this.dialog().nativeElement.open) this.dialog().nativeElement.showModal();
  }
  close(continueEditing = false): void {
    if (this.editingHand() && continueEditing) {
      this.panelParents.set([]);
      this.panel.set('outcome');
      return;
    }
    if (this.editingHand()) this.cancelHandEdit();
    this.dialog().nativeElement.close();
    this.error.set('');
  }
  openIndicators(kind: 'dora' | 'ura'): void {
    if (!this.can('indicators')) {
      this.open('notice');
      this.error.set('This action is not permitted by the host.');
      return;
    }
    const m = this.match();
    if (!m || this.busy()) return;
    this.error.set('');
    this.dora = m.live?.dora ?? '';
    this.ura = m.live?.ura ?? '';
    this.indicatorKind.set(kind);
    this.directIndicator.set(kind);
  }
  async pause(): Promise<void> {
    await this.act(async () => {
      const m = this.match()!;
      if (m.ended) return;
      await this.persist({ ...m, clock: clockAt(m.clock!, this.paused()) });
      this.close();
    });
  }
  async returnToTables(): Promise<void> {
    await this.act(async () => {
      const m = this.match()!;
      if (!m.ended && !this.remotePlayer())
        await this.persist({
          ...m,
          clock: m.clock
            ? clockAt(m.clock, false)
            : { elapsedMs: 0, runningSince: null, handStartMs: 0 },
        });
      await this.router.navigateByUrl('/');
    });
  }
  async riichi(): Promise<void> {
    await this.act(async () => {
      if (this.remotePlayer() && !this.editingHand()) {
        if (this.selected !== this.roomPlayerId())
          throw new Error('Declare only for your own seat.');
        await this.room.submit('riichi', { double: this.doubleRiichi });
        this.sounds.play(this.doubleRiichi ? 'doubleRiichi' : 'riichi');
        this.close(true);
        return;
      }
      if (this.paused()) throw new Error('Resume the game before recording actions.');
      if (this.doubleRiichi && !this.firstTurn)
        throw new Error('Confirm the uninterrupted first turn.');
      const declared = declareRiichi(
        this.match()!,
        this.selected,
        this.doubleRiichi,
        newId(),
        undefined,
        {
          doubleBeforeRecordedCalls: this.doubleRiichi && this.firstTurn,
        },
      );
      this.sounds.play(this.doubleRiichi ? 'doubleRiichi' : 'riichi');
      await this.persist(declared, true);
      this.close(true);
    });
  }
  startCall(type: Meld['type'] | 'kita', resuming = false): void {
    if (this.paused() || (this.busy() && !resuming) || this.match()?.ended) return;
    if (
      type !== 'kita' &&
      !['chi', 'pon'].includes(type) &&
      !(this.editingHand() ? this.manualEntry() : this.scoringMode.advanced()) &&
      !parseTiles(this.dora || this.match()?.live?.dora || '').length
    ) {
      this.resumeCall = type;
      this.requiredIndicators = 1;
      this.indicatorKind.set('dora');
      this.navigatePanel('indicators');
      return;
    }
    this.sounds.play(type);
    this.callType = type;
    this.callText = type === 'kita' ? '4z' : '';
    this.callSource =
      type === 'chi'
        ? this.players[
            (this.players.findIndex((p) => p.id === this.selected) + this.players.length - 1) %
              this.players.length
          ].id
        : (this.players.find((p) => p.id !== this.selected)?.id ?? '');
    this.called = 0;
    this.upgradeId = this.currentPlayer.melds.find((m) => m.type === 'pon')?.id ?? '';
    if (type === 'kita') {
      void this.saveCall(true);
      return;
    }
    this.navigatePanel('call');
  }
  async undoAction(): Promise<void> {
    await this.act(async () => {
      await this.persist(undoLiveAction(this.match()!));
      this.close();
    });
  }
  async cancelDeclaration(): Promise<void> {
    await this.act(async () => {
      if (this.remotePlayer() && !this.editingHand()) {
        if (this.selected !== this.roomPlayerId())
          throw new Error('Declare only for your own seat.');
        await this.room.submit('cancelRiichi', {});
        this.close(true);
        return;
      }
      if (this.paused()) throw new Error('Resume the game before recording actions.');
      await this.persist(cancelRiichi(this.match()!, this.selected));
      this.close(true);
    });
  }
  async tableAction(action: { player: string; type: string }): Promise<void> {
    if (this.remotePlayer() && action.player !== this.roomPlayerId()) {
      this.error.set('Declare only for your own seat.');
      return;
    }
    if (action.type === 'riichi') {
      this.selected = action.player;
      if (livePlayer(this.match()!, action.player).riichi === 'none')
        await this.declarePlayerRiichi(false);
      else await this.cancelDeclaration();
      if (this.error()) {
        const message = this.error();
        this.open('player', action.player);
        this.playerMode.set('riichi');
        this.error.set(message);
      }
      return;
    }
    this.open('player', action.player);
    this.playerMode.set(action.type);
    if (action.type === 'ankan') {
      this.startCall('ankan');
      this.panelParents.set([]);
    }
    if (action.type === 'kita') this.startCall('kita');
  }
  async declarePlayerRiichi(double: boolean): Promise<void> {
    this.doubleRiichi = double;
    // Clicking the explicitly labelled double declaration attests to its stated condition.
    this.firstTurn = double;
    await this.riichi();
  }
  canDeclareDoubleRiichi(): boolean {
    return (
      this.currentPlayer.riichi === 'none' &&
      !this.currentPlayer.melds.some((meld) => meld.type !== 'ankan')
    );
  }
  startPlayerWin(method: 'ron' | 'tsumo'): void {
    if (this.paused() || this.busy() || this.match()?.ended) return;
    const player = this.selected;
    this.startOutcome();
    this.playerWinSelected = true;
    this.sounds.play(method);
    this.winSoundPlayed = true;
    this.winners = { [player]: true };
    this.method = method;
    this.discarder = this.players.find((other) => other.id !== player)?.id ?? '';
    this.panel.set('win');
    if (method === 'tsumo') {
      this.nextWinners();
      // The player already chose Tsumo; Back skips the unused winner/method step.
      this.panelParents.update((parents) => parents.slice(0, -1));
    }
  }
  showPlayerDifference(player: string): void {
    if (player) this.basis = player;
    this.comparisonPlayer.set(player);
  }
  async saveCall(keepOpen = false): Promise<void> {
    await this.act(async () => {
      const payload = {
        type: this.callType,
        text: this.callText,
        source: this.callSource,
        called: this.called,
        upgradeId: this.upgradeId,
      };
      const updated = recordCall(this.match()!, this.selected, payload, newId);
      if (
        !['chi', 'pon', 'kita'].includes(this.callType) &&
        !(this.editingHand() ? this.manualEntry() : this.scoringMode.advanced())
      ) {
        this.pendingKan = updated;
        this.pendingCallPayload = payload;
        this.requiredIndicators = this.requiredDoraCount;
        this.indicatorKind.set('dora');
        this.navigatePanel('indicators');
        return;
      }
      if (this.remotePlayer() && !this.editingHand()) {
        if (this.selected !== this.roomPlayerId())
          throw new Error('Declare only for your own seat.');
        await this.room.submit('call', payload);
      } else await this.persist(updated, true);
      if (!keepOpen) this.close(true);
    });
  }
  upgradeTileKind(): number | undefined {
    const pon = this.currentPlayer?.melds.find(
      (meld) => meld.id === this.upgradeId && meld.type === 'pon',
    );
    return pon ? kindIndex(pon.tiles[0].kind) : undefined;
  }
  async saveIndicators(): Promise<void> {
    await this.act(async () => {
      const m = this.pendingKan ?? this.match()!;
      const kind = this.indicatorKind();
      const text = kind === 'dora' ? this.dora : this.ura;
      const count = parseTiles(text).length;
      if (this.requiredIndicators && count !== this.requiredIndicators)
        throw new Error('Fill every required indicator before saving.');
      const live = { ...(m.live ?? emptyLive()), [kind]: text };
      const maximum =
        1 +
        Object.values(live.players)
          .flatMap((player) => player.melds)
          .filter((meld) => !['chi', 'pon'].includes(meld.type)).length;
      if (parseTiles(this.dora).length > maximum || parseTiles(this.ura).length > maximum)
        throw new Error('Indicators cannot exceed one plus the recorded Kan count.');
      validateRevealed(m, live);
      if (this.pendingKan) {
        if (this.remotePlayer() && !this.editingHand())
          await this.room.submit('call', {
            ...this.pendingCallPayload,
            dora: this.dora,
            requireDora: true,
          });
        else await this.persist({ ...m, live }, true);
        this.pendingKan = null;
        this.pendingCallPayload = null;
        this.requiredIndicators = 0;
        this.close(true);
        return;
      }
      const resumeCall = this.resumeCall;
      const resume = this.indicatorResume;
      if (this.editingHand() || !this.remotePlayer() || this.can('indicators'))
        await this.persist({ ...m, live }, true, 'indicators');
      this.resumeCall = null;
      this.requiredIndicators = 0;
      this.indicatorResume = null;
      if (resumeCall) {
        this.startCall(resumeCall, true);
        return;
      }
      if (resume) {
        this.panel.set(resume);
        this.panelParents.update((parents) => parents.slice(0, -1));
        return;
      }
      this.close(true);
    });
  }
  startOutcome(): void {
    if (this.remotePlayer() && !this.editingHand() && this.selected !== this.roomPlayerId()) {
      this.error.set('Declare only for your own seat.');
      return;
    }
    const edited = this.originalMatch?.events.find((event) => event.id === this.editingHand());
    this.manualEntry.set(
      this.editingHand()
        ? !!(
            edited?.scoringInput?.manualScore ||
            edited?.scoringInputs?.some((input) => input.manualScore)
          )
        : this.scoringMode.advanced(),
    );
    this.winSoundPlayed = false;
    this.playerWinSelected = false;
    this.inputs = [];
    this.round = null;
    this.drawInput = undefined;
    this.winners = {};
    this.method = 'ron';
    this.discarder = this.players[0]?.id ?? '';
    this.navigatePanel('outcome');
  }
  nextWinners(): void {
    this.error.set('');
    const ids = this.players.filter((p) => this.winners[p.id]);
    if (
      !ids.length ||
      (this.method === 'tsumo' && ids.length !== 1) ||
      (this.method === 'ron' && (this.winners[this.discarder] || !this.discarder))
    ) {
      this.error.set('Choose winners and a different discarder; Tsumo has exactly one winner.');
      return;
    }
    this.inputs = [];
    this.winnerIndex = 0;
    if (!this.winSoundPlayed) {
      this.sounds.play(this.method);
      this.winSoundPlayed = true;
    }
    this.beginHand();
  }
  beginHand(): void {
    const edited = this.originalMatch?.events.find((event) => event.id === this.editingHand());
    const stored = (
      edited?.scoringInputs ?? (edited?.scoringInput ? [edited.scoringInput] : [])
    ).find((input) => input.win.winnerId === this.activeWinner)?.manualScore;
    this.manualHan = stored?.han ?? 3;
    this.manualFu = stored?.fu ?? 40;
    this.manualYakuman = stored?.yakuman ?? 0;
    this.manualChips = stored?.chips ?? 0;
    this.manualPayer = stored?.pao?.payerId ?? '';
    this.manualResponsibleYakuman = stored?.pao?.yakuman ?? 1;
    this.handText = '';
    this.winningIndex = -1;
    this.claims = {};
    this.firstTurn = false;
    this.wareme = this.match()?.live?.waremePlayerId ?? '';
    this.navigatePanel('hand');
    if (
      !this.manualEntry() &&
      parseTiles(this.dora || this.match()?.live?.dora || '').length !== this.requiredDoraCount
    )
      this.requireIndicators('dora', 'hand');
  }
  nextHand(): void {
    this.error.set('');
    if (this.manualEntry()) {
      this.reviewWinner();
      return;
    }
    if (
      this.tiles.length !== 14 - this.winnerState.melds.length * 3 ||
      !this.tiles[this.winningIndex]
    ) {
      this.error.set('Enter the concealed hand and select its winning tile.');
      return;
    }
    this.navigatePanel('details');
    if (
      this.winnerState.riichi !== 'none' &&
      parseTiles(this.ura).length !== this.requiredDoraCount
    )
      this.requireIndicators('ura', 'details');
  }
  get claimOptions(): { key: string; label: string }[] {
    const tsumo = this.method === 'tsumo',
      closed = this.winnerState.melds.every((m) => m.type === 'ankan');
    const choices: { key: string; label: string }[] = [];
    if (
      this.winnerState.riichi !== 'none' &&
      (this.match()?.live?.calls ?? 0) === (this.winnerState.riichiCalls ?? 0)
    )
      choices.push({ key: 'ippatsu', label: 'Ippatsu' });
    if (
      tsumo &&
      (this.winnerState.melds.some((m) => !['chi', 'pon'].includes(m.type)) ||
        this.winnerState.kita.length)
    )
      choices.push({ key: 'rinshan', label: 'Rinshan' });
    if (!tsumo) choices.push({ key: 'chankan', label: 'Chankan' });
    if (!tsumo && this.match()?.playerCount === 3)
      choices.push({ key: 'robbedNorth', label: 'Robbing North' });
    choices.push({ key: tsumo ? 'haitei' : 'houtei', label: tsumo ? 'Haitei' : 'Houtei' });
    if (closed && tsumo && !this.match()?.live?.calls)
      choices.push({
        key: this.activeWinner === this.match()?.dealerId ? 'tenhou' : 'chiihou',
        label:
          this.activeWinner === this.match()?.dealerId
            ? 'Tenhou (first dealer draw)'
            : 'Chiihou (first non-dealer draw)',
      });
    return choices;
  }
  reviewWinner(): void {
    this.error.set('');
    if (
      !this.manualEntry() &&
      parseTiles(this.dora || this.match()?.live?.dora || '').length !== this.requiredDoraCount
    ) {
      this.requireIndicators('dora', 'details');
      return;
    }
    if (
      !this.manualEntry() &&
      this.winnerState.riichi !== 'none' &&
      parseTiles(this.ura).length !== this.requiredDoraCount
    ) {
      this.requireIndicators('ura', 'details');
      return;
    }
    try {
      const m = this.match()!,
        state = this.winnerState;
      const revealed = structuredClone(m.live ?? emptyLive());
      revealed.ura = this.ura;
      const source = revealed.players[this.discarder];
      // A robbed tile belongs to the winner, not to the interrupted Kan/Kita as well.
      if (this.method === 'ron' && source) {
        if (this.claims['robbedNorth']) source.kita.pop();
        else if (this.claims['chankan']) {
          const kan = [...source.melds].reverse().find((meld) => meld.type === this.robbed);
          if (kan) kan.tiles.pop();
        }
      }
      validateRevealed(m, revealed, this.tiles);
      const win: WinEvent = {
        winnerId: this.activeWinner,
        method: this.method,
        discarderId: this.method === 'ron' ? this.discarder : undefined,
        winningTileId: this.tiles[this.winningIndex]?.id ?? '',
        riichi: state.riichi === 'riichi',
        doubleRiichi: state.riichi === 'double',
        ippatsu: !!this.claims['ippatsu'],
        rinshan: !!this.claims['rinshan'],
        chankan: !!this.claims['chankan'],
        haitei: !!this.claims['haitei'],
        houtei: !!this.claims['houtei'],
        tenhou: !!this.claims['tenhou'],
        chiihou: !!this.claims['chiihou'],
        firstTurnUninterrupted: this.firstTurn,
        replacement: this.replacement,
        robbed: this.claims['robbedNorth']
          ? 'kita'
          : this.claims['chankan']
            ? this.robbed
            : undefined,
      };
      const input: ScoringInput = {
        manualScore: this.manualEntry()
          ? {
              han: this.manualHan,
              fu: this.manualFu,
              yakuman: this.manualYakuman,
              chips: this.manualChips,
              pao:
                this.manualYakuman && this.manualPayer
                  ? { payerId: this.manualPayer, yakuman: this.manualResponsibleYakuman }
                  : undefined,
            }
          : undefined,
        rules: m.rules,
        players: m.players,
        dealerId: m.dealerId,
        roundWind: m.roundWind,
        honba: m.honba,
        riichiSticks: this.book().table / 1000,
        hand: {
          playerId: this.activeWinner,
          concealedTiles: this.tiles,
          melds: state.melds,
          extractedNorthTiles: state.kita,
        },
        win,
        doraIndicators: parseTiles(this.dora || m.live?.dora || '', 'dora'),
        uraIndicators: state.riichi !== 'none' ? parseTiles(this.ura, 'ura') : [],
        otherPlayerKans: Object.entries(m.live?.players ?? {})
          .filter(([id]) => id !== this.activeWinner)
          .flatMap(([, p]) => p.melds)
          .filter((meld) => !['chi', 'pon'].includes(meld.type)).length,
        waremePlayerId: this.wareme || undefined,
      };
      const result = score(input);
      if (!result.isValid) throw new Error(result.errors.join('\n'));
      const candidate = [...this.inputs.slice(0, this.winnerIndex), structuredClone(input)];
      const next = this.winnerIndex + 1;
      if (next < this.players.filter((p) => this.winners[p.id]).length) {
        this.inputs = candidate;
        this.winnerIndex = next;
        this.beginHand();
        return;
      }
      const round: RoundSettlement =
        this.method === 'ron'
          ? multipleRon(candidate)
          : {
              isValid: true,
              errors: [],
              outcome: 'win',
              payments: result.payments,
              playerDeltas: result.playerDeltas,
              winnerIds: [input.win.winnerId],
              dealerRepeats: input.win.winnerId === m.dealerId,
              results: [result],
            };
      if (!round.isValid) throw new Error(round.errors.join('\n'));
      this.inputs = candidate;
      this.round = round;
      this.navigatePanel('review');
    } catch (e) {
      this.fail(e);
    }
  }
  reviewDraw(): void {
    const m = this.match()!;
    this.drawInput = {
      rules: m.rules,
      players: m.players,
      dealerId: m.dealerId,
      honba: m.honba,
      type: this.drawType,
      tenpaiIds: m.players.filter((p) => this.tenpai[p.id]).map((p) => p.id),
      nagashiIds: m.players.filter((p) => this.nagashi[p.id]).map((p) => p.id),
      reason: this.abortive,
      circumstancesConfirmed: true,
    };
    this.round = drawSettlement(this.drawInput);
    if (!this.round.isValid) {
      this.error.set(this.round.errors.join('\n'));
      return;
    }
    this.error.set('');
    this.navigatePanel('review');
  }
  startDraw(): void {
    if (!this.can('draw') || this.busy() || this.paused() || this.match()?.ended) return;
    if (this.remotePlayer()) this.selected = this.roomPlayerId();
    this.startOutcome();
    this.drawType = 'exhaustive';
    this.tenpai = {};
    this.nagashi = {};
    this.panel.set('draw');
  }
  async settle(): Promise<void> {
    await this.act(async () => {
      if (this.remotePlayer() && !this.editingHand() && this.inputs.length) {
        for (const input of this.inputs) {
          if (this.remotePlayer() && input.win.winnerId !== this.roomPlayerId())
            throw new Error('Declare only for your own seat.');
          await this.room.submit(
            'win',
            { input },
            this.players.findIndex((player) => player.id === input.win.winnerId),
          );
        }
        this.inputs = [];
        this.round = null;
        this.close();
        return;
      }
      if (this.roomCode && !this.editingHand() && this.inputs.length && this.room.wins().length) {
        await this.room.settleWith(this.inputs);
        this.inputs = [];
        this.round = null;
        this.close();
        if (this.match()?.ended) this.open('results');
        return;
      }
      const m = this.match()!;
      if (!this.round?.isValid || this.paused())
        throw new Error('Resume the game before recording actions.');
      const chips = Object.fromEntries(m.players.map((p) => [p.id, 0]));
      this.round.winnerIds.forEach((id, index) => {
        const input = this.inputs.find((i) => i.win.winnerId === id),
          result = this.round!.results[index];
        if (input && result)
          for (const [player, value] of Object.entries(handChips(input, result)))
            chips[player] += value;
      });
      const one = this.inputs.length === 1 ? this.inputs[0] : undefined;
      const event: LedgerEvent = {
        id: newId(),
        type:
          this.round.outcome === 'win'
            ? this.inputs.length > 1
              ? 'multipleRon'
              : 'win'
            : this.round.outcome,
        timestamp: new Date().toISOString(),
        payments: this.round.payments,
        winnerIds: this.round.winnerIds,
        results: this.round.results,
        result: one ? this.round.results[0] : undefined,
        scoringInput: one,
        scoringInputs: this.inputs.length > 1 ? this.inputs : undefined,
        hand: one?.hand,
        win: one?.win,
        drawInput: this.drawInput,
        chipDeltas: chips,
        liveBefore: structuredClone(m.live ?? emptyLive()),
        durationMs: Math.max(0, elapsedMs(m.clock) - (m.clock?.handStartMs ?? 0)),
      };
      const updated = settleRound(m, event, this.round);
      const clock = clockAt(m.clock!, !updated.ended);
      clock.handStartMs = clock.elapsedMs;
      if (this.editingHand() && this.originalMatch) {
        const original = this.originalMatch;
        const rebuilt = finishHandEdit(original, this.editingHand()!, {
          ...updated,
          live: emptyLive(),
          clock,
        });
        if (this.roomCode) await this.room.save(rebuilt, 'history');
        else await this.repo.save(rebuilt, original.updatedAt);
        this.originalMatch = undefined;
        this.editingHand.set(null);
        this.match.set(rebuilt);
        this.close();
        this.open('history');
        return;
      }
      await this.persist(
        { ...updated, live: emptyLive(), clock },
        false,
        this.drawInput ? 'draw' : 'settle',
      );
      this.inputs = [];
      this.round = null;
      this.drawInput = undefined;
      this.close();
      if (updated.ended) this.open('results');
    });
  }
  async endMatch(): Promise<void> {
    await this.act(async () => {
      const m = this.match()!;
      const updated = finishMatch(m, newId());
      updated.events[updated.events.length - 1].liveBefore = structuredClone(m.live ?? emptyLive());
      await this.persist({ ...updated, clock: clockAt(m.clock!, false) }, false, 'finish');
      this.open('results');
    });
  }
  async undo(): Promise<void> {
    await this.act(async () => {
      const m = this.match()!,
        last = m.events.at(-1);
      if (!last) return;
      const updated = undoLastEvent(m);
      const live = structuredClone(last.liveBefore ?? m.live ?? emptyLive());
      if (last.type === 'riichiDeposit')
        for (const payment of last.payments)
          if (live.players[payment.from]) live.players[payment.from].riichi = 'none';
      const clock = clockAt(m.clock!, false);
      clock.handStartMs = Math.max(0, clock.handStartMs - (last.durationMs ?? 0));
      await this.persist({ ...updated, live, clock }, false, 'history');
      this.navigatePanel('history');
    });
  }
  async saveInfo(): Promise<void> {
    await this.act(async () => {
      const m = this.match()!;
      if (
        !this.editName.trim() ||
        this.editName.length > 80 ||
        this.editNames.some((name) => !name.trim() || name.length > 40) ||
        new Set(this.editNames.map((n) => n.trim())).size !== m.playerCount
      )
        throw new Error('Use distinct player names and a valid table name.');
      await this.persist({
        ...m,
        name: this.editName.trim(),
        players: m.players.map((p, i) => ({ ...p, name: this.editNames[i].trim() })),
      });
      this.close();
    });
  }
  rollDice(): void {
    this.diceRequest.update((value) => value + 1);
  }
  exportMatch(): void {
    const m = this.match();
    if (!m) return;
    const url = URL.createObjectURL(new Blob([gamesCsv([m])], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mahjong-match.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
