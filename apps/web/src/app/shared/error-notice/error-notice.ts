import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n';

/** One presentation for action errors and validation lists, kept beside the relevant controls. */
@Component({
  selector: 'app-error-notice',
  imports: [TranslatePipe],
  templateUrl: './error-notice.html',
  styleUrl: './error-notice.css',
})
export class ErrorNotice {
  readonly message = input('');
  readonly messages = input<readonly string[]>([]);
  readonly focusOnShow = input(true);
  readonly content = computed(() =>
    [this.message(), ...this.messages()].filter((message) => message.length > 0),
  );
  private readonly alert = viewChild<ElementRef<HTMLElement>>('alert');
  constructor() {
    afterRenderEffect(() => {
      if (!this.content().length || !this.focusOnShow()) return;
      const element = this.alert()?.nativeElement;
      if (!element) return;
      element.focus({ preventScroll: true });
      const rect = element.getBoundingClientRect();
      const header = element.closest('dialog')
        ? 0
        : Number.parseFloat(getComputedStyle(element).getPropertyValue('--app-header-height')) || 0;
      const bottom = element.closest('dialog')
        ? window.innerHeight
        : ((window.matchMedia('(max-width: 700px)').matches
            ? document.querySelector('.app-navigation')
            : null
          )?.getBoundingClientRect().top ?? window.innerHeight);
      if (rect.top < header + 72 || rect.bottom > bottom)
        element.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }
}
