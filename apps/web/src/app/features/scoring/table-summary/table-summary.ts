import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DecimalPipe, NgOptimizedImage } from '@angular/common';
import { WINDS, type Wind } from '../../../../../../../packages/mahjong-core/index';
import { I18n, TranslatePipe } from '../../../core/i18n/i18n';
import { ConnectionStatus } from '../../../shared/connection-status/connection-status';
import type { LedgerEvent } from '../../../../../../../packages/mahjong-core/ledger';

@Component({
  selector: 'app-table-summary',
  imports: [DecimalPipe, NgOptimizedImage, TranslatePipe, ConnectionStatus],
  templateUrl: './table-summary.html',
  styleUrl: './table-summary.css',
  host: {
    '[class.interactive]': 'interactive()',
    '[class.compact]': 'compact()',
    '(window:blur)': 'releaseComparison()',
    '(document:visibilitychange)': 'releaseComparison()',
  },
})
export class TableSummary {
  private readonly layout = viewChild<ElementRef<HTMLElement>>('layout');
  constructor() {
    afterRenderEffect((cleanup) => {
      if (!this.compact()) return;
      const layout = this.layout()?.nativeElement;
      const surface = layout?.querySelector<HTMLElement>('.table-surface');
      if (!layout || !surface) return;
      const desktop = matchMedia('(min-width: 701px)');
      let frame = 0;
      let scale = Number(surface.style.getPropertyValue('--table-scale')) || 1;
      let shiftX = parseFloat(surface.style.getPropertyValue('--table-shift-x')) || 0;
      let shiftY = parseFloat(surface.style.getPropertyValue('--table-shift-y')) || 0;
      const fit = () => {
        if (!desktop.matches) {
          scale = 1;
          shiftX = shiftY = 0;
        } else {
          const bounds = layout.getBoundingClientRect();
          if (!bounds.width || !bounds.height) return;
          const cx = bounds.left + bounds.width / 2;
          const cy = bounds.top + bounds.height / 2;
          let left = Infinity;
          let right = -Infinity;
          let top = Infinity;
          let bottom = -Infinity;
          for (const element of surface.querySelectorAll(
            '.player-seat, .seat-actions, .seat-label, .table-center',
          )) {
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) continue;
            left = Math.min(left, (rect.left - cx - shiftX) / scale);
            right = Math.max(right, (rect.right - cx - shiftX) / scale);
            top = Math.min(top, (rect.top - cy - shiftY) / scale);
            bottom = Math.max(bottom, (rect.bottom - cy - shiftY) / scale);
          }
          scale = Math.min(
            1,
            (bounds.width - 16) / (right - left),
            (bounds.height - 16) / (bottom - top),
          );
          shiftX = -((left + right) / 2) * scale;
          shiftY = -((top + bottom) / 2) * scale;
        }
        surface.style.setProperty('--table-scale', String(scale));
        surface.style.setProperty('--table-shift-x', `${shiftX}px`);
        surface.style.setProperty('--table-shift-y', `${shiftY}px`);
      };
      const schedule = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(fit);
      };
      const observer = new ResizeObserver(schedule);
      observer.observe(layout);
      window.addEventListener('resize', schedule);
      schedule();
      cleanup(() => {
        observer.disconnect();
        window.removeEventListener('resize', schedule);
        cancelAnimationFrame(frame);
      });
    });
  }
  readonly interactive = input(false);
  readonly presence = input<Readonly<Record<string, string>> | null>(null);
  readonly compact = input(false);
  readonly liveControls = input(false);
  readonly showCaption = input(true);
  readonly ended = input(false);
  readonly handAction = output<void>();
  readonly playerAction = output<string>();
  readonly quickAction = output<{ player: string; type: string }>();
  readonly actionsDisabled = input(false);
  readonly activePlayer = input('');
  readonly allowRiichi = input(true);
  readonly allowCalls = input(true);
  readonly callCounts = input<Record<string, number>>({});
  readonly concealedKanCounts = input<Record<string, number>>({});
  readonly northCounts = input<Record<string, number>>({});
  readonly riichiPlayers = input<Record<string, string>>({});
  readonly pointDifference = output<string>();
  readonly differenceFrom = input('');
  private comparisonHeld = false;
  private heldPointer: number | null = null;
  holdComparison(event: PointerEvent, player: string): void {
    if (event.button !== 0 || this.comparisonHeld) return;
    event.preventDefault();
    this.heldPointer = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.comparisonHeld = true;
    this.pointDifference.emit(player);
  }
  holdKeyboard(event: KeyboardEvent, player: string): void {
    if (![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    if (event.repeat || this.comparisonHeld) return;
    this.comparisonHeld = true;
    this.pointDifference.emit(player);
  }
  releaseKeyboard(event: KeyboardEvent): void {
    if (![' ', 'Enter', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    this.releaseComparison();
  }
  releasePointer(event: PointerEvent): void {
    if (this.heldPointer === event.pointerId) this.releaseComparison();
  }
  releaseComparison(): void {
    if (!this.comparisonHeld) return;
    this.comparisonHeld = false;
    this.heldPointer = null;
    this.pointDifference.emit('');
  }
  displayPoints(id: string): number {
    return this.differenceFrom() && this.differenceFrom() !== id
      ? this.balances()[id] - this.balances()[this.differenceFrom()]
      : this.balances()[id];
  }
  readonly viewSeats = input<string[]>([]);
  private readonly i18n = inject(I18n);
  readonly players = input.required<{ id: string; name: string }[]>();
  readonly balances = input.required<Record<string, number>>();
  readonly dealer = input.required<string>();
  readonly winner = input.required<string>();
  readonly roundWind = input.required<Wind>();
  readonly handNumber = input.required<number>();
  readonly honba = input.required<number>();
  readonly pot = input.required<number>();
  readonly ruleName = input.required<string>();
  readonly gameLength = input<'east' | 'south'>();
  readonly events = input<LedgerEvent[]>([]);
  readonly yakitoriPenalty = input(0);
  readonly recordedWinners = computed(
    () =>
      new Set(
        this.events().flatMap((event) => {
          if (event.type === 'multipleRon') return event.winnerIds ?? [];
          if (event.type === 'nagashi') return event.winnerIds ?? [];
          if (event.type !== 'win') return [];
          const winner = event.win?.winnerId ?? event.scoringInput?.win.winnerId;
          return event.winnerIds ?? (winner ? [winner] : []);
        }),
      ),
  );
  seat(index: number): Wind {
    return WINDS[
      (index -
        this.players().findIndex((player) => player.id === this.dealer()) +
        this.players().length) %
        this.players().length
    ];
  }
  position(index: number): string {
    const display = this.viewSeats().indexOf(this.players()[index].id);
    return ['bottom', 'right', 'top', 'left'][display < 0 ? index : display];
  }
  windLabel(index: number): string {
    const wind = this.seat(index);
    return this.i18n.locale() === 'en' ? wind[0].toUpperCase() : this.i18n.t(wind);
  }
}
