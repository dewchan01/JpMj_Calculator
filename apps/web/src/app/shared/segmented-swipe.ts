import { DestroyRef, Injectable, afterNextRender, inject } from '@angular/core';

/** Horizontal touch gestures select adjacent tabs; vertical gestures remain native scrolling. */
@Injectable({ providedIn: 'root' })
export class SegmentedSwipe {
  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const controller = new AbortController();
      const options = { signal: controller.signal };
      let gesture: { group: HTMLElement; id: number; x: number; y: number } | undefined;
      let suppressed: { group: HTMLElement; until: number } | undefined;
      document.addEventListener(
        'pointerdown',
        (event) => {
          gesture = undefined;
          suppressed = undefined;
          if (event.pointerType !== 'touch' || !event.isPrimary) return;
          const group =
            event.target instanceof Element
              ? event.target.closest<HTMLElement>('.segmented, .tabs, .result-layout')
              : null;
          if (!group || group.scrollWidth > group.clientWidth + 2) return;
          gesture = { group, id: event.pointerId, x: event.clientX, y: event.clientY };
        },
        options,
      );
      document.addEventListener(
        'pointercancel',
        () => {
          gesture = undefined;
        },
        options,
      );
      document.addEventListener(
        'pointerup',
        (event) => {
          const start = gesture;
          gesture = undefined;
          if (!start || start.id !== event.pointerId || !start.group.isConnected) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
          const buttons = Array.from(
            start.group.querySelectorAll<HTMLButtonElement>(':scope > button'),
          ).filter((button) => !button.disabled && button.getClientRects().length > 0);
          const index = buttons.findIndex((button) =>
            button.matches('.selected, .active, [aria-pressed="true"], [aria-selected="true"]'),
          );
          const next = buttons[index + (dx < 0 ? 1 : -1)];
          if (index < 0 || !next) return;
          suppressed = { group: start.group, until: performance.now() + 500 };
          next.click();
          next.focus({ preventScroll: true });
        },
        options,
      );
      document.addEventListener(
        'click',
        (event) => {
          if (
            event.isTrusted &&
            suppressed &&
            performance.now() < suppressed.until &&
            event.target instanceof Node &&
            suppressed.group.contains(event.target)
          ) {
            event.preventDefault();
            event.stopImmediatePropagation();
            suppressed = undefined;
          }
        },
        { ...options, capture: true },
      );
      destroy.onDestroy(() => controller.abort());
    });
  }
}
