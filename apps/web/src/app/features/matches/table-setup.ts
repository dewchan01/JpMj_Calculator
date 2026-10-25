import { Injectable, signal } from '@angular/core';

/** Preserve entered names and game length while the user visits Settings. */
@Injectable({ providedIn: 'root' })
export class TableSetup {
  readonly value = signal({
    name: '',
    names: ['', '', '', ''],
    gameLength: 'south' as 'east' | 'south',
  });
}
