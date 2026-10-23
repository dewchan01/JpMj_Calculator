import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Service, signal } from '@angular/core';

@Service()
export class Theme {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(false);
  constructor() {
    const window = this.document.defaultView;
    const media = window?.matchMedia('(prefers-color-scheme: dark)');
    let saved: string | null = null;
    try {
      saved = window?.localStorage.getItem('riichi-theme') ?? null;
    } catch {
      /* In-memory preference still works. */
    }
    this.apply(saved === 'dark' || (saved !== 'light' && !!media?.matches));
    const changed = () => {
      try {
        if (window?.localStorage.getItem('riichi-theme')) return;
      } catch {
        return;
      }
      this.apply(!!media?.matches);
    };
    media?.addEventListener('change', changed);
    inject(DestroyRef).onDestroy(() => media?.removeEventListener('change', changed));
  }
  toggle(): void {
    this.apply(!this.dark());
    try {
      this.document.defaultView?.localStorage.setItem(
        'riichi-theme',
        this.dark() ? 'dark' : 'light',
      );
    } catch {
      /* Keep in-memory preference. */
    }
  }
  private apply(dark: boolean): void {
    this.dark.set(dark);
    this.document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
  }
}
