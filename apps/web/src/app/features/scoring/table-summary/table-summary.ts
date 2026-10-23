import { Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WINDS, type Wind } from '../../../../../../../packages/mahjong-core/index';
import { I18n, TranslatePipe } from '../../../core/i18n/i18n';
import type { LedgerEvent } from '../../../../../../../packages/mahjong-core/ledger';

@Component({
  selector: 'app-table-summary',
  imports: [DecimalPipe, TranslatePipe],
  templateUrl: './table-summary.html',
  styleUrl: './table-summary.css',
})
export class TableSummary {
  private readonly i18n = inject(I18n);
  readonly players = input.required<{ id: string; name: string }[]>();
  readonly balances = input.required<Record<string, number>>();
  readonly dealer = input.required<string>();
  readonly winner = input.required<string>();
  readonly roundWind = input.required<Wind>();
  readonly handNumber = input.required<number>();
  readonly honba = input.required<number>();
  readonly pot = input.required<number>();
  readonly ruleName = input.required<string>();
  readonly events = input<LedgerEvent[]>([]);
  readonly recordedWinners = computed(
    () =>
      new Set(
        this.events().flatMap((event) => {
          if (event.type === 'multipleRon') return event.winnerIds ?? [];
          if (event.type !== 'win') return [];
          const winner = event.win?.winnerId ?? event.scoringInput?.win.winnerId;
          return event.winnerIds ?? (winner ? [winner] : []);
        }),
      ),
  );
  seat(index: number): Wind {
    return WINDS[
      (index -
        this.players().findIndex((player) => player.id === this.dealer()) +
        this.players().length) %
        this.players().length
    ];
  }
  position(index: number): string {
    return ['bottom', 'right', 'top', 'left'][index];
  }
  windLabel(index: number): string {
    const wind = this.seat(index);
    return this.i18n.locale() === 'en' ? wind[0].toUpperCase() : this.i18n.t(wind);
  }
}
