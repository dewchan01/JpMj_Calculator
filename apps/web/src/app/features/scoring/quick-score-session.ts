import { Injectable } from '@angular/core';
import type { Draft } from './scorer';

/** Keeps the current scratch hand while visiting Settings; never shares a match draft. */
@Injectable({ providedIn: 'root' })
export class QuickScoreSession {
  value?: { count: 3 | 4; preferredCount: 3 | 4; rules: string; draft: Draft };
}
