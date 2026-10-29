import { Component, ElementRef, computed, inject, input, model, viewChild } from '@angular/core';
import { I18n, TranslatePipe } from '../../../../core/i18n/i18n';
import { DialogBackdrop } from '../../../../shared/dialog-backdrop';
import { ResponsiveSheet } from '../../../../shared/responsive-sheet';
import { TileArt } from '../../../../shared/tile-art/tile-art';
import type { Tile } from '../../../../../../../../packages/mahjong-core/index';

@Component({
  selector: 'app-tile-choice',
  imports: [TranslatePipe, TileArt, DialogBackdrop, ResponsiveSheet],
  templateUrl: './tile-choice.html',
  styleUrl: './tile-choice.css',
})
export class TileChoice {
  readonly i18n = inject(I18n);
  readonly label = input.required<string>();
  readonly pickerLabel = input('Choose tiles');
  readonly tiles = input.required<readonly Tile[]>();
  readonly selected = model(0);
  readonly tile = computed(() => this.tiles()[this.selected()]);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  open(): void {
    if (this.tiles().length) this.dialog().nativeElement.showModal();
  }
  choose(index: number): void {
    if (!this.tiles()[index]) return;
    this.selected.set(index);
    this.dialog().nativeElement.close();
  }
}
