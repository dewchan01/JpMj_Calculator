import { newId } from '../../core/id/new-id';
import { FinalResults } from './final-results/final-results';
import { QuickScoreSession } from './quick-score-session';
import { handChips } from '../../../../../../packages/mahjong-scoring/chips';
import { RuleLibrary } from '../settings/rule-library';
import { TileDropZones, type TileDropTarget } from './tiles/tile-drop-zones/tile-drop-zones';
import { ErrorNotice } from '../../shared/error-notice/error-notice';
import { TileReorder } from './tiles/tile-reorder';
import { TableSummary } from './table-summary/table-summary';
import { TileEntryDialog } from './tiles/tile-entry-dialog';
import { TileInput } from './tiles/tile-input';
import { TilePicker } from './tiles/tile-picker';
import { TileArt } from '../../shared/tile-art/tile-art';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  kindIndex,
  parseTiles,
  tileLabel,
  WINDS,
  type Tile,
  type Meld,
  type ScoreResult,
  type Wind,
} from '../../../../../../packages/mahjong-core/index';
import {
  appendEvent,
  balances,
  settleRound,
  undoLastEvent,
  type Match,
  type LedgerEvent,
} from '../../../../../../packages/mahjong-core/ledger';
import {
  tableRules,
  ruleName,
  ruleSettings,
  type RuleProfile,
} from '../../../../../../packages/mahjong-rules/index';
import { score, type ScoringInput } from '../../../../../../packages/mahjong-scoring/index';
import { Repository } from '../matches/data-access/repository';
import { PhotoCapture } from './capture/photo-capture';
import { I18n, TranslatePipe } from '../../core/i18n/i18n';
import { RulePicker } from '../../shared/rules/rule-picker';
import { ScoreResultView } from './score-result/score-result';
import { MatchHistory } from './match-history/match-history';
import { RoundReview } from './round-review/round-review';
import {
  drawSettlement,
  multipleRon,
  type AbortiveReason,
  type DrawInput,
  type RoundSettlement,
} from '../../../../../../packages/mahjong-scoring/rounds';
export interface Draft {
  waremePlayerId?: string;
  tiles: Tile[];
  melds: Meld[];
  kita: Tile[];
  winningId: string;
  winner: string;
  discarder: string;
  method: 'ron' | 'tsumo';
  dealer: string;
  roundWind: Wind;
  honba: number;
  handNumber?: number;
  doraText: string;
  uraText: string;
  flags: Flags;
  status: 'recognized' | 'corrected' | 'verified';
  otherKans?: number;
  replacement?: 'kan' | 'kita';
  robbed?: 'kakan' | 'ankan' | 'kita';
  firstTurn?: boolean;
  queued?: ScoringInput[];
}
type AssignmentTarget = 'chi' | 'pon' | 'daiminkan' | 'ankan' | 'kita';
interface Flags {
  riichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  rinshan: boolean;
  chankan: boolean;
  haitei: boolean;
  houtei: boolean;
  tenhou: boolean;
  chiihou: boolean;
}
const emptyFlags = (): Flags => ({
  riichi: false,
  doubleRiichi: false,
  ippatsu: false,
  rinshan: false,
  chankan: false,
  haitei: false,
  houtei: false,
  tenhou: false,
  chiihou: false,
});
@Component({
  imports: [
    FinalResults,
    ErrorNotice,
    TileInput,
    TileDropZones,
    TableSummary,
    TileEntryDialog,
    TileReorder,
    TilePicker,
    PhotoCapture,
    TileArt,
    ScoreResultView,
    MatchHistory,
    RoundReview,
    RulePicker,
    TranslatePipe,
    FormsModule,
    DecimalPipe,
    RouterLink,
  ],
  templateUrl: './scorer.html',
  styleUrl: './scorer.css',
})
export class Scorer {
  readonly library = inject(RuleLibrary);
  private readonly quickSession = inject(QuickScoreSession);
  waremePlayerId = '';
  get tableSettings() {
    return tableRules(this.rules);
  }
  readonly i18n = inject(I18n);
  private readonly repo = inject(Repository);
  private readonly route = inject(ActivatedRoute);
  readonly match = signal<Match | null>(null);
  readonly ready = signal(false);
  readonly error = signal('');
  readonly errorArea = signal('page');
  errorAt(area: string): string {
    return this.errorArea() === area ? this.error() : '';
  }
  private beginAction(area: string): void {
    this.error.set('');
    this.errorArea.set(area);
  }
  readonly notice = signal('');
  readonly result = signal<ScoreResult | null>(null);
  readonly busy = signal(false);
  readonly roundResult = signal<RoundSettlement | null>(null);
  readonly ruleName = ruleName;
  readonly winds = WINDS;
  readonly labels = tileLabel;
  readonly tileNames = (tile: Tile): string => this.i18n.tile(tile);
  tileActionLabel(tile: Tile, action: 'add' | 'mark' | 'remove' | 'select'): string {
    const visible =
      tileLabel(tile) +
      (action !== 'add' && tile.id === this.winningId ? ' ' + this.i18n.t('WIN') : '');
    const instruction = this.i18n.t(
      (action === 'add'
        ? 'Add '
        : action === 'mark'
          ? 'Mark winning '
          : action === 'select'
            ? 'Select '
            : 'Remove ') + this.i18n.tile(tile),
    );
    return `${visible}: ${instruction}`;
  }
  readonly flagOptions: { key: keyof Flags; label: string }[] = [
    { key: 'riichi', label: 'Riichi' },
    { key: 'doubleRiichi', label: 'Double Riichi' },
    { key: 'ippatsu', label: 'Ippatsu' },
    { key: 'rinshan', label: 'Rinshan' },
    { key: 'chankan', label: 'Chankan' },
    { key: 'haitei', label: 'Haitei' },
    { key: 'houtei', label: 'Houtei' },
    { key: 'tenhou', label: 'Tenhou (first dealer draw)' },
    { key: 'chiihou', label: 'Chiihou (first non-dealer draw)' },
  ];
  readonly suits = ['Characters · Man', 'Circles · Pin', 'Bamboo · Sou', 'Honors'];
  count: 3 | 4 =
    this.quickSession.value?.preferredCount === this.library.preferredCount
      ? this.quickSession.value.count
      : this.library.preferredCount;
  tiles: Tile[] = [];
  melds: Meld[] = [];
  kita: Tile[] = [];
  winningId = '';
  winner = 'p1';
  discarder = 'p2';
  dealer = 'p0';
  method: 'ron' | 'tsumo' = 'ron';
  roundWind: Wind = 'east';
  honba = 0;
  handNumber = 1;
  quickRules = this.library.active(this.count);
  otherKans = 0;
  replacement: 'kan' | 'kita' = 'kan';
  robbed: 'kakan' | 'ankan' | 'kita' = 'kakan';
  firstTurn = false;
  queued: ScoringInput[] = [];
  drawType: DrawInput['type'] = 'exhaustive';
  tenpai: Record<string, boolean> = {};
  nagashi: Record<string, boolean> = {};
  drawConfirmed = false;
  abortiveReason: AbortiveReason = 'nine-terminals';
  readonly abortiveOptions: { value: AbortiveReason; label: string }[] = [
    { value: 'nine-terminals', label: 'Nine terminals and honors' },
    { value: 'four-winds', label: 'Four identical first winds' },
    { value: 'four-riichi', label: 'Four Riichi declarations' },
    { value: 'four-kans', label: 'Four Kans by multiple players' },
    { value: 'triple-ron', label: 'Triple Ron abort' },
  ];
  flags = emptyFlags();
  notation = '';
  doraText = '';
  uraText = '';
  status: Draft['status'] = 'corrected';
  selectWinning = false;
  deleteMode = false;
  source = 'p0';
  calledIndex = 0;
  tab: 'entry' | 'history' | 'draw' = 'entry';
  depositPlayer = 'p1';

