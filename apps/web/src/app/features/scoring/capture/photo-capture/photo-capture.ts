import { newId } from '../../../../core/id/new-id';
import { ErrorNotice } from '../../../../shared/error-notice/error-notice';
import { PercentPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  isDevMode,
  effect,
} from '@angular/core';
import { DiagnosticLog } from '../../../../core/diagnostic-log';
import { form, FormField } from '@angular/forms/signals';
import {
  parseTiles,
  tileLabel,
  type Tile,
} from '../../../../../../../../packages/mahjong-core/index';
import { TranslatePipe } from '../../../../core/i18n/i18n';
import { TileArt } from '../../../../shared/tile-art/tile-art';
import { CaptureConfiguration } from '../capture-config';
import { createRecognizer } from '../create-recognizer';
import { TileReorder } from '../../tiles/tile-reorder';

@Component({
  selector: 'app-photo-capture',
  imports: [ErrorNotice, FormField, TranslatePipe, PercentPipe, TileArt, TileReorder],
  templateUrl: './photo-capture.html',
  styleUrl: './photo-capture.css',
})
export class PhotoCapture {
  private readonly logs = inject(DiagnosticLog);
  readonly playerCount = input.required<3 | 4>();
  readonly title = input('Photo recognition');
  readonly tilesConfirmed = output<Tile[]>();
  readonly configuration = inject(CaptureConfiguration);
  readonly editor = signal({ notation: '' });
  readonly editForm = form(this.editor);
  readonly review = signal<Tile[]>([]);
  readonly confidence = signal<number[]>([]);
  readonly photoUrl = signal('');
  readonly photoName = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly completed = signal(false);
  readonly reviewOpen = signal(false);
  readonly hasUnappliedText = computed(
    () => this.editor().notation !== this.notation(this.review()),
  );
  readonly previewMessage = computed(() => {
    if (this.busy()) return { type: 'info', text: 'Recognizing tiles…' };
    if (this.hasUnappliedText())
      return { type: 'warning', text: 'Update the preview before applying your edited notation.' };
    if (this.completed() && !this.review().length)
      return {
        type: 'warning',
        text: 'No tiles detected. Try another photo or enter tiles manually.',
      };
    if (this.completed())
      return { type: 'success', text: 'Recognition complete. Check the tiles before applying.' };
    return {
      type: 'info',
      text: 'Applying replaces only the target tiles. Meld type, caller, winning tile and round declarations must be checked manually.',
    };
  });
  private pending?: AbortController;
  constructor() {
    void this.configuration.load();
    effect(() => {
      if (this.error() || this.configuration.error()) this.reviewOpen.set(true);
    });
    inject(DestroyRef).onDestroy(() => {
      this.pending?.abort();
      if (this.photoUrl()) URL.revokeObjectURL(this.photoUrl());
    });
  }
  private notation(tiles: Tile[]): string {
    return tiles
      .map((tile) =>
        tile.kind.type === 'suited'
          ? tileLabel(tile)
          : `${
              tile.kind.type === 'wind'
                ? { east: 1, south: 2, west: 3, north: 4 }[tile.kind.wind]
                : { white: 5, green: 6, red: 7 }[tile.kind.dragon]
            }z`,
      )
      .join('');
  }
  private update(tiles: Tile[]): void {
    this.error.set('');
    this.review.set(tiles);
    this.editor.set({ notation: this.notation(tiles) });
  }
  edit(): void {
    try {
      this.update(parseTiles(this.editor().notation, newId()));
      this.confidence.set([]);
      this.error.set('');
    } catch {
      this.error.set('Invalid review notation. Correct the tiles before applying.');
    }
  }
  remove(index: number): void {
    if (this.busy() || index < 0 || index >= this.review().length) return;
    this.update(this.review().filter((_, position) => position !== index));
    this.confidence.update((values) => values.filter((_, position) => position !== index));
  }
  reorder({ from, to }: { from: number; to: number }): void {
    if (
      this.busy() ||
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= this.review().length ||
      to >= this.review().length
    )
      return;
    const tiles = [...this.review()];
    tiles.splice(to, 0, tiles.splice(from, 1)[0]);
    this.update(tiles);
    this.confidence.update((values) => {
      if (!values.length) return values;
      const reordered = [...values];
      reordered.splice(to, 0, reordered.splice(from, 1)[0]);
      return reordered;
    });
  }
  confirm(): void {
    if (!this.review().length || this.busy() || this.hasUnappliedText()) return;
    this.tilesConfirmed.emit(structuredClone(this.review()));
  }
  async capture(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    const config = this.configuration.value();
    if (!file || !config) return;
    this.reviewOpen.set(true);
    this.pending?.abort();
    const pending = new AbortController();
    this.pending = pending;
    this.update([]);
    this.confidence.set([]);
    this.completed.set(false);
    this.error.set('');
    if (!file.type.startsWith('image/')) {
      this.error.set('Choose an image file.');
      return;
    }
    if (!file.size || file.size > 20 * 1024 * 1024) {
      this.error.set('Choose an image smaller than 20 MB.');
      return;
    }
    if (this.photoUrl()) URL.revokeObjectURL(this.photoUrl());
    this.photoUrl.set(URL.createObjectURL(file));
    this.photoName.set(file.name);
    this.busy.set(true);
    const startedAt = performance.now();
    if (isDevMode())
      console.info('[recognition] Started', {
        provider: config.provider,
        bytes: file.size,
        type: file.type,
      });
    try {
      const recognizer = createRecognizer(config);
      const result = await recognizer.recognize(file, {
        playerCount: this.playerCount(),
        signal: pending.signal,
      });
      if (this.pending !== pending || pending.signal.aborted) return;
      this.logs.add(
        'info',
        `Photo recognition completed (${result.predictions.length} tiles).`,
        'recognition',
      );
      if (isDevMode())
        console.info('[recognition] Completed', {
          provider: config.provider,
          predictions: result.predictions.length,
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      this.update(
        result.predictions.map((prediction) => ({
          id: newId(),
          kind: prediction.candidates[0].tile,
          isRed: prediction.candidates[0].isRed,
        })),
      );
      this.confidence.set(
        result.predictions.map((prediction) => prediction.candidates[0].confidence),
      );
      this.completed.set(true);
    } catch (error) {
      if (!pending.signal.aborted)
        this.logs.add('warn', 'Photo recognition failed.', 'recognition');
      if (isDevMode())
        console.warn('[recognition] Failed', {
          provider: config.provider,
          cancelled: pending.signal.aborted,
          errorType: error instanceof Error ? error.name : typeof error,
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      if (this.pending === pending && !pending.signal.aborted)
        this.error.set(error instanceof Error ? error.message : 'Detection request failed.');
    } finally {
      if (this.pending === pending) this.busy.set(false);
    }
  }
}
