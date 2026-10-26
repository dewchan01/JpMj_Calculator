import { Pipe, inject, type PipeTransform } from '@angular/core';
import { I18n } from './i18n';
import { localizedDate } from './date-format';

@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  transform(
    value: string | number | Date | null | undefined,
    style: 'dateTime' | 'date' | 'time' = 'dateTime',
  ): string {
    return localizedDate(value, this.i18n.locale(), style);
  }
}
