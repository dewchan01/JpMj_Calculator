import { Component, linkedSignal, model } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n';

@Component({
  selector: 'app-date-time-field',
  imports: [TranslatePipe],
  templateUrl: './date-time-field.html',
  styleUrl: './date-time-field.css',
})
export class DateTimeField {
  readonly value = model('');
  readonly date = linkedSignal(() => this.value().split('T')[0] ?? '');
  readonly time = linkedSignal(() => this.value().split('T')[1]?.slice(0, 5) ?? '');

  update(part: 'date' | 'time', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const date = part === 'date' ? value : this.date();
    const time = part === 'time' ? value : this.time();
    this.value.set(date && time ? `${date}T${time}` : '');
    this.date.set(date);
    this.time.set(time);
  }
}
