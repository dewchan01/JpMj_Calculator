import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n';
import { LoadingSpinner } from '../loading-spinner/loading-spinner';

@Component({
  selector: 'app-connection-status',
  imports: [TranslatePipe, LoadingSpinner],
  templateUrl: './connection-status.html',
  styleUrl: './connection-status.css',
})
export class ConnectionStatus {
  readonly state = input('Disconnected');
  readonly label = input('');
  readonly compact = input(false);
}
