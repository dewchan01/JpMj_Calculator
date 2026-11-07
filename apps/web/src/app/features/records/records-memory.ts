import { Service, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';

export interface RecordsPosition {
  view: 'games' | 'players';
  filters: { from: string; to: string; mode: string; participant: string };
  gameSort: string;
  playerSort: string;
  currency: string;
  top: number;
}

@Service()
export class RecordsMemory {
  position?: RecordsPosition;
  private previous = '';

  constructor() {
    const router = inject(Router);
    router.events.subscribe((event) => {
      if (event instanceof NavigationStart) this.previous = router.url;
    });
  }

  returning(): boolean {
    return /^\/records\//.test(this.previous);
  }
}
