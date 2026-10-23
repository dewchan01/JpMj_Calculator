import { TileArt } from '../../../shared/tile-art/tile-art';
import { Component, computed, inject, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { tileLabel } from '../../../../../../../packages/mahjong-core/index';
import { type Match, type LedgerEvent } from '../../../../../../../packages/mahjong-core/ledger';
import { ruleName, type RuleProfile } from '../../../../../../../packages/mahjong-rules/index';
import { I18n, TranslatePipe } from '../../../core/i18n/i18n';
@Component({
  selector: 'app-match-history',
  imports: [TileArt, DatePipe, DecimalPipe, TranslatePipe],
  templateUrl: './match-history.html',
})
export class MatchHistory {
  readonly match = input.required<Match | null>();
  readonly rules = input.required<RuleProfile>();
  readonly busy = input(false);
  readonly exportRequested = output<void>();
  readonly undoRequested = output<void>();
  readonly events = computed(() => [...(this.match()?.events ?? [])].reverse());
  readonly i18n = inject(I18n);
  readonly labels = tileLabel;
  readonly ruleName = ruleName;
  name(id: string): string {
    return id === 'table'
      ? this.i18n.t('Table pot')
      : (this.match()?.players.find((player) => player.id === id)?.name ?? id);
  }
  eventLabel(event: LedgerEvent): string {
    if (event.type === 'win') return this.i18n.t('Win · ' + this.name(event.win?.winnerId ?? ''));
    return (
      this.i18n.t(event.type) +
      (event.winnerIds?.length ? ' · ' + event.winnerIds.map((id) => this.name(id)).join(', ') : '')
    );
  }
  eventRules(event: LedgerEvent): RuleProfile {
    return (
      event.scoringInput?.rules ??
      event.scoringInputs?.[0]?.rules ??
      event.drawInput?.rules ??
      this.rules()
    );
  }
  playerList(ids: string[]): string {
    return ids.map((id) => this.name(id)).join(', ') || '—';
  }
}
