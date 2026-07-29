import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface CatalogEntry {
  name: string;
  aptPackage: string;
  command: string;
  presetId: string;
  viewport: { width: number; height: number };
  source: string;
  suite: 'core' | 'circle';
  status: 'preset' | 'planned';
  visualStatus: 'not-validated' | 'needs-tuning' | 'passed';
}

const catalog = JSON.parse(
  readFileSync(new URL('../../tests/fixtures/gnome-app-catalog.json', import.meta.url), 'utf8'),
) as Record<string, CatalogEntry>;

describe('GNOME app conformance catalogue', () => {
  it('gives every shipped preset one runnable, sourced catalogue entry', () => {
    const presetFiles = readdirSync(new URL('../../public/presets/', import.meta.url))
      .filter(file => file.endsWith('.mockup.json'))
      .map(file => file.replace('.mockup.json', ''))
      .sort();
    const catalogPresetIds = Object.values(catalog)
      .filter(entry => entry.status === 'preset')
      .map(entry => entry.presetId)
      .sort();

    expect(catalogPresetIds).toEqual(presetFiles);
  });

  it('keeps each runnable app fully specified for native Broadway capture', () => {
    for (const [id, app] of Object.entries(catalog)) {
      if (app.status !== 'preset') continue;
      expect(app.suite, id).toMatch(/^(core|circle)$/);
      expect(app.aptPackage, id).not.toBe('');
      expect(app.command, id).not.toBe('');
      expect(app.source, id).toMatch(/^https:\/\//);
      expect(app.viewport.width, id).toBeGreaterThan(0);
      expect(app.viewport.height, id).toBeGreaterThan(0);
      expect(app.visualStatus, id).toMatch(/^(not-validated|needs-tuning|passed)$/);
    }
  });
});
