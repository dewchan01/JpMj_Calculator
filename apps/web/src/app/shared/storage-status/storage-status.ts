import { DOCUMENT, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { I18n, TranslatePipe } from '../../core/i18n/i18n';
import { StorageUsageMonitor } from '../../core/storage/storage-usage';

@Component({
  selector: 'app-storage-status',
  imports: [DecimalPipe, TranslatePipe],
  templateUrl: './storage-status.html',
  styleUrl: './storage-status.css',
})
export class StorageStatus {
  readonly storage = inject(StorageUsageMonitor);
  private readonly i18n = inject(I18n);

  constructor() {
    const window = inject(DOCUMENT).defaultView;
    const refresh = () => {
      void this.storage.refresh();
    };
    refresh();
    const timer = window?.setInterval(refresh, 30_000);
    window?.addEventListener('focus', refresh);
    inject(DestroyRef).onDestroy(() => {
      window?.clearInterval(timer);
      window?.removeEventListener('focus', refresh);
    });
  }

  bytes(value: number): string {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    const index = Math.min(
      value > 0 ? Math.floor(Math.log(value) / Math.log(1024)) : 0,
      units.length - 1,
    );
    return (
      new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 2 }).format(
        value / 1024 ** Math.max(0, index),
      ) +
      ' ' +
      units[Math.max(0, index)]
    );
  }
}
