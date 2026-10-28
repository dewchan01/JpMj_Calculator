import { DestroyRef, Directive, inject, input, output, signal } from '@angular/core';

@Directive({
  selector: 'button[appCopyButton]',
  exportAs: 'copyButton',
  host: { '(click)': 'copy()', '[attr.data-copied]': 'copied()' },
})
export class CopyButton {
  readonly appCopyButton = input.required<string>();
  readonly copyFailed = output<void>();
  readonly copied = signal(false);
  private timer?: ReturnType<typeof setTimeout>;
  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }
  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.appCopyButton());
      clearTimeout(this.timer);
      this.copied.set(true);
      this.timer = setTimeout(() => this.copied.set(false), 2500);
    } catch {
      this.copyFailed.emit();
    }
  }
}