  private readonly past: Draft[] = [];
  private readonly future: Draft[] = [];
  private resultFingerprint = '';
  private eventId = newId();
  private draftQueue: Promise<void> = Promise.resolve();
  private loadedId = '';
  private loading = true;
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (!this.route.snapshot.paramMap.has('id') && !this.loading)
        this.quickSession.value = {
          count: this.count,
          preferredCount: this.library.preferredCount,
          rules: JSON.stringify(this.rules),
          draft: this.draft(),
        };
    });
    void this.load();
  }

  get players(): { id: string; name: string }[] {
    return (
      this.match()?.players ??
      ['p0', 'p1', 'p2', 'p3']
        .slice(0, this.count)
        .map((id, i) => ({ id, name: this.i18n.t(`Player ${i + 1}`) }))
    );
  }
  get rules() {
    return this.match()?.rules ?? this.quickRules;
  }
  get settings() {
    return ruleSettings(this.rules);
  }
  updateRules(rules: RuleProfile): void {
    this.quickRules = rules;
    this.queued = [];
    this.past.length = 0;
    this.future.length = 0;
    if (!this.settings.kokushiAnkanRon && this.robbed === 'ankan') this.robbed = 'kakan';
    if (!this.settings.kitaRinshan && this.replacement === 'kita') {
      this.replacement = 'kan';
      this.flags.rinshan = false;
    }
    if (rules.preset === 'm-league') this.drawType = 'exhaustive';
    if (!this.availableAbortiveOptions.some((option) => option.value === this.abortiveReason))
      this.abortiveReason = 'nine-terminals';
    this.drawConfirmed = false;
    this.editStatus();
  }
  get availableAbortiveOptions() {
    return this.abortiveOptions.filter(
      (option) =>
        !(
          this.rules.playerCount === 3 &&
          ['four-winds', 'four-riichi', 'triple-ron'].includes(option.value)
        ) && !(option.value === 'triple-ron' && this.settings.multipleRon !== 'triple-draw'),
    );
  }
  get meldSources() {
    const preceding =
      this.players[
        (this.players.findIndex((player) => player.id === this.winner) + this.players.length - 1) %
          this.players.length
      ];
    return this.players.filter(
      (player) =>
        player.id !== this.winner &&
        (this.assignmentTarget() !== 'chi' || player.id === preceding.id),
    );
  }
  selectAssignment(target: AssignmentTarget): void {
    this.assignmentTarget.set(target);
    if (!this.meldSources.some((player) => player.id === this.source))
      this.source = this.meldSources[0]?.id ?? '';
    this.error.set('');
  }
  get book() {
    const m = this.match();
    return m ? balances(m) : null;
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  name(id: string): string {
    return id === 'table'
      ? this.i18n.t('Table pot')
      : (this.players.find((p) => p.id === id)?.name ?? id);
  }
  seat(id: string): string {
    return WINDS[
      (this.players.findIndex((p) => p.id === id) -
        this.players.findIndex((p) => p.id === this.dealer) +
        this.players.length) %
        this.players.length
    ];
  }
  async load(): Promise<void> {
    try {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        const m = await this.repo.get(id);
        if (!m) throw new Error('Match not found. Return to My table.');
        this.match.set(m);
        this.loadedId = id;
        this.count = m.playerCount;
        this.dealer = m.dealerId;
        this.roundWind = m.roundWind;
        this.honba = m.honba;
        this.handNumber = m.handNumber;
        const saved = await this.repo.draft(id);
        if (saved) this.restore(JSON.parse(saved) as Draft);
      } else if (this.quickSession.value?.count === this.count) {
        const saved = this.quickSession.value;
        this.restore(saved.draft);
        if (saved.rules !== JSON.stringify(this.rules)) {
          this.queued = [];
          if (!this.settings.kokushiAnkanRon && this.robbed === 'ankan') this.robbed = 'kakan';
          if (!this.settings.kitaRinshan && this.replacement === 'kita') {
            this.replacement = 'kan';
            this.flags.rinshan = false;
          }
        }
      }
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.loading = false;
      this.ready.set(true);
    }
  }
  private draft(): Draft {
    return structuredClone({
      waremePlayerId: this.waremePlayerId,
      tiles: this.tiles,
      melds: this.melds,
      kita: this.kita,
      winningId: this.winningId,
      winner: this.winner,
      discarder: this.discarder,
      method: this.method,
      dealer: this.dealer,
      roundWind: this.roundWind,
      honba: this.honba,
      handNumber: this.handNumber,
      doraText: this.doraText,
      uraText: this.uraText,
      flags: this.flags,
      status: this.status,
      otherKans: this.otherKans,
      replacement: this.replacement,
      robbed: this.robbed,
      firstTurn: this.firstTurn,
      queued: this.queued,
    });
  }
  private restore(d: Draft): void {
    this.waremePlayerId = d.waremePlayerId ?? '';
    this.selectedHandTiles.set([]);
    // Restore only editor fields: persisted data must never replace services or signals.
    this.tiles = d.tiles;
    this.melds = d.melds;
    this.kita = d.kita;
    this.winningId = d.winningId;
    this.winner = d.winner;
    this.discarder = d.discarder;
    this.method = d.method;
    this.dealer = d.dealer;
    this.roundWind = d.roundWind;
    this.honba = d.honba;
    this.handNumber = d.handNumber ?? this.handNumber;
    this.doraText = d.doraText;
    this.uraText = d.uraText;
    this.status = d.status;
    this.otherKans = d.otherKans ?? 0;
    this.replacement = d.replacement ?? 'kan';
    this.robbed = d.robbed ?? 'kakan';
    this.firstTurn = d.firstTurn ?? false;
    this.flags = { ...emptyFlags(), ...d.flags };
    this.queued = d.queued ?? [];
    const match = this.match();
    if (match) {
      this.dealer = match.dealerId;
      this.roundWind = match.roundWind;
      this.honba = match.honba;
      this.handNumber = match.handNumber;
    }
  }
  private remember(): void {
    this.past.push(this.draft());
    if (this.past.length > 80) this.past.shift();
    this.future.length = 0;
  }
  changed(): void {
    this.result.set(null);
    this.roundResult.set(null);
    this.error.set('');
    this.notice.set('');
    if (this.loadedId && !this.loading) {
      const id = this.loadedId;
      const value = JSON.stringify(this.draft());
      this.draftQueue = this.draftQueue
        .then(() => this.repo.saveDraft(id, value))
        .catch(() => {
          this.errorArea.set('page');
          this.error.set('Draft could not be saved to this device.');
        });
    }
  }
  editStatus(): void {
    this.status = 'corrected';
    this.changed();
  }
  undo(): void {
    const previous = this.past.pop();
    if (previous) {
      this.future.push(this.draft());
      this.restore(previous);
      this.changed();
    }
  }
  redo(): void {
    const next = this.future.pop();
    if (next) {
      this.past.push(this.draft());
      this.restore(next);
      this.changed();
    }
  }
  reorderTiles({ from, to }: { from: number; to: number }): void {
    this.remember();
    const tiles = [...this.tiles];
    const [tile] = tiles.splice(from, 1);
    tiles.splice(to, 0, tile);
    this.tiles = tiles;
    this.editStatus();
  }
  addTile(tile: Tile): void {
    this.remember();
    this.tiles.push({ ...structuredClone(tile), id: newId() });
    if (!this.winningId) this.winningId = this.tiles.at(-1)!.id;
    this.editStatus();
  }
  clickTile(tile: Tile): void {
    if (this.deleteMode) {
      this.removeTile(tile);
    } else if (this.selectWinning) {
      this.remember();
      this.winningId = tile.id;
      this.editStatus();
    } else {
      if (this.errorArea() === 'assignment' || this.errorArea().startsWith('drop:'))
        this.error.set('');
      this.selectedHandTiles.update((ids) =>
        ids.includes(tile.id) ? ids.filter((id) => id !== tile.id) : [...ids, tile.id],
      );
      if (this.calledIndex >= this.selectedHandTiles().length) this.calledIndex = 0;
    }
  }
  keepConcealed(): void {
    this.selectedHandTiles.set([]);
    if (this.errorArea() === 'assignment' || this.errorArea().startsWith('drop:'))
      this.error.set('');
  }
  toggleDeleteMode(): void {
    this.deleteMode = !this.deleteMode;
    this.selectWinning = false;
    this.selectedHandTiles.set([]);
  }
  removeTile(tile: Tile): void {
    this.remember();
    this.tiles = this.tiles.filter((item) => item.id !== tile.id);
    this.selectedHandTiles.update((ids) => ids.filter((id) => id !== tile.id));
    if (this.winningId === tile.id) this.winningId = this.tiles.at(-1)?.id ?? '';
    this.editStatus();
  }
  applyNotation(): void {
    this.beginAction('tiles');
    try {
      const tiles = parseTiles(this.notation, newId());

      this.remember();
      this.tiles = tiles;
      this.melds = [];
      this.kita = [];
      this.selectedHandTiles.set([]);
      this.winningId = tiles.at(-1)?.id ?? '';
      this.editStatus();
    } catch (e) {
      this.error.set(this.message(e));
    }
  }
  example(): void {
    this.selectedHandTiles.set([]);
    this.remember();
    this.tiles = parseTiles(
      this.rules.playerCount === 3 ? '123p456p789s234s55p' : '123m456m789p234s55p',
      newId(),
    );
    this.melds = [];
    this.kita = [];
    this.winningId = this.tiles[11].id;
    this.flags = emptyFlags();
    this.doraText = '';
    this.uraText = '';
    this.editStatus();
  }
  resetHand(): void {
    this.selectedHandTiles.set([]);
    this.remember();
    this.tiles = [];
    this.melds = [];
    this.kita = [];
    this.winningId = '';
    this.flags = emptyFlags();
    this.firstTurn = false;
    this.otherKans = 0;
    this.replacement = 'kan';
    this.robbed = 'kakan';
    this.selectWinning = false;
    this.deleteMode = false;
    this.doraText = '';
    this.uraText = '';
    this.editStatus();
  }
  changeWinner(): void {
    this.selectedHandTiles.set([]);
    if (this.source === this.winner)
      this.source = this.players.find((player) => player.id !== this.winner)!.id;
    if (this.discarder === this.winner)
      this.discarder = this.players.find((player) => player.id !== this.winner)!.id;
    if (this.tiles.length || this.melds.length) {
      this.tiles = [];
      this.melds = [];
      this.kita = [];
      this.winningId = '';
      this.flags = emptyFlags();
      this.past.length = 0;
      this.future.length = 0;
    }
    this.editStatus();
  }
  changeCount(): void {
    this.assignmentTarget.set('pon');
    this.quickRules = this.library.active(this.count);
    this.queued = [];
    this.resetHand();
    this.past.length = 0;
    this.future.length = 0;
    this.doraText = '';
    this.uraText = '';
    if (!this.players.some((p) => p.id === this.winner)) this.winner = 'p1';
    if (!this.players.some((p) => p.id === this.discarder)) this.discarder = 'p2';
    this.dealer = 'p0';
    this.changed();
  }
  upgrade(meld: Meld): void {
    this.beginAction(`meld:${meld.id}`);
    if (meld.type !== 'pon') return;
    if (
      this.otherKans + this.melds.filter((meld) => !['chi', 'pon'].includes(meld.type)).length >=
      4
    ) {
      this.error.set(
        'The table can contain at most four Kans; enter a valid other-player Kan count.',
      );
      return;
    }
    const tile = (this.selectedTiles.length ? this.selectedTiles : this.tiles).find(
      (tile) => kindIndex(tile.kind) === kindIndex(meld.tiles[0].kind),
    );
    if (!tile || this.selectedTiles.length > 1) {
      this.error.set('Select the fourth matching tile from your collection to upgrade Pon.');
      return;
    }
    this.remember();
    const originalPon = {
      id: meld.id,
      tiles: structuredClone(meld.tiles),
      calledTileId: meld.calledTileId!,
      fromPlayerId: meld.fromPlayerId!,
    };
    this.melds = this.melds.map((m) =>
      m.id === meld.id
        ? {
            ...m,
            id: newId(),
            type: 'kakan',
            tiles: [...m.tiles, tile],
            originalPon,
            upgradedFromMeldId: m.id,
          }
        : m,
    );
    this.tiles = this.tiles.filter((item) => item.id !== tile.id);
    this.selectedHandTiles.set([]);
    if (this.winningId === tile.id) this.winningId = this.tiles.at(-1)?.id ?? '';
    this.editStatus();
  }
  removeMeld(id: string): void {
    this.remember();
    this.melds = this.melds.filter((m) => m.id !== id);
    this.editStatus();
  }
  returnMeld(id: string): void {
    const meld = this.melds.find((meld) => meld.id === id);
    if (!meld) return;
    this.remember();
    this.tiles = [...this.tiles, ...meld.tiles];
    this.melds = this.melds.filter((meld) => meld.id !== id);
    this.editStatus();
  }
  returnNorth(): void {
    if (!this.kita.length) return;
    this.remember();
    this.tiles = [...this.tiles, ...this.kita];
    this.kita = [];
    this.editStatus();
  }
  addKita(): void {
    this.beginAction('north');
    const tile = this.tiles.find((tile) => kindIndex(tile.kind) === 30);
    if (this.rules.playerCount !== 3 || this.kita.length >= 4 || !tile) {
      this.error.set('Extracted tiles must contain only North, up to four tiles.');
      return;
    }
    this.remember();
    this.kita.push(tile);
    this.tiles = this.tiles.filter((item) => item.id !== tile.id);
    this.selectedHandTiles.update((ids) => ids.filter((id) => id !== tile.id));
    if (this.winningId === tile.id) this.winningId = this.tiles.at(-1)?.id ?? '';
    this.editStatus();
  }
  removeKita(): void {
    this.remember();
    this.kita.pop();
    this.editStatus();
  }
  private input(): ScoringInput {
    return {
      rules: this.rules,
      players: this.players,
      dealerId: this.dealer,
      roundWind: this.roundWind,
      hand: {
        playerId: this.winner,
        concealedTiles: this.tiles,
        melds: this.melds,
        extractedNorthTiles: this.kita,
      },
      win: {
        ...this.flags,
        winnerId: this.winner,
        method: this.method,
        discarderId: this.method === 'ron' ? this.discarder : undefined,
        winningTileId: this.winningId,
        replacement: this.replacement,
        robbed:
          this.method === 'ron' && (this.flags.chankan || this.robbed !== 'kakan')
            ? this.robbed
            : undefined,
        firstTurnUninterrupted: this.firstTurn,
      },
      honba: this.honba,
      riichiSticks: (this.book?.table ?? 0) / 1000,
      doraIndicators: parseTiles(this.doraText, 'dora'),
      uraIndicators: parseTiles(this.uraText, 'ura'),
      otherPlayerKans: this.otherKans,
      waremePlayerId: this.waremePlayerId || undefined,
    };
  }
  calculate(): void {
    this.beginAction('score');
    try {
      this.error.set('');
      const input = this.input();
      this.result.set(score(input));
      this.resultFingerprint = JSON.stringify(input);
    } catch (e) {
      this.result.set(null);
      this.error.set(this.message(e));
    }
  }
  async settle(): Promise<void> {
    this.beginAction('settlement');
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const match = this.match();
      if (!match) throw new Error('Create a match to save settlements.');
      const input = this.input();
      if (this.resultFingerprint !== JSON.stringify(input))
        throw new Error('Inputs changed; calculate again.');
      const result = score(input);
      if (!result.isValid) throw new Error('Invalid hands cannot be settled.');
      if (this.queued.length)
        throw new Error('Settle or remove the queued Ron winners before a single-hand settlement.');
      const round: RoundSettlement = {
        isValid: true,
        errors: [],
        outcome: 'win',
        payments: result.payments,
        playerDeltas: result.playerDeltas,
        winnerIds: [input.win.winnerId],
        dealerRepeats: input.win.winnerId === this.dealer,
        results: [result],
      };
      const updated = settleRound(
        match,
        {
          id: this.eventId,
          type: 'win',
          timestamp: new Date().toISOString(),
          payments: result.payments,
          result,
          hand: structuredClone(input.hand),
          win: input.win,
          roundWind: this.roundWind,
          scoringInput: structuredClone(input),
          chipDeltas: handChips(input, result),
        },
        round,
        {
          dealerId: this.dealer,
          roundWind: this.roundWind,
          handNumber: this.handNumber,
          honba: this.honba,
        },
      );
      await this.repo.save(updated, match.updatedAt);
      this.match.set(updated);
      this.eventId = newId();
      this.waremePlayerId = '';
      this.dealer = updated.dealerId;
      this.roundWind = updated.roundWind;
      this.honba = updated.honba;
      this.handNumber = updated.handNumber;
      this.resetHand();
      await this.draftQueue;
      await this.repo.clearDraft(match.id);
      this.notice.set('Settlement saved. Dealer, round and honba have been updated.');
      this.tab = 'history';
    } catch (e) {
      this.errorArea.set('settlement');
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  async deposit(): Promise<void> {
    this.beginAction('escrow');
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const match = this.match();
      if (!match) return;
      if (match.ended) throw new Error('This match has ended. Undo its last event to reopen it.');
      let lastWin = -1;
      match.events.forEach((event, index) => {
        if (event.type !== 'riichiDeposit') lastWin = index;
      });
      if (
        match.events
          .slice(lastWin + 1)
          .some(
            (e) =>
              e.type === 'riichiDeposit' && e.payments.some((p) => p.from === this.depositPlayer),
          )
      )
        throw new Error('This player has already deposited in the current hand.');
      if (
        !tableRules(match.rules).allowNegativeRiichi &&
        (this.book?.players[this.depositPlayer] ?? 0) < 1000
      )
        throw new Error('Not enough points for a Riichi deposit.');
      const updated = appendEvent(match, {
        id: newId(),
        type: 'riichiDeposit',
        timestamp: new Date().toISOString(),
        payments: [
          { from: this.depositPlayer, to: 'table', amount: 1000, reason: 'Riichi deposit' },
        ],
      });
      await this.repo.save(updated, match.updatedAt);
      this.match.set(updated);
      this.changed();
      this.notice.set('1,000 points moved into table escrow.');
    } catch (e) {
      this.errorArea.set('escrow');
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  async undoSettlement(): Promise<void> {
    this.beginAction('history');
    const match = this.match();
    if (!match || this.busy()) return;
    if (!confirm(this.i18n.t('Undo the latest ledger event and restore its points?'))) return;
    this.busy.set(true);
    try {
      const updated = undoLastEvent(match);
      await this.repo.save(updated, match.updatedAt);
      this.match.set(updated);
      this.dealer = updated.dealerId;
      this.roundWind = updated.roundWind;
      this.handNumber = updated.handNumber;
      this.honba = updated.honba;
      this.changed();
      this.notice.set('Last event undone. Enter a corrected hand if needed.');
    } catch (e) {
      this.errorArea.set('history');
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  exportMatch(): void {
    const match = this.match();
    if (!match) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(match, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `riichi-${match.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  get openMeldCount(): number {
    return this.melds.filter((meld) => meld.type !== 'ankan').length;
  }
  get concealedKanCount(): number {
    return this.melds.filter((meld) => meld.type === 'ankan').length;
  }
  readonly assignmentDialog = viewChild<ElementRef<HTMLDialogElement>>('assignmentDialog');
  readonly assignmentOpen = signal(false);
  openAssignment(): void {
    this.beginAction('assignment');
    this.assignmentOpen.set(true);
    this.assignmentDialog()?.nativeElement.showModal();
  }
  closeAssignment(): void {
    this.assignmentOpen.set(false);
    this.assignmentDialog()?.nativeElement.close();
  }
  assignSelectedToZone(target: TileDropTarget): void {
    const index = this.tiles.findIndex((tile) => this.selectedHandTiles().includes(tile.id));
    if (index >= 0) this.dropHandTile({ index, target });
  }
  dropHandTile({ index, target }: { index: number; target: string }): void {
    if (!['meld', 'ankan', 'kita'].includes(target) || !this.tiles[index]) return;
    const tile = this.tiles[index];
    const assignment = target === 'meld' ? 'pon' : (target as 'ankan' | 'kita');
    let ids = this.selectedHandTiles().includes(tile.id) ? this.selectedHandTiles() : [tile.id];
    if (ids.length === 1 && assignment !== 'kita') {
      const matching = this.tiles.filter(
        (candidate) => kindIndex(candidate.kind) === kindIndex(tile.kind),
      );
      const required = assignment === 'pon' ? 3 : 4;
      if (matching.length === required || (target === 'meld' && matching.length === 4)) {
        ids = matching.map((candidate) => candidate.id);
        this.calledIndex = ids.indexOf(tile.id);
      }
    }
    this.selectedHandTiles.set(ids);
    this.selectAssignment(assignment);
    if (target === 'meld') {
      if (ids.length === 4) this.selectAssignment('daiminkan');
      else if (
        this.selectedTiles.some((candidate) => kindIndex(candidate.kind) !== kindIndex(tile.kind))
      )
        this.selectAssignment('chi');
      this.openAssignment();
      return;
    }
    this.groupHandTiles();
    if (this.error()) this.errorArea.set('drop:' + target);
  }
  readonly assignmentTarget = signal<AssignmentTarget>('pon');
  readonly selectedHandTiles = signal<string[]>([]);
  get selectedTiles(): Tile[] {
    return this.tiles.filter((tile) => this.selectedHandTiles().includes(tile.id));
  }
  removeSelectedTiles(): void {
    if (!this.selectedTiles.length) return;
    this.remember();
    this.tiles = this.tiles.filter((tile) => !this.selectedHandTiles().includes(tile.id));
    if (!this.tiles.some((tile) => tile.id === this.winningId))
      this.winningId = this.tiles.at(-1)?.id ?? '';
    this.selectedHandTiles.set([]);
    this.editStatus();
  }
  groupHandTiles(): void {
    this.beginAction('assignment');
    const selected = this.tiles.filter((tile) => this.selectedHandTiles().includes(tile.id));
    const target = this.assignmentTarget();
    if (!selected.length) return;
    if (target === 'kita') {
      if (
        this.rules.playerCount !== 3 ||
        this.kita.length + selected.length > 4 ||
        selected.some((tile) => kindIndex(tile.kind) !== 30)
      ) {
        this.error.set('Extracted tiles must contain only North, up to four tiles.');
        return;
      }
    } else {
      if (
        ['ankan', 'daiminkan'].includes(target) &&
        this.otherKans + this.melds.filter((meld) => !['chi', 'pon'].includes(meld.type)).length >=
          4
      ) {
        this.error.set(
          'The table can contain at most four Kans; enter a valid other-player Kan count.',
        );
        return;
      }
      const kinds = selected.map((tile) => kindIndex(tile.kind)).sort((a, b) => a - b);
      const validShape =
        target === 'chi'
          ? kinds[0] < 27 &&
            Math.floor(kinds[0] / 9) === Math.floor(kinds[2] / 9) &&
            kinds[1] === kinds[0] + 1 &&
            kinds[2] === kinds[0] + 2
          : kinds.every((kind) => kind === kinds[0]);
      if (!validShape || this.melds.length >= 4) {
        this.error.set(
          'Select a valid sequence for Chi or matching tiles for Pon/Kan, with at most four melds.',
        );
        return;
      }
      if (selected.length !== (target === 'chi' || target === 'pon' ? 3 : 4)) {
        this.error.set('Enter three tiles for Chi/Pon or four for Kan.');
        return;
      }
      if (target === 'chi' && this.rules.playerCount === 3) {
        this.error.set('Chi is prohibited in Sanma.');
        return;
      }
      if (target !== 'ankan' && !this.meldSources.some((player) => player.id === this.source)) {
        this.error.set(
          target === 'chi'
            ? 'Chi must come from the preceding player.'
            : 'A called meld needs another seated source player.',
        );
        return;
      }
      if (
        target !== 'ankan' &&
        (this.calledIndex < 0 ||
          this.calledIndex >= selected.length ||
          !Number.isInteger(this.calledIndex))
      ) {
        this.error.set('Select a called tile within the meld.');
        return;
      }
    }
    this.remember();
    if (target === 'kita') this.kita = [...this.kita, ...selected];
    else
      this.melds = [
        ...this.melds,
        {
          id: newId(),
          type: target,
          tiles: selected,
          callOrder: Math.max(0, ...this.melds.map((meld) => meld.callOrder ?? 0)) + 1,
          ...(target === 'ankan'
            ? {}
            : { fromPlayerId: this.source, calledTileId: selected[this.calledIndex].id }),
        },
      ];
    this.tiles = this.tiles.filter((tile) => !this.selectedHandTiles().includes(tile.id));
    if (!this.tiles.some((tile) => tile.id === this.winningId))
      this.winningId = this.tiles.at(-1)?.id ?? '';
    this.selectedHandTiles.set([]);
    this.editStatus();
    this.closeAssignment();
  }
  applyWorkspacePhoto(tiles: Tile[]): void {
    this.remember();
    this.tiles = tiles.map((tile) => ({ ...tile, id: newId() }));
    this.melds = [];
    this.kita = [];
    this.selectedHandTiles.set([]);
    this.winningId = this.tiles.at(-1)?.id ?? '';
    this.editStatus();
  }
  tileClass(t: Tile): string {
    return t.isRed || kindIndex(t.kind) === 33
      ? 'red-ink'
      : kindIndex(t.kind) === 32
        ? 'green-ink'
        : '';
  }
  private message(e: unknown): string {
    return e instanceof Error
      ? e.message
      : 'Something went wrong. Your last saved match is unchanged.';
  }
  queueRon(): void {
    this.beginAction('queued');
    try {
      if (this.method !== 'ron') throw new Error('Select Ron before adding a winner.');
      if (this.queued.some((i) => i.win.winnerId === this.winner))
        throw new Error('This winner is already queued.');
      const input = this.input();
      const result = score(input);
      if (!result.isValid) {
        this.result.set(result);
        return;
      }
      const dora = this.doraText;
      this.queued.push(structuredClone(input));
      this.resetHand();
      this.doraText = dora;
      this.changed();
      this.notice.set(
        'Ron hand added. Select the next winner and enter their hand, or review all winners.',
      );
    } catch (e) {
      this.error.set(this.message(e));
    }
  }
  removeQueued(id: string): void {
    this.queued = this.queued.filter((i) => i.win.winnerId !== id);
    this.changed();
  }
  calculateQueued(): void {
    this.beginAction('queued');
    this.error.set('');
    this.roundResult.set(
      multipleRon(this.queued.map((i) => ({ ...i, riichiSticks: (this.book?.table ?? 0) / 1000 }))),
    );
  }
  calculateDraw(): void {
    this.beginAction('draw');
    this.error.set('');
    this.roundResult.set(drawSettlement(this.drawInput()));
  }
  private drawInput(): DrawInput {
    return {
      rules: this.rules,
      players: this.players,
      dealerId: this.dealer,
      honba: this.honba,
      type: this.drawType,
      tenpaiIds: this.players.filter((p) => this.tenpai[p.id]).map((p) => p.id),
      nagashiIds: this.players.filter((p) => this.nagashi[p.id]).map((p) => p.id),
      circumstancesConfirmed: this.drawConfirmed,
      reason: this.drawType === 'abortive' ? this.abortiveReason : undefined,
    };
  }
  async confirmRound(): Promise<void> {
    this.beginAction('round');
    if (this.busy() || !this.roundResult()?.isValid) return;
    this.busy.set(true);
    try {
      const match = this.match();
      if (!match) throw new Error('Create a match to save settlements.');
      const inputs = this.queued.map((i) => ({
        ...i,
        riichiSticks: (this.book?.table ?? 0) / 1000,
      }));
      const round = this.tab === 'draw' ? drawSettlement(this.drawInput()) : multipleRon(inputs);
      if (!round.isValid) throw new Error(round.errors.join(' '));
      const first = inputs[0];
      const event: LedgerEvent = {
        id: this.eventId,
        timestamp: new Date().toISOString(),
        type:
          this.tab === 'draw'
            ? round.outcome === 'nagashi'
              ? 'nagashi'
              : round.outcome === 'abortiveDraw'
                ? 'abortiveDraw'
                : 'exhaustiveDraw'
            : round.outcome === 'abortiveDraw'
              ? 'abortiveDraw'
              : 'multipleRon',
        payments: round.payments,
        results: round.results,
        winnerIds: round.winnerIds,
        scoringInputs: this.tab === 'draw' ? undefined : inputs,
        drawInput: this.tab === 'draw' ? this.drawInput() : undefined,
      };
      if (this.tab !== 'draw') {
        event.chipDeltas = Object.fromEntries(this.players.map((player) => [player.id, 0]));
        round.winnerIds.forEach((id, index) => {
          const input = inputs.find((input) => input.win.winnerId === id);
          if (input && round.results[index])
            for (const [player, chips] of Object.entries(handChips(input, round.results[index])))
              event.chipDeltas![player] += chips;
        });
      }
      const context =
        this.tab !== 'draw' && first
          ? {
              dealerId: first.dealerId,
              roundWind: first.roundWind,
              honba: first.honba,
              handNumber: this.handNumber,
            }
          : {
              dealerId: this.dealer,
              roundWind: this.roundWind,
              honba: this.honba,
              handNumber: this.handNumber,
            };
      const updated = settleRound(match, event, round, context);
      await this.repo.save(updated, match.updatedAt);
      this.match.set(updated);
      this.dealer = updated.dealerId;
      this.roundWind = updated.roundWind;
      this.honba = updated.honba;
      this.handNumber = updated.handNumber;
      this.eventId = newId();
      this.waremePlayerId = '';
      this.queued = [];
      this.resetHand();
      this.drawConfirmed = false;
      this.tenpai = {};
      this.nagashi = {};
      await this.draftQueue;
      await this.repo.clearDraft(match.id);
      this.tab = 'history';
      this.notice.set('Settlement saved. Dealer, round and honba have been updated.');
    } catch (e) {
      this.errorArea.set('round');
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }
}
