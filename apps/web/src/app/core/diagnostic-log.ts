import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import {
  diagnosticPage,
  diagnosticUserMessage,
  redactDiagnostic,
  type LogCategory,
  type LogLevel,
} from './diagnostic-policy';
import type { Subscription } from 'rxjs';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  occurrences: number;
  message: string;
}
@Injectable({ providedIn: 'root' })
export class DiagnosticLog {
  readonly entries = signal<LogEntry[]>([]);
  private sequence = 0;
  private navigation?: Subscription;
  constructor() {
    const destroy = inject(DestroyRef);
    const controller = new AbortController();
    window.addEventListener('error', (event) => this.runtimeError(event.error), {
      signal: controller.signal,
    });
    window.addEventListener(
      'unhandledrejection',
      (event) => {
        this.runtimeError(event.reason);
      },
      { signal: controller.signal },
    );
    this.add('info', 'Application started.');
    destroy.onDestroy(() => {
      controller.abort();
      this.navigation?.unsubscribe();
    });
  }
  trackNavigation(router: Router): void {
    this.navigation?.unsubscribe();
    this.navigation = router.events.subscribe((event) => {
      if (event instanceof NavigationEnd)
        this.add('info', `Page: ${diagnosticPage(event.urlAfterRedirects)}`, 'navigation');
      if (event instanceof NavigationError) this.add('error', 'Navigation failed.', 'navigation');
    });
  }
  runtimeError(error: unknown): void {
    if (error instanceof Error && error.name === 'AbortError') return;
    const name =
      error instanceof Error &&
      ['TypeError', 'RangeError', 'ReferenceError', 'SyntaxError'].includes(error.name)
        ? error.name
        : 'Error';
    this.add('error', `Unexpected runtime error (${name}).`, 'runtime');
  }
  userMessage(message: string): void {
    const entry = diagnosticUserMessage(message);
    if (entry) this.add(entry.level, entry.message, entry.category);
  }
  add(level: LogEntry['level'], message: string, category: LogCategory = 'runtime'): void {
    const safe = redactDiagnostic(message);
    this.entries.update((entries) => {
      const previous = entries.at(-1);
      if (
        previous &&
        previous.level === level &&
        previous.category === category &&
        previous.message === safe &&
        Date.now() - Date.parse(previous.timestamp) < 5000
      )
        return [...entries.slice(0, -1), { ...previous, occurrences: previous.occurrences + 1 }];
      return [
        ...entries.slice(-199),
        {
          id: ++this.sequence,
          timestamp: new Date().toISOString(),
          level,
          category,
          occurrences: 1,
          message: safe,
        },
      ];
    });
  }
  clear(): void {
    this.entries.set([]);
  }
}
