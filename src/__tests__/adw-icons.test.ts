/**
 * Runtime Adwaita icon registry (src/utils/adwIcons.ts). Previously 0%
 * coverage.
 *
 * Covers the catalog (kebab-case normalization, RTL-skip), hasAdwIcon,
 * registerSourceIcons, restoreStoredSourceIcons, publishIconVariables and
 * ensureAdwIcon (symbolic / full-colour / placeholder rule injection) with a
 * minimal DOM stub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  ensureAdwIcon,
  hasAdwIcon,
  publishIconVariables,
  registerSourceIcons,
  restoreStoredSourceIcons,
  SOURCE_ICONS_STORAGE_KEY,
} = await import('../utils/adwIcons');

// ── minimal DOM + storage stubs ──────────────────────────────────────────────

class FakeStyle {
  id = '';
  textContent = '';
  appendChild = vi.fn((el: unknown) => el);
}

let styles: FakeStyle[] = [];
let head: FakeStyle;
let backing = new Map<string, string>();
const created = new Map<string, FakeStyle>();

function installDom() {
  head = new FakeStyle();
  styles = [];
  created.clear();
  globalThis.document = {
    head,
    createElement: (tag: string) => {
      if (tag === 'style') {
        const s = new FakeStyle();
        styles.push(s);
        return s;
      }
      return new FakeStyle();
    },
    getElementById: (id: string) => styles.find((s) => s.id === id) ?? null,
  } as unknown as Document;
}

function installStorage() {
  backing = new Map();
  globalThis.localStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => { backing.set(k, v); },
    removeItem: (k: string) => { backing.delete(k); },
    clear: () => { backing.clear(); },
    key: (i: number) => [...backing.keys()][i] ?? null,
    get length() { return backing.size; },
  } as Storage;
}

beforeEach(() => {
  installDom();
  installStorage();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as Record<string, unknown>).document;
  delete (globalThis as Record<string, unknown>).localStorage;
});

// ── catalog + hasAdwIcon ─────────────────────────────────────────────────────

describe('hasAdwIcon', () => {
  it('recognises real Adwaita symbolic icons', () => {
    // editUndoSymbolic in the theme → catalog key edit-undo.
    expect(hasAdwIcon('edit-undo')).toBe(true);
    expect(hasAdwIcon('edit-undo-symbolic')).toBe(true);
  });

  it('rejects unknown icons', () => {
    expect(hasAdwIcon('no-such-icon-xyz')).toBe(false);
    expect(hasAdwIcon(undefined)).toBe(false);
  });

  it('registers application artwork via registerSourceIcons', () => {
    expect(hasAdwIcon('org.gnome.Weather')).toBe(false);
    registerSourceIcons({
      'org.gnome.Weather': '<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>',
    });
    expect(hasAdwIcon('org.gnome.Weather')).toBe(true);
  });

  it('ignores non-SVG and non-string entries when registering', () => {
    registerSourceIcons({
      'org.example.Other': 'not-an-svg',
      'org.example.Broken': 42 as unknown as string,
    });
    expect(hasAdwIcon('org.example.Other')).toBe(false);
    expect(hasAdwIcon('org.example.Broken')).toBe(false);
  });
});

// ── restoreStoredSourceIcons ─────────────────────────────────────────────────

describe('restoreStoredSourceIcons', () => {
  it('restores icons persisted by a previously loaded preset', () => {
    localStorage.setItem(SOURCE_ICONS_STORAGE_KEY, JSON.stringify({
      'org.gnome.Weather': '<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>',
    }));
    restoreStoredSourceIcons();
    expect(hasAdwIcon('org.gnome.Weather')).toBe(true);
  });

  it('tolerates a corrupt cache', () => {
    localStorage.setItem(SOURCE_ICONS_STORAGE_KEY, '{not-json');
    expect(() => restoreStoredSourceIcons()).not.toThrow();
  });
});

// ── publishIconVariables ─────────────────────────────────────────────────────

describe('publishIconVariables', () => {
  it('injects --icon-<name> custom properties for catalog icons', () => {
    publishIconVariables(['edit-undo-symbolic']);
    const sheet = styles.find((s) => s.id === 'protota-icon-variables');
    expect(sheet).toBeDefined();
    expect(sheet!.textContent).toContain('--icon-edit-undo');
    expect(sheet!.textContent).toContain('data:image/svg+xml');
  });

  it('skips unknown icon names without emitting a style', () => {
    publishIconVariables(['definitely-not-an-icon']);
    expect(styles.find((s) => s.id === 'protota-icon-variables')).toBeUndefined();
  });
});

// ── ensureAdwIcon ────────────────────────────────────────────────────────────

describe('ensureAdwIcon', () => {
  it('injects a mask rule for a symbolic icon', () => {
    ensureAdwIcon('edit-undo-symbolic');
    const sheet = document.getElementById('protota-runtime-icons') as FakeStyle | null;
    expect(sheet).not.toBeNull();
    expect(sheet!.textContent).toContain('.adw-icon.adw-icon--edit-undo');
    expect(sheet!.textContent).toContain('mask-image: url("data:image/svg+xml');
  });

  it('injects a background-image rule for full-colour app artwork', () => {
    registerSourceIcons({
      'org.example.Weather': '<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>',
    });
    ensureAdwIcon('org.example.Weather');
    const sheet = document.getElementById('protota-runtime-icons') as FakeStyle | null;
    expect(sheet!.textContent).toContain('background-image:');
    // Full-colour art must not be masked.
    expect(sheet!.textContent).toContain('mask-image: none');
  });

  it('escapes dots and colons in the selector for reverse-DNS names', () => {
    registerSourceIcons({
      'org.example.Calendar': '<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>',
    });
    ensureAdwIcon('org.example.Calendar');
    const sheet = document.getElementById('protota-runtime-icons') as FakeStyle | null;
    expect(sheet!.textContent).toContain('.adw-icon--org\\.example\\.Calendar');
  });

  it('emits a dashed placeholder for unknown icons', () => {
    ensureAdwIcon('org.unknown.App');
    const sheet = document.getElementById('protota-runtime-icons') as FakeStyle | null;
    expect(sheet!.textContent).toContain('border: 1px dashed');
    expect(sheet!.textContent).toContain('opacity: 0.5');
  });

  it('is idempotent per icon', () => {
    ensureAdwIcon('edit-redo-symbolic');
    ensureAdwIcon('edit-redo-symbolic');
    const sheet = document.getElementById('protota-runtime-icons') as FakeStyle | null;
    // Only one rule emitted for the icon despite two calls.
    const count = sheet!.textContent.split('.adw-icon--edit-redo').length - 1;
    expect(count).toBe(1);
  });
});
