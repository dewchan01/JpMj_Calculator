import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n';

@Component({
  selector: 'app-dice-simulator',
  imports: [TranslatePipe],
  templateUrl: './dice-simulator.html',
  styleUrl: './dice-simulator.css',
})
export class DiceSimulator {
  readonly request = input(0);
  readonly diceRolling = signal(false);
  dice = [1, 1];
  private diceTimer: ReturnType<typeof setTimeout> | undefined;
  readonly dieDots = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  readonly diePips: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  constructor() {
    effect(() => {
      if (this.request()) untracked(() => this.rollDice());
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.diceTimer));
  }
  rollDice(): void {
    if (this.diceRolling()) return;
    const bytes = new Uint8Array(2),
      result: number[] = [];
    while (result.length < 2) {
      crypto.getRandomValues(bytes);
      for (const value of bytes) if (value < 252 && result.length < 2) result.push((value % 6) + 1);
    }
    this.dice = result;
    this.diceRolling.set(true);
    this.diceTimer = setTimeout(
      () => this.diceRolling.set(false),
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750,
    );
  }
}
