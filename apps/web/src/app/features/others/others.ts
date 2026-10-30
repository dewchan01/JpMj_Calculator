import { DataTransfer } from '../records/data-transfer/data-transfer';
import { GameSounds } from '../../core/sound/game-sounds';
import { BackgroundMusic } from '../../core/sound/background-music';
import { AudioControls } from '../../core/sound/audio-controls';
import { ScoringMode } from '../../core/scoring-mode';
import { Component, computed, inject, signal } from '@angular/core';
import { Repository } from '../matches/data-access/repository';
import { ErrorNotice } from '../../shared/error-notice/error-notice';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18n, TranslatePipe } from '../../core/i18n/i18n';
import { StorageStatus } from '../../shared/storage-status/storage-status';
import { Theme } from '../../core/theme/theme';
import { BuildInfo } from '../../core/build-info';
import { AppUpdates } from '../../core/app-updates/app-updates';
import { CaptureConfiguration } from '../scoring/capture/capture-config';

@Component({
  imports: [
    DataTransfer,
    RouterLink,
    TranslatePipe,
    StorageStatus,
    DialogBackdrop,
    LocalDatePipe,
    ErrorNotice,
  ],
  templateUrl: './others.html',
  styleUrl: './others.css',
})
export class Others {
  private readonly repo = inject(Repository);
  readonly clearMode = signal<'records' | 'all'>('records');
  readonly clearing = signal(false);
  readonly clearError = signal('');
  readonly canDismissClear = () => !this.clearing();
  async clearLocalData(): Promise<void> {
    if (this.clearing()) return;
    this.clearing.set(true);
    this.clearError.set('');
    try {
      await this.repo.clearRecords();
      for (const storage of [localStorage, sessionStorage]) {
        for (const key of Object.keys(storage)) {
          if (
            this.clearMode() === 'all' ? key.startsWith('riichi-') : key.startsWith('riichi-view:')
          )
            storage.removeItem(key);
        }
      }
      window.location.reload();
    } catch {
      this.clearError.set('Could not clear local data. Try again.');
      this.clearing.set(false);
    }
  }
  readonly updates = inject(AppUpdates);
  readonly scoringMode = inject(ScoringMode);
  readonly sounds = inject(GameSounds);
  readonly music = inject(BackgroundMusic);
  readonly audio = inject(AudioControls);
  readonly soundLabels = {
    pon: 'Pon',
    kita: 'North extraction',
    chi: 'Chi',
    daiminkan: 'Open Kan',
    kakan: 'Added Kan',
    ankan: 'Concealed Kan',
    riichi: 'Riichi',
    doubleRiichi: 'Double Riichi',
    ron: 'Ron · discard',
    tsumo: 'Tsumo · self draw',
  };
  readonly logs = inject(DiagnosticLog);
  private logTapCount = 0;
  private lastLogTap = 0;
  revealLogs(dialog: HTMLDialogElement): void {
    const now = performance.now();
    this.logTapCount = now - this.lastLogTap <= 900 ? this.logTapCount + 1 : 1;
    this.lastLogTap = now;
    if (this.logTapCount === 3) {
      this.logTapCount = 0;
      dialog.showModal();
    }
  }
  readonly i18n = inject(I18n);
  readonly theme = inject(Theme);
  readonly build = inject(BuildInfo).value;
  readonly configuration = inject(CaptureConfiguration);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  readonly section = computed(() => this.params()?.get('section') ?? '');
  readonly entries = [
    {
      path: '/others/language',
      title: 'Language',
      group: 'Preferences',
      icon: 'M3 5h12M9 3v2m-3 0c0 6 6 10 6 10M13 5c0 6-6 10-9 11m10 5 4-11 4 11m-6-4h4',
    },
    {
      path: '/others/theme',
      title: 'Theme',
      group: 'Preferences',
      icon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
    },
    {
      path: '/others/sound',
      title: 'Sound effects',
      group: 'Preferences',
      icon: 'M11 4 6 8H3v8h3l5 4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
    },
    {
      path: '/others/advanced',
      title: 'Scoring mode',
      group: 'Preferences',
      icon: 'M5 3h14v18H5ZM8 6h8v4H8Zm0 8h2m4 0h2m-8 4h2m4 0h2',
    },
    {
      path: '/others/data-management',
      title: 'Manage local data',
      group: 'Preferences',
      icon: 'M4 5h16v14H4zM4 9h16M8 13h8m-8 3h5',
    },
    {
      path: '/others/rules',
      title: 'Rules',
      group: 'Help and information',
      icon: 'M4 3h16v18H4zM8 7h8M8 12h8M8 17h5',
    },
    {
      path: '/others/version',
      title: 'Version',
      group: 'Help and information',
      icon: 'M12 11v7m0-12h.01M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20',
    },
    {
      path: '/others/developer',
      title: 'Developer',
      group: 'Help and information',
      icon: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16',
    },
    {
      path: '/others/terms',
      title: 'Terms and conditions',
      group: 'Legal',
      icon: 'M5 3h10l4 4v14H5zM14 3v5h5M9 12h6m-6 4h6',
    },
    {
      path: '/others/license',
      title: 'License',
      group: 'Legal',
      icon: 'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7Zm-4 9 3 3 5-6',
    },
  ];
  readonly groups = ['Preferences', 'Help and information', 'Legal'].map((title) => ({
    title,
    entries: this.entries.filter((entry) => entry.group === title),
  }));
  readonly title = computed(
    () =>
      this.entries.find((entry) => entry.path === '/others/' + this.section())?.title ?? 'Others',
  );
  changeLanguage(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'en' || value === 'zh-TW' || value === 'zh-CN' || value === 'ja')
      this.i18n.set(value);
  }
}
import { DiagnosticLog } from '../../core/diagnostic-log';
import { DialogBackdrop } from '../../shared/dialog-backdrop';
import { LocalDatePipe } from '../../core/i18n/local-date';
