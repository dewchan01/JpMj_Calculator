import { Component, computed, input } from '@angular/core';
import { playerConnectionStates } from '../../core/online/presence';
import { TranslatePipe } from '../../core/i18n/i18n';
import { ConnectionStatus } from '../connection-status/connection-status';

@Component({
  selector: 'app-player-presence',
  imports: [TranslatePipe, ConnectionStatus],
  templateUrl: './player-presence.html',
  styleUrl: './player-presence.css',
})
export class PlayerPresence {
  readonly players = input.required<readonly { name: string }[]>();
  readonly onlineSeats = input<readonly number[] | null>(null);
  readonly ownSeat = input<number | null>(null);
  readonly connection = input('Connecting');
  readonly states = computed(() =>
    playerConnectionStates(
      this.players().length,
      this.onlineSeats(),
      this.ownSeat(),
      this.connection(),
    ),
  );
}
