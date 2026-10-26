import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationError, Router } from '@angular/router';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'error';
  message: string;
}
@Injectable({ providedIn: 'root' })
export class DiagnosticLog {
  readonly entries = signal<LogEntry[]>([]);
  private sequence = 0;
  constructor() {
    const destroy = inject(DestroyRef);
    const controller = new AbortController();
    window.addEventListener(
      'error',
      (event) => this.add('error', event.message || 'Resource failed to load.'),
      { signal: controller.signal },
    );
    window.addEventListener(
      'unhandledrejection',
      (event) => {
        this.add(
          'error',
          event.reason instanceof Error ? event.reason.message : String(event.reason),
        );
      },
      { signal: controller.signal },
    );
    const navigation = inject(Router).events.subscribe((event) => {
      // Route names are useful without retaining player names, IDs or query parameters.
      if (event instanceof NavigationEnd)
        this.add(
          'info',
          `Page: ${event.urlAfterRedirects.split(/[?#]/)[0].split('/').slice(0, 2).join('/') || '/'}`,
        );
      if (event instanceof NavigationError)
        this.add('error', event.error instanceof Error ? event.error.message : String(event.error));
    });
    this.add('info', 'Application started.');
    destroy.onDestroy(() => {
      controller.abort();
      navigation.unsubscribe();
    });
  }
  add(level: LogEntry['level'], message: string): void {
    this.entries.update((entries) => [
      ...entries.slice(-199),
      {
        id: ++this.sequence,
        timestamp: new Date().toISOString(),
        level,
        message: message.slice(0, 2000),
      },
    ]);
  }
  clear(): void {
    this.entries.set([]);
  }
}
