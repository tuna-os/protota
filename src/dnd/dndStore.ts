import { create } from 'zustand';
import type { AdwNodeType } from '../types/mockup';

/**
 * Transient drag-gesture state (#79). This is editor state, never document
 * state: while a drag is in flight nothing touches the mockup document or
 * the undo history. The drop commits exactly one store mutation.
 *
 * The payload lives here rather than in DataTransfer (Penpot's atom
 * pattern): HTML5 dragover events cannot read DataTransfer contents, and
 * pointer-drags have no DataTransfer at all, so both mechanisms share this
 * module-level state instead.
 */
export type DragPayload =
  | { kind: 'palette'; widgetType: AdwNodeType }
  | { kind: 'node'; nodeId: string };

/** Every drop resolves to a container + insertion index (+ optional slot). */
export interface DropTarget {
  parentId: string;
  index: number;
  slot?: string;
  screenId: string;
}

/**
 * Post-drop quantise offer (#79): the drop landed in a box whose `spacing`
 * is off the Adwaita scale (HIG-W001). Transient editor state — it proposes
 * the same nearest-scale fix the diagnostic's quick fix applies, and clears
 * on the next drag or on dismissal.
 */
export interface QuantiseHint {
  parentId: string;
  screenId: string;
  spacing: number;
  nearest: number;
}

interface DndState {
  drag: DragPayload | null;
  target: DropTarget | null;
  quantiseHint: QuantiseHint | null;
  startDrag: (drag: DragPayload) => void;
  setTarget: (target: DropTarget | null) => void;
  endDrag: () => void;
  setQuantiseHint: (hint: QuantiseHint | null) => void;
}

export const useDndStore = create<DndState>((set) => ({
  drag: null,
  target: null,
  quantiseHint: null,
  startDrag: (drag) => set({ drag, target: null, quantiseHint: null }),
  setTarget: (target) => set({ target }),
  endDrag: () => set({ drag: null, target: null }),
  setQuantiseHint: (quantiseHint) => set({ quantiseHint }),
}));

/** MIME type marking a palette drag so foreign OS drags are ignored. */
export const PALETTE_MIME = 'application/x-protota-widget';
