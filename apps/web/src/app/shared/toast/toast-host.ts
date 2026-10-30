import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  inject,
  viewChild,
} from '@angular/core';
import { Toast } from './toast';
import { TranslatePipe } from '../../core/i18n/i18n';

@Component({
  selector: 'app-toast-host',
  imports: [TranslatePipe],
  templateUrl: './toast-host.html',
  styleUrl: './toast-host.css',
})
export class ToastHost {
  readonly toast = inject(Toast);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  constructor() {
    afterRenderEffect(() => {
      const element = this.surface().nativeElement;
      if (this.toast.current()) this.place();
      else if (element.matches(':popover-open')) element.hidePopover();
    });
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const element = this.surface().nativeElement;
      const dismissOutside = (event: MouseEvent) => {
        if (
          this.toast.current()?.dismissOnOutside &&
          event.target instanceof Node &&
          !element.contains(event.target)
        )
          this.toast.dismiss();
      };
      document.addEventListener('click', dismissOutside, true);
      // A toast must belong to the active modal to remain operable and accessible.
      const observer = new MutationObserver(() => {
        if (this.toast.current()) this.place();
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['open'],
      });
      destroy.onDestroy(() => {
        document.removeEventListener('click', dismissOutside, true);
        observer.disconnect();
        element.remove();
      });
    });
  }
  private place(): void {
    const element = this.surface().nativeElement;
    const modal = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'))
      .reverse()
      .find((dialog) => dialog.matches(':modal'));
    const target = modal ?? this.host.nativeElement;
    if (element.parentElement !== target) {
      if (element.matches(':popover-open')) element.hidePopover();
      target.appendChild(element);
    }
    if (!element.matches(':popover-open')) element.showPopover();
  }
  resume(): void {
    const element = this.surface().nativeElement;
    if (!element.matches(':hover') && !element.contains(document.activeElement))
      this.toast.resume();
  }
}
