import { afterEach, expect, test, vi } from 'vitest';
import { newId } from './new-id';

afterEach(() => vi.unstubAllGlobals());

test('uses the native UUID API when available', () => {
  const randomUUID = vi.fn(() => '8bca8ebd-256d-43bc-bb01-96077064ec12');
  vi.stubGlobal('crypto', { randomUUID });
  expect(newId()).toBe('8bca8ebd-256d-43bc-bb01-96077064ec12');
  expect(randomUUID).toHaveBeenCalledOnce();
});

test('creates distinct version-4 UUIDs without the secure-context API', () => {
  const getRandomValues = crypto.getRandomValues.bind(crypto);
  vi.stubGlobal('crypto', { getRandomValues });
  const ids = Array.from({ length: 100 }, () => newId());
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
