import { newId } from '../../core/id/new-id';
import { TableSetup } from './table-setup';
import { RuleLibrary } from '../settings/rule-library';
import { ErrorNotice } from '../../shared/error-notice/error-notice';
import { InstallBanner } from './install-banner/install-banner';
import { I18n, TranslatePipe } from '../../core/i18n/i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { applyEach, form, FormField, maxLength } from '@angular/forms/signals';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { type Match } from '../../../../../../packages/mahjong-core/ledger';
import { RulePicker } from '../../shared/rules/rule-picker';
import { Repository } from './data-access/repository';
import { PlayerLibrary } from './data-access/player-library';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DiceSimulator } from '../../shared/dice-simulator/dice-simulator';
import { emptyLive } from '../../../../../../packages/mahjong-core/live';
@Component({
  imports: [
    ErrorNotice,
    InstallBanner,
    RulePicker,
    TranslatePipe,
    FormField,
    RouterLink,
    DecimalPipe,
    ReactiveFormsModule,
    FormsModule,
    DiceSimulator,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  swapA = 0;
  swapB = 1;
  readonly diceRequest = signal(0);
  readonly seatNotice = signal('');
  activeNames(): string[] {
    return this.setup()
      .names.slice(0, this.count())
      .map((name, i) => name.trim() || this.i18n.t(`Player ${i + 1}`));
  }
  savedPlayerId(index: number): string {
    return (
      this.playerLibrary.players().find((player) => player.name === this.setup().names[index])
        ?.id ?? ''
    );
  }
  swapPlayers(): void {
    const names = this.activeNames();
    if (this.swapA === this.swapB || !names[this.swapA] || !names[this.swapB]) return;
    [names[this.swapA], names[this.swapB]] = [names[this.swapB], names[this.swapA]];
    this.setup.update((setup) => ({
      ...setup,
      names: [...names, ...setup.names.slice(this.count())],
    }));
    this.seatNotice.set('Positions swapped.');
  }
  randomizePlayers(): void {
    const names = this.activeNames();
    for (let i = names.length - 1; i > 0; i--) {
      const bytes = new Uint32Array(1),
        limit = Math.floor(0x100000000 / (i + 1)) * (i + 1);
      do {
        crypto.getRandomValues(bytes);
      } while (bytes[0] >= limit);
      const j = bytes[0] % (i + 1);
      [names[i], names[j]] = [names[j], names[i]];
    }
    this.setup.update((setup) => ({
      ...setup,
      names: [...names, ...setup.names.slice(this.count())],
    }));
    this.seatNotice.set('Positions randomized.');
  }
  readonly playerError = signal('');
  readonly playerLibrary = inject(PlayerLibrary);
  readonly playerName = new FormControl('', { nonNullable: true });
  addPlayer(): void {
    this.playerError.set('');
    try {
      this.playerLibrary.add(this.playerName.value);
      this.playerName.reset();
      this.playerError.set('');
    } catch (e) {
      this.playerError.set(e instanceof Error ? e.message : 'Could not save player.');
    }
  }
  removePlayer(id: string): void {
    try {
      this.playerLibrary.remove(id);
    } catch {
      this.playerError.set('Could not save player.');
    }
  }
  choosePlayer(index: number, id: string): void {
    const player = this.playerLibrary.players().find((p) => p.id === id);
    if (player)
      this.setup.update((setup) => ({
        ...setup,
        names: setup.names.map((name, i) => (i === index ? player.name : name)),
      }));
  }
  readonly library = inject(RuleLibrary);
  readonly i18n = inject(I18n);
  private readonly repo = inject(Repository);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly seats = ['East', 'South', 'West', 'North'];
  readonly count = signal<3 | 4>(this.library.preferredCount);
  readonly rules = computed(() => this.library.active(this.count()));
  readonly setup = inject(TableSetup).value;
  readonly setupForm = form(this.setup, (fields) => {
    maxLength(fields.name, 80);
    applyEach(fields.names, (name) => maxLength(name, 40));
  });
  setCount(count: 3 | 4): void {
    this.count.set(count);
    this.swapA = 0;
    this.swapB = 1;
    this.seatNotice.set('');
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
      const players = setup.names.slice(0, this.count()).map((n, i) => ({
        id: `p${i}`,
        name: n.trim() || this.i18n.t(`Player ${i + 1}`),
        profileId: this.playerLibrary.players().find((p) => p.name === n.trim())?.id,
      }));
      if (new Set(players.map((p) => p.name)).size !== players.length)
        throw new Error('Choose a different player for each seat.');
      const now = new Date().toISOString();
      const match: Match = {
        id: newId(),
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
        live: emptyLive(),
        clock: { elapsedMs: 0, runningSince: now, handStartMs: 0 },
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
}
