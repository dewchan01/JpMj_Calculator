import '@angular/compiler';
import {
  createEnvironmentInjector,
  Injector,
  runInInjectionContext,
  type EnvironmentInjector,
} from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast } from './toast';

let injector: EnvironmentInjector;
let toast: Toast;
beforeEach(() => {
  vi.useFakeTimers();
  injector = createEnvironmentInjector([], Injector.NULL as EnvironmentInjector);
  toast = runInInjectionContext(injector, () => new Toast());
});
afterEach(() => {
  injector.destroy();
  vi.useRealTimers();
});
describe('shared toast', () => {
  it('dismisses successful notices automatically', () => {
    toast.success('Games imported.');
    expect(toast.current()?.kind).toBe('success');
    vi.advanceTimersByTime(5000);
    expect(toast.current()).toBeNull();
  });
  it('replaces the last notice without letting its old timer close the new one', () => {
    toast.show('first');
    vi.advanceTimersByTime(4000);
    toast.show('second');
    vi.advanceTimersByTime(1000);
    expect(toast.current()?.message).toBe('second');
    vi.advanceTimersByTime(4000);
    expect(toast.current()).toBeNull();
  });
  it('pauses and resumes the remaining reading time', () => {
    toast.show('message');
    vi.advanceTimersByTime(2000);
    toast.pause();
    vi.advanceTimersByTime(10000);
    expect(toast.current()).not.toBeNull();
    toast.resume();
    vi.advanceTimersByTime(2999);
    expect(toast.current()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(toast.current()).toBeNull();
  });
  it('keeps an error visible longer', () => {
    toast.error('failure');
    vi.advanceTimersByTime(5000);
    expect(toast.current()?.kind).toBe('error');
    vi.advanceTimersByTime(3000);
    expect(toast.current()).toBeNull();
  });
  it('supports manual dismissal', () => {
    toast.show('message');
    toast.dismiss();
    expect(toast.current()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cleans up timers when the application is destroyed', () => {
    toast.show('message');
    injector.destroy();
    expect(vi.getTimerCount()).toBe(0);
    injector = createEnvironmentInjector([], Injector.NULL as EnvironmentInjector);
  });
});
