import { CaptureConfiguration } from './features/scoring/capture/capture-config';
import { I18n, TranslatePipe } from './core/i18n/i18n';
import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Theme } from './core/theme/theme';
import { GameSounds } from './core/sound/game-sounds';
import { SegmentedSwipe } from './shared/segmented-swipe';
import { ToastHost } from './shared/toast/toast-host';
@Component({
  selector: 'app-root',
  imports: [ToastHost, TranslatePipe, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly sounds = inject(GameSounds);
  toggleSound(): void {
    this.sounds.setEnabled(!this.sounds.enabled());
    if (this.sounds.enabled()) this.sounds.unlock();
  }
  private readonly tabScroll = inject(TabScroll);
  private readonly segmentedSwipe = inject(SegmentedSwipe);
  private readonly diagnosticLog = inject(DiagnosticLog);
  private readonly ripples = inject(ButtonRipples);
  readonly configuration = inject(CaptureConfiguration);
  constructor() {
    this.diagnosticLog.trackNavigation(this.router);
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
  readonly tableActive = computed(() => {
    const path = this.currentUrl().split(/[?#]/)[0];
    return (
      path === '/' || path === '/score' || path.startsWith('/score/') || path.startsWith('/room/')
    );
  });
  readonly liveTable = computed(() => /^\/(score|room)\//.test(this.currentUrl().split(/[?#]/)[0]));
  readonly i18n = inject(I18n);
  readonly theme = inject(Theme);
  changeLanguage(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'en' || value === 'zh-TW' || value === 'zh-CN' || value === 'ja')
      this.i18n.set(value);
  }
}
import { ButtonRipples } from './shared/ripple';
import { DiagnosticLog } from './core/diagnostic-log';
import { TabScroll } from './shared/tab-scroll';
