import { DestroyRef, Injectable, afterNextRender, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class TabScroll {
  constructor() {
    const destroy = inject(DestroyRef);
    const navigation = inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationEnd && !event.urlAfterRedirects.includes('#'))
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    });
    destroy.onDestroy(() => navigation.unsubscribe());
    afterNextRender(() => {
      const controller = new AbortController();
      document.addEventListener(
        'click',
        (event) => {
          const button = event.target instanceof Element ? event.target.closest('button') : null;
          if (
            !button ||
            button.disabled ||
            button.getAttribute('aria-pressed') === 'true' ||
            button.getAttribute('aria-selected') === 'true' ||
            button.classList.contains('active') ||
            button.classList.contains('selected')
          )
            return;
          if (
            !button.matches(
              '.segmented button, .tabs button, [role="tab"], .filter-chips button[aria-pressed], .graph-legend button, .result-layout button, .mode-chips button',
            )
          )
            return;
          requestAnimationFrame(() => {
            let container = button.parentElement;
            while (container) {
              if (
                container.scrollHeight > container.clientHeight &&
                /auto|scroll/.test(getComputedStyle(container).overflowY)
              ) {
                container.scrollTo({ top: 0, behavior: 'instant' });
                return;
              }
              container = container.parentElement;
            }
            if (!button.closest('dialog')) window.scrollTo({ top: 0, behavior: 'instant' });
          });
        },
        { capture: true, signal: controller.signal },
      );
      destroy.onDestroy(() => controller.abort());
    });
  }
}
