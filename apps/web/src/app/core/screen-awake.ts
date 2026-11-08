import { DestroyRef, Service, inject } from '@angular/core';

@Service()
export class ScreenAwake {
  private enabled = false;
  private visible = !document.hidden;
  private lock?: WakeLockSentinel;
  private pending = false;
  private generation = 0;

  constructor() {
    const hide = () => {
      this.visible = false;
      this.update();
    };
    const show = () => {
      this.visible = !document.hidden;
      this.update();
    };
    const visibility = () => (document.hidden ? hide() : show());
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
      this.setActive(false);
    });
  }

  setActive(enabled: boolean): void {
    this.enabled = enabled;
    this.update();
  }

  private update(): void {
    if (!this.enabled || !this.visible) {
      this.generation++;
      const lock = this.lock;
      this.lock = undefined;
      if (lock) void lock.release().catch(() => undefined);
      return;
    }
    if (!('wakeLock' in navigator) || this.lock || this.pending) return;
    void this.acquire();
  }

  private async acquire(): Promise<void> {
    const generation = this.generation;
    this.pending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (generation !== this.generation || !this.enabled || !this.visible) {
        await lock.release();
        return;
      }
      this.lock = lock;
      lock.addEventListener(
        'release',
        () => {
          if (this.lock === lock) this.lock = undefined;
        },
        { once: true },
      );
    } catch {
      // Unsupported devices and system power restrictions must not interrupt a match.
    } finally {
      this.pending = false;
      if (generation !== this.generation) this.update();
    }
  }
}
