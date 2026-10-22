import { I18n, TranslatePipe } from '../../core/i18n/i18n';
import { Component, inject } from '@angular/core';
@Component({ imports: [TranslatePipe], templateUrl: './about.html' })
export class About {
  readonly i18n = inject(I18n);
}
