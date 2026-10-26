import { DestroyRef, Injectable, afterNextRender, inject } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class ButtonRipples {
  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const controller = new AbortController();
      const options = { capture: true, signal: controller.signal };
      document.addEventListener('pointerdown', (event) => this.ripple(event), options);
      document.addEventListener(
        'click',
        (event) => {
          if (event.detail === 0) this.ripple(event);
        },
        options,
      );
      destroy.onDestroy(() => controller.abort());
    });
  }
  private ripple(event: MouseEvent): void {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (
      !button ||
      button.hasAttribute('data-no-ripple') ||
      button.disabled ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    if (event.type === 'pointerdown' && event.button !== 0) return;
    if (getComputedStyle(button).position === 'static') button.style.position = 'relative';
    button.classList.add('ripple-button');
    const bounds = button.getBoundingClientRect();
    const size = Math.hypot(bounds.width, bounds.height) * 2;
    const wave = document.createElement('span');
    wave.className = 'button-ripple';
    wave.style.width = wave.style.height = size + 'px';
    wave.style.left =
      (event.detail || event.type === 'pointerdown'
        ? event.clientX - bounds.left
        : bounds.width / 2) -
      size / 2 +
      'px';
    wave.style.top =
      (event.detail || event.type === 'pointerdown'
        ? event.clientY - bounds.top
        : bounds.height / 2) -
      size / 2 +
      'px';
    button.append(wave);
    const animation = wave.animate(
      [
        { transform: 'scale(0)', opacity: 0.32 },
        { transform: 'scale(1)', opacity: 0 },
      ],
      { duration: 650, easing: 'ease-out' },
    );
    void animation.finished.then(
      () => wave.remove(),
      () => wave.remove(),
    );
  }
}
