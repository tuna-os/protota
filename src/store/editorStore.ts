import { create } from 'zustand';
import { toggleSelection, unionSelection } from '../utils/selection';

/**
 * EditorStore manages UI/editor state (selection, modals, canvas chrome) that does not
 * persist with the document and does not participate in undo/redo.
 *
 * This is Phase 2 of the mockupStore refactor (issue #360). It extracts editor-local
 * state into an independent store that can be tested, serialized, or reset without
 * coupling to document state, persistence, or diagnostics.
 */
export interface EditorState {
  /** Primary (last-selected) node — what the inspector and single-node ops use. */
  selectedNodeId: string | null;
  /**
   * Ordered multi-selection (#79, penpot-study.md §3). The primary is always
   * the last element; `selectedNodeId` mirrors it. Editor state, never undoable.
   */
  selectedNodeIds: string[];
  selectedScreenId: string | null;
  /**
   * Whole-screen selection (#138). `selectedScreenId` is the *active screen context*
   * (always points somewhere); this flag marks it as an explicit selection of the screen
   * itself. Screen and node selection are mutually exclusive.
   */
  screenSelected: boolean;
  /**
   * Visible reason the last deleteScreen refused (the last-screen rule).
   * Transient editor chrome; cleared after display.
   */
  screenDeleteNotice: string | null;
  showAddScreenModal: boolean;
  /** Flow-edge visibility on the canvas. */
  showFlows: boolean;

  // Single-node selection
  selectNode: (nodeId: string | null, screenId?: string) => void;
  toggleNodeSelection: (nodeId: string, screenId?: string) => void;
  selectNodes: (ids: string[], screenId?: string, additive?: boolean) => void;

  // Screen and UI
  selectScreen: (screenId: string | null) => void;
  clearScreenDeleteNotice: () => void;
  setShowAddScreenModal: (show: boolean) => void;
  toggleShowFlows: () => void;

  // Cleanup hooks for when mockupStore modifies the document
  /** Clear selection referencing a deleted screen. */
  clearScreenSelection: (screenId: string) => void;
  /** Remove deleted nodes from selection. */
  clearNodeSelection: (nodeIds: string[]) => void;
  /** Full reset (e.g., when the document is cleared). */
  resetSelection: (initialScreenId: string | null) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedScreenId: null,
  screenSelected: false,
  screenDeleteNotice: null,
  showAddScreenModal: false,
  showFlows: false,

  selectNode: (nodeId, screenId) =>
    set({
      selectedNodeId: nodeId,
      selectedNodeIds: nodeId ? [nodeId] : [],
      selectedScreenId: screenId ?? get().selectedScreenId,
      screenSelected: false,
    }),

  toggleNodeSelection: (nodeId, screenId) => {
    const selectedNodeIds = toggleSelection(get().selectedNodeIds, nodeId);
    set({
      selectedNodeIds,
      selectedNodeId: selectedNodeIds[selectedNodeIds.length - 1] ?? null,
      selectedScreenId: screenId ?? get().selectedScreenId,
      screenSelected: false,
    });
  },

  selectNodes: (ids, screenId, additive) => {
    const selectedNodeIds = additive ? unionSelection(get().selectedNodeIds, ids) : [...ids];
    set({
      selectedNodeIds,
      selectedNodeId: selectedNodeIds[selectedNodeIds.length - 1] ?? null,
      selectedScreenId: screenId ?? get().selectedScreenId,
      screenSelected: false,
    });
  },

  selectScreen: (screenId) => {
    if (screenId === null) {
      set({ screenSelected: false });
      return;
    }
    set({
      selectedScreenId: screenId,
      screenSelected: true,
      selectedNodeId: null,
      selectedNodeIds: [],
    });
  },

  clearScreenDeleteNotice: () => {
    if (get().screenDeleteNotice !== null) set({ screenDeleteNotice: null });
  },

  setShowAddScreenModal: (show) => set({ showAddScreenModal: show }),

  toggleShowFlows: () => set({ showFlows: !get().showFlows }),

  clearScreenSelection: (screenId) => {
    if (get().selectedScreenId === screenId) {
      set({ selectedScreenId: null, screenSelected: false });
    }
  },

  clearNodeSelection: (nodeIds) => {
    const surviving = get().selectedNodeIds.filter((id) => !nodeIds.includes(id));
    set({
      selectedNodeIds: surviving,
      selectedNodeId: surviving[surviving.length - 1] ?? null,
    });
  },

  resetSelection: (initialScreenId) => {
    set({
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedScreenId: initialScreenId ?? null,
      screenSelected: false,
      screenDeleteNotice: null,
      showAddScreenModal: false,
      showFlows: false,
    });
  },
}));
