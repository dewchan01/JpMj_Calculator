import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/** Keeps native dialog focus/backdrop semantics while animating mobile sheets. */
@Directive({
  selector: 'dialog[appResponsiveSheet]',
  host: { class: 'responsive-sheet', '(cancel)': 'cancel($event)' },
})
export class ResponsiveSheet {
  private readonly dialog = inject<ElementRef<HTMLDialogElement>>(ElementRef).nativeElement;
  private readonly nativeClose = this.dialog.close.bind(this.dialog);
  private readonly nativeShow = this.dialog.showModal.bind(this.dialog);
  private animation?: Animation;
  private closing = false;
  private mobile(): boolean {
    return (
      matchMedia('(max-width: 700px)').matches &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
  constructor() {
    this.dialog.showModal = () => {
      this.animation?.cancel();
      this.closing = false;
      if (!this.dialog.open) this.nativeShow();
      if (this.mobile())
        this.animation = this.dialog.animate(
          [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
          { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
    };
    this.dialog.close = (value) => {
      if (!this.dialog.open || this.closing) return;
      this.animation?.cancel();
      if (!this.mobile()) {
        this.nativeClose(value);
        return;
      }
      this.closing = true;
      this.animation = this.dialog.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }],
        { duration: 180, easing: 'ease-in', fill: 'forwards' },
      );
      void this.animation.finished.then(
        () => {
          this.nativeClose(value);
          this.animation?.cancel();
          this.closing = false;
        },
        () => {
          this.closing = false;
        },
      );
    };
    inject(DestroyRef).onDestroy(() => {
      this.animation?.cancel();
      this.dialog.close = this.nativeClose;
      this.dialog.showModal = this.nativeShow;
    });
  }
  cancel(event: Event): void {
    event.preventDefault();
    this.dialog.close();
  }
}
