import { DialogBackdrop } from '../../../shared/dialog-backdrop';
import { GameSounds } from '../../../core/sound/game-sounds';
import { handEditDraft, finishHandEdit } from './hand-edit';
import { DiceSimulator } from '../../../shared/dice-simulator/dice-simulator';
import {
  Component,
  DestroyRef,
  ElementRef,
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
  | 'menu'
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
  | 'seats'
  | 'help'
  | 'difference'
  | 'dice'
  | 'results';
@Component({
  imports: [
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
    ErrorNotice,
  ],
  templateUrl: './game-table.html',
  styleUrl: './game-table.css',
})
export class GameTable {
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
  readonly indicatorKinds = ['dora', 'ura'] as const;
  readonly indicatorKind = signal<'dora' | 'ura'>('dora');
  readonly i18n = inject(I18n);
  private readonly repo = inject(Repository);
  private readonly sounds = inject(GameSounds);
  private readonly route = inject(ActivatedRoute);
  readonly match = signal<Match | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly now = signal(Date.now());
  readonly editingHand = signal<string | null>(null);
  private originalMatch?: Match;
  readonly directIndicator = signal<'dora' | 'ura' | null>(null);
  editHand(eventId: string): void {
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
  readonly canDismissPrompt = () => !this.busy() && this.panelParents().length === 0;
  navigatePanel(panel: Panel): void {
    if (panel === this.panel()) return;
    this.panelParents.update((parents) => [...parents, this.panel()]);
    this.panel.set(panel);
    this.error.set('');
  }
  backPanel(): void {
    const parents = this.panelParents();
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
        return [p.id, livePlayer(this.match()!, p.id).melds.length];
      }),
    ),
  );
  readonly northCounts = computed(() =>
    Object.fromEntries(
      (this.match()?.players ?? []).map((p) => [p.id, livePlayer(this.match()!, p.id).kita.length]),
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
  legalKan = false;
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
  swapA = '';
  swapB = '';
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
    const interval = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(interval);
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
    if (this.panel() === 'indicators')
      return this.indicatorKind() === 'dora' ? 'Dora indicators' : 'Ura indicators';
    if (this.panel() === 'player' && this.playerMode() === 'riichi') return 'Riichi';
    const titles: Record<Panel, string> = {
      menu: 'Game menu',
      player: 'Player actions',
      call: 'Record call',
      indicators: 'Dora / Ura',
      outcome: 'End this hand',
      win: this.playerWinSelected ? 'Win method' : 'Who won this hand?',
      hand: 'The winning hand',
      details: 'Winning conditions',
      review: 'Review settlement',
      draw: 'Record draw',
      history: 'History',
      finish: 'End entire match',
      info: 'Edit game info',
      settings: 'In-game settings',
      seats: 'Change seats',
      help: 'Help',
      difference: 'Point differences',
      dice: 'Dice',
      results: 'Final results',
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
      const match = await this.repo.get(this.route.snapshot.paramMap.get('id') ?? '');
      if (!match) throw new Error('Match not found. Return to My table.');
      this.match.set(match);
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
    } catch (e) {
      this.fail(e);
    }
  }
  private fail(e: unknown): void {
    this.error.set(e instanceof Error ? e.message : 'Could not save match.');
  }
  private async persist(updated: Match, remember = false): Promise<void> {
    const previous = this.match();
    if (previous && remember) updated = rememberLiveAction(previous, updated);
    else if (
      previous &&
      updated.events !== previous.events &&
      updated.events.some(
        (e) => !previous.events.some((p) => p.id === e.id) && e.type !== 'riichiDeposit',
      )
    )
      updated = { ...updated, liveUndo: [] };
    updated.updatedAt = new Date().toISOString();
    if (!this.editingHand()) await this.repo.save(updated, previous?.updatedAt);
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
      this.swapA = m.players[0].id;
      this.swapB = m.players[1].id;
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
      if (!m.ended)
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
  startCall(type: Meld['type'] | 'kita'): void {
    if (this.paused() || this.busy() || this.match()?.ended) return;
    this.sounds.play(type);
    this.legalKan = false;
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
      if (this.paused()) throw new Error('Resume the game before recording actions.');
      await this.persist(cancelRiichi(this.match()!, this.selected));
      this.close(true);
    });
  }
  async tableAction(action: { player: string; type: string }): Promise<void> {
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
    if (method === 'tsumo') this.nextWinners();
    else this.navigatePanel('win');
  }
  showPlayerDifference(player: string): void {
    if (player) this.basis = player;
    this.comparisonPlayer.set(player);
  }
  async saveCall(keepOpen = false): Promise<void> {
    await this.act(async () => {
      const m = this.match()!;
      if (m.ended || this.paused()) throw new Error('Resume the game before recording actions.');
      if (this.callType === 'ankan' && this.currentPlayer.riichi !== 'none' && !this.legalKan)
        throw new Error('Confirm the Kan is legal and preserves the wait.');
      const live = structuredClone(m.live ?? emptyLive()),
        state = structuredClone(livePlayer(m, this.selected));
      if (state.riichi !== 'none' && !['ankan', 'kita'].includes(this.callType))
        throw new Error('Riichi/Ippatsu require a closed hand.');
      let tiles = parseTiles(this.callText, newId());
      if (tiles.length === 1 && ['pon', 'ankan', 'daiminkan'].includes(this.callType)) {
        const tile = tiles[0];
        tiles = Array.from({ length: this.callType === 'pon' ? 3 : 4 }, (_, index) => ({
          ...tile,
          id: newId(),
          isRed: index === 0 && tile.isRed,
        }));
      }
      if (this.callType === 'kita') {
        if (m.playerCount !== 3 || tiles.length !== 1 || kindIndex(tiles[0].kind) !== 30)
          throw new Error('Kita requires one North tile in a three-player game.');
        state.kita.push(tiles[0]);
      } else if (this.callType === 'kakan') {
        const pon = state.melds.find((meld) => meld.id === this.upgradeId && meld.type === 'pon');
        if (!pon || tiles.length !== 1 || kindIndex(tiles[0].kind) !== kindIndex(pon.tiles[0].kind))
          throw new Error('Choose a Pon and its matching fourth tile.');
        state.melds = state.melds.map((meld) =>
          meld.id !== pon.id
            ? meld
            : {
                ...pon,
                type: 'kakan',
                tiles: [...pon.tiles, tiles[0]],
                upgradedFromMeldId: pon.id,
                originalPon: {
                  id: pon.id,
                  tiles: pon.tiles,
                  calledTileId: pon.calledTileId!,
                  fromPlayerId: pon.fromPlayerId!,
                },
              },
        );
      } else {
        const required = ['chi', 'pon'].includes(this.callType) ? 3 : 4;
        if (tiles.length !== required)
          throw new Error('Chi/Pon need three tiles; Kan needs four tiles.');
        const indices = tiles.map((t) => kindIndex(t.kind)).sort((a, b) => a - b);
        if (
          this.callType === 'chi'
            ? !(
                indices[0] < 27 &&
                Math.floor(indices[0] / 9) === Math.floor(indices[2] / 9) &&
                indices[1] === indices[0] + 1 &&
                indices[2] === indices[0] + 2
              )
            : !indices.every((i) => i === indices[0])
        )
          throw new Error('Select a legal sequence or matching tiles.');
        const open = this.callType !== 'ankan';
        if (
          open &&
          (!this.players.some((p) => p.id === this.callSource) ||
            this.callSource === this.selected ||
            !tiles[this.called])
        )
          throw new Error('Select the call source and called tile.');
        if (
          this.callType === 'chi' &&
          (m.playerCount === 3 ||
            this.callSource !==
              m.players[
                (m.players.findIndex((p) => p.id === this.selected) + m.playerCount - 1) %
                  m.playerCount
              ].id)
        )
          throw new Error('Chi is only allowed from the previous player in a four-player game.');
        state.melds.push({
          id: newId(),
          type: this.callType,
          tiles,
          fromPlayerId: open ? this.callSource : undefined,
          calledTileId: open ? tiles[this.called].id : undefined,
          callOrder: live.calls + 1,
        });
      }
      if (
        ruleSettings(m.rules).redFives &&
        ['ankan', 'daiminkan', 'kakan'].includes(this.callType)
      ) {
        const kan =
          this.callType === 'kakan'
            ? state.melds.find((meld) => meld.id === this.upgradeId)
            : state.melds[state.melds.length - 1];
        if (
          kan &&
          kan.tiles.length === 4 &&
          [4, 13, 22].includes(kindIndex(kan.tiles[0].kind)) &&
          !kan.tiles.some((tile) => tile.isRed)
        ) {
          kan.tiles[3] = { ...kan.tiles[3], isRed: true };
        }
      }
      live.players[this.selected] = state;
      live.calls++;
      live.actions = [
        ...(live.actions ?? []),
        {
          type: this.callType,
          playerId: this.selected,
          timestamp: new Date().toISOString(),
          elapsedMs: elapsedMs(m.clock),
        },
      ];
      validateRevealed(m, live);
      const kans = Object.values(live.players)
        .flatMap((p) => p.melds)
        .filter((meld) => !['chi', 'pon'].includes(meld.type)).length;
      if (kans > 4) throw new Error('At most four Kans can be recorded in a hand.');
      await this.persist({ ...m, live }, true);
      if (!['chi', 'pon', 'kita'].includes(this.callType)) {
        this.indicatorKind.set('dora');
        this.open('indicators');
      } else {
        if (!keepOpen) this.close(true);
      }
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
      const m = this.match()!;
      const live = {
        ...(m.live ?? emptyLive()),
        [this.indicatorKind()]: this.indicatorKind() === 'dora' ? this.dora : this.ura,
      };
      const kans = Object.values(live.players)
        .flatMap((p) => p.melds)
        .filter((meld) => !['chi', 'pon'].includes(meld.type)).length;
      if (parseTiles(this.dora).length > 1 + kans || parseTiles(this.ura).length > 1 + kans)
        throw new Error('Indicators cannot exceed one plus the recorded Kan count.');
      validateRevealed(m, live);
      await this.persist({ ...m, live }, true);
      this.close(true);
    });
  }
  startOutcome(): void {
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
    this.handText = '';
    this.winningIndex = -1;
    this.claims = {};
    this.firstTurn = false;
    this.wareme = this.match()?.live?.waremePlayerId ?? '';
    this.navigatePanel('hand');
  }
  nextHand(): void {
    this.error.set('');
    if (
      this.tiles.length !== 14 - this.winnerState.melds.length * 3 ||
      !this.tiles[this.winningIndex]
    ) {
      this.error.set('Enter the concealed hand and select its winning tile.');
      return;
    }
    this.navigatePanel('details');
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
        doraIndicators: parseTiles(m.live?.dora ?? '', 'dora'),
        uraIndicators: state.riichi !== 'none' ? parseTiles(this.ura, 'ura') : [],
        otherPlayerKans: Object.entries(m.live?.players ?? {})
          .filter(([id]) => id !== this.activeWinner)
          .flatMap(([, p]) => p.melds)
          .filter((meld) => !['chi', 'pon'].includes(meld.type)).length,
        waremePlayerId: this.wareme || undefined,
      };
      const result = score(input);
      if (!result.isValid) throw new Error(result.errors.join('\n'));
      const candidate = [...this.inputs, structuredClone(input)];
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
  async settle(): Promise<void> {
    await this.act(async () => {
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
        await this.repo.save(rebuilt, original.updatedAt);
        this.originalMatch = undefined;
        this.editingHand.set(null);
        this.match.set(rebuilt);
        this.close();
        this.open('history');
        return;
      }
      await this.persist({ ...updated, live: emptyLive(), clock });
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
      await this.persist({ ...updated, clock: clockAt(m.clock!, false) });
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
      await this.persist({ ...updated, live, clock });
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
  async swapSeats(): Promise<void> {
    await this.act(async () => {
      const m = this.match()!;
      const order = [...(m.viewSeats ?? m.players.map((p) => p.id))];
      const a = order.indexOf(this.swapA),
        b = order.indexOf(this.swapB);
      if (a < 0 || b < 0 || a === b) throw new Error('Choose two different players.');
      [order[a], order[b]] = [order[b], order[a]];
      await this.persist({ ...m, viewSeats: order });
      this.close();
    });
  }
  rollDice(): void {
    this.diceRequest.update((value) => value + 1);
  }
  exportMatch(): void {
    const m = this.match();
    if (!m) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mahjong-match.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
