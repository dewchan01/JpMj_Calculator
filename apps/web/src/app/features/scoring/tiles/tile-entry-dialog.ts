import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  contentChild,
  input,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/i18n';

/** Lazily renders entry tools in a native, keyboard-accessible modal. */
@Component({
  selector: 'app-tile-entry-dialog',
  imports: [NgTemplateOutlet, TranslatePipe],
  templateUrl: './tile-entry-dialog.html',
  styleUrl: './tile-entry-dialog.css',
})
export class TileEntryDialog {
  readonly label = input('Enter tiles');
  readonly buttonText = input<string>();
  readonly opened = signal(false);
  readonly dragOffset = signal(0);
  readonly dragging = signal(false);
  readonly content = contentChild.required<TemplateRef<unknown>>(TemplateRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private startTouch?: { x: number; y: number };
  private animation?: Animation;
  private closing = false;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.animation?.cancel());
  }
  private get mobileMotion(): boolean {
    return (
      window.matchMedia('(max-width: 600px)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
  show(): void {
    if (this.closing) return;
    this.dragOffset.set(0);
    this.opened.set(true);
    this.dialog().nativeElement.showModal();
    if (this.mobileMotion)
      this.animation = this.dialog().nativeElement.animate(
        [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
        { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
  }
  close(): void {
    const dialog = this.dialog().nativeElement;
    if (this.closing || !dialog.open) return;
    this.startTouch = undefined;
    this.dragging.set(false);
    if (!this.mobileMotion) {
      this.dragOffset.set(0);
      dialog.close();
      return;
    }
    this.closing = true;
    this.animation?.cancel();
    this.animation = dialog.animate(
      [{ transform: `translateY(${this.dragOffset()}px)` }, { transform: 'translateY(100%)' }],
      { duration: 200, easing: 'ease-in', fill: 'forwards' },
    );
    void this.animation.finished
      .then(() => {
        dialog.close();
        this.animation?.cancel();
        this.dragOffset.set(0);
        this.closing = false;
      })
      .catch(() => {
        this.closing = false;
      });
  }
  touchStart(event: TouchEvent): void {
    this.startTouch = undefined;
    const target = event.target;
    if (
      !window.matchMedia('(max-width: 600px)').matches ||
      this.closing ||
      event.touches.length !== 1 ||
      this.dialog().nativeElement.scrollTop > 0 ||
      !(target instanceof Element) ||
      target.closest('button, input, select, textarea, summary, a, label')
    )
      return;
    this.startTouch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  touchMove(event: TouchEvent): void {
    if (event.touches.length !== 1) {
      this.touchEnd(true);
      return;
    }
    if (!this.startTouch) return;
    const distance = event.touches[0].clientY - this.startTouch.y;
    if (
      !this.dragging() &&
      (distance <= 0 || Math.abs(event.touches[0].clientX - this.startTouch.x) > Math.abs(distance))
    ) {
      this.startTouch = undefined;
      return;
    }
    if ((distance > 4 || this.dragging()) && event.cancelable) {
      event.preventDefault();
      this.animation?.cancel();
      this.dragging.set(true);
      this.dragOffset.set(Math.max(0, distance));
    }
  }
  touchEnd(cancelled = false): void {
    const threshold = Math.min(140, this.dialog().nativeElement.clientHeight * 0.22);
    this.startTouch = undefined;
    this.dragging.set(false);
    if (!cancelled && this.dragOffset() >= threshold) this.close();
    else this.dragOffset.set(0);
  }
}
