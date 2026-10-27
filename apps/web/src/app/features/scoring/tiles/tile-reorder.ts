import { DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';

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
  readonly removeOutside = input(false);
  readonly tileRemoved = output<number>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private scrollFrame?: number;
  private point?: { x: number; y: number };
  private preview?: HTMLElement;
  private previewOffset?: { x: number; y: number };
  private slots: { element: HTMLElement; index: number; bounds: DOMRect }[] = [];
  private slotOrigin?: DOMRect;
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
    collection?: HTMLElement;
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
      collection: this.removeOutside()
        ? (tile.closest<HTMLElement>('[data-tile-collection]') ?? this.element.nativeElement)
        : undefined,
    };
  }
  move(event: PointerEvent): void {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8)
      pointer.dragging = true;
    if (!pointer.dragging) return;
    if (!this.preview) {
      this.createPreview(pointer.from);
      this.slotOrigin = this.element.nativeElement.getBoundingClientRect();
      this.slots = Array.from(
        this.element.nativeElement.querySelectorAll<HTMLElement>('[data-tile-index]'),
      )
        .filter((tile) => tile.closest('[appTileReorder]') === this.element.nativeElement)
        .map((element) => ({
          element,
          index: Number(element.dataset['tileIndex']),
          bounds: element.getBoundingClientRect(),
        }));
    }
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
    // Measure the original slots, independently of the animated tiles under the pointer.
    const host = this.element.nativeElement.getBoundingClientRect();
    const dx = host.left - this.slotOrigin!.left,
      dy = host.top - this.slotOrigin!.top;
    const positions = this.slots.map((slot) => ({
      ...slot,
      bounds: new DOMRect(
        slot.bounds.left + dx,
        slot.bounds.top + dy,
        slot.bounds.width,
        slot.bounds.height,
      ),
    }));
    const source = positions.find((slot) => slot.index === pointer.from);
    const collection = source?.element.parentElement;
    const bounds = collection?.getBoundingClientRect();
    const inside =
      bounds &&
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom;
    if (!pointer.dropTarget && inside && source) {
      const nearest = positions.reduce((best, slot) => {
        const distance = (item: typeof slot) =>
          Math.hypot(
            event.clientX - item.bounds.left - item.bounds.width / 2,
            event.clientY - item.bounds.top - item.bounds.height / 2,
          );
        return distance(slot) < distance(best) ? slot : best;
      }, source);
      pointer.to = nearest.index;
      const order = positions.filter((slot) => slot.index !== pointer.from);
      order.splice(
        positions.findIndex((slot) => slot.index === pointer.to),
        0,
        source,
      );
      order.forEach((slot, index) => {
        if (slot.index === pointer.from) return;
        const target = positions[index].bounds;
        slot.element.style.setProperty('--tile-shift-x', `${target.left - slot.bounds.left}px`);
        slot.element.style.setProperty('--tile-shift-y', `${target.top - slot.bounds.top}px`);
        slot.element.classList.add('tile-reorder-shift');
      });
      source.element.style.setProperty(
        '--tile-shift-x',
        `${nearest.bounds.left - source.bounds.left}px`,
      );
      source.element.style.setProperty(
        '--tile-shift-y',
        `${nearest.bounds.top - source.bounds.top}px`,
      );
      source.element.classList.add('tile-reorder-shift');
    } else {
      this.slots.forEach(({ element }) => {
        element.style.setProperty('--tile-shift-x', '0px');
        element.style.setProperty('--tile-shift-y', '0px');
      });
    }
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
      else if (
        pointer.collection &&
        (() => {
          const rect = pointer.collection.getBoundingClientRect();
          return (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          );
        })()
      )
        this.tileRemoved.emit(pointer.from);
      else if (pointer.from !== pointer.to)
        this.tileReordered.emit({ from: pointer.from, to: pointer.to });
    }
    this.cancel();
  }
  cancel(): void {
    this.slots.forEach(({ element }) => {
      element.classList.remove('tile-reorder-shift');
      element.style.removeProperty('--tile-shift-x');
      element.style.removeProperty('--tile-shift-y');
    });
    this.slots = [];
    this.slotOrigin = undefined;
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
    const sourceImage = source.querySelector('img');
    if (sourceImage) {
      // A top-layer preview must not depend on cloned Angular hosts or percentage-sized wrappers.
      const image = document.createElement('img');
      image.src = sourceImage.currentSrc || sourceImage.src;
      image.alt = '';
      image.draggable = false;
      Object.assign(image.style, {
        display: 'block',
        width: '100%',
        height: '100%',
        maxWidth: 'none',
        maxHeight: 'none',
        objectFit: 'contain',
      });
      preview.replaceChildren(image);
      preview.style.padding = '0';
    }
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
