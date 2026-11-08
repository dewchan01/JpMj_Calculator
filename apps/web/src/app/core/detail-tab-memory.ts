import { Service, signal } from '@angular/core';

/** Independent tab choices retained while navigating within the app. */
@Service()
export class DetailTabMemory {
  readonly settingsCount = signal<3 | 4 | null>(null);
  readonly result = signal<'result' | 'history' | 'details'>('result');
  readonly player = signal<'overview' | 'stats' | 'explore'>('overview');
}
