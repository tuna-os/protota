import { create } from 'zustand';
import { produce } from 'immer';
import type { MockupDocument, AdwNode, AdwNodeType } from '../types/mockup';
import type { ScreenTemplateType } from '../types/mockup';
import { SCREEN_DEFAULTS } from '../types/mockup';
import { findNodeLocation } from '../utils/treeHelpers';

const STORAGE_KEY = 'adwaita_mockup_doc_v2';
const MAX_HISTORY = 50;

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
  setShowAddScreenModal: (show: boolean) => void;
}

export const useMockupStore = create<MockupState>((set, get) => {
  const saved = (() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  })();
  const startDoc: MockupDocument = saved || initialDocument;

  const pushSnapshot = (newDoc: MockupDocument): Partial<MockupState> => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newDoc));
    const { history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    if (newHistory.length >= MAX_HISTORY) newHistory.shift();
    newHistory.push(newDoc);
    return { doc: newDoc, history: newHistory, historyIndex: newHistory.length - 1 };
  };

  return {
    doc: startDoc,
    selectedNodeId: null,
    selectedScreenId: startDoc.screens[0]?.id || null,
    history: [startDoc],
    historyIndex: 0,
    showAddScreenModal: false,

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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prevDoc));
        set({ doc: prevDoc, historyIndex: newIndex });
      }
    },

    redo: () => {
      const { historyIndex, history } = get();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        const nextDoc = history[newIndex];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDoc));
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
  };
});
