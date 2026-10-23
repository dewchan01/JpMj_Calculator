import { ErrorNotice } from '../../../shared/error-notice/error-notice';
import { PercentPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { parseTiles, tileLabel, type Tile } from '../../../../../../../packages/mahjong-core/index';
import { TranslatePipe } from '../../../core/i18n/i18n';
import { TileArt } from '../../../shared/tile-art/tile-art';
import { CaptureConfiguration } from './capture-config';
import { createRecognizer } from './create-recognizer';

@Component({
  selector: 'app-photo-capture',
  imports: [ErrorNotice, FormField, TranslatePipe, PercentPipe, TileArt],
  templateUrl: './photo-capture.html',
  styleUrl: './photo-capture.css',
})
export class PhotoCapture {
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
  private pending?: AbortController;
  constructor() {
    void this.configuration.load();
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
      this.update(parseTiles(this.editor().notation, crypto.randomUUID()));
      this.confidence.set([]);
      this.error.set('');
    } catch {
      this.error.set('Invalid review notation. Correct the tiles before applying.');
    }
  }
  remove(index: number): void {
    this.update(this.review().filter((_, position) => position !== index));
    this.confidence.update((values) => values.filter((_, position) => position !== index));
  }
  move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= this.review().length) return;
    const tiles = [...this.review()];
    [tiles[index], tiles[target]] = [tiles[target], tiles[index]];
    this.update(tiles);
    this.confidence.update((values) => {
      if (!values.length) return values;
      const reordered = [...values];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
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
      console.info('[recognition] Completed', {
        provider: config.provider,
        predictions: result.predictions.length,
        elapsedMs: Math.round(performance.now() - startedAt),
      });
      this.update(
        result.predictions.map((prediction) => ({
          id: crypto.randomUUID(),
          kind: prediction.candidates[0].tile,
          isRed: prediction.candidates[0].isRed,
        })),
      );
      this.confidence.set(
        result.predictions.map((prediction) => prediction.candidates[0].confidence),
      );
      this.completed.set(true);
    } catch (error) {
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
