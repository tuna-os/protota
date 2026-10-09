import type { MockupDocument } from '../types/mockup';
import { blueprintToDocument, mockupToBlueprint } from '../utils/blueprint';
import { DEFAULT_WINDOW_BUTTONS, type WindowButtonsPreference } from '../utils/headerBarChrome';

const BLUEPRINT_STORAGE_KEY = 'protota_blueprint_v1';
const METADATA_STORAGE_KEY = 'protota_editor_metadata_v1';
const LEGACY_STORAGE_KEY = 'protota_doc_v1';
const IGNORES_STORAGE_KEY = 'protota_diagnostics_ignores_v1';
const WINDOW_BUTTONS_STORAGE_KEY = 'protota_window_buttons_v1';
const PANEL_STATE_STORAGE_KEY = 'protota_panels_v1';

export interface PersistedIgnores {
  rules: string[];
  instances: string[];
}

interface EditorMetadata {
  title?: string;
  colorScheme?: MockupDocument['colorScheme'];
}

export function loadIgnores(): PersistedIgnores {
  try {
    const raw = localStorage.getItem(IGNORES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedIgnores>;
      return {
        rules: Array.isArray(parsed.rules) ? parsed.rules : [],
        instances: Array.isArray(parsed.instances) ? parsed.instances : [],
      };
    }
  } catch { /* corrupt cache means no ignores */ }
  return { rules: [], instances: [] };
}

export function saveIgnores(ignores: PersistedIgnores) {
  localStorage.setItem(IGNORES_STORAGE_KEY, JSON.stringify(ignores));
}

export function loadWindowButtons(): WindowButtonsPreference {
  try {
    const raw = localStorage.getItem(WINDOW_BUTTONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WindowButtonsPreference>;
      const pref: WindowButtonsPreference = { ...DEFAULT_WINDOW_BUTTONS };
      if (parsed.buttons === 'close' || parsed.buttons === 'window') pref.buttons = parsed.buttons;
      if (parsed.side === 'start' || parsed.side === 'end') pref.side = parsed.side;
      return pref;
    }
  } catch { /* corrupt cache means default buttons */ }
  return { ...DEFAULT_WINDOW_BUTTONS };
}

export function saveWindowButtons(preference: WindowButtonsPreference) {
  localStorage.setItem(WINDOW_BUTTONS_STORAGE_KEY, JSON.stringify(preference));
}

/**
 * The user's desktop drawer layout — a personal setting like the window
 * buttons preference, not document content. `null` when nothing was saved
 * yet, so the first-start auto rules (App.tsx) still govern.
 */
export interface PanelState {
  left: boolean;
  right: boolean;
}

export function loadPanelState(): PanelState | null {
  try {
    const raw = localStorage.getItem(PANEL_STATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PanelState>;
      if (typeof parsed.left === 'boolean' && typeof parsed.right === 'boolean') {
        return { left: parsed.left, right: parsed.right };
      }
    }
  } catch { /* corrupt cache means no saved layout */ }
  return null;
}

export function savePanelState(state: PanelState) {
  localStorage.setItem(PANEL_STATE_STORAGE_KEY, JSON.stringify(state));
}

/** Persist the UI as Blueprint; JSON is reserved for editor-only metadata. */
export function persistDocumentSource(doc: MockupDocument) {
  localStorage.setItem(BLUEPRINT_STORAGE_KEY, mockupToBlueprint(doc));
  localStorage.setItem(
    METADATA_STORAGE_KEY,
    JSON.stringify({ title: doc.title, colorScheme: doc.colorScheme } satisfies EditorMetadata),
  );
}

/** Load Blueprint state, migrating the pre-Blueprint JSON format once. */
export function loadPersistedDocument(): MockupDocument | null {
  try {
    const source = localStorage.getItem(BLUEPRINT_STORAGE_KEY);
    if (source) {
      const metadata = JSON.parse(localStorage.getItem(METADATA_STORAGE_KEY) || '{}') as EditorMetadata;
      const document = blueprintToDocument(source, metadata.title);
      document.colorScheme = metadata.colorScheme || 'auto';
      return document;
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;
    const document = JSON.parse(legacy) as MockupDocument;
    persistDocumentSource(document);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return document;
  } catch {
    return null;
  }
}
