/**
 * Export/import round-trip for .mockup.json documents and the Blueprint
 * file-import path in src/utils/exportImport.ts (previously ~10% covered —
 * only the .blp delegate was exercised by blueprint.test.ts).
 *
 * Runs in the node vitest environment: File/Blob/atob/URL.createObjectURL
 * are real Node globals; document.createElement and FileReader are stubbed
 * at the module seam, and imageStore is mocked so no IndexedDB is touched.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock('../services/imageStore', () => ({
  getImageBlob: vi.fn(),
  saveImageBlob: vi.fn(),
}));

import { exportDocumentFile, importDocumentFile } from '../utils/exportImport';
import { getImageBlob, saveImageBlob } from '../services/imageStore';
import type { MockupDocument } from '../types/mockup';

const mockGetImageBlob = vi.mocked(getImageBlob);
const mockSaveImageBlob = vi.mocked(saveImageBlob);

function baseDoc(): MockupDocument {
  return {
    id: 'd1',
    title: 'My App',
    colorScheme: 'light',
    edges: [],
    screens: [
      {
        id: 's1', title: 'Main', type: 'standard', width: 800, height: 600,
        rootNode: { id: 'window', type: 'window', children: [] },
      },
    ],
  };
}

function docWithImages(): MockupDocument {
  const doc = baseDoc();
  doc.screens[0].rootNode.children = [
    // Same imageId twice on purpose — extractImageIds must dedupe.
    { id: 'a', type: 'box', imageId: 'asset-1', children: [] },
    { id: 'b', type: 'box', imageId: 'asset-1', children: [] },
    { id: 'c', type: 'box', imageId: 'asset-2', children: [] },
  ];
  return doc;
}

// Minimal FileReader so exportDocumentFile's blobToBase64 runs in node.
class FakeFileReader {
  result: string | ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: Blob): void {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
      this.onloadend?.();
    });
  }
}

describe('exportDocumentFile', () => {
  let anchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    anchor = { href: '', download: '', click: vi.fn() };
    vi.stubGlobal('document', { createElement: () => anchor });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      // Capture the payload for assertions.
      void blob;
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    mockGetImageBlob.mockReset();
    mockSaveImageBlob.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exports a versioned payload and triggers a download', async () => {
    // Intercept the serialized payload via a Blob-backed URL: jsdom-less
    // node gives us a real Blob from createObjectURL's argument.
    const blobArgs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
      blobArgs.push(blob);
      return 'blob:test';
    });

    await exportDocumentFile(baseDoc());
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.download).toBe('my-app.mockup.json');

    const json = JSON.parse(await blobArgs[0].text());
    expect(json.version).toBe(1);
    expect(json.exportedAt).toBeTruthy();
    expect(json.document.id).toBe('d1');
    expect(json.assets).toEqual({});
  });

  it('embeds deduplicated image assets as base64', async () => {
    vi.stubGlobal('FileReader', FakeFileReader);
    mockGetImageBlob.mockImplementation(async (id: string) => {
      if (id === 'asset-1') return new Blob(['png-one'], { type: 'image/png' });
      if (id === 'asset-2') return new Blob(['png-two'], { type: 'image/png' });
      return null;
    });

    const blobArgs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
      blobArgs.push(blob);
      return 'blob:test';
    });

    await exportDocumentFile(docWithImages());

    // asset-1 requested once despite appearing twice in the tree.
    expect(mockGetImageBlob).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(await blobArgs[0].text());
    expect(payload.assets['asset-1']).toBe(
      `data:image/png;base64,${Buffer.from('png-one').toString('base64')}`,
    );
    expect(payload.assets['asset-2']).toBe(
      `data:image/png;base64,${Buffer.from('png-two').toString('base64')}`,
    );
  });

  it('omits image ids whose blob is missing', async () => {
    vi.stubGlobal('FileReader', FakeFileReader);
    mockGetImageBlob.mockResolvedValue(null);

    const blobArgs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
      blobArgs.push(blob);
      return 'blob:test';
    });

    await exportDocumentFile(docWithImages());
    const payload = JSON.parse(await blobArgs[0].text());
    expect(payload.assets).toEqual({});
  });
});

describe('importDocumentFile', () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = globalThis;
    mockGetImageBlob.mockReset();
    mockSaveImageBlob.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as { window?: unknown }).window;
  });

  it('imports a .mockup.json document and restores its assets', async () => {
    const doc = baseDoc();
    const payload = {
      version: 1,
      exportedAt: '2026-08-12T00:00:00Z',
      document: doc,
      assets: { 'asset-1': `data:image/png;base64,${Buffer.from('png').toString('base64')}` },
    };
    const file = new File([JSON.stringify(payload)], 'my-app.mockup.json', {
      type: 'application/json',
    });

    const imported = await importDocumentFile(file);
    expect(imported.id).toBe('d1');
    expect(mockSaveImageBlob).toHaveBeenCalledTimes(1);
    const [savedId, savedBlob] = mockSaveImageBlob.mock.calls[0];
    expect(savedId).toBe('asset-1');
    expect(savedBlob.type).toBe('image/png');
    expect(await savedBlob.text()).toBe('png');
  });

  it('rejects a payload without a document', async () => {
    const file = new File([JSON.stringify({ version: 1, assets: {} })], 'bad.mockup.json', {
      type: 'application/json',
    });
    await expect(importDocumentFile(file)).rejects.toThrow('Invalid mockup document format');
  });

  it('rejects malformed JSON', async () => {
    const file = new File(['{not json'], 'bad.mockup.json', { type: 'application/json' });
    await expect(importDocumentFile(file)).rejects.toThrow();
  });

  it('imports a Blueprint file with a derived title', async () => {
    const fixture = readFileSync(
      new URL('../../tests/fixtures/gnome-ui/toolbar-grid.blp', import.meta.url),
      'utf8',
    );
    const file = new File([fixture], 'toolbar-grid.blp', { type: 'text/plain' });
    const imported = await importDocumentFile(file);
    expect(imported.title).toBe('toolbar grid');
    expect(imported.screens[0].rootNode).toMatchObject({ type: 'window' });
    expect(mockSaveImageBlob).not.toHaveBeenCalled();
  });

  it('derives a sensible title from a .ui file', async () => {
    const file = new File(
      ['<interface>\n  <requires lib="gtk-4.0"/>\n  <object class="GtkWindow" id="win">\n    <property name="title">Settings</property>\n  </object>\n</interface>\n'],
      'settings-dialog.ui',
      { type: 'text/xml' },
    );
    const imported = await importDocumentFile(file);
    expect(imported.title).toBe('settings dialog');
  });
});
