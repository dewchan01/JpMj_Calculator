import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/i18n';
import { ErrorNotice } from '../../../../shared/error-notice/error-notice';
export type TileDropTarget = 'meld' | 'ankan' | 'kita';
@Component({
  selector: 'app-tile-drop-zones',
  imports: [TranslatePipe, ErrorNotice],
  templateUrl: './tile-drop-zones.html',
  styleUrl: './tile-drop-zones.css',
})
export class TileDropZones {
  readonly playerCount = input.required<3 | 4>();
  readonly meldCount = input(0);
  readonly kanCount = input(0);
  readonly northCount = input(0);
  readonly hasSelection = input(false);
  readonly errorTarget = input('');
  readonly error = input('');
  readonly assigned = output<TileDropTarget>();
  readonly zones = computed(() => [
    {
      target: 'meld' as const,
      label: 'Open melds',
      action: 'Move selected tiles to melds',
      count: this.meldCount(),
    },
    {
      target: 'ankan' as const,
      label: 'Concealed Kan',
      action: 'Move selected tiles to concealed Kan',
      count: this.kanCount(),
    },
    ...(this.playerCount() === 3
      ? [
          {
            target: 'kita' as const,
            label: 'Extracted North',
            action: 'Move selected tiles to North',
            count: this.northCount(),
          },
        ]
      : []),
  ]);
}
