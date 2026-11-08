import '@angular/compiler';
import {
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
  type EnvironmentInjector,
} from '@angular/core';
import { describe, it, expect } from 'vitest';
import { DetailTabMemory } from './detail-tab-memory';

describe('detail state memory', () => {
  it('restores a selection separately for each tab and after recreation', () => {
    const injector = createEnvironmentInjector(
      [DetailTabMemory],
      null as unknown as EnvironmentInjector,
    );
    runInInjectionContext(injector, () => {
      const memory = injector.get(DetailTabMemory);
      const tab = signal('stats');
      const selected = memory.remember(
        () => `player:${tab()}`,
        () => '',
      );
      expect(selected()).toBe('');
      selected.set('a');
      expect(selected()).toBe('a');
      tab.set('overview');
      expect(selected()).toBe('');
      tab.set('stats');
      expect(selected()).toBe('a');
      expect(
        memory.remember(
          () => 'player:stats',
          () => '',
        )(),
      ).toBe('a');
      const lazy = memory.remember(
        () => `lazy:${tab()}`,
        () => '',
      );
      lazy.set('b');
      tab.set('overview');
      tab.set('stats');
      expect(lazy()).toBe('b');
    });
    injector.destroy();
  });
});
