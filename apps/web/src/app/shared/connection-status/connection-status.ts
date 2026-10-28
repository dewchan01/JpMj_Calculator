import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n';

@Component({
  selector: 'app-connection-status',
  imports: [TranslatePipe],
  templateUrl: './connection-status.html',
  styleUrl: './connection-status.css',
})
export class ConnectionStatus {
  readonly state = input('Disconnected');
}
