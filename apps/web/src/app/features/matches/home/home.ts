import { DialogBackdrop, closeDialogGroup } from '../../../shared/dialog-backdrop';
import { DateTimeField } from '../../../shared/date-time-field/date-time-field';
import { Online } from '../../online/online';
import { ruleName } from '../../../../../../../packages/mahjong-rules/index';
import { TileArt } from '../../../shared/tile-art/tile-art';
import { parseTiles } from '../../../../../../../packages/mahjong-core/index';
import { newId } from '../../../core/id/new-id';
import { TableSetup } from '../table-setup';
import { RuleLibrary } from '../../settings/rule-library';
import { ErrorNotice } from '../../../shared/error-notice/error-notice';
import { InstallBanner } from '../install-banner/install-banner';
import { I18n, TranslatePipe } from '../../../core/i18n/i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { applyEach, form, FormField, maxLength } from '@angular/forms/signals';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { type Match } from '../../../../../../../packages/mahjong-core/ledger';
import { RulePicker } from '../../../shared/rules/rule-picker/rule-picker';
import { Repository } from '../data-access/repository';
import { PlayerLibrary } from '../data-access/player-library';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DiceSimulator } from '../../../shared/dice-simulator/dice-simulator';
import { emptyLive } from '../../../../../../../packages/mahjong-core/live';
import { adjustFinalPoints } from '../../../../../../../packages/mahjong-core/final-results';
import { localDateTimeInput } from '../../../core/i18n/date-format';
@Component({
  imports: [
    DateTimeField,
    Online,
    TileArt,
    ResponsiveSheet,
    DialogBackdrop,
    ErrorNotice,
    InstallBanner,
    RulePicker,
    TranslatePipe,
    FormField,
    RouterLink,
    DecimalPipe,
    ReactiveFormsModule,
    FormsModule,
    DiceSimulator,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  closeStartFlow(): void {
    closeDialogGroup('start-game');
  }
  readonly sharedMode = signal<'host' | 'join' | ''>('');
  readonly sharedGameId = signal('');
  readonly prepareSharedGame = async (): Promise<string> => {
    await this.create(false, true);
    if (!this.sharedGameId()) throw new Error(this.error() || 'Could not create match.');
    return this.sharedGameId();
  };
  async openShared(mode: 'host' | 'join', dialog: HTMLDialogElement): Promise<void> {
    this.sharedGameId.set('');
    this.sharedMode.set('');
    this.sharedMode.set(mode);
    dialog.showModal();
  }
  gameRuleName(game: Match): string {
    return game.rules.preset === 'custom' && game.rules.name
      ? game.rules.name
      : this.i18n.t(ruleName(game.rules));
  }
  readonly introTiles = parseTiles('1m6z9s', 'intro');
  readonly ongoing = signal<Match[]>([]);
  resultPoints: number[] = [];
  resultDate = '';
  constructor() {
    this.fillSavedPlayers();
    void this.loadOngoing();
  }
  async loadOngoing(): Promise<void> {
    try {
      this.ongoing.set((await this.repo.list()).filter((match) => !match.ended));
    } catch {
      this.error.set('Could not load match.');
    }
  }
  openRecordResults(dialog: HTMLDialogElement): void {
    this.resultPoints = Array(this.count()).fill(this.rules().startingPoints);
    this.error.set('');
    this.resultDate = localDateTimeInput(new Date());
    dialog.showModal();
  }
  readonly pickerSeat = signal<number | null>(null);
  readonly playerSearch = signal('');
  readonly playerFilter = signal<'all' | 'available' | 'seated'>('all');
  readonly playerSort = signal<'asc' | 'desc' | 'newest'>('asc');
  readonly playerLimit = signal(24);
  readonly filteredPlayers = computed(() => {
    const query = this.playerSearch().trim().toLocaleLowerCase();
    const players = this.playerLibrary
      .players()
      .filter((p) => p.name.toLocaleLowerCase().includes(query))
      .filter(
        (p) =>
          this.playerFilter() === 'all' ||
          this.setup().names.slice(0, this.count()).includes(p.name) ===
            (this.playerFilter() === 'seated'),
      );
    if (this.playerSort() === 'newest') return players.reverse();
    const direction = this.playerSort() === 'asc' ? 1 : -1;
    return players.sort(
      (a, b) => direction * a.name.localeCompare(b.name, this.i18n.locale(), { numeric: true }),
    );
  });
  readonly visiblePlayers = computed(() => this.filteredPlayers().slice(0, this.playerLimit()));
  loadMorePlayers(event: Event): void {
    const panel = event.target as HTMLElement;
    if (panel.scrollHeight - panel.scrollTop - panel.clientHeight < 120)
      this.playerLimit.update((limit) => Math.min(this.filteredPlayers().length, limit + 24));
  }
  openPlayers(dialog: HTMLDialogElement, seat: number | null = null): void {
    this.pickerSeat.set(seat);
    this.playerSearch.set('');
    this.playerFilter.set('all');
    this.playerLimit.set(24);
    this.playerError.set('');
    dialog.showModal();
    dialog.querySelector('.player-results')?.scrollTo(0, 0);
  }
  filterPlayers(event: Event): void {
    this.playerSearch.set((event.target as HTMLInputElement).value);
    this.playerLimit.set(24);
  }
  filterSeats(event: Event): void {
    this.playerFilter.set(
      (event.target as HTMLSelectElement).value as 'all' | 'available' | 'seated',
    );
    this.playerLimit.set(24);
  }
  sortPlayers(sort: 'asc' | 'desc' | 'newest'): void {
    this.playerSort.set(sort);
    this.playerLimit.set(24);
  }
  changePlayerSort(event: Event): void {
    const sort = (event.target as HTMLSelectElement).value;
    if (sort === 'asc' || sort === 'desc' || sort === 'newest') this.sortPlayers(sort);
  }
  alreadySeated(name: string): boolean {
    return (
      this.pickerSeat() !== null &&
      this.setup()
        .names.slice(0, this.count())
        .some((other, index) => index !== this.pickerSeat() && other === name)
    );
  }
  selectPlayer(id: string): boolean {
    const index = this.pickerSeat();
    const player = this.playerLibrary.players().find((player) => player.id === id);
    if (index === null || !player) return false;
    if (this.alreadySeated(player.name)) {
      this.playerError.set('Choose a different player for each seat.');
      return false;
    }
    this.setup.update((setup) => ({
      ...setup,
      names: setup.names.map((name, seat) => (seat === index ? player.name : name)),
    }));
    return true;
  }
  swapA = 0;
  swapB = 1;
  readonly diceRequest = signal(0);
  readonly seatNotice = signal('');
  activeNames(): string[] {
    return this.setup()
      .names.slice(0, this.count())
      .map((name, i) => name.trim() || this.i18n.t(`Player ${i + 1}`));
  }
  swapPlayers(): void {
    const names = this.activeNames();
    if (this.swapA === this.swapB || !names[this.swapA] || !names[this.swapB]) return;
    [names[this.swapA], names[this.swapB]] = [names[this.swapB], names[this.swapA]];
    this.setup.update((setup) => ({
      ...setup,
      names: [...names, ...setup.names.slice(this.count())],
    }));
    this.seatNotice.set('Positions swapped.');
  }
  randomizePlayers(): void {
    const names = this.activeNames();
    for (let i = names.length - 1; i > 0; i--) {
      const bytes = new Uint32Array(1),
        limit = Math.floor(0x100000000 / (i + 1)) * (i + 1);
      do {
        crypto.getRandomValues(bytes);
      } while (bytes[0] >= limit);
      const j = bytes[0] % (i + 1);
      [names[i], names[j]] = [names[j], names[i]];
    }
    this.setup.update((setup) => ({
      ...setup,
      names: [...names, ...setup.names.slice(this.count())],
    }));
    this.seatNotice.set('');
  }
  readonly playerError = signal('');
  readonly playerLibrary = inject(PlayerLibrary);
  readonly playerName = new FormControl('', { nonNullable: true });
  readonly renameName = new FormControl('', { nonNullable: true });
  readonly editingPlayer = signal('');
  renamePlayer(dialog: HTMLDialogElement): void {
    this.playerError.set('');
    try {
      const previous = this.playerLibrary
        .players()
        .find((player) => player.id === this.editingPlayer());
      if (!previous) return;
      this.playerLibrary.rename(previous.id, this.renameName.value);
      this.setup.update((setup) => ({
        ...setup,
        names: setup.names.map((name) =>
          name === previous.name ? this.renameName.value.trim() : name,
        ),
      }));
      dialog.close();
    } catch (error) {
      this.playerError.set(error instanceof Error ? error.message : 'Could not save player.');
    }
  }
  addPlayer(dialog?: HTMLDialogElement): void {
    this.playerError.set('');
    try {
      const player = this.playerLibrary.add(this.playerName.value);
      this.playerError.set('');
      if (this.pickerSeat() !== null && !this.selectPlayer(player.id)) return;
      this.playerName.reset();
      this.playerSearch.set('');
      this.playerFilter.set('all');
      this.playerLimit.set(this.playerLibrary.players().length);
      dialog?.close();
    } catch (e) {
      this.playerError.set(e instanceof Error ? e.message : 'Could not save player.');
    }
  }
  readonly removingPlayer = signal<{ id: string; name: string } | null>(null);
  removePlayer(dialog: HTMLDialogElement): void {
    const player = this.removingPlayer();
    if (!player) return;
    this.playerError.set('');
    try {
      this.playerLibrary.remove(player.id);
      this.removingPlayer.set(null);
      dialog.close();
    } catch {
      this.playerError.set('Could not save player.');
    }
  }
  readonly library = inject(RuleLibrary);
  readonly i18n = inject(I18n);
  private readonly repo = inject(Repository);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly seats = ['East', 'South', 'West', 'North'];
  readonly count = signal<3 | 4>(this.library.preferredCount);
  readonly rules = computed(() => this.library.active(this.count()));
  readonly setup = inject(TableSetup).value;
  readonly setupForm = form(this.setup, (fields) => {
    maxLength(fields.name, 80);
    applyEach(fields.names, (name) => maxLength(name, 40));
  });
  setCount(count: 3 | 4): void {
    this.count.set(count);
    this.fillSavedPlayers();
    if (+this.setup().mySeat >= count) this.setup.update((value) => ({ ...value, mySeat: '0' }));
    this.swapA = 0;
    this.swapB = 1;
    this.seatNotice.set('');
  }
  private fillSavedPlayers(): void {
    const players = this.playerLibrary.players();
    this.setup.update((setup) => {
      const names = [...setup.names];
      const used = new Set(names.map((name) => name.trim()).filter(Boolean));
      const available = players.filter((player) => !used.has(player.name));
      for (let seat = 0; seat < this.count(); seat++) {
        if (!names[seat].trim() && available.length) names[seat] = available.shift()!.name;
      }
      return { ...setup, names };
    });
  }
  async create(resultsOnly = false, shared = false): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const rules = structuredClone(this.rules());
      const setup = this.setup();
      if (
        !Number.isInteger(rules.startingPoints) ||
        rules.startingPoints < 1000 ||
        rules.startingPoints > 100000
      )
        throw new Error('Starting points must be an integer between 1,000 and 100,000.');
      const players = setup.names.slice(0, this.count()).map((n, i) => ({
        id: `p${i}`,
        name: n.trim() || this.i18n.t(`Player ${i + 1}`),
        profileId: this.playerLibrary.players().find((p) => p.name === n.trim())?.id ?? newId(),
      }));
      if (new Set(players.map((p) => p.name)).size !== players.length)
        throw new Error('Choose a different player for each seat.');
      const now = new Date().toISOString();
      let match: Match = {
        id: newId(),
        schemaVersion: 1,
        name: setup.name.trim() || this.i18n.t(`${this.count()}P table`),
        createdAt: now,
        updatedAt: now,
        playerCount: this.count(),
        rules,
        players,
        initialBalances: Object.fromEntries(players.map((p) => [p.id, rules.startingPoints])),
        initialDealerId: players[0].id,
        dealerId: players[0].id,
        roundWind: 'east',
        handNumber: 1,
        honba: 0,
        events: [],
        live: emptyLive(),
        clock: { elapsedMs: 0, runningSince: shared ? null : now, handStartMs: 0 },
      };
      match.gameLength = rules.preset === 'm-league' ? 'south' : setup.gameLength;
      const mySeat = +setup.mySeat < players.length ? +setup.mySeat : 0;
      localStorage.setItem(
        `riichi-view:${match.id}`,
        JSON.stringify(
          [...players.slice(mySeat), ...players.slice(0, mySeat)].map((player) => player.id),
        ),
      );
      if (resultsOnly) {
        const date = new Date(this.resultDate);
        if (!Number.isFinite(date.getTime())) throw new Error('Enter a valid game date.');
        match = adjustFinalPoints(
          {
            ...match,
            createdAt: date.toISOString(),
            ended: true,
            endReason: 'Results only',
            clock: { elapsedMs: 0, runningSince: null, handStartMs: 0 },
          },
          Object.fromEntries(players.map((player, index) => [player.id, this.resultPoints[index]])),
          newId(),
          now,
        );
      }
      await this.repo.save(match);
      if (shared) {
        this.sharedGameId.set(match.id);
        await this.loadOngoing();
        return;
      }
      await this.router.navigate([resultsOnly ? '/records' : '/score', match.id]);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not create match.');
    } finally {
      this.busy.set(false);
    }
  }
}
import { ResponsiveSheet } from '../../../shared/responsive-sheet';
