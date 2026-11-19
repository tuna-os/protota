/**
 * src/store/persistence.ts: what the editor restores from localStorage on
 * start. A bad cache entry must degrade to defaults, never throw out of the
 * loader and blank the editor.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadIgnores,
  loadPanelState,
  loadPersistedDocument,
  loadWindowButtons,
  persistDocumentSource,
  saveIgnores,
  savePanelState,
  saveWindowButtons,
} from '../store/persistence';
import { DEFAULT_WINDOW_BUTTONS } from '../utils/headerBarChrome';
import { initialDocument } from '../store/templates';
import type { MockupDocument } from '../types/mockup';

let backing: Map<string, string>;

beforeEach(() => {
  backing = new Map();
  globalThis.localStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => { backing.set(k, v); },
    removeItem: (k: string) => { backing.delete(k); },
    clear: () => { backing.clear(); },
    key: (i: number) => [...backing.keys()][i] ?? null,
    get length() { return backing.size; },
  } as Storage;
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage;
});

describe('diagnostics ignores', () => {
  it('is empty when nothing was saved', () => {
    expect(loadIgnores()).toEqual({ rules: [], instances: [] });
  });

  it('round-trips what was saved', () => {
    saveIgnores({ rules: ['a11y-label'], instances: ['n1', 'n2'] });
    expect(loadIgnores()).toEqual({ rules: ['a11y-label'], instances: ['n1', 'n2'] });
  });

  it('keeps a valid list when the other field is not an array', () => {
    backing.set('protota_diagnostics_ignores_v1', JSON.stringify({ rules: ['r'], instances: 'n1' }));
    expect(loadIgnores()).toEqual({ rules: ['r'], instances: [] });
  });

  it('falls back to empty on corrupt JSON', () => {
    backing.set('protota_diagnostics_ignores_v1', '{not-json');
    expect(loadIgnores()).toEqual({ rules: [], instances: [] });
  });
});

describe('window buttons preference', () => {
  it('defaults when nothing was saved', () => {
    expect(loadWindowButtons()).toEqual(DEFAULT_WINDOW_BUTTONS);
  });

  it('returns a copy, so callers cannot mutate the shared default', () => {
    const pref = loadWindowButtons();
    expect(pref).not.toBe(DEFAULT_WINDOW_BUTTONS);
    pref.side = 'start';
    expect(DEFAULT_WINDOW_BUTTONS.side).toBe('end');
  });

  it('round-trips a saved preference', () => {
    saveWindowButtons({ buttons: 'close', side: 'start' });
    expect(loadWindowButtons()).toEqual({ buttons: 'close', side: 'start' });
  });

  it('ignores unknown values field by field', () => {
    backing.set('protota_window_buttons_v1', JSON.stringify({ buttons: 'maximize', side: 'start' }));
    expect(loadWindowButtons()).toEqual({ buttons: DEFAULT_WINDOW_BUTTONS.buttons, side: 'start' });
  });

  it('falls back to the default on corrupt JSON', () => {
    backing.set('protota_window_buttons_v1', 'nope');
    expect(loadWindowButtons()).toEqual(DEFAULT_WINDOW_BUTTONS);
  });
});

describe('panel state', () => {
  it('is null before anything was saved, so first-start rules still apply', () => {
    expect(loadPanelState()).toBeNull();
  });

  it('round-trips a saved layout', () => {
    savePanelState({ left: true, right: false });
    expect(loadPanelState()).toEqual({ left: true, right: false });
  });

  it('is null unless both sides are booleans', () => {
    backing.set('protota_panels_v1', JSON.stringify({ left: true, right: 'yes' }));
    expect(loadPanelState()).toBeNull();
    backing.set('protota_panels_v1', JSON.stringify({ left: true }));
    expect(loadPanelState()).toBeNull();
  });

  it('is null on corrupt JSON', () => {
    backing.set('protota_panels_v1', '{');
    expect(loadPanelState()).toBeNull();
  });
});

describe('persisted document', () => {
  it('is null when nothing was saved', () => {
    expect(loadPersistedDocument()).toBeNull();
  });

  it('stores Blueprint for the UI and JSON only for editor metadata', () => {
    persistDocumentSource({ ...initialDocument, title: 'My App', colorScheme: 'dark' });
    expect(backing.get('protota_blueprint_v1')).toContain('Adw');
    expect(JSON.parse(backing.get('protota_editor_metadata_v1')!)).toEqual({
      title: 'My App',
      colorScheme: 'dark',
    });
  });

  it('restores title and colour scheme from the metadata', () => {
    persistDocumentSource({ ...initialDocument, title: 'My App', colorScheme: 'dark' });
    const loaded = loadPersistedDocument();
    expect(loaded?.title).toBe('My App');
    expect(loaded?.colorScheme).toBe('dark');
    expect(loaded?.screens.length).toBeGreaterThan(0);
  });

  it('defaults the colour scheme to auto when the metadata lacks one', () => {
    persistDocumentSource(initialDocument);
    backing.set('protota_editor_metadata_v1', JSON.stringify({ title: 'T' }));
    expect(loadPersistedDocument()?.colorScheme).toBe('auto');
  });

  it('loads Blueprint even when the metadata entry is missing', () => {
    persistDocumentSource(initialDocument);
    backing.delete('protota_editor_metadata_v1');
    const loaded = loadPersistedDocument();
    expect(loaded).not.toBeNull();
    expect(loaded?.colorScheme).toBe('auto');
  });

  it('returns null when the metadata JSON is corrupt', () => {
    persistDocumentSource(initialDocument);
    backing.set('protota_editor_metadata_v1', '{not-json');
    expect(loadPersistedDocument()).toBeNull();
  });

  it('migrates the pre-Blueprint JSON format once, then drops it', () => {
    const legacy: MockupDocument = { ...initialDocument, title: 'Legacy', colorScheme: 'light' };
    backing.set('protota_doc_v1', JSON.stringify(legacy));

    expect(loadPersistedDocument()).toEqual(legacy);
    expect(backing.has('protota_doc_v1')).toBe(false);
    expect(backing.has('protota_blueprint_v1')).toBe(true);

    // The second load reads the migrated Blueprint, not the (removed) JSON.
    const again = loadPersistedDocument();
    expect(again?.title).toBe('Legacy');
    expect(again?.colorScheme).toBe('light');
  });

  it('returns null for a corrupt legacy entry and leaves it in place', () => {
    backing.set('protota_doc_v1', '{not-json');
    expect(loadPersistedDocument()).toBeNull();
    expect(backing.get('protota_doc_v1')).toBe('{not-json');
  });
});
