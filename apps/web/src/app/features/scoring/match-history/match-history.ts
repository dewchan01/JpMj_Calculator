import { TileArt } from '../../../shared/tile-art/tile-art';
import { Component, computed, inject, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LocalDatePipe } from '../../../core/i18n/local-date';
import { tileLabel } from '../../../../../../../packages/mahjong-core/index';
import { type Match, type LedgerEvent } from '../../../../../../../packages/mahjong-core/ledger';
import { ruleName, type RuleProfile } from '../../../../../../../packages/mahjong-rules/index';
import { I18n, TranslatePipe } from '../../../core/i18n/i18n';
@Component({
  selector: 'app-match-history',
  imports: [TileArt, LocalDatePipe, DecimalPipe, TranslatePipe],
  templateUrl: './match-history.html',
  styleUrl: './match-history.css',
})
export class MatchHistory {
  readonly match = input.required<Match | null>();
  readonly rules = input.required<RuleProfile>();
  readonly busy = input(false);
  readonly readOnly = input(false);
  readonly exportRequested = output<void>();
  readonly undoRequested = output<void>();
  readonly events = computed(() => [...(this.match()?.events ?? [])].reverse());
  readonly handPlayers = computed(() => {
    const match = this.match();
    const result = new Map<
      string,
      {
        id: string;
        name: string;
        seat: string;
        before: number;
        after: number;
        riichi: string;
        calls: string;
        win: string;
      }[]
    >();
    if (!match) return result;
    const points = { ...match.initialBalances };
    const winds = ['East', 'South', 'West', 'North'];
    for (const event of match.events) {
      const before = { ...points };
      for (const payment of event.payments) {
        if (payment.from !== 'table') points[payment.from] -= payment.amount;
        if (payment.to !== 'table') points[payment.to] += payment.amount;
      }
      const dealer = match.players.findIndex(
        (player) => player.id === (event.before?.dealerId ?? match.initialDealerId),
      );
      const inputs = event.scoringInputs ?? (event.scoringInput ? [event.scoringInput] : []);
      result.set(
        event.id,
        match.players.map((player, index) => {
          const live = event.liveBefore?.players[player.id];
          const input = inputs.find((input) => input.win.winnerId === player.id);
          const win = input?.win ?? (event.win?.winnerId === player.id ? event.win : undefined);
          const hand = input?.hand ?? (event.win?.winnerId === player.id ? event.hand : undefined);
          const melds = live?.melds ?? hand?.melds ?? (event.liveBefore ? [] : undefined);
          return {
            id: player.id,
            name: player.name,
            seat: winds[(index - Math.max(0, dealer) + match.playerCount) % match.playerCount],
            before: before[player.id],
            after: points[player.id],
            riichi:
              event.type === 'riichiDeposit' &&
              event.payments.some((payment) => payment.from === player.id && payment.to === 'table')
                ? 'Yes'
                : live
                  ? live.riichi === 'none'
                    ? 'No'
                    : 'Yes'
                  : win
                    ? win.riichi || win.doubleRiichi
                      ? 'Yes'
                      : 'No'
                    : event.liveBefore
                      ? 'No'
                      : '\u2014',
            calls: melds
              ? melds.map((meld) => this.i18n.t(meld.type)).join(', ') || this.i18n.t('None')
              : '\u2014',
            win: win ? win.method : event.winnerIds?.includes(player.id) ? 'Win' : '\u2014',
          };
        }),
      );
    }
    return result;
  });
  readonly i18n = inject(I18n);
  readonly labels = tileLabel;
  readonly ruleName = ruleName;
  chips(event: LedgerEvent) {
    return Object.entries(event.chipDeltas ?? {})
      .filter(([, value]) => value !== 0)
      .map(([id, value]) => ({ id, value }));
  }
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
