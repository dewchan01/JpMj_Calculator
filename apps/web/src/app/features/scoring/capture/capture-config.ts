import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';
import { parseCaptureConfig, type CaptureConfig } from './capture-settings';

@Service()
export class CaptureConfiguration {
  private readonly document = inject(DOCUMENT);
  readonly value = signal<CaptureConfig | null>(null);
  readonly error = signal('');
  readonly supportEmail = signal('');
  readonly developerName = signal('Riichi / table');
  private loading?: Promise<void>;
  load(): Promise<void> {
    return (this.loading ??= this.read());
  }
  private async read(): Promise<void> {
    try {
      const response = await fetch(new URL('config.json', this.document.baseURI), {
        signal: AbortSignal.timeout(10000),
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Configuration unavailable');
      const data: unknown = await response.json();
      if (
        typeof data === 'object' &&
        data !== null &&
        'developerName' in data &&
        typeof data.developerName === 'string' &&
        data.developerName.trim()
      )
        this.developerName.set(data.developerName.trim().slice(0, 100));
      if (
        typeof data === 'object' &&
        data !== null &&
        'supportEmail' in data &&
        typeof data.supportEmail === 'string' &&
        /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.supportEmail)
      )
        this.supportEmail.set(data.supportEmail.trim());
      this.value.set(parseCaptureConfig(data));
    } catch {
      this.error.set(
        'Photo recognition is unavailable. Check config.json. Manual entry still works.',
      );
    }
  }
}
