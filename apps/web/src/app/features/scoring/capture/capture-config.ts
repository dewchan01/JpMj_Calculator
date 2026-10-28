import { inject, Service, signal } from '@angular/core';
import { AppConfiguration } from '../../../core/config/app-config';
import { parseCaptureConfig, type CaptureConfig } from './capture-settings';

@Service()
export class CaptureConfiguration {
  private readonly configuration = inject(AppConfiguration);
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
      const data = await this.configuration.ready;
      if (!data) throw new Error('Configuration unavailable');
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
