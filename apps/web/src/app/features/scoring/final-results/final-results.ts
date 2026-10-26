import { Component, computed, input, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Repository } from '../../matches/data-access/repository';
import { MatchHistory } from '../match-history/match-history';
import { I18n } from '../../../core/i18n/i18n';
import { matchStatistics, type PlayerStatistics } from './match-statistics';
import { playerColors, statisticFields, statisticText, statisticsImage } from './statistics-image';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '../../../core/i18n/i18n';
import type { Match } from '../../../../../../../packages/mahjong-core/ledger';
import { finalStandings } from '../../../../../../../packages/mahjong-core/final-results';
import { tableRules } from '../../../../../../../packages/mahjong-rules/index';

@Component({
  selector: 'app-final-results',
  imports: [DecimalPipe, TranslatePipe, MatchHistory],
  templateUrl: './final-results.html',
  styleUrl: './final-results.css',
})
export class FinalResults {
  readonly view = signal<'table' | 'list' | 'statistics' | 'history'>('table');
  readonly views = ['table', 'list', 'statistics', 'history'] as const;
  readonly viewLabels = {
    table: 'Table',
    list: 'List',
    statistics: 'Statistics',
    history: 'History',
  };
  readonly selected = signal('');
  readonly confirmDiscard = signal(false);
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly i18n = inject(I18n);
  private readonly repo = inject(Repository);
  private readonly router = inject(Router);
  readonly fields = statisticFields;
  readonly colors = playerColors;
  readonly statistics = computed(() => matchStatistics(this.match()));
  readonly plotted = computed(() =>
    this.match().players.filter((player) => !this.selected() || player.id === this.selected()),
  );
  readonly visiblePlayers = computed(() =>
    this.statistics()
      .players.filter((player) => !this.selected() || player.id === this.selected())
      .sort((a, b) => this.rank(a.id) - this.rank(b.id)),
  );
  readonly range = computed(() => {
    const values = this.statistics().points.flatMap((point) => Object.values(point.balances));
    return { min: Math.min(...values) - 1000, max: Math.max(...values) + 1000 };
  });
  x(index: number): number {
    return 70 + (index / Math.max(1, this.statistics().points.length - 1)) * 630;
  }
  y(points: number): number {
    return 250 - ((points - this.range().min) / (this.range().max - this.range().min)) * 220;
  }
  line(id: string): string {
    return this.statistics()
      .points.map((point, index) => this.x(index) + ',' + this.y(point.balances[id]))
      .join(' ');
  }
  color(id: string): string {
    return this.colors[this.match().players.findIndex((player) => player.id === id)];
  }
  rank(id: string): number {
    return this.rows().find((row) => row.id === id)?.rank ?? 0;
  }
  value(player: PlayerStatistics, field: (typeof statisticFields)[number]): string {
    return statisticText(player[field.key], field.format, this.i18n.locale());
  }
  async shareImage(): Promise<void> {
    this.busy.set(true);
    this.notice.set('');
    try {
      const blob = await statisticsImage(
        this.match(),
        this.rows(),
        this.statistics().players,
        this.statistics().points,
        (key) => this.i18n.t(key),
        this.i18n.locale(),
        this.view() === 'statistics' || this.view() === 'list' ? this.selected() : '',
      );
      const file = new File([blob], 'mahjong-results.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: this.match().name });
      else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        this.notice.set('Could not export image.');
    } finally {
      this.busy.set(false);
    }
  }
  async keepGame(): Promise<void> {
    this.busy.set(true);
    try {
      await this.repo.save(this.match(), this.match().updatedAt);
      await this.router.navigateByUrl('/records');
    } catch {
      this.notice.set('Could not save match.');
    } finally {
      this.busy.set(false);
    }
  }
  async discardGame(): Promise<void> {
    this.busy.set(true);
    try {
      await this.repo.remove(this.match().id);
      await this.router.navigateByUrl('/');
    } catch {
      this.notice.set('Could not delete match.');
    } finally {
      this.busy.set(false);
    }
  }
  readonly match = input.required<Match>();
  readonly rows = computed(() => finalStandings(this.match()));
  readonly settings = computed(() => tableRules(this.match().rules));
}
