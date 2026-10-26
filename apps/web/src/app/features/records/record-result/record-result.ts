import { Component, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DialogBackdrop } from '../../../shared/dialog-backdrop';
import { Repository } from '../../matches/data-access/repository';
import { FinalResults } from '../../scoring/final-results/final-results';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { ErrorNotice } from '../../../shared/error-notice/error-notice';
import type { Match } from '../../../../../../../packages/mahjong-core/ledger';

@Component({
  imports: [RouterLink, FinalResults, TranslatePipe, ErrorNotice, DialogBackdrop],
  templateUrl: './record-result.html',
  styleUrl: './record-result.css',
})
export class RecordResult {
  private readonly repo = inject(Repository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly resultView = viewChild(FinalResults);
  readonly busy = signal(false);
  readonly match = signal<Match | null>(null);
  readonly error = signal('');
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    try {
      const match = await this.repo.get(this.route.snapshot.paramMap.get('id') ?? '');
      if (!match?.ended) throw new Error('Completed game not found.');
      this.match.set(match);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load match.');
    }
  }
  async remove(): Promise<void> {
    const match = this.match();
    if (!match || this.busy()) return;
    this.busy.set(true);
    try {
      await this.repo.remove(match.id);
      await this.router.navigateByUrl('/records');
    } catch {
      this.error.set('Could not delete match.');
    } finally {
      this.busy.set(false);
    }
  }
}
