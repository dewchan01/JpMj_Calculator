import '@angular/compiler';
import { DOCUMENT } from '@angular/common';
import {
  createEnvironmentInjector,
  Injector,
  runInInjectionContext,
  signal,
  type EnvironmentInjector,
} from '@angular/core';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuildInfo } from '../build-info';
import { DiagnosticLog } from '../diagnostic-log';
import { AppUpdates } from './app-updates';
import { Toast } from '../../shared/toast/toast';

const injectors: EnvironmentInjector[] = [];
afterEach(() => {
  injectors.splice(0).forEach((injector) => injector.destroy());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setup(worker = true) {
  const events = new Subject<VersionEvent>();
  const sw = {
    isEnabled: worker,
    versionUpdates: events,
    checkForUpdate: vi.fn(async () => false),
  };
  const reload = vi.fn();
  const logs = { add: vi.fn() };
  const local = { version: '1.0.0', commit: 'old', dirty: false };
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => local }));
  vi.stubGlobal('fetch', fetcher);
  const injector = createEnvironmentInjector(
    [
      { provide: SwUpdate, useValue: sw },
      { provide: BuildInfo, useValue: { ready: Promise.resolve(), value: signal(local) } },
      { provide: DiagnosticLog, useValue: logs },
      { provide: Toast, useValue: { success: vi.fn(), error: vi.fn() } },
      {
        provide: DOCUMENT,
        useValue: {
          baseURI: 'https://example.com/app/',
          hidden: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          defaultView: {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            navigator: { serviceWorker: { controller: worker ? {} : null } },
            location: { reload },
          },
        },
      },
    ],
    Injector.NULL as EnvironmentInjector,
  );
  injectors.push(injector);
  const service = runInInjectionContext(injector, () => new AppUpdates());
  return {
    service,
    sw,
    reload,
    events,
    fetcher,
    logs,
    document: injector.get(DOCUMENT),
    toast: injector.get(Toast),
  };
}

describe('manual application updates', () => {
  it('automatically applies an update on startup without opening the version page', async () => {
    vi.useFakeTimers();
    const { service, sw, reload } = setup();
    sw.checkForUpdate.mockResolvedValue(true);
    service.startAutomaticChecks();
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).toHaveBeenCalledOnce();
  });
  it('checks again on foreground entry even within fifteen minutes', async () => {
    vi.useFakeTimers();
    const { service, sw, document, reload } = setup();
    service.startAutomaticChecks();
    await vi.advanceTimersByTimeAsync(0);
    sw.checkForUpdate.mockResolvedValue(true);
    const listener = vi
      .mocked(document.addEventListener)
      .mock.calls.find(([name]) => name === 'visibilitychange')![1] as () => void;
    listener();
    await vi.advanceTimersByTimeAsync(0);
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledOnce();
  });
  it('avoids automatic metadata reload loops when the server still reports the same update', async () => {
    const { service, fetcher, document, reload } = setup(false);
    const values = new Map<string, string>();
    Object.defineProperty(document.defaultView, 'sessionStorage', {
      value: {
        getItem: (key: string) => values.get(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    fetcher.mockResolvedValue({
      ok: true,
      json: async () => ({ version: '2.0.0', commit: 'new', dirty: false }),
    });
    await service.check(true, true);
    await service.check(true, true);
    expect(reload).toHaveBeenCalledOnce();
  });
  it('detects ready versions without reloading', () => {
    const { service, reload, events } = setup();
    events.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });
    expect(service.available()).toBe(true);
    expect(service.showPrompt()).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });
  it('checks quietly every 15 minutes and skips hidden pages', async () => {
    vi.useFakeTimers();
    const { service, fetcher, document, toast } = setup(false);
    service.startAutomaticChecks();
    service.startAutomaticChecks();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([true, false])('defers game reload until confirmed (worker: %s)', async (worker) => {
    const { service, sw, reload, fetcher } = setup(worker);
    sw.checkForUpdate.mockResolvedValue(true);
    fetcher.mockResolvedValue({
      ok: true,
      json: async () => ({ version: '2.0.0', commit: 'new', dirty: false }),
    });
    await service.check(false);
    expect(service.available()).toBe(true);
    expect(reload).not.toHaveBeenCalled();
    service.apply();
    expect(reload).toHaveBeenCalledOnce();
  });
  it('waits for the worker download and reloads when a new version is ready', async () => {
    const { service, sw, reload, fetcher } = setup();
    sw.checkForUpdate.mockResolvedValue(true);
    await service.check();
    expect(reload).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();
    expect(service.busy()).toBe(false);
  });
  it('applies a ready version even when the subsequent check finds no new download', async () => {
    const { service, events, reload } = setup();
    events.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });
    await service.check();
    expect(reload).toHaveBeenCalledOnce();
  });
  it('reports current version without reloading and bypasses stale metadata', async () => {
    const { service, reload, fetcher } = setup();
    await service.check();
    expect(service.message()).toBe('You are using the latest version.');
    expect(reload).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledWith(new URL('https://example.com/app/version.json'), {
      cache: 'no-store',
      headers: { 'ngsw-bypass': 'true' },
    });
  });
  it('supports a browser without a controlling worker', async () => {
    const { service, sw, reload, fetcher } = setup(false);
    fetcher.mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.1', commit: 'new', dirty: false }),
    });
    await service.check();
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
  });
  it('shows a recoverable failure and permits retrying', async () => {
    const { service, sw, reload } = setup();
    sw.checkForUpdate.mockRejectedValueOnce(new Error('offline'));
    await service.check();
    expect(service.failed()).toBe(true);
    expect(service.busy()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    await service.check();
    expect(service.failed()).toBe(false);
    expect(service.message()).toBe('You are using the latest version.');
  });
  it('coalesces repeated clicks while the first check is pending', async () => {
    const { service, sw } = setup();
    let complete!: (found: boolean) => void;
    sw.checkForUpdate.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const first = service.check();
    await Promise.resolve();
    await service.check();
    expect(sw.checkForUpdate).toHaveBeenCalledOnce();
    complete(false);
    await first;
  });
});
