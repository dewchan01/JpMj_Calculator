import { SignedValue } from '../../shared/signed-value/signed-value';
import { ResponsiveSheet } from '../../shared/responsive-sheet';
import { DialogBackdrop } from '../../shared/dialog-backdrop';
import { Component, computed, inject, signal, viewChild, ElementRef } from '@angular/core';
import { DecimalPipe, KeyValuePipe } from '@angular/common';
import { LocalDatePipe } from '../../core/i18n/local-date';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Repository } from '../matches/data-access/repository';
import { I18n, TranslatePipe } from '../../core/i18n/i18n';
import { ErrorNotice } from '../../shared/error-notice/error-notice';
import { finalStandings } from '../../../../../../packages/mahjong-core/final-results';
import type { Match } from '../../../../../../packages/mahjong-core/ledger';
import { ruleName, tableRules } from '../../../../../../packages/mahjong-rules/index';
import { durationMinutes, filterMatches, playerRecords } from './record-stats';

@Component({
  imports: [
    SignedValue,
    ResponsiveSheet,
    DialogBackdrop,
    LocalDatePipe,
    DecimalPipe,
    KeyValuePipe,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    ErrorNotice,
  ],
  templateUrl: './records.html',
  styleUrl: './records.css',
})
export class Records {
  private readonly route = inject(ActivatedRoute);
  private readonly repo = inject(Repository);
  readonly i18n = inject(I18n);
  readonly matches = signal<Match[]>([]);
  readonly error = signal('');
  readonly loading = signal(true);
  readonly view = signal<'games' | 'players'>(
    this.route.snapshot.queryParamMap.get('view') === 'players' ? 'players' : 'games',
  );
  readonly modes = [
    { value: '', label: 'All modes' },
    { value: '4-east', label: '4P East-only' },
    { value: '4-south', label: '4P East and South' },
    { value: '3-east', label: '3P East-only' },
    { value: '3-south', label: '3P East and South' },
  ];
  readonly filters = new FormGroup({
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    mode: new FormControl('', { nonNullable: true }),
    participant: new FormControl('', { nonNullable: true }),
  });
  readonly filterDialog = viewChild.required<ElementRef<HTMLDialogElement>>('filterDialog');
  readonly filterDraft = new FormGroup({
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    participant: new FormControl('', { nonNullable: true }),
  });
  private readonly draftChanges = toSignal(this.filterDraft.valueChanges, {
    initialValue: this.filterDraft.getRawValue(),
  });
  readonly invalidDraftDates = computed(() => {
    const { from, to } = this.draftChanges();
    return !!from && !!to && from > to;
  });
  readonly activeFilterCount = computed(() => Object.values(this.changes()).filter(Boolean).length);
  openFilters(): void {
    const { from, to, participant } = this.filters.getRawValue();
    this.filterDraft.setValue({ from, to, participant });
    this.filterDialog().nativeElement.showModal();
  }
  applyFilters(): void {
    if (this.invalidDraftDates()) return;
    this.filters.patchValue(this.filterDraft.getRawValue());
    this.filterDialog().nativeElement.close();
  }
  private readonly changes = toSignal(this.filters.valueChanges, {
    initialValue: this.filters.getRawValue(),
  });
  readonly gameSort = new FormControl('newest', { nonNullable: true });
  private readonly gameOrder = toSignal(this.gameSort.valueChanges, { initialValue: 'newest' });
  readonly playerSort = new FormControl('name', { nonNullable: true });
  private readonly playerOrder = toSignal(this.playerSort.valueChanges, { initialValue: 'name' });
  readonly currency = new FormControl('', { nonNullable: true });
  private readonly moneyCurrency = toSignal(this.currency.valueChanges, { initialValue: '' });
  readonly participants = computed(() =>
    [...new Set(this.matches().flatMap((m) => m.players.map((p) => p.name.trim())))].sort((a, b) =>
      a.localeCompare(b),
    ),
  );
  readonly invalidDates = computed(() => {
    const { from, to } = this.changes();
    return !!from && !!to && from > to;
  });
  readonly filtered = computed(() => {
    const f = this.changes();
    return this.invalidDates()
      ? []
      : filterMatches(this.matches(), {
          from: f.from ?? '',
          to: f.to ?? '',
          mode: f.mode ?? '',
          participant: f.participant ?? '',
        });
  });
  readonly games = computed(() =>
    this.filtered()
      .map((match) => {
        const rows = finalStandings(match);
        const latestHand = [...match.events]
          .reverse()
          .find((event) =>
            ['win', 'multipleRon', 'exhaustiveDraw', 'abortiveDraw', 'nagashi'].includes(
              event.type,
            ),
          );
        const profile =
          latestHand?.scoringInput?.rules ??
          latestHand?.scoringInputs?.[0]?.rules ??
          latestHand?.drawInput?.rules ??
          match.rules;
        return {
          match,
          ruleLabel:
            profile.preset === 'custom' && profile.name
              ? profile.name
              : this.i18n.t(ruleName(profile)),
          rows,
          latestRound: latestHand?.before ?? null,
          totals: rows.reduce(
            (total, row) => ({
              points: total.points + row.points,
              score: total.score + row.finalScore,
              money: total.money + row.totalMoney,
            }),
            { points: 0, score: 0, money: 0 },
          ),
          minutes: durationMinutes(match),
          currency: tableRules(match.rules).currency,
        };
      })
      .sort(
        (a, b) =>
          (Date.parse(a.match.createdAt) - Date.parse(b.match.createdAt)) *
            (this.gameOrder() === 'oldest' ? 1 : -1) || a.match.id.localeCompare(b.match.id),
      ),
  );
  readonly completed = computed(() => this.filtered().filter((m) => m.ended).length);
  readonly currencies = computed(() =>
    [
      ...new Set(
        this.matches()
          .filter((m) => m.ended)
          .map((m) => tableRules(m.rules).currency),
      ),
    ].sort(),
  );
  readonly players = computed(() => {
    const f = this.changes();
    const rows = playerRecords(this.filtered()).filter(
      (p) => !f.participant || p.name === f.participant,
    );
    const selected = this.moneyCurrency();
    const currency = this.currencies().includes(selected) ? selected : (this.currencies()[0] ?? '');
    return rows.sort((a, b) => {
      const order = this.playerOrder();
      const comparison =
        order === 'games'
          ? b.games - a.games
          : order === 'rank'
            ? a.averageRank - b.averageRank
            : order === 'points'
              ? b.points - a.points
              : order === 'score'
                ? b.score - a.score
                : order === 'money'
                  ? (b.money[currency] ?? 0) - (a.money[currency] ?? 0)
                  : 0;
      return comparison || a.name.localeCompare(b.name, this.i18n.locale());
    });
  });
  constructor() {
    const query = this.route.snapshot.queryParamMap;
    this.filters.patchValue({
      from: query.get('from') ?? '',
      to: query.get('to') ?? '',
      mode: query.get('mode') ?? '',
    });
    void this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.matches.set((await this.repo.list()).filter((match) => match.ended));
      if (!this.currencies().includes(this.currency.value))
        this.currency.setValue(this.currencies()[0] ?? '');
    } catch {
      this.error.set('Local storage is unavailable. Enable browser storage to save matches.');
    } finally {
      this.loading.set(false);
    }
  }
  reset(): void {
    this.filters.reset({ from: '', to: '', mode: '', participant: '' });
  }
}
