import { beforeEach, describe, expect, it } from 'vitest';
import type { MockupDocument, Screen } from '../types/mockup';
import {
  toggleSelection, unionSelection, rangeSelection, filterShallowest,
} from '../utils/selection';

/**
 * Multi-select (#79): pure selection-set reducer logic, plus the store's
 * selection actions (ordered set, primary = last, never undoable).
 *
 * The store persists snapshots to localStorage at module scope; stub before
 * the dynamic import (same pattern as move-node.test.ts).
 */
const backing = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => backing.get(key) ?? null,
  setItem: (key: string, value: string) => { backing.set(key, value); },
  removeItem: (key: string) => { backing.delete(key); },
  clear: () => { backing.clear(); },
  key: (index: number) => [...backing.keys()][index] ?? null,
  get length() { return backing.size; },
} as Storage;

const { useMockupStore } = await import('../store/mockupStore');

/**
 * root(box)
 * ├── a(box)
 * │   ├── a1(button)
 * │   └── a2(label)
 * ├── b(box)
 * └── c(button)
 */
function makeScreens(): Screen[] {
  return [
    {
      id: 's1', title: 'Screen 1', type: 'empty', width: 800, height: 600,
      rootNode: {
        id: 'root', type: 'box',
        children: [
          {
            id: 'a', type: 'box',
            children: [
              { id: 'a1', type: 'button' },
              { id: 'a2', type: 'label' },
            ],
          },
          { id: 'b', type: 'box', children: [] },
          { id: 'c', type: 'button' },
        ],
      },
    },
  ];
}

function makeDoc(): MockupDocument {
  return { id: 'doc-test', title: 'Test', edges: [], colorScheme: 'auto', screens: makeScreens() };
}

describe('toggleSelection', () => {
  it('adds an absent id at the end', () => {
    expect(toggleSelection(['a'], 'b')).toEqual(['a', 'b']);
  });
  it('removes a present id, preserving order of the rest', () => {
    expect(toggleSelection(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
  it('toggles from empty', () => {
    expect(toggleSelection([], 'x')).toEqual(['x']);
  });
});

describe('unionSelection', () => {
  it('appends only new ids, keeping existing order', () => {
    expect(unionSelection(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('rangeSelection', () => {
  const order = ['r', 'a', 'a1', 'a2', 'b', 'c'];
  it('selects the inclusive range downward', () => {
    expect(rangeSelection(order, 'a', 'b')).toEqual(['a', 'a1', 'a2', 'b']);
  });
  it('selects the inclusive range upward', () => {
    expect(rangeSelection(order, 'b', 'a1')).toEqual(['a1', 'a2', 'b']);
  });
  it('falls back to the target when the anchor is not visible', () => {
    expect(rangeSelection(order, 'ghost', 'b')).toEqual(['b']);
  });
});

describe('filterShallowest', () => {
  const screens = makeScreens();
  it('drops descendants of another selected node', () => {
    expect(filterShallowest(['a', 'a1', 'a2', 'c'], screens)).toEqual(['a', 'c']);
  });
  it('keeps unrelated siblings', () => {
    expect(filterShallowest(['a1', 'a2', 'c'], screens)).toEqual(['a1', 'a2', 'c']);
  });
  it('handles the root swallowing everything', () => {
    expect(filterShallowest(['root', 'a', 'c'], screens)).toEqual(['root']);
  });
});

describe('store selection actions', () => {
  beforeEach(() => {
    const doc = makeDoc();
    useMockupStore.setState({
      doc, history: [doc], historyIndex: 0,
      selectedNodeId: null, selectedNodeIds: [], selectedScreenId: 's1',
    });
  });

  it('selectNode collapses to a single-id selection', () => {
    const s = useMockupStore.getState();
    s.selectNodes(['a1', 'a2']);
    useMockupStore.getState().selectNode('c');
    expect(useMockupStore.getState().selectedNodeIds).toEqual(['c']);
    expect(useMockupStore.getState().selectedNodeId).toBe('c');
  });

  it('toggleNodeSelection keeps the primary as the last element', () => {
    const s = useMockupStore.getState();
    s.selectNode('a1');
    useMockupStore.getState().toggleNodeSelection('a2');
    expect(useMockupStore.getState().selectedNodeIds).toEqual(['a1', 'a2']);
    expect(useMockupStore.getState().selectedNodeId).toBe('a2');
    useMockupStore.getState().toggleNodeSelection('a2');
    expect(useMockupStore.getState().selectedNodeIds).toEqual(['a1']);
    expect(useMockupStore.getState().selectedNodeId).toBe('a1');
  });

  it('selectNode(null) clears the whole selection', () => {
    useMockupStore.getState().selectNodes(['a1', 'a2']);
    useMockupStore.getState().selectNode(null);
    expect(useMockupStore.getState().selectedNodeIds).toEqual([]);
    expect(useMockupStore.getState().selectedNodeId).toBeNull();
  });

  it('selection changes never touch the undo history', () => {
    const before = useMockupStore.getState().historyIndex;
    useMockupStore.getState().selectNodes(['a1', 'a2']);
    useMockupStore.getState().toggleNodeSelection('c');
    expect(useMockupStore.getState().historyIndex).toBe(before);
    expect(useMockupStore.getState().history).toHaveLength(1);
  });

  it('deleteSelectedNodes removes all selected in ONE snapshot and clears selection', () => {
    useMockupStore.getState().selectNodes(['a1', 'c']);
    const before = useMockupStore.getState().historyIndex;
    useMockupStore.getState().deleteSelectedNodes();
    const state = useMockupStore.getState();
    expect(state.historyIndex).toBe(before + 1);
    const root = state.doc.screens[0].rootNode;
    expect(root.children!.map((n) => n.id)).toEqual(['a', 'b']);
    expect(root.children![0].children!.map((n) => n.id)).toEqual(['a2']);
    expect(state.selectedNodeIds).toEqual([]);
    // A single undo restores both nodes.
    state.undo();
    const restored = useMockupStore.getState().doc.screens[0].rootNode;
    expect(restored.children!.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(restored.children![0].children!.map((n) => n.id)).toEqual(['a1', 'a2']);
  });

  it('deleteSelectedNodes tolerates a selection containing a parent and its child', () => {
    useMockupStore.getState().selectNodes(['a', 'a1']);
    const before = useMockupStore.getState().historyIndex;
    useMockupStore.getState().deleteSelectedNodes();
    const state = useMockupStore.getState();
    expect(state.historyIndex).toBe(before + 1);
    expect(state.doc.screens[0].rootNode.children!.map((n) => n.id)).toEqual(['b', 'c']);
  });

  it('deleteSelectedNodes skips screen roots and pushes nothing when only roots are selected', () => {
    useMockupStore.getState().selectNodes(['root']);
    const before = useMockupStore.getState().historyIndex;
    useMockupStore.getState().deleteSelectedNodes();
    expect(useMockupStore.getState().historyIndex).toBe(before);
  });

  it('updateNodesProps batches edits into ONE snapshot', () => {
    const before = useMockupStore.getState().historyIndex;
    useMockupStore.getState().updateNodesProps([
      { nodeId: 'a1', props: { halign: 'end' } },
      { nodeId: 'a2', props: { halign: 'end' } },
    ]);
    const state = useMockupStore.getState();
    expect(state.historyIndex).toBe(before + 1);
    const a = state.doc.screens[0].rootNode.children![0];
    expect(a.children![0].halign).toBe('end');
    expect(a.children![1].halign).toBe('end');
  });
});
