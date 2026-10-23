import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { type Tile } from '../../../../../../packages/mahjong-core/index';
import { I18n } from '../../core/i18n/i18n';
import { Theme } from '../../core/theme/theme';

@Component({
  selector: 'app-tile-art',
  imports: [NgOptimizedImage],
  templateUrl: './tile-art.html',
  styleUrl: './tile-art.css',
})
export class TileArt {
  readonly tile = input.required<Tile>();
  readonly decorative = input(false);
  readonly i18n = inject(I18n);
  private readonly theme = inject(Theme);
  readonly source = computed(() => {
    const tile = this.tile();
    const kind = tile.kind;
    const name =
      kind.type === 'suited'
        ? `${{ man: 'Man', pin: 'Pin', sou: 'Sou' }[kind.suit]}${kind.rank}${tile.isRed ? '-Dora' : ''}`
        : kind.type === 'wind'
          ? { east: 'Ton', south: 'Nan', west: 'Shaa', north: 'Pei' }[kind.wind]
          : { white: 'Haku', green: 'Hatsu', red: 'Chun' }[kind.dragon];
    return `tiles/${this.theme.dark() ? 'Black' : 'Regular'}/${name}.svg`;
  });
}
