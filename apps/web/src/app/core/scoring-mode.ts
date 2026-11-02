import { Service, signal } from '@angular/core';

@Service()
export class ScoringMode {
  readonly hideMoney = signal(localStorage.getItem('riichi-hide-money') === 'true');
  setHideMoney(value: boolean): void {
    localStorage.setItem('riichi-hide-money', String(value));
    this.hideMoney.set(value);
  }
  readonly advanced = signal(this.saved());
  private saved(): boolean {
    try {
      return localStorage.getItem('riichi-advanced-scoring') === 'true';
    } catch {
      return false;
    }
  }
  setAdvanced(value: boolean): void {
    this.advanced.set(value);
    try {
      localStorage.setItem('riichi-advanced-scoring', String(value));
    } catch {
      /* Keep the preference for this session if storage is unavailable. */
    }
  }
}
