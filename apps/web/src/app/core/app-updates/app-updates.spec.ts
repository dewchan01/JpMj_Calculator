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
          defaultView: {
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
  return { service, sw, reload, events, fetcher, logs };
}

describe('manual application updates', () => {
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
