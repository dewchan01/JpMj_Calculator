import { DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';

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
  readonly tileDropped = output<{ index: number; target: string }>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private scrollFrame?: number;
  private point?: { x: number; y: number };
  private preview?: HTMLElement;
  private previewOffset?: { x: number; y: number };
  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }
  private pointer?: {
    id: number;
    from: number;
    to: number;
    x: number;
    y: number;
    dragging: boolean;
    dropTarget?: string;
  };
  private index(target: EventTarget | null): number {
    if (!(target instanceof Element)) return -1;
    const tile = target.closest<HTMLElement>('[data-tile-index]');
    return tile && tile.closest('[appTileReorder]') === this.element.nativeElement
      ? Number(tile.dataset['tileIndex'])
      : -1;
  }
  start(event: PointerEvent): void {
    const from = this.index(event.target);
    if (from < 0 || !event.isPrimary || event.button !== 0) return;
    this.cancel();
    const tile = (event.target as Element).closest<HTMLElement>('[data-tile-index]')!;
    const bounds = tile.getBoundingClientRect();
    this.previewOffset = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
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
    if (!this.preview) this.createPreview(pointer.from);
    if (this.preview && this.previewOffset) {
      this.preview.style.left = `${event.clientX - this.previewOffset.x}px`;
      this.preview.style.top = `${event.clientY - this.previewOffset.y}px`;
    }
    this.point = { x: event.clientX, y: event.clientY };
    if (!this.scrollFrame) this.scrollFrame = requestAnimationFrame(() => this.autoScroll());
    this.element.nativeElement.setPointerCapture(event.pointerId);
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const zone = hit?.closest<HTMLElement>('[data-tile-drop-target]');
    pointer.dropTarget =
      zone && this.element.nativeElement.contains(zone)
        ? zone.dataset['tileDropTarget']
        : undefined;
    this.element.nativeElement
      .querySelectorAll<HTMLElement>('[data-tile-drop-target]')
      .forEach((element) => element.classList.toggle('tile-drop-active', element === zone));
    const to = this.index(hit);
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
      // Scrolling can move a zone after the last pointermove; resolve the release point again.
      const zone = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-tile-drop-target]');
      pointer.dropTarget =
        zone && this.element.nativeElement.contains(zone)
          ? zone.dataset['tileDropTarget']
          : undefined;
      // The pointer-generated click must not activate the tile's remove action.
      const suppress = (click: Event) => {
        click.preventDefault();
        click.stopImmediatePropagation();
      };
      this.element.nativeElement.addEventListener('click', suppress, { capture: true, once: true });
      setTimeout(() => this.element.nativeElement.removeEventListener('click', suppress, true), 0);
      if (pointer.dropTarget)
        this.tileDropped.emit({ index: pointer.from, target: pointer.dropTarget });
      else if (pointer.from !== pointer.to)
        this.tileReordered.emit({ from: pointer.from, to: pointer.to });
    }
    this.cancel();
  }
  cancel(): void {
    this.preview?.remove();
    this.preview = undefined;
    this.previewOffset = undefined;
    if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = undefined;
    this.point = undefined;
    if (this.pointer && this.element.nativeElement.hasPointerCapture(this.pointer.id))
      this.element.nativeElement.releasePointerCapture(this.pointer.id);
    this.pointer = undefined;
    this.element.nativeElement
      .querySelectorAll('.tile-dragging, .tile-drop-target, .tile-drop-active')
      .forEach((tile) =>
        tile.classList.remove('tile-dragging', 'tile-drop-target', 'tile-drop-active'),
      );
  }
  private createPreview(index: number): void {
    const source = this.element.nativeElement.querySelector<HTMLElement>(
      `[data-tile-index="${index}"]`,
    );
    if (!source) return;
    const bounds = source.getBoundingClientRect();
    const preview = source.cloneNode(true) as HTMLElement;
    preview.removeAttribute('data-tile-index');
    preview.removeAttribute('id');
    preview.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    preview.classList.remove('tile-dragging', 'tile-drop-target');
    preview.classList.add('tile-drag-preview');
    preview.setAttribute('aria-hidden', 'true');
    preview.inert = true;
    preview.popover = 'manual';
    preview.style.width = `${bounds.width}px`;
    preview.style.height = `${bounds.height}px`;
    source.parentElement!.append(preview);
    // The top layer keeps the complete tile above dialogs and clipped hand trays.
    preview.showPopover();
    this.preview = preview;
  }
  private autoScroll(): void {
    this.scrollFrame = undefined;
    if (!this.pointer?.dragging || !this.point) return;
    const dialog = this.element.nativeElement.closest('dialog');
    const top = dialog?.getBoundingClientRect().top ?? 0;
    const navigation = (
      window.matchMedia('(max-width: 700px)').matches
        ? document.querySelector('.app-navigation')
        : null
    )?.getBoundingClientRect();
    const bottom = dialog?.getBoundingClientRect().bottom ?? navigation?.top ?? innerHeight;
    const delta = this.point.y < top + 60 ? -12 : this.point.y > bottom - 60 ? 12 : 0;
    if (delta) {
      if (dialog) dialog.scrollBy({ top: delta, behavior: 'instant' });
      else window.scrollBy({ top: delta, behavior: 'instant' });
      const zone = document
        .elementFromPoint(this.point.x, this.point.y)
        ?.closest<HTMLElement>('[data-tile-drop-target]');
      this.pointer.dropTarget =
        zone && this.element.nativeElement.contains(zone)
          ? zone.dataset['tileDropTarget']
          : undefined;
      this.element.nativeElement
        .querySelectorAll<HTMLElement>('[data-tile-drop-target]')
        .forEach((element) => element.classList.toggle('tile-drop-active', element === zone));
    }
    this.scrollFrame = requestAnimationFrame(() => this.autoScroll());
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
