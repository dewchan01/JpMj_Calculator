import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'error';
export interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
  dismissOnOutside: boolean;
}

/** One replaceable transient notice, shared across pages and modal dialogs. */
@Injectable({ providedIn: 'root' })
export class Toast {
  readonly current = signal<ToastMessage | null>(null);
  private sequence = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private remaining = 0;
  private deadline = 0;
  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }
  show(
    message: string,
    kind: ToastKind = 'info',
    duration = kind === 'error' ? 8000 : 5000,
    dismissOnOutside = true,
  ): void {
    clearTimeout(this.timer);
    this.current.set({ id: ++this.sequence, message, kind, dismissOnOutside });
    this.remaining = duration;
    this.resume();
  }
  success(message: string): void {
    this.show(message, 'success');
  }
  error(message: string): void {
    this.show(message, 'error');
  }
  dismiss(): void {
    clearTimeout(this.timer);
    this.current.set(null);
  }
  pause(): void {
    clearTimeout(this.timer);
    this.remaining = Math.max(0, this.deadline - Date.now());
  }
  resume(): void {
    clearTimeout(this.timer);
    if (!this.current() || this.remaining <= 0) return;
    this.deadline = Date.now() + this.remaining;
    this.timer = setTimeout(() => this.dismiss(), this.remaining);
  }
}
