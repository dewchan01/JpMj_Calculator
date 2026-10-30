import { Directive, ElementRef, booleanAttribute, inject, input } from '@angular/core';

/** Dismisses one explicitly grouped prompt flow without affecting unrelated dialogs. */
export function closeDialogGroup(group: string): void {
  for (const dialog of document.querySelectorAll<HTMLDialogElement>(
    'dialog[open][data-dismiss-group]',
  ))
    if (dialog.dataset['dismissGroup'] === group) dialog.close();
}

/** Backdrops dismiss the active prompt unless it explicitly prevents dismissal. */
@Directive({
  selector: 'dialog[appDialogBackdrop]',
  host: { '(pointerdown)': 'start($event)', '(pointerup)': 'finish($event)' },
})
export class DialogBackdrop {
  readonly enabled = input(true, { alias: 'appDialogBackdrop', transform: booleanAttribute });
  readonly canDismiss = input<(() => boolean) | undefined>(undefined, {
    alias: 'dialogCanDismiss',
  });
  private readonly element = inject<ElementRef<HTMLDialogElement>>(ElementRef);
  private startedOutside = false;
  private outside(event: PointerEvent): boolean {
    const dialog = this.element.nativeElement;
    const box = dialog.getBoundingClientRect();
    return (
      event.target === dialog &&
      (event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom)
    );
  }
  start(event: PointerEvent): void {
    this.startedOutside = this.outside(event);
  }
  finish(event: PointerEvent): void {
    if (
      this.startedOutside &&
      this.outside(event) &&
      this.enabled() &&
      (this.canDismiss()?.() ?? true)
    ) {
      const group = this.element.nativeElement.dataset['dismissGroup'];
      if (group) closeDialogGroup(group);
      else this.element.nativeElement.close();
    }
    this.startedOutside = false;
  }
}
