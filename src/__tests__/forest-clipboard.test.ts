import { beforeEach, describe, expect, it } from 'vitest';
import type { MockupDocument, Screen } from '../types/mockup';

/**
 * Forest clipboard + runInTransaction (ADR 0001 Part 3 items 3–4).
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
 * s1 root(box)          s2 s2root(box)   s3 proot(preferences-dialog)
 * ├── a(box)            └── d(box)       └── pg(preferences-page)
 * │   ├── a1(button)                         └── grp(preferences-group)
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
              { id: 'a1', type: 'button', title: 'One' },
              { id: 'a2', type: 'label', title: 'Two' },
            ],
          },
          { id: 'b', type: 'box', children: [] },
          { id: 'c', type: 'button', title: 'Three' },
        ],
      },
    },
    {
      id: 's2', title: 'Screen 2', type: 'empty', width: 800, height: 600,
      rootNode: { id: 's2root', type: 'box', children: [{ id: 'd', type: 'box', children: [] }] },
    },
    {
      id: 's3', title: 'Screen 3', type: 'preferences', width: 640, height: 480,
      rootNode: {
        id: 'proot', type: 'preferences-dialog',
        children: [{
          id: 'pg', type: 'preferences-page', title: 'General',
          children: [{ id: 'grp', type: 'preferences-group', children: [] }],
        }],
      },
    },
  ];
}

function makeDoc(): MockupDocument {
  return { id: 'doc-test', title: 'Test', edges: [], colorScheme: 'auto', screens: makeScreens() };
}

const state = () => useMockupStore.getState();
const childIds = (screenIndex: number, path: string[] = []): string[] => {
  let node = state().doc.screens[screenIndex].rootNode;
  for (const id of path) node = node.children!.find((child) => child.id === id)!;
  return (node.children ?? []).map((child) => child.id);
};
const childTypes = (screenIndex: number, path: string[] = []): string[] => {
  let node = state().doc.screens[screenIndex].rootNode;
  for (const id of path) node = node.children!.find((child) => child.id === id)!;
  return (node.children ?? []).map((child) => child.type);
};

beforeEach(() => {
  const doc = makeDoc();
  useMockupStore.setState({
    doc, history: [doc], historyIndex: 0, clipboard: [],
    selectedNodeId: null, selectedNodeIds: [], selectedScreenId: 's1',
  });
});

describe('copyNodes', () => {
  it('stores shallowest-filtered subtrees in selection order', () => {
    const copied = state().copyNodes(['c', 'a', 'a1']);
    expect(copied).toEqual(['c', 'a']); // a1 is swallowed by its ancestor a
    expect(state().clipboard.map((tree) => tree.id)).toEqual(['c', 'a']);
    expect(state().clipboard[1].children!.map((child) => child.id)).toEqual(['a1', 'a2']);
  });

  it('deep-copies: later edits to the document do not change the clipboard', () => {
    state().copyNodes(['a1']);
    state().updateNodeProps('a1', { title: 'Renamed' });
    expect(state().clipboard[0].title).toBe('One');
  });

  it('leaves the clipboard untouched when no id resolves', () => {
    state().copyNodes(['c']);
    expect(state().copyNodes(['ghost'])).toEqual([]);
    expect(state().clipboard.map((tree) => tree.id)).toEqual(['c']);
  });

  it('copying never touches the undo history', () => {
    const before = state().historyIndex;
    state().copyNodes(['a', 'c']);
    expect(state().historyIndex).toBe(before);
  });
});

describe('pasteNodes', () => {
  it('pastes the forest sequentially in order, fresh ids, ONE undo snapshot', () => {
    state().copyNodes(['a1', 'a2']);
    const before = state().historyIndex;
    const { pastedIds, skipped } = state().pasteNodes('b');
    expect(skipped).toEqual([]);
    expect(pastedIds).toHaveLength(2);
    expect(pastedIds).not.toContain('a1');
    expect(childIds(0, ['b'])).toEqual(pastedIds);
    expect(childTypes(0, ['b'])).toEqual(['button', 'label']);
    expect(state().historyIndex).toBe(before + 1);
    // One undo removes the whole paste; sources are untouched throughout.
    state().undo();
    expect(childIds(0, ['b'])).toEqual([]);
    expect(childIds(0, ['a'])).toEqual(['a1', 'a2']);
  });

  it('falls back beside a leaf target, preserving clipboard order', () => {
    state().copyNodes(['a1', 'c']);
    const { pastedIds } = state().pasteNodes('a2'); // a label cannot hold buttons
    expect(pastedIds).toHaveLength(2);
    expect(childIds(0, ['a'])).toEqual(['a1', 'a2', ...pastedIds]);
    expect(childTypes(0, ['a'])).toEqual(['button', 'label', 'button', 'button']);
  });

  it('skips and reports a tree that cannot legally land; the rest paste in ONE snapshot', () => {
    state().copyNodes(['grp', 'c']);
    const before = state().historyIndex;
    const { pastedIds, skipped } = state().pasteNodes('pg');
    // preferences-page takes groups; a button fits neither it nor its parent.
    expect(pastedIds).toHaveLength(1);
    expect(skipped).toEqual(['button']);
    expect(childTypes(2, ['pg'])).toEqual(['preferences-group', 'preferences-group']);
    expect(state().historyIndex).toBe(before + 1);
  });

  it('pushes no snapshot when nothing can land', () => {
    state().copyNodes(['c']);
    const before = state().historyIndex;
    const { pastedIds, skipped } = state().pasteNodes('proot');
    expect(pastedIds).toEqual([]);
    expect(skipped).toEqual(['button']);
    expect(state().historyIndex).toBe(before);
  });

  it('pastes across screens', () => {
    state().copyNodes(['a']);
    const { pastedIds } = state().pasteNodes('d');
    expect(pastedIds).toHaveLength(1);
    expect(childIds(1, ['d'])).toEqual(pastedIds);
    expect(childTypes(1, ['d'])).toEqual(['box']);
  });

  it('pasteNode wrapper returns the first pasted id', () => {
    state().copyNodes(['a1', 'a2']);
    const first = state().pasteNode('b');
    expect(first).toBe(childIds(0, ['b'])[0]);
  });
});

describe('cutNodes', () => {
  it('copies, then deletes the copied roots in ONE snapshot; paste completes the move', () => {
    state().selectNodes(['a1', 'c']);
    const before = state().historyIndex;
    state().cutNodes(['a1', 'c']);
    expect(state().clipboard.map((tree) => tree.id)).toEqual(['a1', 'c']);
    expect(childIds(0)).toEqual(['a', 'b']);
    expect(childIds(0, ['a'])).toEqual(['a2']);
    expect(state().historyIndex).toBe(before + 1);
    expect(state().selectedNodeIds).toEqual([]);
    // Cross-screen move: paste the cut forest into screen 2.
    const { pastedIds } = state().pasteNodes('d');
    expect(childTypes(1, ['d'])).toEqual(['button', 'button']);
    expect(pastedIds).toHaveLength(2);
    // Single undo of the cut restores both nodes.
    state().undo(); // paste
    state().undo(); // cut
    expect(childIds(0)).toEqual(['a', 'b', 'c']);
    expect(childIds(0, ['a'])).toEqual(['a1', 'a2']);
  });

  it('copies a screen root but never deletes it, pushing no snapshot', () => {
    const before = state().historyIndex;
    state().cutNodes(['root']);
    expect(state().clipboard.map((tree) => tree.id)).toEqual(['root']);
    expect(state().doc.screens[0].rootNode.id).toBe('root');
    expect(state().historyIndex).toBe(before);
  });
});

describe('duplicateNodes', () => {
  it('duplicates each subtree beside its own original in ONE snapshot', () => {
    const before = state().historyIndex;
    const created = state().duplicateNodes(['a2', 'c']);
    expect(created).toHaveLength(2);
    expect(childIds(0, ['a'])).toEqual(['a1', 'a2', created[0]]);
    expect(childTypes(0)).toEqual(['box', 'box', 'button', 'button']);
    expect(state().historyIndex).toBe(before + 1);
    // Duplicate never clobbers the clipboard.
    expect(state().clipboard).toEqual([]);
    state().undo();
    expect(childIds(0, ['a'])).toEqual(['a1', 'a2']);
    expect(childIds(0)).toEqual(['a', 'b', 'c']);
  });

  it('applies shallowest filtering before duplicating', () => {
    const created = state().duplicateNodes(['a', 'a1']);
    expect(created).toHaveLength(1); // only a duplicates, a1 rode along inside it
  });
});

describe('runInTransaction', () => {
  it('batches N mutations into ONE undo snapshot', () => {
    const before = state().historyIndex;
    state().runInTransaction(() => {
      state().updateNodeProps('a1', { title: 'X' });
      state().updateNodeProps('a2', { title: 'Y' });
      state().addChildNode('b', 'button');
    });
    expect(state().historyIndex).toBe(before + 1);
    expect(childIds(0, ['b'])).toHaveLength(1);
    state().undo();
    const a = state().doc.screens[0].rootNode.children![0];
    expect(a.children![0].title).toBe('One');
    expect(a.children![1].title).toBe('Two');
    expect(childIds(0, ['b'])).toEqual([]);
  });

  it('nested transactions are no-ops: the outermost owns the single snapshot', () => {
    const before = state().historyIndex;
    state().runInTransaction(() => {
      state().updateNodeProps('a1', { title: 'X' });
      state().runInTransaction(() => {
        state().updateNodeProps('a2', { title: 'Y' });
      });
      expect(state().historyIndex).toBe(before); // inner commit deferred
    });
    expect(state().historyIndex).toBe(before + 1);
  });

  it('an empty transaction pushes nothing', () => {
    const before = state().historyIndex;
    state().runInTransaction(() => {});
    expect(state().historyIndex).toBe(before);
  });
});
