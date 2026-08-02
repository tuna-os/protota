/**
 * The public preset catalog and its loader — shared by the Preset Gallery
 * (which persists the loaded document and reloads the editor) and the URL
 * render mode (which loads in-memory only; docs/render-api.md).
 */
import type { MockupDocument } from '../types/mockup';
import { blueprintBundleToDocument, type BlueprintSourceFile } from './blueprint';

export interface PresetMeta {
  id: string;
  name: string;
  description: string;
  screens: number;
  sourceImportPending?: boolean;
  /** Use live browser import when it is richer than the shipped preset artifact. */
  sourcePackage?: string;
}

export const PRESET_CATALOG: PresetMeta[] = [
  { id: 'amberol', name: 'Amberol', description: 'GNOME Circle music player, generated from its official Blueprint source.', screens: 1 },
  { id: 'apostrophe', name: 'Apostrophe', description: 'GNOME Circle Markdown editor, imported from its official GtkBuilder source.', screens: 1, sourcePackage: 'source-imports/apostrophe.source.json' },
  { id: 'authenticator', name: 'Authenticator', description: 'GNOME Circle 2FA code manager, imported from its official GtkBuilder source.', screens: 1, sourcePackage: 'source-imports/authenticator.source.json' },
  { id: 'decoder', name: 'Decoder', description: 'GNOME Circle QR scanner and generator, imported from its official GtkBuilder source.', screens: 1, sourcePackage: 'source-imports/decoder.source.json' },
  { id: 'text-editor', name: 'GNOME Text Editor', description: 'Document editor with header bar, save/open buttons, and content area.', screens: 1 },
  { id: 'settings', name: 'GNOME Settings', description: 'Navigation split view generated from its official Blueprint source — collapses below its 550sp Adw.Breakpoint.', screens: 1 },
  { id: 'calculator', name: 'GNOME Calculator', description: 'Button grid calculator with display and arithmetic operations.', screens: 1 },
  { id: 'files', name: 'GNOME Files (Nautilus)', description: 'Sidebar + content layout with bookmarks, search, and file grid.', screens: 1 },
  { id: 'calendar', name: 'GNOME Calendar', description: 'Month and week views reconstructed from version-matched source and native runtime state.', screens: 2 },
  { id: 'weather', name: 'GNOME Weather', description: 'City forecast view with status header and 7-day temperature trends.', screens: 1 },
  { id: 'clocks', name: 'GNOME Clocks', description: 'World clocks, alarms, stopwatch, and timers with ViewSwitcher tabs.', screens: 1 },
  { id: 'disks', name: 'GNOME Disks', description: 'Disk partition utility with drive list sidebar and volume allocation.', screens: 1 },
  { id: 'web', name: 'GNOME Web (Epiphany)', description: 'Browser window with tab bar, location entry, and status landing page.', screens: 1 },
  { id: 'software', name: 'GNOME Software', description: 'App store catalog with ViewSwitcher tabs (Explore, Installed, Updates).', screens: 1 },
];

export interface LoadedPreset {
  doc: MockupDocument;
  /** App-shipped artwork embedded by the preset generator (mockup presets). */
  sourceIcons?: Record<string, string>;
  kind: 'source-import' | 'mockup';
}

/**
 * Load the best available artifact for a gallery preset. Enriched generated
 * presets win when available; selected legacy entries still use live source
 * import when that is richer than their stale manual mockup artifact.
 * Unknown ids reject with an actionable error; callers must surface it, not
 * fall back.
 */
export async function loadPresetDocument(id: string): Promise<LoadedPreset> {
  const base = import.meta.env.BASE_URL;
  const meta = PRESET_CATALOG.find((candidate) => candidate.id === id);
  if (meta?.sourcePackage) {
    const response = await fetch(`${base}${meta.sourcePackage}`);
    if (!response.ok) throw new Error(`Preset "${id}": source bundle failed to load (HTTP ${response.status}).`);
    const source = await response.json() as { entry: string; files: BlueprintSourceFile[] };
    const doc = blueprintBundleToDocument(source.files, source.entry, meta.name);
    doc.colorScheme = doc.colorScheme || 'auto';
    return { doc, kind: 'source-import' };
  }
  const response = await fetch(`${base}presets/${id}.mockup.json`);
  // A dev server (and some static hosts) answer missing files with the HTML
  // shell and status 200 — treat any non-JSON body as an unknown preset.
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) {
    throw new Error(`Unknown preset "${id}".`);
  }
  const payload = await response.json() as { document: MockupDocument; sourceIcons?: Record<string, string> };
  if (!payload || typeof payload !== 'object' || !payload.document?.screens) {
    throw new Error(`Unknown preset "${id}" (malformed preset payload).`);
  }
  const doc = payload.document;
  doc.colorScheme = doc.colorScheme || 'auto';
  return { doc, sourceIcons: payload.sourceIcons, kind: 'mockup' };
}
