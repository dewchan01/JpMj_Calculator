import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';

export type StorageLevel = 'normal' | 'warning' | 'critical';
export interface StorageUsage {
  used: number;
  quota: number;
  percent: number;
  level: StorageLevel;
}

/** Browser estimates cover the entire origin, including IndexedDB and offline caches. */
export function readStorageEstimate(estimate: StorageEstimate): StorageUsage | null {
  const { usage, quota } = estimate;
  if (
    usage === undefined ||
    quota === undefined ||
    !Number.isFinite(usage) ||
    !Number.isFinite(quota) ||
    usage < 0 ||
    quota <= 0
  )
    return null;
  const percent = (usage / quota) * 100;
  return {
    used: usage,
    quota,
    percent,
    level: percent >= 95 ? 'critical' : percent >= 80 ? 'warning' : 'normal',
  };
}

@Service()
export class StorageUsageMonitor {
  private readonly document = inject(DOCUMENT);
  readonly usage = signal<StorageUsage | null>(null);
  readonly refreshing = signal(false);
  readonly level = computed(() => this.usage()?.level ?? 'normal');

  async refresh(): Promise<void> {
    if (this.refreshing()) return;
    const storage = this.document.defaultView?.navigator.storage;
    if (!storage?.estimate) {
      this.usage.set(null);
      return;
    }
    this.refreshing.set(true);
    try {
      this.usage.set(readStorageEstimate(await storage.estimate()));
    } catch {
      this.usage.set(null);
    } finally {
      this.refreshing.set(false);
    }
  }
}
