import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18n, TranslatePipe } from '../../core/i18n/i18n';
import { Theme } from '../../core/theme/theme';
import { BuildInfo } from '../../core/build-info';
import { CaptureConfiguration } from '../scoring/capture/capture-config';

@Component({
  imports: [RouterLink, TranslatePipe],
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
    { path: '/others/rules', title: 'Rules', mark: '01' },
    { path: '/others/version', title: 'Version', mark: '02' },
    { path: '/others/developer', title: 'Developer', mark: '03' },
    { path: '/others/terms', title: 'Terms and conditions', mark: '04' },
    { path: '/others/license', title: 'License', mark: '05' },
    { path: '/others/language', title: 'Language', mark: '06' },
    { path: '/others/theme', title: 'Theme', mark: '07' },
  ];
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
