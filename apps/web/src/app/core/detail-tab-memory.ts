import { Service, signal, inject, Injector, afterNextRender } from '@angular/core';

/** Independent tab choices retained while navigating within the app. */
@Service()
export class DetailTabMemory {
  private readonly injector = inject(Injector);
  private readonly positions = new Map<string, number>();
  private generation = 0;
  switchTab(
    group: string,
    current: string | number,
    next: string | number,
    select: () => void,
  ): void {
    if (current === next) return;
    this.positions.set(`${group}:${current}`, window.scrollY);
    const top = this.positions.get(`${group}:${next}`) ?? 0;
    const generation = ++this.generation;
    select();
    afterNextRender(
      () => {
        if (generation === this.generation) window.scrollTo({ top, behavior: 'instant' });
      },
      { injector: this.injector },
    );
  }
  readonly settingsCount = signal<3 | 4 | null>(null);
  readonly result = signal<'result' | 'history' | 'details'>('result');
  readonly player = signal<'overview' | 'stats' | 'explore'>('overview');
}
