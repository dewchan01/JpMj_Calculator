import { Component, computed, inject, input, output } from '@angular/core';
import {
  kindAt,
  kindIndex,
  type Tile,
  tileLabel,
} from '../../../../../../../../packages/mahjong-core/index';
import { I18n, TranslatePipe } from '../../../../core/i18n/i18n';
import { TileArt } from '../../../../shared/tile-art/tile-art';

@Component({
  selector: 'app-tile-picker',
  imports: [TileArt, TranslatePipe],
  templateUrl: './tile-picker.html',
  styleUrl: './tile-picker.css',
})
export class TilePicker {
  readonly playerCount = input.required<3 | 4>();
  readonly redFives = input(true);
  readonly tilePicked = output<Tile>();
  readonly dragEnabled = input(false);
  dragIndex(tile: Tile): number | null {
    return this.dragEnabled() ? kindIndex(tile.kind) + (tile.isRed ? 34 : 0) : null;
  }
  private readonly i18n = inject(I18n);
  readonly rows = computed(() =>
    [
      {
        label: 'Characters · Man',
        indices: [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(
          (index) => this.playerCount() === 4 || index === 0 || index === 8,
        ),
      },
      { label: 'Circles · Pin', indices: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
      { label: 'Bamboo · Sou', indices: [18, 19, 20, 21, 22, 23, 24, 25, 26] },
      { label: 'Honors', indices: [27, 28, 29, 30, 31, 32, 33] },
    ]
      .map((row) => ({
        label: row.label,
        tiles: row.indices.map((index) => ({
          id: `picker-${index}`,
          kind: kindAt(index),
          isRed: false,
        })),
      }))
      .concat(
        this.redFives()
          ? [
              {
                label: 'Red fives',
                tiles: (this.playerCount() === 3 ? [13, 22] : [4, 13, 22]).map((index) => ({
                  id: `red-${index}`,
                  kind: kindAt(index),
                  isRed: true,
                })),
              },
            ]
          : [],
      ),
  );
  label(tile: Tile): string {
    return `${tileLabel(tile)}: ${this.i18n.t('Add ' + this.i18n.tile(tile))}`;
  }
}
