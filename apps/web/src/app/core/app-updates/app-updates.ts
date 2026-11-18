import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { BuildInfo } from '../build-info';
import { DiagnosticLog } from '../diagnostic-log';
import { Toast } from '../../shared/toast/toast';

@Injectable({ providedIn: 'root' })
export class AppUpdates {
  private readonly sw = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);
  private readonly build = inject(BuildInfo);
  private readonly logs = inject(DiagnosticLog);
  private readonly toast = inject(Toast);
  private ready = false;
  readonly busy = signal(false);
  readonly message = signal('');
  readonly failed = signal(false);
  readonly available = signal(false);
  readonly showPrompt = signal(false);
  private automatic = false;
  private timer?: ReturnType<typeof setInterval>;
  private lastAutomaticCheck = 0;
  private readonly wake = () => {
    if (Date.now() - this.lastAutomaticCheck >= 15 * 60 * 1000) this.checkAutomatically();
  };

  private markAvailable(): void {
    this.available.set(true);
    this.showPrompt.set(true);
    this.message.set('Update available');
  }

  startAutomaticChecks(): void {
    if (this.automatic) return;
    this.automatic = true;
    this.checkAutomatically();
    this.timer = setInterval(() => this.checkAutomatically(), 15 * 60 * 1000);
    this.document.addEventListener('visibilitychange', this.wake);
    this.document.defaultView?.addEventListener('online', this.wake);
  }

  private checkAutomatically(): void {
    if (
      this.document.hidden ||
      this.document.defaultView?.navigator.onLine === false ||
      this.busy() ||
      this.available()
    )
      return;
    this.lastAutomaticCheck = Date.now();
    void this.check(false, true);
  }

  constructor() {
    const subscription = this.sw.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        this.ready = true;
        this.markAvailable();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      clearInterval(this.timer);
      if (this.automatic) {
        this.document.removeEventListener('visibilitychange', this.wake);
        this.document.defaultView?.removeEventListener('online', this.wake);
      }
    });
  }

  async check(autoReload = true, silent = false): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    this.message.set('Checking for updates…');
    try {
      await this.build.ready;
      const workerActive =
        this.sw.isEnabled && !!this.document.defaultView?.navigator.serviceWorker?.controller;
      if (workerActive) {
        const downloaded = this.ready || (await this.sw.checkForUpdate());
        if (downloaded || this.ready) {
          this.markAvailable();
          if (autoReload) this.reload();
          return;
        }
      }
      // Bypass the app cache to also handle a previously downloaded update or browsers without SW.
      const response = await fetch(new URL('version.json', this.document.baseURI), {
        cache: 'no-store',
        headers: { 'ngsw-bypass': 'true' },
      });
      if (!response.ok) throw new Error('Version check failed.');
      const remote: unknown = await response.json();
      if (
        !remote ||
        typeof remote !== 'object' ||
        !('version' in remote) ||
        typeof remote.version !== 'string' ||
        !('commit' in remote) ||
        typeof remote.commit !== 'string'
      )
        throw new Error('Invalid build information.');
      const local = this.build.value();
      if (
        remote.version !== local.version ||
        remote.commit !== local.commit ||
        ('dirty' in remote && remote.dirty === true) !== local.dirty
      ) {
        this.markAvailable();
        if (autoReload) this.reload();
      } else {
        this.available.set(false);
        this.message.set('You are using the latest version.');
        if (!silent) this.toast.success(this.message());
      }
    } catch {
      this.failed.set(true);
      this.message.set('Could not check for updates. Check your connection and try again.');
      if (!silent) {
        this.toast.error(this.message());
        this.logs.add('warn', 'Could not check application updates.', 'network');
      }
    } finally {
      this.busy.set(false);
    }
  }

  apply(): void {
    if (this.available()) this.reload();
  }

  private reload(): void {
    this.message.set('Update ready. Reloading…');
    this.document.defaultView?.location.reload();
  }
}
