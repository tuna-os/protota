import { create } from 'zustand';
import { produce } from 'immer';
import type { MockupDocument, AdwNode, AdwNodeType } from '../types/mockup';
import { findNodeLocation } from '../utils/treeHelpers';

const STORAGE_KEY = 'adwaita_mockup_doc_v1';
const MAX_HISTORY = 50;

const initialDocument: MockupDocument = {
  id: 'doc-1',
  title: 'Untitled GNOME App',
  edges: [],
  screens: [
    {
      id: 'screen-1',
      title: 'Main Window',
      type: 'window',
      width: 800,
      height: 600,
      rootNode: {
        id: 'node-root-1',
        type: 'adw-window',
        title: 'My Adwaita App',
        children: [
          {
            id: 'node-header-1',
            type: 'adw-header-bar',
            title: 'My Adwaita App',
          },
          {
            id: 'node-pref-page-1',
            type: 'adw-preferences-page',
            children: [
              {
                id: 'node-pref-group-1',
                type: 'adw-preferences-group',
                title: 'General Settings',
                children: [
                  {
                    id: 'node-row-1',
                    type: 'adw-action-row',
                    title: 'Enable Feature',
                    subtitle: 'Activates core desktop capabilities',
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
  setShowAddScreenModal: (show: boolean) => void;
}

export type ScreenTemplateType = 'window' | 'dialog' | 'preferences' | 'status-page';

function createRootNode(type: ScreenTemplateType, title: string): AdwNode {
  const id = `node-root-${Date.now()}`;
  switch (type) {
    case 'window':
      return {
        id,
        type: 'adw-window',
        title,
        children: [
          { id: `${id}-header`, type: 'adw-header-bar', title },
        ],
      };
    case 'dialog':
      return {
        id,
        type: 'adw-window',
        title,
        children: [
          { id: `${id}-header`, type: 'adw-header-bar', title },
          {
            id: `${id}-content`,
            type: 'adw-preferences-page',
            children: [
              {
                id: `${id}-group`,
                type: 'adw-preferences-group',
                title: 'Content',
              },
            ],
          },
        ],
      };
    case 'preferences':
      return {
        id,
        type: 'adw-preferences-page',
        title,
        children: [
          {
            id: `${id}-group`,
            type: 'adw-preferences-group',
            title,
          },
        ],
      };
    case 'status-page':
      return {
        id,
        type: 'adw-status-page',
        title,
        description: 'Nothing here yet.',
        iconName: 'system-search-symbolic',
      };
  }
}

const SCREEN_DEFAULTS: Record<ScreenTemplateType, { width: number; height: number }> = {
  window: { width: 1024, height: 720 },
  dialog: { width: 600, height: 500 },
  preferences: { width: 800, height: 600 },
  'status-page': { width: 400, height: 500 },
};

export const useMockupStore = create<MockupState>((set, get) => {
  const saved = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const startDoc: MockupDocument = saved || initialDocument;

  const pushSnapshot = (newDoc: MockupDocument): Partial<MockupState> => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newDoc));
    const { history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    if (newHistory.length >= MAX_HISTORY) newHistory.shift();
    newHistory.push(newDoc);
    return {
      doc: newDoc,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    };
  };

  return {
    doc: startDoc,
    selectedNodeId: null,
    selectedScreenId: startDoc.screens[0]?.id || null,
    history: [startDoc],
    historyIndex: 0,
    showAddScreenModal: false,

    selectNode: (nodeId, screenId) =>
      set({
        selectedNodeId: nodeId,
        selectedScreenId: screenId ?? get().selectedScreenId,
      }),

    updateNodeProps: (nodeId, props) => {
      const nextDoc = produce(get().doc, (draft) => {
        const update = (node: AdwNode): boolean => {
          if (node.id === nodeId) {
            Object.assign(node, props);
            return true;
          }
          return node.children?.some(update) ?? false;
        };
        draft.screens.forEach((s) => update(s.rootNode));
      });
      set(pushSnapshot(nextDoc));
    },

    addChildNode: (parentId, childType) => {
      const nextDoc = produce(get().doc, (draft) => {
        const newNode: AdwNode = {
          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: childType,
          title: `New ${childType.replace('adw-', '')}`,
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
          id: `screen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
          if (loc) {
            loc.parentChildren.splice(loc.index, 1);
            break;
          }
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
  };
});
