import { create } from 'zustand';
import { produce } from 'immer';
import type { MockupDocument, AdwNode, AdwNodeType, Screen } from '../types/mockup';
import type { ScreenTemplateType } from '../types/mockup';
import { SCREEN_DEFAULTS, LEGAL_CHILDREN } from '../types/mockup';
import type { Diagnostic, DiagnosticTier, QuickFix } from '../diagnostics/types';
import { instanceKey } from '../diagnostics/types';
import { runDiagnostics } from '../diagnostics/engine';
import { runRoundTripCheck } from '../diagnostics/blueprintSource';
import { findNodeLocation, findNodeById } from '../utils/treeHelpers';
import { toggleSelection, unionSelection, filterShallowest } from '../utils/selection';
import { blueprintToDocument, mockupToBlueprint } from '../utils/blueprint';

const BLUEPRINT_STORAGE_KEY = 'protota_blueprint_v1';
const METADATA_STORAGE_KEY = 'protota_editor_metadata_v1';
const LEGACY_STORAGE_KEY = 'protota_doc_v1';
/** Diagnostic ignores are editor state, not document content (design §2.4). */
const IGNORES_STORAGE_KEY = 'protota_diagnostics_ignores_v1';
const MAX_HISTORY = 50;

interface PersistedIgnores {
  rules: string[];
  instances: string[];
}

