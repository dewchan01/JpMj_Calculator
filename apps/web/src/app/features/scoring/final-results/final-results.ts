import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '../../../core/i18n/i18n';
import type { Match } from '../../../../../../../packages/mahjong-core/ledger';
import { finalStandings } from '../../../../../../../packages/mahjong-core/final-results';
import { tableRules } from '../../../../../../../packages/mahjong-rules/index';

@Component({
  selector: 'app-final-results',
  imports: [DecimalPipe, TranslatePipe],
  templateUrl: './final-results.html',
  styleUrl: './final-results.css',
})
export class FinalResults {
  readonly match = input.required<Match>();
  readonly rows = computed(() => finalStandings(this.match()));
  readonly settings = computed(() => tableRules(this.match().rules));
}
