import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18n, TranslatePipe } from '../../core/i18n/i18n';
import { StorageStatus } from '../../shared/storage-status/storage-status';
import { Theme } from '../../core/theme/theme';
import { BuildInfo } from '../../core/build-info';
import { CaptureConfiguration } from '../scoring/capture/capture-config';

@Component({
  imports: [RouterLink, TranslatePipe, StorageStatus],
  templateUrl: './others.html',
  styleUrl: './others.css',
})
export class Others {
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
