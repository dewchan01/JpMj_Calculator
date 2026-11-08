import {
  Service,
  signal,
  inject,
  Injector,
  afterNextRender,
  linkedSignal,
  DestroyRef,
  type WritableSignal,
} from '@angular/core';

/** Independent tab choices retained while navigating within the app. */
@Service()
export class DetailTabMemory {
  private readonly values = new Map<string, unknown>();
  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }
  set<T>(key: string, value: T): void {
    this.values.set(key, value);
  }
  remember<T>(key: () => string, initial: () => T): WritableSignal<T> {
    const value = linkedSignal<string, T>({
      source: key,
      computation: (current) => {
        return this.values.has(current) ? this.get<T>(current)! : initial();
      },
    });
    const set = value.set.bind(value);
    value.set = (next) => {
      this.set(key(), next);
      set(next);
    };
    value.update = (update) => value.set(update(value()));
    inject(DestroyRef).onDestroy(() => this.set(key(), value()));
    return value;
  }
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
