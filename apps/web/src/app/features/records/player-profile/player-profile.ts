import { ResponsiveSheet } from '../../../shared/responsive-sheet';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18n, TranslatePipe } from '../../../core/i18n/i18n';
import { LocalDatePipe } from '../../../core/i18n/local-date';
import { ErrorNotice } from '../../../shared/error-notice/error-notice';
import { DialogBackdrop } from '../../../shared/dialog-backdrop';
import { Repository } from '../../matches/data-access/repository';
import type { Match } from '../../../../../../../packages/mahjong-core/ledger';
import {
  analyzePlayer,
  analysisGroups,
  type AnalysisMetric,
  type GameSample,
} from './player-analysis';
import { leagueResemblance, mLeagueReference } from './m-league-reference';
import { playerIdentities, playerIdentity, identityLabel } from '../player-identity';
import { PlayerLibrary } from '../../matches/data-access/player-library';

@Component({
  imports: [ResponsiveSheet, RouterLink, TranslatePipe, LocalDatePipe, ErrorNotice, DialogBackdrop],
  templateUrl: './player-profile.html',
  styleUrl: './player-profile.css',
})
export class PlayerProfile {
  private readonly route = inject(ActivatedRoute);
  private readonly repo = inject(Repository);
  readonly i18n = inject(I18n);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly playerLibrary = inject(PlayerLibrary);
  readonly identities = computed(() =>
    playerIdentities(this.matches(), this.playerLibrary.players()),
  );
  readonly identity = computed(() => {
    const value = this.params().get('name') ?? '';
    if (this.identities().some((player) => player.id === value)) return value;
    const legacy = this.identities().filter((player) => player.name === value);
    return legacy.length === 1 ? legacy[0].id : value;
  });
  readonly name = computed(
    () =>
      this.identities().find((player) => player.id === this.identity())?.name ??
      this.params().get('name') ??
      '',
  );
  identityLabel(player: { id: string; name: string }): string {
    const current = this.identities().find((person) => person.id === player.id) ?? player;
    return identityLabel(current, this.identities());
  }
  readonly matches = signal<Match[]>([]);
  readonly error = signal('');
  readonly loading = signal(true);
  readonly count = signal<3 | 4>(
    this.route.snapshot.queryParamMap.get('mode')?.startsWith('3') ? 3 : 4,
  );
  readonly length = signal(this.route.snapshot.queryParamMap.get('mode')?.split('-')[1] ?? '');
  readonly from = signal(this.route.snapshot.queryParamMap.get('from') ?? '');
  readonly to = signal(this.route.snapshot.queryParamMap.get('to') ?? '');
  readonly invalidDates = computed(() => !!this.from() && !!this.to() && this.from() > this.to());
  readonly filterDraft = signal({ from: '', to: '', length: '' });
  readonly invalidDraftDates = computed(
    () =>
      !!this.filterDraft().from &&
      !!this.filterDraft().to &&
      this.filterDraft().from > this.filterDraft().to,
  );
  openFilters(dialog: HTMLDialogElement): void {
    this.filterDraft.set({ from: this.from(), to: this.to(), length: this.length() });
    dialog.showModal();
  }
  updateFilter(event: Event, key: 'from' | 'to' | 'length'): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.filterDraft.update((draft) => ({ ...draft, [key]: value }));
  }
  applyFilters(dialog: HTMLDialogElement): void {
    if (this.invalidDraftDates()) return;
    const draft = this.filterDraft();
    this.from.set(draft.from);
    this.to.set(draft.to);
    this.length.set(draft.length);
    this.compare.set('');
    this.opponent.set('');
    dialog.close();
  }
  readonly tab = signal<'overview' | 'stats' | 'explore'>('overview');
  readonly tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'stats', label: 'Statistics' },
    { key: 'explore', label: 'Explore' },
  ] as const;
  readonly compare = signal('');
  readonly opponent = signal('');
  readonly groups = analysisGroups;
  readonly seats = ['East seat', 'South seat', 'West seat', 'North seat'];
  readonly reference = mLeagueReference;
  readonly scoped = computed(() =>
    this.invalidDates()
      ? []
      : this.matches().filter((match) => {
          const date = new Date(match.createdAt);
          const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          return (
            (!this.from() || day >= this.from()) &&
            (!this.to() || day <= this.to()) &&
            (!this.length() || (match.gameLength ?? 'south') === this.length())
          );
        }),
  );
  readonly analysis = computed(() => analyzePlayer(this.scoped(), this.identity(), this.count()));
  readonly comparison = computed(() =>
    this.compare() ? analyzePlayer(this.scoped(), this.compare(), this.count()) : null,
  );
  readonly peers = computed(() =>
    playerIdentities(this.scoped().filter((match) => match.playerCount === this.count())).filter(
      (player) => player.id !== this.identity(),
    ),
  );
  readonly chemistry = computed(() =>
    this.analysis().chemistry.filter((row) => !this.opponent() || row.id === this.opponent()),
  );
  readonly sharedGames = computed(() =>
    this.analysis()
      .games.filter(
        (game) =>
          !this.opponent() ||
          game.match.players.some(
            (player) => playerIdentity(game.match, player) === this.opponent(),
          ),
      )
      .slice()
      .reverse(),
  );
  readonly resemblance = computed(() => leagueResemblance(this.analysis()));
  readonly scoredWins = computed(() =>
    this.analysis().distribution.reduce((total, bin) => total + bin.count, 0),
  );
  readonly backQuery = computed(() => ({
    view: 'players',
    from: this.from(),
    to: this.to(),
    mode: this.length() ? `${this.count()}-${this.length()}` : '',
  }));
  readonly tendency = [
    { key: 'open', label: 'Open hand rate' },
    { key: 'riichi', label: 'Riichi rate' },
    { key: 'win', label: 'Win rate' },
    { key: 'deal', label: 'Deal-in rate' },
  ];
  readonly comparisonFields = [
    { key: 'averageRank', label: 'Average rank' },
    { key: 'averageScore', label: 'Average score' },
    { key: 'win', label: 'Win rate' },
    { key: 'deal', label: 'Deal-in rate' },
  ];
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    try {
      const matches = (await this.repo.list()).filter((match) => match.ended);
      this.matches.set(matches);
      const requested = this.params().get('name') ?? '';
      if (
        !this.identities().some((player) => player.id === requested) &&
        this.identities().filter((player) => player.name === requested).length > 1
      )
        this.error.set('Several players share this name. Select a player from Records.');
      if (!this.route.snapshot.queryParamMap.get('mode')) {
        const own = matches.filter((match) =>
          match.players.some((player) => playerIdentity(match, player) === this.identity()),
        );
        this.count.set(
          own.some((match) => match.playerCount === 4)
            ? 4
            : own.some((match) => match.playerCount === 3)
              ? 3
              : 4,
        );
      }
    } catch {
      this.error.set('Could not load match.');
    } finally {
      this.loading.set(false);
    }
  }
  setCount(count: 3 | 4): void {
    this.count.set(count);
    this.compare.set('');
    this.opponent.set('');
  }
  setValue(event: Event, field: 'from' | 'to' | 'length' | 'compare' | 'opponent'): void {
    this[field].set((event.target as HTMLInputElement | HTMLSelectElement).value);
  }
  format(value: number | null | undefined, format: AnalysisMetric['format'] = 'number'): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '\u2014';
    return new Intl.NumberFormat(
      this.i18n.locale(),
      format === 'percent'
        ? { style: 'percent', maximumFractionDigits: 1 }
        : {
            maximumFractionDigits: format === 'points' ? 0 : 2,
            minimumFractionDigits: format === 'money' ? 2 : 0,
          },
    ).format(value);
  }
  rankLine(games: GameSample[]): string {
    return games
      .slice(-16)
      .map(
        (game, index, items) =>
          `${40 + (index / Math.max(1, items.length - 1)) * 620},${30 + ((game.rank - 1) / (this.count() - 1)) * 150}`,
      )
      .join(' ');
  }
  rankX(index: number, count: number): number {
    return 40 + (index / Math.max(1, count - 1)) * 620;
  }
  rankY(rank: number): number {
    return 30 + ((rank - 1) / (this.count() - 1)) * 150;
  }
  bar(count: number, total: number): number {
    return total ? (count / total) * 100 : 0;
  }
  scoreBin(lower: number, upper: number): string {
    return Number.isFinite(upper)
      ? `${this.format(lower, 'points')}\u2013${this.format(upper - 1, 'points')}`
      : `${this.format(lower, 'points')}+`;
  }
}
