import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPresetDocument, PRESET_CATALOG } from '../utils/presetCatalog';

afterEach(() => vi.unstubAllGlobals());

describe('preset catalog loading', () => {
  it.each(['amberol', 'settings'])('loads the enriched %s preset artifact', async (id) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      generatedBy: 'scripts/generate-preset.mjs',
      document: {
        version: 1,
        title: id,
        screens: [{ id: 'screen', name: 'Screen', width: 400, height: 600, rootNode: { id: 'root', type: 'window' } }],
      },
      sourceIcons: { 'app-symbolic': '<svg />' },
    }), { headers: { 'content-type': 'application/json' } }));
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
