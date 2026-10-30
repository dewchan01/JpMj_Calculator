import {
  Component,
  computed,
  inject,
  output,
  signal,
  type OnInit,
  DestroyRef,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShareHistory, type SavedShare } from '../../../core/online/share-history';
import { FormsModule } from '@angular/forms';
import { OnlineApi, type ShareReceipt } from '../../../core/online/online-api';
import { Repository } from '../../matches/data-access/repository';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { LocalDatePipe } from '../../../core/i18n/local-date';
import { Toast } from '../../../shared/toast/toast';
import { DialogBackdrop } from '../../../shared/dialog-backdrop';
import { gameArchive, parseArchive } from './data-archive';
import { gamesCsv, parseGamesCsv } from './data-csv';
import { transferId } from '../../../shared/qr/scan-qr';
import { QrScanner } from '../../../shared/qr/qr-scanner';
import { CopyButton } from '../../../shared/copy-button/copy-button';
import { filterMatches } from '../record-stats';
import type { Match } from '../../../../../../../packages/mahjong-core/ledger';
import { PlayerLibrary } from '../../matches/data-access/player-library';
import { playerIdentities, identityLabel, mapImportedPlayers } from '../player-identity';

@Component({
  selector: 'app-data-transfer',
  imports: [
    RouterLink,
    CopyButton,
    FormsModule,
    TranslatePipe,
    LocalDatePipe,
    DialogBackdrop,
    QrScanner,
  ],
  templateUrl: './data-transfer.html',
  styleUrl: './data-transfer.css',
})
export class DataTransfer implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly history = inject(ShareHistory);
  readonly mode: 'menu' | 'import' | 'export' | 'share-history' =
    inject(ActivatedRoute).snapshot.data['transferMode'] ?? 'menu';
  private readonly destroy = inject(DestroyRef);
  async ngOnInit(): Promise<void> {
    if (this.mode === 'menu') return;
    this.importing.set(this.mode === 'import');
    this.busy.set(true);
    try {
      await this.online.ready;
      this.history.load();
      this.localMatches.set(await this.repo.list());
      if (this.mode === 'export') this.games.set(this.localMatches());
      const shared = this.route.snapshot.queryParamMap.get('share');
      if (this.mode === 'import' && shared) {
        this.transferCode.set(shared);
        await this.loadTransfer();
      }
    } catch {
      this.error.set('Could not load match.');
    } finally {
      this.busy.set(false);
    }
    if (this.destroy.destroyed) return;
    const timer = setInterval(() => this.history.load(), 60000);
    this.destroy.onDestroy(() => clearInterval(timer));
  }
  readonly online = inject(OnlineApi);
  readonly share = signal<ShareReceipt | null>(null);
  readonly shareQr = signal('');
  readonly transferCode = signal('');
  private sharedSelection = '';
  private readonly repo = inject(Repository);
  readonly changed = output<void>();
  readonly games = signal<Match[]>([]);
  private readonly library = inject(PlayerLibrary);
  private readonly localMatches = signal<Match[]>([]);
  readonly identityLabel = identityLabel;
  readonly existingPlayers = computed(() =>
    playerIdentities(this.localMatches(), this.library.players()),
  );
  readonly incomingPlayers = computed(() => playerIdentities(this.newGames()));
  private newGames(): Match[] {
    const existing = new Set(this.localMatches().map((match) => match.id));
    return this.selected().filter((match) => !existing.has(match.id));
  }
  readonly playerMapping = signal<Record<string, string>>({});
  readonly mergeTargets = computed(() => [
    ...new Map(
      [...this.incomingPlayers(), ...this.existingPlayers()].map((person) => [person.id, person]),
    ).values(),
  ]);
  mappingTarget(id: string): string {
    const value = this.playerMapping();
    return Object.hasOwn(value, id) && this.mergeTargets().some((person) => person.id === value[id])
      ? value[id]
      : id;
  }
  existingIdentity(id: string): boolean {
    return this.existingPlayers().some((player) => player.id === id);
  }
  mapPlayer(id: string, target: string): void {
    if (target !== id && !this.mergeTargets().some((person) => person.id === target)) return;
    this.playerMapping.update((value) => ({ ...value, [id]: target }));
  }
  readonly importing = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly toast = inject(Toast);
  readonly from = signal('');
  readonly to = signal('');
  readonly player = signal('');
  readonly excluded = signal(new Set<string>());
  readonly invalidDates = computed(() => !!this.from() && !!this.to() && this.from() > this.to());
  readonly players = computed(() => playerIdentities(this.games()));
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
    this.busy.set(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Archive must be smaller than 20 MiB.');
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Invalid CSV file.');
      const archive = parseGamesCsv(await file.text());
      this.playerMapping.set({});
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
      new Blob([gamesCsv(this.selected())], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `riichi-games-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    this.toast.success('Export complete.');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async shareSelected(): Promise<void> {
    if (this.busy() || this.invalidDates() || !this.selected().length) return;
    const selection = JSON.stringify(this.selected().map((game) => [game.id, game.updatedAt]));
    if (
      this.share() &&
      this.shareQr() &&
      selection === this.sharedSelection &&
      Date.parse(this.share()!.expiresAt) > Date.now()
    )
      return;
    this.share.set(null);
    this.shareQr.set('');
    this.busy.set(true);
    this.error.set('');
    try {
      const archive = gameArchive(this.selected());
      if (new Blob([JSON.stringify(archive)]).size > 5 * 1024 * 1024)
        throw new Error('Shared data must be smaller than 5 MiB.');
      const receipt = await this.online.request<ShareReceipt>('/api/shares', 'POST', archive);
      this.share.set(receipt);
      if (!this.history.add(receipt, this.selected()[0].name, this.selected().length))
        this.error.set('Share history could not be saved on this device.');
      this.sharedSelection = selection;
      const { default: qr } = await import('qrcode');
      this.shareQr.set(
        await qr.toDataURL(JSON.stringify({ format: 'riichi-share', version: 1, id: receipt.id }), {
          width: 240,
          margin: 2,
        }),
      );
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Could not connect to the online service.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  async showSavedShare(entry: SavedShare, dialog: HTMLDialogElement): Promise<void> {
    if (this.busy()) return;
    if (Date.parse(entry.expiresAt) <= Date.now()) {
      this.history.load();
      this.error.set('This room or share has expired or was removed.');
      return;
    }
    this.error.set('');
    this.shareQr.set('');
    this.share.set(entry);
    dialog.showModal();
    this.busy.set(true);
    try {
      const { default: qr } = await import('qrcode');
      this.shareQr.set(
        await qr.toDataURL(JSON.stringify({ format: 'riichi-share', version: 1, id: entry.id }), {
          width: 240,
          margin: 2,
        }),
      );
    } catch {
      this.error.set('Could not load match.');
    } finally {
      this.busy.set(false);
    }
  }
  async scanTransfer(value: string): Promise<void> {
    if (this.busy()) return;
    this.games.set([]);
    this.busy.set(true);
    this.error.set('');
    try {
      this.transferCode.set(transferId(value));
      await this.loadTransfer();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Invalid transfer code.');
    } finally {
      this.busy.set(false);
    }
  }
  async fetchTransfer(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.loadTransfer();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Invalid transfer code.');
    } finally {
      this.busy.set(false);
    }
  }
  private async loadTransfer(): Promise<void> {
    this.games.set([]);
    this.playerMapping.set({});
    const id = transferId(this.transferCode());
    const archive = parseArchive(
      JSON.stringify(await this.online.request<unknown>(`/api/shares/${id}`)),
    );
    this.games.set(archive.matches);
    this.excluded.set(new Set());
    this.from.set('');
    this.to.set('');
    this.player.set('');
  }
  async revokeShare(dialog: HTMLDialogElement): Promise<void> {
    const receipt = this.share();
    if (!receipt || this.busy()) return;
    this.busy.set(true);
    try {
      await this.online.request(`/api/shares/${receipt.id}`, 'DELETE', undefined, undefined, {
        'X-Deletion-Secret': receipt.deletionSecret,
      });
      dialog.close();
      this.share.set(null);
      this.shareQr.set('');
      this.history.remove(receipt.id);
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
      const mapping = Object.fromEntries(
        this.incomingPlayers().map((person) => [person.id, this.mappingTarget(person.id)]),
      );
      const mapped = mapImportedPlayers(this.newGames(), mapping);
      const count = await this.repo.importGames(mapped);
      this.localMatches.set(await this.repo.list());
      this.toast.success(count ? 'Games imported.' : 'No new games to import.');
      this.changed.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not import games.');
    } finally {
      this.busy.set(false);
    }
  }
}
