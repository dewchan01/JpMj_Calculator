import { ErrorNotice } from '../../../shared/error-notice/error-notice';
import { Component, inject, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { type ScoreResult } from '../../../../../../../packages/mahjong-core/index';
import { balances, type Match } from '../../../../../../../packages/mahjong-core/ledger';
import { ruleName, type RuleProfile } from '../../../../../../../packages/mahjong-rules/index';
import { I18n, TranslatePipe } from '../../../core/i18n/i18n';
@Component({
  selector: 'app-score-result',
  imports: [ErrorNotice, DecimalPipe, RouterLink, TranslatePipe],
  templateUrl: './score-result.html',
})
export class ScoreResultView {
  readonly result = input.required<ScoreResult | null>();
  readonly match = input.required<Match | null>();
  readonly players = input.required<{ id: string; name: string }[]>();
  readonly book = input.required<ReturnType<typeof balances> | null>();
  readonly rules = input.required<RuleProfile>();
  readonly winner = input.required<string>();
  readonly busy = input(false);
  readonly confirmSettlement = output<void>();
  readonly ruleName = ruleName;
  private readonly i18n = inject(I18n);
  name(id: string): string {
    return id === 'table'
      ? this.i18n.t('Table pot')
      : (this.players().find((player) => player.id === id)?.name ?? id);
  }
}
