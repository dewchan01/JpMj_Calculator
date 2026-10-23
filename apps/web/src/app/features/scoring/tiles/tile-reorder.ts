import { Directive, ElementRef, inject, output } from '@angular/core';

/** Pointer-based reordering works with touch, pen and mouse; Alt+arrows is the keyboard alternative. */
@Directive({
  selector: '[appTileReorder]',
  host: {
    '(pointerdown)': 'start($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'finish($event)',
    '(pointercancel)': 'cancel()',
    '(dragstart)': '$event.preventDefault()',
    '(keydown)': 'keyboard($event)',
  },
})
export class TileReorder {
  readonly tileReordered = output<{ from: number; to: number }>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private pointer?: {
    id: number;
    from: number;
    to: number;
    x: number;
    y: number;
    dragging: boolean;
  };
  private index(target: EventTarget | null): number {
    if (!(target instanceof Element)) return -1;
    const tile = target.closest<HTMLElement>('[data-tile-index]');
    return tile && this.element.nativeElement.contains(tile)
      ? Number(tile.dataset['tileIndex'])
      : -1;
  }
  start(event: PointerEvent): void {
    const from = this.index(event.target);
    if (from < 0 || !event.isPrimary || event.button !== 0) return;
    this.pointer = {
      id: event.pointerId,
      from,
      to: from,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
    };
  }
  move(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8)
      pointer.dragging = true;
    if (!pointer.dragging) return;
    this.element.nativeElement.setPointerCapture(event.pointerId);
    const to = this.index(document.elementFromPoint(event.clientX, event.clientY));
    if (to >= 0) pointer.to = to;
    this.element.nativeElement
      .querySelectorAll<HTMLElement>('[data-tile-index]')
      .forEach((tile) => {
        tile.classList.toggle('tile-dragging', Number(tile.dataset['tileIndex']) === pointer.from);
        tile.classList.toggle('tile-drop-target', Number(tile.dataset['tileIndex']) === pointer.to);
      });
  }
  finish(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (pointer.dragging) {
      // The pointer-generated click must not activate the tile's remove action.
      const suppress = (click: Event) => {
        click.preventDefault();
        click.stopImmediatePropagation();
      };
      this.element.nativeElement.addEventListener('click', suppress, { capture: true, once: true });
      setTimeout(() => this.element.nativeElement.removeEventListener('click', suppress, true), 0);
      if (pointer.from !== pointer.to)
        this.tileReordered.emit({ from: pointer.from, to: pointer.to });
    }
    this.cancel();
  }
  cancel(): void {
    if (this.pointer && this.element.nativeElement.hasPointerCapture(this.pointer.id))
      this.element.nativeElement.releasePointerCapture(this.pointer.id);
    this.pointer = undefined;
    this.element.nativeElement
      .querySelectorAll('.tile-dragging, .tile-drop-target')
      .forEach((tile) => tile.classList.remove('tile-dragging', 'tile-drop-target'));
  }
  keyboard(event: KeyboardEvent): void {
    const from = this.index(event.target);
    if (!event.altKey || from < 0 || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const to = from + (event.key === 'ArrowLeft' ? -1 : 1);
    if (to < 0 || to >= this.element.nativeElement.querySelectorAll('[data-tile-index]').length)
      return;
    event.preventDefault();
    this.tileReordered.emit({ from, to });
  }
}
