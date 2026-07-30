import { create } from 'zustand';
import { produce } from 'immer';
import type { MockupDocument, AdwNode, AdwNodeType } from '../types/mockup';
import type { ScreenTemplateType } from '../types/mockup';
import { SCREEN_DEFAULTS } from '../types/mockup';
import type { LintViolation } from '../utils/higLinter';
import { lintDocument } from '../utils/higLinter';
import { findNodeLocation } from '../utils/treeHelpers';
import { blueprintToDocument, mockupToBlueprint } from '../utils/blueprint';

const BLUEPRINT_STORAGE_KEY = 'protota_blueprint_v1';
const METADATA_STORAGE_KEY = 'protota_editor_metadata_v1';
const LEGACY_STORAGE_KEY = 'protota_doc_v1';
const MAX_HISTORY = 50;

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
  selectedNodeId: string | null;
  selectedScreenId: string | null;
  history: MockupDocument[];
  historyIndex: number;
  showAddScreenModal: boolean;
  lintEnabled: boolean;
  /** Flow-edge connectors between screens (#11) drawn on the canvas. */
  showFlows: boolean;
  violations: LintViolation[];

  selectNode: (nodeId: string | null, screenId?: string) => void;
  updateNodeProps: (nodeId: string, props: Partial<AdwNode>) => void;
  addChildNode: (parentId: string, type: AdwNodeType) => void;
  addScreen: (title: string, type: ScreenTemplateType) => void;
  moveNodeUp: (nodeId: string) => void;
  moveNodeDown: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  undo: () => void;
  redo: () => void;
  toggleColorScheme: () => void;
  toggleLint: () => void;
  toggleShowFlows: () => void;
  /** Connect two screens with a navigation flow edge (#11). */
  addEdge: (sourceScreenId: string, targetScreenId: string) => void;
  removeEdge: (edgeId: string) => void;
  setShowAddScreenModal: (show: boolean) => void;
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
    if (get().lintEnabled) {
      result.violations = lintDocument(newDoc);
    }
    return result;
  };

  return {
    doc: startDoc,
    selectedNodeId: null,
    selectedScreenId: startDoc.screens[0]?.id || null,
    history: [startDoc],
    historyIndex: 0,
    showAddScreenModal: false,
    lintEnabled: false,
    showFlows: false,
    violations: [],

    selectNode: (nodeId, screenId) =>
      set({ selectedNodeId: nodeId, selectedScreenId: screenId ?? get().selectedScreenId }),

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

    addChildNode: (parentId, childType) => {
      const nextDoc = produce(get().doc, (draft) => {
        const label = childType.replace(/-/g, ' ');
        const newNode: AdwNode = {
          id: uid('node'),
          type: childType,
          title: label.charAt(0).toUpperCase() + label.slice(1),
        };
        const addTo = (node: AdwNode): boolean => {
          if (node.id === parentId) {
            node.children = node.children || [];
            node.children.push(newNode);
            return true;
          }
          return node.children?.some(addTo) ?? false;
        };
        draft.screens.forEach((s) => addTo(s.rootNode));
      });
      set(pushSnapshot(nextDoc));
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
      set(nextState);
    },

    undo: () => {
      const { historyIndex, history } = get();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        const prevDoc = history[newIndex];
        persistDocumentSource(prevDoc);
        set({ doc: prevDoc, historyIndex: newIndex });
      }
    },

    redo: () => {
      const { historyIndex, history } = get();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        const nextDoc = history[newIndex];
        persistDocumentSource(nextDoc);
        set({ doc: nextDoc, historyIndex: newIndex });
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

    toggleLint: () => {
      const nextEnabled = !get().lintEnabled;
      const nextViolations = nextEnabled ? lintDocument(get().doc) : [];
      set({ lintEnabled: nextEnabled, violations: nextViolations });
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
  };
});

// Expose the store for Playwright debugging in dev builds only.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__mockupStore = useMockupStore;
}
