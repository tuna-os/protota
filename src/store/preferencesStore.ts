import { create } from 'zustand';
import type { WindowButtonsPreference } from '../utils/headerBarChrome';
import { loadWindowButtons, saveWindowButtons } from './persistence';

/**
 * Personal settings that outlive any one document: not part of the document,
 * never in undo history, and loaded from localStorage on start.
 */
export interface PreferencesState {
  /** Window-buttons preference (#163): buttons set + position. */
  windowButtons: WindowButtonsPreference;
  setWindowButtons: (patch: Partial<WindowButtonsPreference>) => void;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  windowButtons: loadWindowButtons(),

  setWindowButtons: (patch) => {
    const current = get().windowButtons;
    const next: WindowButtonsPreference = { ...current, ...patch };
    if (next.buttons === current.buttons && next.side === current.side) return;
    saveWindowButtons(next);
    set({ windowButtons: next });
  },
}));
