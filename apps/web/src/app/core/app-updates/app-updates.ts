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

  constructor() {
    const subscription = this.sw.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') this.ready = true;
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  async check(): Promise<void> {
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
          this.reload();
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
      )
        this.reload();
      else {
        this.message.set('You are using the latest version.');
        this.toast.success(this.message());
      }
    } catch {
      this.failed.set(true);
      this.message.set('Could not check for updates. Check your connection and try again.');
      this.toast.error(this.message());
      this.logs.add('warn', 'Could not check application updates.', 'network');
    } finally {
      this.busy.set(false);
    }
  }

  private reload(): void {
    this.message.set('Update ready. Reloading…');
    this.document.defaultView?.location.reload();
  }
}
