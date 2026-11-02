import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RecordRetention {
  readonly autoDelete = signal(localStorage.getItem('riichi-auto-delete-finished') === 'true');
  setAutoDelete(value: boolean): void {
    localStorage.setItem('riichi-auto-delete-finished', String(value));
    this.autoDelete.set(value);
  }
}
