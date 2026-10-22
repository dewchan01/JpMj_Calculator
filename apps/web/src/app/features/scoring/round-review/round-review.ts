import { Component, inject, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { RoundSettlement } from '../../../../../../../packages/mahjong-scoring/rounds';
import type { Player } from '../../../../../../../packages/mahjong-core/index';
import { I18n, TranslatePipe } from '../../../core/i18n/i18n';
@Component({
  selector: 'app-round-review',
  imports: [DecimalPipe, TranslatePipe],
  templateUrl: './round-review.html',
})
export class RoundReview {
  private readonly i18n = inject(I18n);
  readonly result = input<RoundSettlement | null>(null);
  readonly players = input<Player[]>([]);
  readonly canSave = input(false);
  readonly busy = input(false);
  readonly confirmSettlement = output<void>();
  name(id: string): string {
    return id === 'table'
      ? this.i18n.t('Table pot')
      : (this.players().find((p) => p.id === id)?.name ?? id);
  }
}
