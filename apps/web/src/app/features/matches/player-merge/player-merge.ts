import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { ErrorNotice } from '../../../shared/error-notice/error-notice';
import { Repository } from '../data-access/repository';
import { PlayerLibrary } from '../data-access/player-library';
import {
  identityLabel,
  playerIdentities,
  type PlayerIdentity,
} from '../../records/player-identity';

@Component({
  selector: 'app-player-merge',
  imports: [FormsModule, TranslatePipe, ErrorNotice],
  templateUrl: './player-merge.html',
  styleUrl: './player-merge.css',
})
export class PlayerMerge {
  private readonly repository = inject(Repository);
  private readonly library = inject(PlayerLibrary);
  readonly players = signal<PlayerIdentity[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly result = signal<{ source: string; target: string; count: number } | null>(null);
  source = '';
  target = '';
  label(player: PlayerIdentity): string {
    return identityLabel(player, this.players());
  }
  async open(dialog: HTMLDialogElement): Promise<void> {
    this.error.set('');
    this.result.set(null);
    this.source = '';
    this.target = '';
    dialog.showModal();
    this.busy.set(true);
    try {
      this.players.set(playerIdentities(await this.repository.list(), this.library.players()));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not load match.');
    } finally {
      this.busy.set(false);
    }
  }
  async merge(): Promise<void> {
    if (this.busy()) return;
    const source = this.players().find((p) => p.id === this.source);
    const target = this.players().find((p) => p.id === this.target);
    if (!source || !target || source.id === target.id) return;
    this.busy.set(true);
    this.error.set('');
    const previous = this.library.players();
    try {
      // Persist the library first so a storage quota failure cannot leave records half merged.
      this.library.replace([
        ...previous.filter((p) => p.id !== source.id && p.id !== target.id),
        target,
      ]);
      try {
        const count = await this.repository.mergePlayers(source.id, target);
        this.result.set({ source: this.label(source), target: this.label(target), count });
      } catch (e) {
        this.library.replace(previous);
        throw e;
      }
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not save match.');
    } finally {
      this.busy.set(false);
    }
  }
}
