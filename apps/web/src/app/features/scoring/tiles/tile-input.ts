import { newId } from '../../../core/id/new-id';
import { ErrorNotice } from '../../../shared/error-notice/error-notice';
import { Component, computed, inject, input, linkedSignal, model, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { kindIndex, parseTiles, type Tile } from '../../../../../../../packages/mahjong-core/index';
import { I18n, TranslatePipe } from '../../../core/i18n/i18n';
import { TileArt } from '../../../shared/tile-art/tile-art';
import { TilePicker } from './tile-picker';
import { TileEntryDialog } from './tile-entry-dialog';
import { PhotoCapture } from '../capture/photo-capture';

@Component({
  selector: 'app-tile-input',
  imports: [
    ErrorNotice,
    TilePicker,
    TileArt,
    TranslatePipe,
    FormField,
    TileEntryDialog,
    PhotoCapture,
  ],
  templateUrl: './tile-input.html',
  styleUrl: './tile-input.css',
  host: { '[attr.data-label]': 'label()' },
})
export class TileInput {
  readonly notationHintId = `notation-hint-${newId()}`;
  readonly value = model('');
  readonly label = input.required<string>();
  readonly playerCount = input.required<3 | 4>();
  readonly redFives = input(true);
  readonly editor = linkedSignal(() => ({ notation: this.value() }));
  readonly editForm = form(this.editor);
  readonly error = signal('');
  readonly pickerOpen = signal(true);
  readonly tiles = computed(() => {
    try {
      return parseTiles(this.value(), 'input');
    } catch {
      return [];
    }
  });
  private readonly i18n = inject(I18n);
  private notation(tiles: Tile[]): string {
    return tiles
      .map((tile) =>
        tile.kind.type === 'suited'
          ? `${tile.isRed ? 0 : tile.kind.rank}${{ man: 'm', pin: 'p', sou: 's' }[tile.kind.suit]}`
          : `${kindIndex(tile.kind) - 26}z`,
      )
      .join('');
  }
  add(tile: Tile): void {
    this.value.set(this.notation([...this.tiles(), tile]));
    this.error.set('');
  }
  applyPhoto(tiles: Tile[]): void {
    this.value.set(this.notation(tiles));
    this.error.set('');
  }
  remove(index: number): void {
    this.value.set(this.notation(this.tiles().filter((_, position) => position !== index)));
  }
  removeLabel(tile: Tile): string {
    return this.i18n.t('Remove ' + this.i18n.tile(tile));
  }
  edit(): void {
    try {
      parseTiles(this.editor().notation, 'input');
      this.value.set(this.editor().notation);
      this.error.set('');
    } catch {
      this.error.set('Invalid review notation. Correct the tiles before applying.');
    }
  }
}