function loadIgnores(): PersistedIgnores {
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

function saveIgnores(ignores: PersistedIgnores) {
  localStorage.setItem(IGNORES_STORAGE_KEY, JSON.stringify(ignores));
}

interface EditorMetadata {
  title?: string;
  colorScheme?: MockupDocument['colorScheme'];
}

/** Persist the UI as Blueprint; JSON is reserved for editor-only metadata. */
export function persistDocumentSource(doc: MockupDocument) {
  localStorage.setItem(BLUEPRINT_STORAGE_KEY, mockupToBlueprint(doc));
  localStorage.setItem(
    METADATA_STORAGE_KEY,
    JSON.stringify({ title: doc.title, colorScheme: doc.colorScheme } satisfies EditorMetadata),
  );
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * HIG-compliant initial document.
 * Standard app window: AdwApplicationWindow → AdwToolbarView → [HeaderBar + content].
 */
const initialDocument: MockupDocument = {
  id: 'doc-1',
  title: 'Untitled GNOME App',
  edges: [],
  colorScheme: 'auto',
  screens: [
    {
      id: 'screen-1',
      title: 'Main Window',
      type: 'standard',
      width: 900,
      height: 650,
      rootNode: {
        id: uid('root'),
        type: 'window',
        children: [
          {
            id: uid('toolbar'),
            type: 'toolbar-view',
            children: [
              {
                id: uid('hdr'),
                type: 'header-bar',
                title: 'My GNOME App',
                children: [
                  { id: uid('title'), type: 'window-title', title: 'My GNOME App' },
                ],
              },
              {
                id: uid('content'),
                type: 'box',
                orientation: 'vertical',
                spacing: 12,
                children: [
                  {
                    id: uid('clamp'),
                    type: 'clamp',
                    children: [
                      {
                        id: uid('label'),
                        type: 'label',
                        title: 'Welcome to your mockup. Select widgets from the palette to build your UI.',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
};

/**
 * Create a HIG-compliant root node tree for each screen template type.
 */
function createRootNode(type: ScreenTemplateType, title: string): AdwNode {
  switch (type) {
    // === Standard app window (from layout-recipes.md §5.2) ===
    case 'standard':
      return {
        id: uid('root'), type: 'window',
        children: [{
          id: uid('toolbar'), type: 'toolbar-view',
          children: [
            { id: uid('hdr'), type: 'header-bar', title,
              children: [{ id: uid('title'), type: 'window-title', title }],
            },
            { id: uid('content'), type: 'box', orientation: 'vertical', spacing: 12,
              children: [{
                id: uid('clamp'), type: 'clamp',
                children: [{ id: uid('label'), type: 'label', title: 'Add content here.' }],
              }],
            },
          ],
        }],
      };

    // === ViewSwitcher app (from layout-recipes.md §5.3) ===
    case 'view-switcher':
      return {
        id: uid('root'), type: 'window',
        children: [{
          id: uid('toolbar'), type: 'toolbar-view',
          children: [
            { id: uid('hdr'), type: 'header-bar',
              children: [{ id: uid('switcher'), type: 'view-switcher' }],
            },
            { id: uid('stack'), type: 'view-stack',
              children: [
                { id: uid('page1'), type: 'box', orientation: 'vertical', spacing: 12,
                  children: [{ id: uid('c1'), type: 'clamp',
                    children: [{ id: uid('l1'), type: 'label', title: 'First View' }],
                  }],
                },
                { id: uid('page2'), type: 'box', orientation: 'vertical', spacing: 12,
                  children: [{ id: uid('c2'), type: 'clamp',
                    children: [{ id: uid('l2'), type: 'label', title: 'Second View' }],
                  }],
                },
              ],
            },
          ],
        }],
      };

    // === Preferences dialog (from layout-recipes.md §5.1) ===
    case 'preferences':
      return {
        id: uid('root'), type: 'preferences-dialog', title,
        children: [{
          id: uid('page'), type: 'preferences-page', title: 'General',
          iconName: 'preferences-system-symbolic',
          children: [{
            id: uid('group'), type: 'preferences-group',
            title: 'Behaviour', description: 'Configure app behaviour.',
            children: [
              { id: uid('switch1'), type: 'switch-row', title: 'Enable Feature', subtitle: 'Turns on core functionality', active: true },
              { id: uid('combo1'), type: 'combo-row', title: 'Theme', subtitle: 'Select appearance' },
            ],
          }],
        }],
      };

    // === Sidebar app ===
    case 'sidebar':
      return {
        id: uid('root'), type: 'window',
        children: [{
          id: uid('toolbar'), type: 'toolbar-view',
          children: [
            { id: uid('hdr'), type: 'header-bar',
              children: [{ id: uid('title'), type: 'window-title', title }],
            },
            { id: uid('split'), type: 'overlay-split',
              children: [
                { id: uid('sidebar'), type: 'box', orientation: 'vertical', spacing: 6,
                  children: [
                    { id: uid('sbtn1'), type: 'button', title: 'Item 1', flat: true },
                    { id: uid('sbtn2'), type: 'button', title: 'Item 2', flat: true },
                  ],
                },
                { id: uid('main-content'), type: 'clamp',
                  children: [{ id: uid('l3'), type: 'label', title: 'Select an item from the sidebar.' }],
                },
              ],
            },
          ],
        }],
      };

    // === Modal dialog ===
    case 'dialog':
      return {
        id: uid('root'), type: 'dialog', title,
        children: [{
          id: uid('toolbar'), type: 'toolbar-view',
          children: [
            { id: uid('hdr'), type: 'header-bar', title },
            { id: uid('body'), type: 'box', orientation: 'vertical', spacing: 18,
              children: [
                { id: uid('msg'), type: 'label', title: 'Dialog content goes here.' },
                { id: uid('actions'), type: 'box', orientation: 'horizontal', spacing: 6,
                  children: [
                    { id: uid('cancel'), type: 'button', title: 'Cancel', flat: true },
                    { id: uid('ok'), type: 'button', title: 'OK', suggested: true },
                  ],
                },
              ],
            },
          ],
        }],
      };

    // === Alert dialog (confirmation/error) ===
    case 'alert-dialog':
      return {
        id: uid('root'), type: 'alert-dialog',
        title: 'Are you sure?',
        description: 'This action cannot be undone.',
        children: [
          { id: uid('cancel'), type: 'button', title: 'Cancel', flat: true },
          { id: uid('confirm'), type: 'button', title: 'Delete', destructive: true },
        ],
      };

    // === About dialog ===
    case 'about':
      return {
        id: uid('root'), type: 'about-dialog',
        title, description: 'A GNOME application',
        iconName: 'application-x-executable',
      };

    // === Status page (empty/error/loading) ===
    case 'status-page':
      return {
        id: uid('root'), type: 'status-page',
        title: 'Nothing Here', description: 'Try adding content to get started.',
        iconName: 'system-search-symbolic',
        children: [
          { id: uid('action'), type: 'button', title: 'Get Started', suggested: true },
        ],
      };

    // === Blank canvas ===
    case 'empty':
      return {
        id: uid('root'), type: 'box', orientation: 'vertical', spacing: 12,
        children: [{ id: uid('label'), type: 'label', title: 'Blank canvas — add widgets.' }],
      };
  }
}

interface MockupState {
  doc: MockupDocument;
  /** Primary (last-selected) node — what the inspector and single-node ops use. */
  selectedNodeId: string | null;
  /**
   * Ordered multi-selection (#79, penpot-study.md §3). The primary is always
   * the last element; `selectedNodeId` mirrors it. Editor state, never
   * document state — selection does not go through pushSnapshot/undo.
   */
  selectedNodeIds: string[];
  selectedScreenId: string | null;
  /**
   * Whole-screen selection (#138). `selectedScreenId` alone is the *active
   * screen context* (it always points somewhere so the inspector, command
   * palette, and render targeting have a screen to talk about); this flag
   * marks it as an explicit selection of the screen itself. Screen and node
   * selection are mutually exclusive: `selectScreen` clears the node
   * selection, and every node-selection action clears this flag — so the
   * global Delete shortcut (which keys off `selectedNodeId(s)`) can never
   * double-handle a screen deletion. Editor state, never undoable.
   */
  screenSelected: boolean;
  /**
   * Visible reason the last deleteScreen refused (the last-screen rule).
   * Transient editor chrome; surfaces show it briefly and clear it.
   */
  screenDeleteNotice: string | null;
  history: MockupDocument[];
  historyIndex: number;
  showAddScreenModal: boolean;
  /** Diagnostics (#95) — renames lintEnabled/violations/toggleLint. */
  diagnosticsEnabled: boolean;
  diagnostics: Diagnostic[];
  /** BLP-E001 round-trip results, refreshed at export and cleared on edit. */
  exportCheck: Diagnostic[];
  /**
   * Live Blueprint syntax tier (BLP-L001, ADR 0001 Part 3 item 2): opt-in
   * per session — enabling it lazily loads a ~14 MB Pyodide runtime in a
   * worker, so it must never default on. Results come from
   * useLiveBlueprint, which only runs while the Diagnostics panel exists.
   */
  liveBlueprintEnabled: boolean;
  liveBlueprintStatus: 'off' | 'loading' | 'ready' | 'error';
  liveBlueprintError: string | null;
  liveBlueprintDiagnostics: Diagnostic[];
  /** Panel tier chips; filtering happens at selection time, not in the engine. */
  tierFilters: Record<DiagnosticTier, boolean>;
  /** Rule ids disabled globally (persisted). */
  ignoredRules: string[];
  /** `${ruleId}:${nodeId}` dismissals (persisted). */
  ignoredInstances: string[];
  /** Flow-edge connectors between screens (#11) drawn on the canvas. */
  showFlows: boolean;

  selectNode: (nodeId: string | null, screenId?: string) => void;
  /** Ctrl/Cmd-click: toggle membership; primary becomes the last element. */
  toggleNodeSelection: (nodeId: string, screenId?: string) => void;
  /** Replace (or with `additive`, union into) the selection with `ids`. */
  selectNodes: (ids: string[], screenId?: string, additive?: boolean) => void;
  /**
   * Select a whole screen (#138): title click on canvas, screen row in the
   * Layers panel. Clears the node selection (see `screenSelected`). Passing
   * null clears the screen selection but keeps the active-screen context.
   */
  selectScreen: (screenId: string | null) => void;
  /**
   * Delete a whole screen — nodes, its flow edges, everything — in ONE undo
   * snapshot. Screens have no stored x/y: the canvas lays them out as a
   * flex row, so the remaining screens auto-adjust to fill the space simply
   * by the array entry disappearing. Returns false (and sets
   * `screenDeleteNotice`) for the last screen: the editor's invariant since
   * initialDocument is that a document always has a screen for the
   * active-screen context to point at — emptying the canvas is a deliberate
   * act with its own affordance (clearCanvas / presets), not a Delete press.
   */
  deleteScreen: (screenId: string) => boolean;
  clearScreenDeleteNotice: () => void;
  updateNodeProps: (nodeId: string, props: Partial<AdwNode>) => void;
  /**
   * Batched multi-node property edit in ONE undo snapshot — the store
   * addition penpot-study.md §6/§8 calls for, used by align/distribute.
   */
  updateNodesProps: (edits: Array<{ nodeId: string; props: Partial<AdwNode> }>) => void;
  /** Screen geometry lives beside rootNode; needed by HIG-E001's quick-fix. */
  updateScreenProps: (screenId: string, props: Partial<Pick<Screen, 'width' | 'height' | 'title'>>) => void;
  /**
   * Insert a new child into a container, at `index` among its children when
   * given (clamped), else appended. Returns the new node's id, or null when
   * the parent does not exist. One undo snapshot.
   */
  addChildNode: (parentId: string, type: AdwNodeType, slot?: string, index?: number) => string | null;
  addScreen: (title: string, type: ScreenTemplateType) => void;
  moveNodeUp: (nodeId: string) => void;
  moveNodeDown: (nodeId: string) => void;
  /**
   * Reparent/reorder a node in a single undo snapshot, preserving identity.
   * `index` is the drop position among the target's current children (before
   * the node is removed); pass `children.length` to append. Illegal moves —
   * a node into itself or its own descendant, a screen root, or an unknown
   * id — are ignored.
   */
  moveNode: (nodeId: string, targetParentId: string, index: number, slot?: string) => void;
  deleteNode: (nodeId: string) => void;
  /** Delete every selected node (screen roots skipped) in ONE undo snapshot. */
  deleteSelectedNodes: () => void;
  undo: () => void;
  redo: () => void;
  /**
   * Run several store mutations as ONE undo snapshot (ADR 0001 Part 3,
   * penpot-study.md §8). While `fn` runs, per-mutation snapshots are
   * suspended: `doc` still updates after every mutation (so chained
   * mutations see each other), but history, persistence, and diagnostics
   * settle exactly once at commit. Nested calls are no-ops — the inner
   * function runs inline and the outermost transaction owns the snapshot.
   * A throw inside `fn` still commits whatever mutated before it (one
   * undoable step) and then propagates.
   */
  runInTransaction: (fn: () => void) => void;
  /** Direct theme picker (mobile overflow menu's 3-circle switcher). */
  setColorScheme: (scheme: MockupDocument['colorScheme']) => void;
  toggleDiagnostics: () => void;
  setTierFilter: (tier: DiagnosticTier, on: boolean) => void;
  ignoreRule: (ruleId: string) => void;
  ignoreInstance: (ruleId: string, nodeId: string) => void;
  /** Re-enable all rules and un-dismiss all instances. */
  clearIgnores: () => void;
  /** Apply a machine fix expressed as data over existing mutations (§6). */
  applyQuickFix: (d: Diagnostic) => void;
  /** Export round-trip check (BLP-E001); returns the diagnostics it stored. */
  runExportCheck: () => Diagnostic[];
  /** Opt in/out of the live browser syntax check (BLP-L001). */
  toggleLiveBlueprint: () => void;
  /** Status/result updates from the useLiveBlueprint driver. */
  setLiveBlueprintState: (partial: Partial<Pick<MockupState,
    'liveBlueprintStatus' | 'liveBlueprintError' | 'liveBlueprintDiagnostics'>>) => void;
  toggleShowFlows: () => void;
  /** Connect two screens with a navigation flow edge (#11). */
  addEdge: (sourceScreenId: string, targetScreenId: string) => void;
  removeEdge: (edgeId: string) => void;
  setShowAddScreenModal: (show: boolean) => void;
  clearCanvas: () => void;
  /**
   * Forest clipboard (ADR 0001 Part 3 item 3): an ordered list of copied
   * subtrees. #112 kept the clipboard single-subtree; multi-select made the
   * natural unit an ordered forest. The single-node actions below are thin
   * wrappers over the forest ones.
   */
  clipboard: AdwNode[];
  copyNode: (nodeId: string) => void;
  /**
   * Copy an ordered forest: `nodeIds` are shallowest-filtered (a selected
   * container swallows its selected descendants, same rule as align and
   * drag) and stored in the given (selection) order. Unknown ids are
   * dropped; when nothing resolves the clipboard is left untouched.
   * Returns the ids of the subtree roots actually copied.
   */
  copyNodes: (nodeIds: string[]) => string[];
  cutNode: (nodeId: string) => void;
  /**
   * Copy, then delete the copied roots in ONE undo snapshot. Screen roots
   * are copied but never deleted (they are anchors, as in delete).
   */
  cutNodes: (nodeIds: string[]) => void;
  /** Paste into a container, or beside a leaf. Returns the first new id. */
  pasteNode: (targetId: string) => string | null;
  /**
   * Paste the clipboard forest sequentially into/beside `targetId` (which
   * may live on any screen — cross-screen paste). Each tree resolves
   * legality individually: into the target when the target may hold it,
   * else beside the target; a tree that can land in neither place is
   * reported in `skipped` and the rest still paste. ONE undo snapshot for
   * the whole paste (none when nothing lands).
   */
  pasteNodes: (targetId: string) => { pastedIds: string[]; skipped: AdwNodeType[] };
  duplicateNode: (nodeId: string) => string | null;
  /**
   * Duplicate each subtree (shallowest-filtered) beside its own original in
   * ONE undo snapshot, without touching the clipboard. Returns the new ids.
   */
  duplicateNodes: (nodeIds: string[]) => string[];
}

/** The container holding a node, so paste can fall back to placing beside it. */
function findParentOf(root: AdwNode, nodeId: string): AdwNode | null {
  if (root.children?.some((child) => child.id === nodeId)) return root;
  for (const child of root.children ?? []) {
    const found = findParentOf(child, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * Legality resolution shared by paste and duplicate, applied to an immer
 * draft: prefer placing the tree INTO the target; fall back to BESIDE it
 * when the target cannot legally hold the tree but its parent can.
 * `besideOffset` is how many earlier trees of the same batch already landed
 * beside the target, so a sequential forest paste keeps clipboard order.
 * Returns where the tree landed, or null when it cannot legally land.
 */
function placeTreeAt(
  screens: Screen[], targetId: string, tree: AdwNode, besideOffset: number,
): 'into' | 'beside' | null {
  for (const screen of screens) {
    const target = findNodeById([screen.rootNode], targetId);
    if (!target) continue;
    if ((LEGAL_CHILDREN[target.type] ?? []).includes(tree.type)) {
      target.children = target.children ?? [];
      target.children.push(tree);
      return 'into';
    }
    const location = findNodeLocation(screen.rootNode, targetId);
    const parent = location ? findParentOf(screen.rootNode, targetId) : null;
    if (location && parent && (LEGAL_CHILDREN[parent.type] ?? []).includes(tree.type)) {
      location.parentChildren.splice(location.index + 1 + besideOffset, 0, tree);
      return 'beside';
    }
    return null;
  }
  return null;
}

/** A pasted subtree needs fresh ids, or two nodes would answer to one name. */
function withFreshIds(node: AdwNode): AdwNode {
  return {
    ...node,
    id: uid(node.type),
    children: node.children?.map(withFreshIds),
  };
}

export const useMockupStore = create<MockupState>((set, get) => {
  const saved = (() => {
    try {
      const source = localStorage.getItem(BLUEPRINT_STORAGE_KEY);
      if (source) {
        const metadata = JSON.parse(localStorage.getItem(METADATA_STORAGE_KEY) || '{}') as EditorMetadata;
        const document = blueprintToDocument(source, metadata.title);
        document.colorScheme = metadata.colorScheme || 'auto';
        return document;
      }
      // One-time migration for documents created before Blueprint became the
      // persisted UI format. New writes never store a JSON widget tree.
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacy) return null;
      const document = JSON.parse(legacy) as MockupDocument;
      persistDocumentSource(document);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return document;
    }
    catch { return null; }
  })();
  const startDoc: MockupDocument = saved || initialDocument;

  /** >0 while runInTransaction runs: per-mutation snapshots are suspended. */
  let transactionDepth = 0;

  const pushSnapshot = (newDoc: MockupDocument): Partial<MockupState> => {
    // Inside a transaction the document advances but history, persistence,
    // and diagnostics wait for the single commit snapshot.
    if (transactionDepth > 0) return { doc: newDoc };
    persistDocumentSource(newDoc);
    const { history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    if (newHistory.length >= MAX_HISTORY) newHistory.shift();
    newHistory.push(newDoc);
    const result: Partial<MockupState> = { doc: newDoc, history: newHistory, historyIndex: newHistory.length - 1 };
    if (get().diagnosticsEnabled) {
      result.diagnostics = runDiagnostics(newDoc);
    }
    // Round-trip results describe the document as it was at export time.
    if (get().exportCheck.length) result.exportCheck = [];
    return result;
  };

  return {
    doc: startDoc,
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedScreenId: startDoc.screens[0]?.id || null,
    screenSelected: false,
    screenDeleteNotice: null,
    history: [startDoc],
    historyIndex: 0,
    showAddScreenModal: false,
    diagnosticsEnabled: false,
    diagnostics: [],
    exportCheck: [],
    liveBlueprintEnabled: false,
    liveBlueprintStatus: 'off',
    liveBlueprintError: null,
    liveBlueprintDiagnostics: [],
    tierFilters: { error: true, warning: true, suggestion: true },
    ...(() => { const ignores = loadIgnores(); return { ignoredRules: ignores.rules, ignoredInstances: ignores.instances }; })(),
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
      if (!get().doc.screens.some((screen) => screen.id === screenId)) return;
      // Screen selection replaces node selection (mutual exclusion, #138):
      // with no selected node ids, the global Delete shortcut no-ops and the
      // canvas/panel handlers own the whole-screen deletion.
      set({
        selectedScreenId: screenId,
        screenSelected: true,
        selectedNodeId: null,
        selectedNodeIds: [],
      });
    },

    deleteScreen: (screenId) => {
      const { doc } = get();
      const index = doc.screens.findIndex((screen) => screen.id === screenId);
      if (index < 0) return false;
      if (doc.screens.length === 1) {
        set({ screenDeleteNotice: 'Can’t delete the last screen — a document always keeps one.' });
        return false;
      }
      const nextDoc = produce(doc, (draft) => {
        draft.screens.splice(index, 1);
        // Flow edges pointing at the deleted screen die with it, in the SAME
        // snapshot, so undo restores screen + edges together.
        draft.edges = draft.edges.filter(
          (edge) => edge.sourceId !== screenId && edge.targetId !== screenId,
        );
      });
      // Any selected nodes living on the deleted screen leave the selection.
      const surviving = get().selectedNodeIds.filter((id) =>
        nextDoc.screens.some((screen) => findNodeById([screen.rootNode], id)),
      );
      // Keep the active-screen context valid; when the deleted screen was the
      // explicit selection, the neighbour inherits it so repeated Delete
      // walks through the screens (the exact flow in issue #138).
      const wasContext = get().selectedScreenId === screenId;
      const neighbour = nextDoc.screens[Math.min(index, nextDoc.screens.length - 1)];
      set({
        ...pushSnapshot(nextDoc),
        selectedNodeIds: surviving,
        selectedNodeId: surviving[surviving.length - 1] ?? null,
        ...(wasContext ? { selectedScreenId: neighbour.id } : {}),
        screenDeleteNotice: null,
      });
      return true;
    },

    clearScreenDeleteNotice: () => {
      if (get().screenDeleteNotice !== null) set({ screenDeleteNotice: null });
    },

    updateNodeProps: (nodeId, props) => {
      const nextDoc = produce(get().doc, (draft) => {
        const update = (node: AdwNode): boolean => {
          if (node.id === nodeId) { Object.assign(node, props); return true; }
          return node.children?.some(update) ?? false;
        };
        draft.screens.forEach((s) => update(s.rootNode));
      });
      set(pushSnapshot(nextDoc));
    },

    updateNodesProps: (edits) => {
      if (edits.length === 0) return;
      const nextDoc = produce(get().doc, (draft) => {
        for (const edit of edits) {
          const update = (node: AdwNode): boolean => {
            if (node.id === edit.nodeId) { Object.assign(node, edit.props); return true; }
            return node.children?.some(update) ?? false;
          };
          draft.screens.some((s) => update(s.rootNode));
        }
      });
      set(pushSnapshot(nextDoc));
    },

    updateScreenProps: (screenId, props) => {
      const nextDoc = produce(get().doc, (draft) => {
        const screen = draft.screens.find((s) => s.id === screenId);
        if (screen) Object.assign(screen, props);
      });
      set(pushSnapshot(nextDoc));
    },

    addChildNode: (parentId, childType, slot, index) => {
      const label = childType.replace(/-/g, ' ');
      const newNode: AdwNode = {
        id: uid('node'),
        type: childType,
        title: label.charAt(0).toUpperCase() + label.slice(1),
        // A named slot decides where a container puts the child, so it is
        // part of creating it rather than an edit afterwards.
        ...(slot ? { slot } : {}),
      };
      let placed = false;
      const nextDoc = produce(get().doc, (draft) => {
        const addTo = (node: AdwNode): boolean => {
          if (node.id === parentId) {
            node.children = node.children || [];
            const at = index === undefined
              ? node.children.length
              : Math.max(0, Math.min(index, node.children.length));
            node.children.splice(at, 0, newNode);
            placed = true;
            return true;
          }
          return node.children?.some(addTo) ?? false;
        };
        draft.screens.forEach((s) => addTo(s.rootNode));
      });
      if (!placed) return null;
      set(pushSnapshot(nextDoc));
      return newNode.id;
    },

    addScreen: (title, type) => {
      const defaults = SCREEN_DEFAULTS[type];
      const nextDoc = produce(get().doc, (draft) => {
        draft.screens.push({
          id: uid('screen'),
          title,
          type,
          width: defaults.width,
          height: defaults.height,
          rootNode: createRootNode(type, title),
        });
      });
      set(pushSnapshot(nextDoc));
    },

    moveNodeUp: (nodeId) => {
      const nextDoc = produce(get().doc, (draft) => {
        for (const screen of draft.screens) {
          const loc = findNodeLocation(screen.rootNode, nodeId);
          if (loc && loc.index > 0) {
            const { parentChildren, index } = loc;
            const prev = parentChildren[index - 1];
            parentChildren[index - 1] = parentChildren[index];
            parentChildren[index] = prev;
            break;
          }
        }
      });
      set(pushSnapshot(nextDoc));
    },

    moveNodeDown: (nodeId) => {
      const nextDoc = produce(get().doc, (draft) => {
        for (const screen of draft.screens) {
          const loc = findNodeLocation(screen.rootNode, nodeId);
          if (loc && loc.index < loc.parentChildren.length - 1) {
            const { parentChildren, index } = loc;
            const next = parentChildren[index + 1];
            parentChildren[index + 1] = parentChildren[index];
            parentChildren[index] = next;
            break;
          }
        }
      });
      set(pushSnapshot(nextDoc));
    },

    moveNode: (nodeId, targetParentId, index, slot) => {
      if (nodeId === targetParentId) return;
      const { doc } = get();
      // Screen roots are anchors, not movable layers.
      if (doc.screens.some((screen) => screen.rootNode.id === nodeId)) return;
      let subject: AdwNode | null = null;
      let sourceLoc: ReturnType<typeof findNodeLocation> = null;
      for (const screen of doc.screens) {
        sourceLoc = findNodeLocation(screen.rootNode, nodeId);
        if (sourceLoc) { subject = sourceLoc.parentChildren[sourceLoc.index]; break; }
      }
      if (!subject || !sourceLoc) return;
      // A node cannot move into itself or its own descendant.
      if (findNodeById([subject], targetParentId)) return;
      let target: AdwNode | null = null;
      for (const screen of doc.screens) {
        target = findNodeById([screen.rootNode], targetParentId);
        if (target) break;
      }
      if (!target) return;
      // Reordering to the position it already occupies is not an edit.
      if (target.children === sourceLoc.parentChildren && slot === undefined) {
        let finalIndex = Math.max(0, Math.min(index, target.children.length));
        if (finalIndex > sourceLoc.index) finalIndex -= 1;
        if (finalIndex === sourceLoc.index) return;
      }

      const nextDoc = produce(doc, (draft) => {
        let loc: ReturnType<typeof findNodeLocation> = null;
        for (const screen of draft.screens) {
          loc = findNodeLocation(screen.rootNode, nodeId);
          if (loc) break;
        }
        let draftTarget: AdwNode | null = null;
        for (const screen of draft.screens) {
          draftTarget = findNodeById([screen.rootNode], targetParentId);
          if (draftTarget) break;
        }
        if (!loc || !draftTarget) return;
        // Splice the same node object out and back in — never delete+add —
        // so the node keeps its identity across the move.
        const [moved] = loc.parentChildren.splice(loc.index, 1);
        draftTarget.children = draftTarget.children ?? [];
        let insertAt = Math.max(0, Math.min(index, draftTarget.children.length + 1));
        if (loc.parentChildren === draftTarget.children && insertAt > loc.index) insertAt -= 1;
        insertAt = Math.min(insertAt, draftTarget.children.length);
        draftTarget.children.splice(insertAt, 0, moved);
        if (slot !== undefined) moved.slot = slot || undefined;
      });
      set(pushSnapshot(nextDoc));
    },

    deleteNode: (nodeId) => {
      // Imported presets reuse node ids across screens (every Clocks screen
      // roots at `imported-1`), so a global first-match search can delete a
      // node on a screen the user never touched (#137). When the id being
      // deleted is the current selection, its screen is known — scope the
      // search to exactly that screen.
      const { selectedNodeId, selectedScreenId } = get();
      const scopedScreenId =
        nodeId === selectedNodeId && selectedScreenId ? selectedScreenId : null;
      let removed = false;
      const nextDoc = produce(get().doc, (draft) => {
        const screens = scopedScreenId
          ? draft.screens.filter((screen) => screen.id === scopedScreenId)
          : draft.screens;
        for (const screen of screens) {
          // Screen roots are anchors: deleting one must be a no-op — not a
          // fallthrough that removes a same-id node from another screen.
          if (screen.rootNode.id === nodeId) continue;
          const loc = findNodeLocation(screen.rootNode, nodeId);
          if (loc) { loc.parentChildren.splice(loc.index, 1); removed = true; break; }
        }
      });
      // A delete that removed nothing (screen root, unknown id) must leave
      // both the document and the history untouched — pushing an identical
      // snapshot would turn the user's next undo into a visible no-op.
      if (!removed) return;
      const nextState = pushSnapshot(nextDoc);
      if (get().selectedNodeId === nodeId) {
        (nextState as MockupState).selectedNodeId = null;
      }
      if (get().selectedNodeIds.includes(nodeId)) {
        nextState.selectedNodeIds = get().selectedNodeIds.filter((id) => id !== nodeId);
      }
      set(nextState);
    },

    deleteSelectedNodes: () => {
      const ids = get().selectedNodeIds;
      if (ids.length === 0) return;
      let removed = 0;
      const nextDoc = produce(get().doc, (draft) => {
        for (const nodeId of ids) {
          for (const screen of draft.screens) {
            if (screen.rootNode.id === nodeId) continue; // roots are anchors
            const loc = findNodeLocation(screen.rootNode, nodeId);
            // A node already gone (deleted with a selected ancestor) is fine.
            if (loc) { loc.parentChildren.splice(loc.index, 1); removed += 1; break; }
          }
        }
      });
      if (removed === 0) return;
      // One snapshot for the whole batch; selection collapses to none.
      set({ ...pushSnapshot(nextDoc), selectedNodeId: null, selectedNodeIds: [] });
    },

    undo: () => {
      const { historyIndex, history } = get();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        const prevDoc = history[newIndex];
        persistDocumentSource(prevDoc);
        set({
          doc: prevDoc, historyIndex: newIndex,
          // The report must describe the document now on screen.
          ...(get().diagnosticsEnabled ? { diagnostics: runDiagnostics(prevDoc) } : {}),
        });
      }
    },

    redo: () => {
      const { historyIndex, history } = get();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        const nextDoc = history[newIndex];
        persistDocumentSource(nextDoc);
        set({
          doc: nextDoc, historyIndex: newIndex,
          ...(get().diagnosticsEnabled ? { diagnostics: runDiagnostics(nextDoc) } : {}),
        });
      }
    },

    runInTransaction: (fn) => {
      if (transactionDepth > 0) { fn(); return; } // nested: inline no-op
      transactionDepth += 1;
      const before = get().doc;
      try {
        fn();
      } finally {
        transactionDepth -= 1;
        const after = get().doc;
        // An empty transaction pushes nothing; a productive one pushes the
        // accumulated document as exactly one history entry.
        if (after !== before) set(pushSnapshot(after));
      }
    },

    setShowAddScreenModal: (show) => set({ showAddScreenModal: show }),

    setColorScheme: (scheme) => {
      if (get().doc.colorScheme === scheme) return;
      const next = produce(get().doc, (draft) => {
        draft.colorScheme = scheme;
      });
      set(pushSnapshot(next));
    },

    toggleDiagnostics: () => {
      const nextEnabled = !get().diagnosticsEnabled;
      set({
        diagnosticsEnabled: nextEnabled,
        diagnostics: nextEnabled ? runDiagnostics(get().doc) : [],
        // Live results describe the panel that is going away; drop them so
        // the badge never counts stale BLP-L001s. Opt-in survives (the
        // worker stays warm and resumes when diagnostics come back).
        ...(nextEnabled ? {} : { exportCheck: [], liveBlueprintDiagnostics: [], liveBlueprintStatus: 'off' as const }),
      });
    },

    setTierFilter: (tier, on) =>
      set({ tierFilters: { ...get().tierFilters, [tier]: on } }),

    ignoreRule: (ruleId) => {
      const ignoredRules = [...new Set([...get().ignoredRules, ruleId])];
      saveIgnores({ rules: ignoredRules, instances: get().ignoredInstances });
      set({ ignoredRules });
    },

    ignoreInstance: (ruleId, nodeId) => {
      const ignoredInstances = [...new Set([...get().ignoredInstances, instanceKey(ruleId, nodeId)])];
      saveIgnores({ rules: get().ignoredRules, instances: ignoredInstances });
      set({ ignoredInstances });
    },

    clearIgnores: () => {
      saveIgnores({ rules: [], instances: [] });
      set({ ignoredRules: [], ignoredInstances: [] });
    },

    applyQuickFix: (d) => {
      const fix: QuickFix | undefined = d.quickFix;
      if (!fix) return;
      switch (fix.kind) {
        case 'set-props':
          get().updateNodeProps(fix.nodeId, fix.props);
          break;
        case 'add-child':
          get().addChildNode(fix.parentId, fix.childType, fix.slot);
          break;
        case 'delete-node':
          get().deleteNode(fix.nodeId);
          break;
        case 'set-screen-props':
          get().updateScreenProps(d.screenId, fix.props);
          break;
      }
      // Reselect the anchor so the red-to-green loop stays visible (§6).
      if (d.nodeId) get().selectNode(d.nodeId, d.screenId);
    },

    runExportCheck: () => {
      const exportCheck = runRoundTripCheck(get().doc);
      set({ exportCheck });
      return exportCheck;
    },

    toggleLiveBlueprint: () => {
      const liveBlueprintEnabled = !get().liveBlueprintEnabled;
      // The worker itself survives a toggle (liveBlueprintClient singleton),
      // so re-enabling never re-downloads the runtime.
      set(liveBlueprintEnabled
        ? { liveBlueprintEnabled }
        : {
            liveBlueprintEnabled,
            liveBlueprintStatus: 'off',
            liveBlueprintError: null,
            liveBlueprintDiagnostics: [],
          });
    },

    setLiveBlueprintState: (partial) => set(partial),

    toggleShowFlows: () => set({ showFlows: !get().showFlows }),

    addEdge: (sourceScreenId, targetScreenId) => {
      if (sourceScreenId === targetScreenId) return;
      const duplicate = get().doc.edges.some(
        (edge) => edge.sourceId === sourceScreenId && edge.targetId === targetScreenId,
      );
      if (duplicate) return;
      const nextDoc = produce(get().doc, (draft) => {
        draft.edges.push({ id: uid('edge'), sourceId: sourceScreenId, targetId: targetScreenId });
      });
      // Flow authoring implies the user wants to see the flows.
      set({ ...pushSnapshot(nextDoc), showFlows: true });
    },

    removeEdge: (edgeId) => {
      const nextDoc = produce(get().doc, (draft) => {
        draft.edges = draft.edges.filter((edge) => edge.id !== edgeId);
      });
      set(pushSnapshot(nextDoc));
    },

    clipboard: [],

    copyNodes: (nodeIds) => {
      const { doc } = get();
      // Selection order is paste order; a selected container swallows its
      // selected descendants (same shallowest rule as align and drag).
      const kept = filterShallowest(nodeIds, doc.screens);
      const trees: AdwNode[] = [];
      for (const id of kept) {
        for (const screen of doc.screens) {
          const found = findNodeById([screen.rootNode], id);
          if (found) { trees.push(JSON.parse(JSON.stringify(found))); break; }
        }
      }
      if (trees.length === 0) return [];
      set({ clipboard: trees });
      return trees.map((tree) => tree.id);
    },

    copyNode: (nodeId) => { get().copyNodes([nodeId]); },

    cutNodes: (nodeIds) => {
      const copiedIds = get().copyNodes(nodeIds);
      if (copiedIds.length === 0) return;
      let removed = 0;
      const nextDoc = produce(get().doc, (draft) => {
        for (const nodeId of copiedIds) {
          for (const screen of draft.screens) {
            if (screen.rootNode.id === nodeId) continue; // roots are anchors
            const loc = findNodeLocation(screen.rootNode, nodeId);
            if (loc) { loc.parentChildren.splice(loc.index, 1); removed += 1; break; }
          }
        }
      });
      if (removed === 0) return;
      // One snapshot for the whole cut; cut nodes leave the selection.
      const remaining = get().selectedNodeIds.filter((id) => !copiedIds.includes(id));
      set({
        ...pushSnapshot(nextDoc),
        selectedNodeIds: remaining,
        selectedNodeId: remaining[remaining.length - 1] ?? null,
      });
    },

    cutNode: (nodeId) => { get().cutNodes([nodeId]); },

    pasteNodes: (targetId) => {
      const pastedIds: string[] = [];
      const skipped: AdwNodeType[] = [];
      const clipboard = get().clipboard;
      if (clipboard.length === 0) return { pastedIds, skipped };
      const copies = clipboard.map(withFreshIds);
      const nextDoc = produce(get().doc, (draft) => {
        let besideOffset = 0;
        for (const copy of copies) {
          const landed = placeTreeAt(draft.screens, targetId, copy, besideOffset);
          if (landed === null) { skipped.push(copy.type); continue; }
          if (landed === 'beside') besideOffset += 1;
          pastedIds.push(copy.id);
        }
      });
      if (pastedIds.length === 0) return { pastedIds, skipped };
      set(pushSnapshot(nextDoc));
      return { pastedIds, skipped };
    },

    pasteNode: (targetId) => get().pasteNodes(targetId).pastedIds[0] ?? null,

    duplicateNodes: (nodeIds) => {
      const { doc } = get();
      const kept = filterShallowest(nodeIds, doc.screens);
      const copies: Array<{ sourceId: string; copy: AdwNode }> = [];
      for (const id of kept) {
        for (const screen of doc.screens) {
          const found = findNodeById([screen.rootNode], id);
          if (found) {
            copies.push({ sourceId: id, copy: withFreshIds(JSON.parse(JSON.stringify(found))) });
            break;
          }
        }
      }
      if (copies.length === 0) return [];
      const createdIds: string[] = [];
      const nextDoc = produce(get().doc, (draft) => {
        for (const { sourceId, copy } of copies) {
          // Each duplicate lands relative to its OWN original (into it when
          // legal, else beside it) — never batched into one target.
          if (placeTreeAt(draft.screens, sourceId, copy, 0)) createdIds.push(copy.id);
        }
      });
      if (createdIds.length === 0) return [];
      set(pushSnapshot(nextDoc));
      return createdIds;
    },

    duplicateNode: (nodeId) => get().duplicateNodes([nodeId])[0] ?? null,

    clearCanvas: () => {
      const freshDoc: MockupDocument = {
        ...get().doc,
        edges: [],
        screens: [],
      };
      set(pushSnapshot(freshDoc));
    },
  };
});

// Expose the store for Playwright debugging in dev builds only.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__mockupStore = useMockupStore;
}
