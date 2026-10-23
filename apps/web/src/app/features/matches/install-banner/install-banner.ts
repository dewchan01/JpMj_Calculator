import { ErrorNotice } from '../../../shared/error-notice/error-notice';
import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/i18n';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Component({
  selector: 'app-install-banner',
  imports: [ErrorNotice, TranslatePipe],
  templateUrl: './install-banner.html',
  styleUrl: './install-banner.css',
})
export class InstallBanner {
  readonly installed = signal(false);
  readonly dismissed = signal(false);
  readonly available = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('popup');
  private prompt?: InstallPrompt;
  closePermanently(): void {
    try {
      localStorage.setItem('riichi-install-reminder-hidden', 'true');
    } catch {
      /* Dismiss for this visit if storage is unavailable. */
    }
    this.dismissed.set(true);
  }
  constructor() {
    try {
      this.dismissed.set(localStorage.getItem('riichi-install-reminder-hidden') === 'true');
    } catch {
      /* Storage is optional. */
    }
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (dialog && !dialog.open) dialog.showModal();
    });
    const standalone = window.matchMedia('(display-mode: standalone)');
    const sync = () =>
      this.installed.set(
        standalone.matches || ('standalone' in navigator && navigator.standalone === true),
      );
    const offer = (event: Event) => {
      event.preventDefault();
      this.prompt = event as InstallPrompt;
      this.available.set(true);
    };
    const installed = () => this.installed.set(true);
    sync();
    standalone.addEventListener('change', sync);
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', installed);
    inject(DestroyRef).onDestroy(() => {
      standalone.removeEventListener('change', sync);
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', installed);
    });
  }
  async install(): Promise<void> {
    const prompt = this.prompt;
    if (!prompt || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === 'accepted') this.dismissed.set(true);
    } catch {
      this.error.set('Installation could not start. Use your browser menu to install the app.');
    } finally {
      this.prompt = undefined;
      this.available.set(false);
      this.busy.set(false);
    }
  }
}
