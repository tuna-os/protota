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
import { toggleSelection, unionSelection } from '../utils/selection';
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
  history: MockupDocument[];
  historyIndex: number;
  showAddScreenModal: boolean;
  /** Diagnostics (#95) — renames lintEnabled/violations/toggleLint. */
  diagnosticsEnabled: boolean;
  diagnostics: Diagnostic[];
  /** BLP-E001 round-trip results, refreshed at export and cleared on edit. */
  exportCheck: Diagnostic[];
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
  toggleColorScheme: () => void;
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
  toggleShowFlows: () => void;
  /** Connect two screens with a navigation flow edge (#11). */
  addEdge: (sourceScreenId: string, targetScreenId: string) => void;
  removeEdge: (edgeId: string) => void;
  setShowAddScreenModal: (show: boolean) => void;
  clearCanvas: () => void;
  /** Subtree clipboard: the designer workflow of build once, place often. */
  clipboard: AdwNode | null;
  copyNode: (nodeId: string) => void;
  cutNode: (nodeId: string) => void;
  /** Paste into a container, or beside a leaf. Returns the new node's id. */
  pasteNode: (targetId: string) => string | null;
  duplicateNode: (nodeId: string) => string | null;
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

  const pushSnapshot = (newDoc: MockupDocument): Partial<MockupState> => {
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
    history: [startDoc],
    historyIndex: 0,
    showAddScreenModal: false,
    diagnosticsEnabled: false,
    diagnostics: [],
    exportCheck: [],
    tierFilters: { error: true, warning: true, suggestion: true },
    ...(() => { const ignores = loadIgnores(); return { ignoredRules: ignores.rules, ignoredInstances: ignores.instances }; })(),
    showFlows: false,

    selectNode: (nodeId, screenId) =>
      set({
        selectedNodeId: nodeId,
        selectedNodeIds: nodeId ? [nodeId] : [],
        selectedScreenId: screenId ?? get().selectedScreenId,
      }),

    toggleNodeSelection: (nodeId, screenId) => {
      const selectedNodeIds = toggleSelection(get().selectedNodeIds, nodeId);
      set({
        selectedNodeIds,
        selectedNodeId: selectedNodeIds[selectedNodeIds.length - 1] ?? null,
        selectedScreenId: screenId ?? get().selectedScreenId,
      });
    },

    selectNodes: (ids, screenId, additive) => {
      const selectedNodeIds = additive ? unionSelection(get().selectedNodeIds, ids) : [...ids];
      set({
        selectedNodeIds,
        selectedNodeId: selectedNodeIds[selectedNodeIds.length - 1] ?? null,
        selectedScreenId: screenId ?? get().selectedScreenId,
      });
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
      const nextDoc = produce(get().doc, (draft) => {
        for (const screen of draft.screens) {
          if (screen.rootNode.id === nodeId) continue;
          const loc = findNodeLocation(screen.rootNode, nodeId);
          if (loc) { loc.parentChildren.splice(loc.index, 1); break; }
        }
      });
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

    setShowAddScreenModal: (show) => set({ showAddScreenModal: show }),

    toggleColorScheme: () => {
      const next = produce(get().doc, (draft) => {
        const cycle: Record<string, MockupDocument['colorScheme']> = {
          auto: 'dark', dark: 'light', light: 'auto',
        };
        draft.colorScheme = cycle[draft.colorScheme];
      });
      set(pushSnapshot(next));
    },

    toggleDiagnostics: () => {
      const nextEnabled = !get().diagnosticsEnabled;
      set({
        diagnosticsEnabled: nextEnabled,
        diagnostics: nextEnabled ? runDiagnostics(get().doc) : [],
        ...(nextEnabled ? {} : { exportCheck: [] }),
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

    clipboard: null,

    copyNode: (nodeId) => {
      for (const screen of get().doc.screens) {
        const found = findNodeById([screen.rootNode], nodeId);
        if (found) { set({ clipboard: JSON.parse(JSON.stringify(found)) }); return; }
      }
    },

    cutNode: (nodeId) => {
      get().copyNode(nodeId);
      if (get().clipboard) get().deleteNode(nodeId);
    },

    pasteNode: (targetId) => {
      const clipboard = get().clipboard;
      if (!clipboard) return null;
      const copy = withFreshIds(clipboard);
      let placed = false;
      const nextDoc = produce(get().doc, (draft) => {
        for (const screen of draft.screens) {
          const target = findNodeById([screen.rootNode], targetId);
          if (!target) continue;
          // Prefer pasting into the target; fall back to beside it when the
          // target cannot legally hold this widget.
          const legalHere = (LEGAL_CHILDREN[target.type] ?? []).includes(copy.type);
          if (legalHere) {
            target.children = target.children ?? [];
            target.children.push(copy);
            placed = true;
          } else {
            const location = findNodeLocation(screen.rootNode, targetId);
            const parent = location ? findParentOf(screen.rootNode, targetId) : null;
            if (location && parent && (LEGAL_CHILDREN[parent.type] ?? []).includes(copy.type)) {
              location.parentChildren.splice(location.index + 1, 0, copy);
              placed = true;
            }
          }
          break;
        }
      });
      if (!placed) return null;
      set(pushSnapshot(nextDoc));
      return copy.id;
    },

    duplicateNode: (nodeId) => {
      get().copyNode(nodeId);
      return get().pasteNode(nodeId);
    },

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
