import { CaptureConfiguration } from './features/scoring/capture/capture-config';
import { I18n, TranslatePipe } from './core/i18n/i18n';
import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { StorageStatus } from './shared/storage-status/storage-status';
import { BuildInfo } from './core/build-info';
import { Theme } from './core/theme/theme';
@Component({
  selector: 'app-root',
  imports: [StorageStatus, TranslatePipe, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly configuration = inject(CaptureConfiguration);
  readonly version = inject(BuildInfo).value;
  constructor() {
    void this.configuration.load();
  }
  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  readonly showStorage = computed(() => this.currentUrl().split(/[?#]/)[0] === '/others/rules');
  readonly tableActive = computed(() => {
    const path = this.currentUrl().split(/[?#]/)[0];
    return path === '/' || path === '/score' || path.startsWith('/score/');
  });
  readonly liveTable = computed(() => this.currentUrl().split(/[?#]/)[0].startsWith('/score/'));
  readonly i18n = inject(I18n);
  readonly theme = inject(Theme);
  changeLanguage(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'en' || value === 'zh-TW' || value === 'zh-CN' || value === 'ja')
      this.i18n.set(value);
  }
}
