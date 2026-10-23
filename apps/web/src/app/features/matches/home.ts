import { I18n, TranslatePipe } from '../../core/i18n/i18n';
import { Component, inject, signal } from '@angular/core';
import { applyEach, form, FormField, maxLength } from '@angular/forms/signals';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { balances, type Match } from '../../../../../../packages/mahjong-core/ledger';
import {
  rankedRules,
  presetRules,
  type RuleProfile,
} from '../../../../../../packages/mahjong-rules/index';
import { RulePicker } from '../../shared/rules/rule-picker';
import { Repository } from './data-access/repository';
@Component({
  imports: [RulePicker, TranslatePipe, FormField, RouterLink, DecimalPipe, DatePipe],
  templateUrl: './home.html',
})
export class Home {
  readonly i18n = inject(I18n);
  private readonly repo = inject(Repository);
  private readonly router = inject(Router);
  readonly matches = signal<Match[]>([]);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly seats = ['East', 'South', 'West', 'North'];
  readonly count = signal<3 | 4>(4);
  readonly rules = signal(rankedRules(4));
  readonly setup = signal({
    name: '',
    names: ['', '', '', ''],
    gameLength: 'south' as 'east' | 'south',
  });
  readonly setupForm = form(this.setup, (fields) => {
    maxLength(fields.name, 80);
    applyEach(fields.names, (name) => maxLength(name, 40));
  });
  setCount(count: 3 | 4): void {
    this.count.set(count);
    const current = this.rules();
    const preset = current.preset === 'm-league' && count === 3 ? 'mahjong-soul' : current.preset;
    const next = presetRules(preset ?? 'mahjong-soul', count);
    this.rules.set(
      current.preset === 'custom'
        ? { ...current, playerCount: count, startingPoints: next.startingPoints }
        : next,
    );
  }
  updateRules(profile: RuleProfile): void {
    // A fast preset change can arrive before the child has rendered a new player count.
    const count = this.count();
    if (profile.playerCount === count) {
      this.rules.set(profile);
      return;
    }
    const preset =
      profile.preset === 'm-league' && count === 3
        ? 'mahjong-soul'
        : (profile.preset ?? 'mahjong-soul');
    const baseline = presetRules(preset, count);
    this.rules.set(
      preset === 'custom'
        ? {
            ...profile,
            id: baseline.id,
            playerCount: count,
            startingPoints: baseline.startingPoints,
          }
        : baseline,
    );
  }
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    try {
      this.matches.set(await this.repo.list());
    } catch {
      this.error.set('Local storage is unavailable. Enable browser storage to save matches.');
    }
  }
  balance(match: Match, id: string): number {
    return balances(match).players[id];
  }
  async create(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const rules = structuredClone(this.rules());
      const setup = this.setup();
      if (
        !Number.isInteger(rules.startingPoints) ||
        rules.startingPoints < 1000 ||
        rules.startingPoints > 100000
      )
        throw new Error('Starting points must be an integer between 1,000 and 100,000.');
      const players = setup.names
        .slice(0, this.count())
        .map((n, i) => ({ id: `p${i}`, name: n.trim() || this.i18n.t(`Player ${i + 1}`) }));
      const now = new Date().toISOString();
      const match: Match = {
        id: crypto.randomUUID(),
        schemaVersion: 1,
        name: setup.name.trim() || this.i18n.t(`${this.count()}P table`),
        createdAt: now,
        updatedAt: now,
        playerCount: this.count(),
        rules,
        players,
        initialBalances: Object.fromEntries(players.map((p) => [p.id, rules.startingPoints])),
        initialDealerId: players[0].id,
        dealerId: players[0].id,
        roundWind: 'east',
        handNumber: 1,
        honba: 0,
        events: [],
      };
      match.gameLength = rules.preset === 'm-league' ? 'south' : setup.gameLength;
      await this.repo.save(match);
      await this.router.navigate(['/score', match.id]);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not create match.');
    } finally {
      this.busy.set(false);
    }
  }
  async remove(match: Match): Promise<void> {
    if (!confirm(this.i18n.t(`Delete ${match.name} and its local history?`))) return;
    try {
      await this.repo.remove(match.id);
      await this.load();
    } catch {
      this.error.set('Could not delete match.');
    }
  }
}
