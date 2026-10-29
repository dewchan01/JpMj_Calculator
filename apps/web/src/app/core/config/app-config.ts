import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { DiagnosticLog } from '../diagnostic-log';

/** Loads the environment-selected public settings once for all consumers. */
@Service()
export class AppConfiguration {
  private readonly document = inject(DOCUMENT);
  private readonly logs = inject(DiagnosticLog);
  readonly ready: Promise<unknown> = this.read();

  private async read(): Promise<unknown> {
    try {
      const response = await fetch(new URL('config.json', this.document.baseURI), {
        signal: AbortSignal.timeout(10000),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) {
        this.logs.add(
          'warn',
          `Configuration request failed (HTTP ${response.status}).`,
          'configuration',
        );
        return null;
      }
      return await response.json();
    } catch {
      this.logs.add('warn', 'Public configuration could not be loaded.', 'configuration');
      return null;
    }
  }
}
