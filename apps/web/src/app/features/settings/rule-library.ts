import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { newId } from '../../core/id/new-id';
import {
  presetRules,
  validateProfile,
  type RuleProfile,
  type RulePreset,
} from '../../../../../../packages/mahjong-rules/index';

interface Library {
  version: 1;
  profiles: RuleProfile[];
  active: Record<3 | 4, string>;
  preferredCount?: 3 | 4;
  applied?: Partial<Record<3 | 4, RuleProfile>>;
}
const key = 'riichi-rule-library-v1';
const empty = (): Library => ({
  version: 1,
  profiles: [],
  active: { 3: 'mahjong-soul-3p', 4: 'mahjong-soul-4p' },
});

@Injectable({ providedIn: 'root' })
export class RuleLibrary {
  readonly state = signal<Library>(this.read());
  get preferredCount(): 3 | 4 {
    return this.state().preferredCount ?? 4;
  }
  constructor() {
    const sync = (event: StorageEvent) => {
      if (event.key === key) this.state.set(this.read());
    };
    window.addEventListener('storage', sync);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', sync));
  }
  profiles(count: 3 | 4): RuleProfile[] {
    return this.state().profiles.filter((profile) => profile.playerCount === count);
  }
  active(count: 3 | 4): RuleProfile {
    const applied = this.state().applied?.[count];
    if (applied) return structuredClone(applied);
    const id = this.state().active[count];
    const saved = this.profiles(count).find((profile) => profile.id === id);
    if (saved) return structuredClone(saved);
    const preset =
      (['mahjong-soul', 'tenhou', ...(count === 4 ? ['m-league'] : [])] as RulePreset[]).find(
        (preset) => `${preset}-${count}p` === id,
      ) ?? 'mahjong-soul';
    return presetRules(preset, count);
  }
  draft(count: 3 | 4): RuleProfile {
    const active = this.active(count);
    return structuredClone(
      this.profiles(count).find((profile) => profile.id === active.id) ?? active,
    );
  }
  save(profile: RuleProfile): RuleProfile {
    const errors = validateProfile(profile);
    if (errors.length) throw new Error(errors[0]);
    if (!profile.name?.trim()) throw new Error('Give this custom rule set a name.');
    const previous = this.state().profiles.find((saved) => saved.id === profile.id);
    const saved: RuleProfile = structuredClone({
      ...profile,
      preset: 'custom',
      name: profile.name.trim(),
      id: previous?.id ?? newId(),
      version: Math.max(previous?.version ?? 2, 2) + 1,
    });
    this.write({
      ...this.state(),
      profiles: [...this.state().profiles.filter((item) => item.id !== saved.id), saved],
    });
    return saved;
  }
  use(profile: RuleProfile): void {
    if (validateProfile(profile).length)
      throw new Error('Check the rule settings before applying them.');
    if (
      profile.preset === 'custom' &&
      !this.state().profiles.some((saved) => saved.id === profile.id)
    )
      throw new Error('Save the custom rules before applying them.');
    this.write({
      ...this.state(),
      preferredCount: profile.playerCount,
      active: { ...this.state().active, [profile.playerCount]: profile.id },
      applied: { ...this.state().applied, [profile.playerCount]: structuredClone(profile) },
    });
  }
  remove(profile: RuleProfile): void {
    const state = this.state();
    this.write({
      ...state,
      profiles: state.profiles.filter((item) => item.id !== profile.id),
      applied: {
        ...state.applied,
        [profile.playerCount]:
          state.active[profile.playerCount] === profile.id
            ? undefined
            : state.applied?.[profile.playerCount],
      },
      active: {
        ...state.active,
        [profile.playerCount]:
          state.active[profile.playerCount] === profile.id
            ? `mahjong-soul-${profile.playerCount}p`
            : state.active[profile.playerCount],
      },
    });
  }
  private write(state: Library): void {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      throw new Error('Rules could not be saved. Enable browser storage and try again.');
    }
    this.state.set(structuredClone(state));
  }
  private read(): Library {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (
        !value ||
        typeof value !== 'object' ||
        !('version' in value) ||
        value.version !== 1 ||
        !('profiles' in value) ||
        !Array.isArray(value.profiles) ||
        !('active' in value) ||
        !value.active ||
        typeof value.active !== 'object'
      )
        return empty();
      const profiles = value.profiles.filter((item: unknown): item is RuleProfile => {
        if (!item || typeof item !== 'object') return false;
        const profile = item as RuleProfile;
        return (
          typeof profile.id === 'string' &&
          typeof profile.name === 'string' &&
          profile.preset === 'custom' &&
          typeof profile.openTanyao === 'boolean' &&
          typeof profile.kiriage === 'boolean' &&
          !validateProfile(profile).length
        );
      });
      const active = value.active as Record<string, unknown>;
      const applied: Partial<Record<3 | 4, RuleProfile>> = {};
      if ('applied' in value && value.applied && typeof value.applied === 'object') {
        for (const count of [3, 4] as const) {
          const candidate = (value.applied as Record<string, unknown>)[count];
          if (
            candidate &&
            typeof candidate === 'object' &&
            (candidate as RuleProfile).playerCount === count &&
            !validateProfile(candidate as RuleProfile).length
          )
            applied[count] = candidate as RuleProfile;
        }
      }
      return {
        version: 1,
        profiles,
        applied,
        preferredCount: 'preferredCount' in value && value.preferredCount === 3 ? 3 : 4,
        active: {
          3: typeof active['3'] === 'string' ? active['3'] : 'mahjong-soul-3p',
          4: typeof active['4'] === 'string' ? active['4'] : 'mahjong-soul-4p',
        },
      };
    } catch {
      return empty();
    }
  }
}
