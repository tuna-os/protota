import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPresetDocument, PRESET_CATALOG } from '../utils/presetCatalog';

afterEach(() => vi.unstubAllGlobals());

const toolbarGrid = readFileSync(
  new URL('../../tests/fixtures/gnome-ui/toolbar-grid.blp', import.meta.url),
  'utf8',
);

function jsonResponse(body: unknown, contentType = 'application/json') {
  return new Response(JSON.stringify(body), { headers: { 'content-type': contentType } });
}

describe('preset catalog loading', () => {
  it.each(['amberol', 'settings'])('loads the enriched %s preset artifact', async (id) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      generatedBy: 'scripts/generate-preset.mjs',
      document: {
        version: 1,
        title: id,
        screens: [{ id: 'screen', name: 'Screen', width: 400, height: 600, rootNode: { id: 'root', type: 'window' } }],
      },
      sourceIcons: { 'app-symbolic': '<svg />' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const loaded = await loadPresetDocument(id);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toMatch(new RegExp(`/presets/${id}\\.mockup\\.json$`));
    expect(loaded.kind).toBe('mockup');
    expect(loaded.sourceIcons).toEqual({ 'app-symbolic': '<svg />' });
  });

  it('uses one live-import screen for source packages', async () => {
    const counts = new Map(PRESET_CATALOG.map(preset => [preset.id, preset.screens]));
    expect(counts.get('apostrophe')).toBe(1);
    expect(counts.get('authenticator')).toBe(1);
    expect(counts.get('decoder')).toBe(1);
  });
});

describe('preset catalog: source-package path', () => {
  it('imports a source bundle into a document', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      entry: 'main.blp',
      files: [{ path: 'main.blp', content: toolbarGrid }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const loaded = await loadPresetDocument('apostrophe');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/source-imports\/apostrophe\.source\.json$/);
    expect(loaded.kind).toBe('source-import');
    expect(loaded.doc.screens[0].rootNode).toMatchObject({ type: 'window' });
    // Imported documents default to auto color scheme.
    expect(loaded.doc.colorScheme).toBe('auto');
  });

  it('rejects when the source bundle fails to load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('boom', { status: 500 }),
    ));
    await expect(loadPresetDocument('apostrophe')).rejects.toThrow(
      /source bundle failed to load \(HTTP 500\)/,
    );
  });
});

describe('preset catalog: mockup-path guards', () => {
  it('rejects a non-JSON body as an unknown preset (dev-server HTML shell)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('<html>index.html</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    ));
    await expect(loadPresetDocument('amberol')).rejects.toThrow('Unknown preset "amberol".');
  });

  it('rejects an HTTP error as an unknown preset', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('not found', { status: 404 }),
    ));
    await expect(loadPresetDocument('amberol')).rejects.toThrow('Unknown preset "amberol".');
  });

  it('rejects a malformed payload without document.screens', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ document: { title: 'x' } }),
    ));
    await expect(loadPresetDocument('amberol')).rejects.toThrow(/malformed preset payload/);
  });

  it('rejects unknown ids with the unknown-preset error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('not found', { status: 404 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadPresetDocument('definitely-not-a-preset')).rejects.toThrow(
      'Unknown preset "definitely-not-a-preset".',
    );
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/presets\/definitely-not-a-preset\.mockup\.json$/);
  });

  it('defaults colorScheme to auto on mockup payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      document: {
        version: 1,
        title: 'amberol',
        screens: [{ id: 's', title: 'S', type: 'standard', width: 400, height: 600, rootNode: { id: 'r', type: 'window' } }],
      },
    })));
    const loaded = await loadPresetDocument('amberol');
    expect(loaded.doc.colorScheme).toBe('auto');
  });
});

describe('preset catalog: data integrity', () => {
  it('has unique, well-formed entries', () => {
    const ids = new Set<string>();
    for (const preset of PRESET_CATALOG) {
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.screens).toBeGreaterThan(0);
    }
  });
});
