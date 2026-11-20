import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * usePreferencesStore (#393): the window-buttons preference lives outside the
 * document store, loads from localStorage at start and never enters undo
 * history. Each test re-imports the store so the start-up load sees the
 * storage contents that test arranged.
 */
const STORAGE_KEY = 'protota_window_buttons_v1';
const backing = new Map<string, string>();
const writes: string[] = [];
globalThis.localStorage = {
  getItem: (key: string) => backing.get(key) ?? null,
  setItem: (key: string, value: string) => { writes.push(key); backing.set(key, value); },
  removeItem: (key: string) => { backing.delete(key); },
  clear: () => { backing.clear(); },
  key: (index: number) => [...backing.keys()][index] ?? null,
  get length() { return backing.size; },
} as Storage;

async function loadStore() {
  vi.resetModules();
  return (await import('../store/preferencesStore')).usePreferencesStore;
}

beforeEach(() => {
  backing.clear();
  writes.length = 0;
});

describe('usePreferencesStore', () => {
  it('starts from the default buttons when nothing is saved', async () => {
    const store = await loadStore();
    expect(store.getState().windowButtons).toEqual({ buttons: 'window', side: 'end' });
  });

  it('starts from the saved preference', async () => {
    backing.set(STORAGE_KEY, JSON.stringify({ buttons: 'close', side: 'start' }));
    const store = await loadStore();
    expect(store.getState().windowButtons).toEqual({ buttons: 'close', side: 'start' });
  });

  it('falls back to the default for corrupt or unknown saved values', async () => {
    backing.set(STORAGE_KEY, '{not json');
    expect((await loadStore()).getState().windowButtons).toEqual({ buttons: 'window', side: 'end' });

    backing.set(STORAGE_KEY, JSON.stringify({ buttons: 'minimize', side: 'start' }));
    expect((await loadStore()).getState().windowButtons).toEqual({ buttons: 'window', side: 'start' });
  });

  it('merges a patch and persists it under the existing key', async () => {
    const store = await loadStore();
    store.getState().setWindowButtons({ side: 'start' });

    expect(store.getState().windowButtons).toEqual({ buttons: 'window', side: 'start' });
    expect(JSON.parse(backing.get(STORAGE_KEY)!)).toEqual({ buttons: 'window', side: 'start' });
    expect((await loadStore()).getState().windowButtons).toEqual({ buttons: 'window', side: 'start' });
  });

  it('does not write or notify when the patch changes nothing', async () => {
    const store = await loadStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().setWindowButtons({ buttons: 'window' });

    expect(writes).not.toContain(STORAGE_KEY);
    expect(listener).not.toHaveBeenCalled();
  });

  it('leaves the document store and its undo history untouched', async () => {
    const store = await loadStore();
    const { useMockupStore } = await import('../store/mockupStore');
    const before = useMockupStore.getState();

    store.getState().setWindowButtons({ buttons: 'close' });

    const after = useMockupStore.getState();
    expect(after.historyIndex).toBe(before.historyIndex);
    expect(after.history).toBe(before.history);
    expect(after.doc).toBe(before.doc);
    expect('windowButtons' in after).toBe(false);
  });
});
