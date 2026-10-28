import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';

/** Loads the environment-selected public settings once for all consumers. */
@Service()
export class AppConfiguration {
  private readonly document = inject(DOCUMENT);
  readonly ready: Promise<unknown> = this.read();

  private async read(): Promise<unknown> {
    try {
      const response = await fetch(new URL('config.json', this.document.baseURI), {
        signal: AbortSignal.timeout(10000),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }
}
