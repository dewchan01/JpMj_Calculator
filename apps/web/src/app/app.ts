import { I18n, TranslatePipe } from './core/i18n/i18n';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StorageStatus } from './shared/storage-status/storage-status';
@Component({
  selector: 'app-root',
  imports: [StorageStatus, TranslatePipe, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  readonly i18n = inject(I18n);
  changeLanguage(event: Event): void {
    this.i18n.set((event.target as HTMLSelectElement).value === 'zh-TW' ? 'zh-TW' : 'en');
  }
}
