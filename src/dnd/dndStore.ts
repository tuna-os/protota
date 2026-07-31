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

interface DndState {
  drag: DragPayload | null;
  target: DropTarget | null;
  startDrag: (drag: DragPayload) => void;
  setTarget: (target: DropTarget | null) => void;
  endDrag: () => void;
}

export const useDndStore = create<DndState>((set) => ({
  drag: null,
  target: null,
  startDrag: (drag) => set({ drag, target: null }),
  setTarget: (target) => set({ target }),
  endDrag: () => set({ drag: null, target: null }),
}));

/** MIME type marking a palette drag so foreign OS drags are ignored. */
export const PALETTE_MIME = 'application/x-protota-widget';
