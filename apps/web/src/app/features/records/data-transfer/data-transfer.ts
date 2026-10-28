import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OnlineApi, type ShareReceipt } from '../../../core/online/online-api';
import { Repository } from '../../matches/data-access/repository';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { LocalDatePipe } from '../../../core/i18n/local-date';
import { DialogBackdrop } from '../../../shared/dialog-backdrop';
import { gameArchive, parseArchive } from './data-archive';
import { filterMatches } from '../record-stats';
import type { Match } from '../../../../../../../packages/mahjong-core/ledger';

@Component({
  selector: 'app-data-transfer',
  imports: [FormsModule, TranslatePipe, LocalDatePipe, DialogBackdrop],
  templateUrl: './data-transfer.html',
  styleUrl: './data-transfer.css',
})
export class DataTransfer {
  readonly online = inject(OnlineApi);
  readonly share = signal<ShareReceipt | null>(null);
  readonly shareQr = signal('');
  private readonly repo = inject(Repository);
  readonly changed = output<void>();
  readonly games = signal<Match[]>([]);
  readonly importing = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly status = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly player = signal('');
  readonly excluded = signal(new Set<string>());
  readonly invalidDates = computed(() => !!this.from() && !!this.to() && this.from() > this.to());
  readonly players = computed(() =>
    [...new Set(this.games().flatMap((game) => game.players.map((player) => player.name)))].sort(),
  );
  readonly filtered = computed(() =>
    filterMatches(this.games(), {
      from: this.from(),
      to: this.to(),
      participant: this.player(),
      mode: '',
    }),
  );
  readonly selected = computed(() =>
    this.filtered().filter((game) => !this.excluded().has(game.id)),
  );
  async open(dialog: HTMLDialogElement, mode: 'import' | 'export'): Promise<void> {
    this.error.set('');
    this.status.set('');
    this.share.set(null);
    this.shareQr.set('');
    this.importing.set(mode === 'import');
    this.games.set([]);
    this.from.set('');
    this.to.set('');
    this.player.set('');
    this.excluded.set(new Set());
    this.busy.set(true);
    dialog.showModal();
    try {
      if (mode === 'export') this.games.set(await this.repo.list());
    } catch {
      this.error.set('Could not load match.');
    } finally {
      this.busy.set(false);
    }
  }
  toggle(id: string): void {
    this.excluded.update((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async readFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.games.set([]);
    this.importing.set(true);
    this.error.set('');
    this.status.set('');
    this.busy.set(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Archive must be smaller than 20 MiB.');
      const archive = parseArchive(await file.text());
      this.games.set(archive.matches);
      this.importing.set(true);
      this.excluded.set(new Set());
      this.player.set('');
      this.from.set('');
      this.to.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Invalid game archive.');
    } finally {
      input.value = '';
      this.busy.set(false);
    }
  }
  export(): void {
    if (this.invalidDates() || !this.selected().length) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(gameArchive(this.selected()), null, 2)], {
        type: 'application/json',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `riichi-games-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async shareSelected(): Promise<void> {
    if (this.busy() || this.invalidDates() || !this.selected().length) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const archive = gameArchive(this.selected());
      if (new Blob([JSON.stringify(archive)]).size > 5 * 1024 * 1024)
        throw new Error('Shared data must be smaller than 5 MiB.');
      const receipt = await this.online.request<ShareReceipt>('/api/shares', 'POST', archive);
      this.share.set(receipt);
      const { default: qr } = await import('qrcode');
      this.shareQr.set(
        await qr.toDataURL(this.online.link('share', receipt.id), { width: 240, margin: 2 }),
      );
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Could not connect to the online service.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  async revokeShare(): Promise<void> {
    const receipt = this.share();
    if (!receipt || this.busy()) return;
    this.busy.set(true);
    try {
      await this.online.request(`/api/shares/${receipt.id}`, 'DELETE', undefined, undefined, {
        'X-Deletion-Secret': receipt.deletionSecret,
      });
      this.share.set(null);
      this.shareQr.set('');
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Could not connect to the online service.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  async import(): Promise<void> {
    if (this.busy() || this.invalidDates() || !this.selected().length) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const count = await this.repo.importGames(this.selected());
      this.status.set(count ? 'Games imported.' : 'No new games to import.');
      this.changed.emit();
    } catch {
      this.error.set('Could not import games.');
    } finally {
      this.busy.set(false);
    }
  }
}
