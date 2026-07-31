import { beforeEach, describe, expect, it } from 'vitest';
import type { AdwNode, MockupDocument } from '../types/mockup';

/**
 * moveNode reparents/reorders in one undo snapshot (#79).
 *
 * The store persists every snapshot to localStorage at module scope, and
 * vitest runs in a plain node environment, so a stub must exist before the
 * store module is evaluated — hence the dynamic import below.
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
function makeDoc(): MockupDocument {
  return {
    id: 'doc-test',
    title: 'Test',
    edges: [],
    colorScheme: 'auto',
    screens: [
      {
        id: 's1',
        title: 'Screen 1',
        type: 'empty',
        width: 800,
        height: 600,
        rootNode: {
          id: 'root',
          type: 'box',
          children: [
            {
              id: 'a',
              type: 'box',
              children: [
                { id: 'a1', type: 'button', title: 'A1' },
                { id: 'a2', type: 'label', title: 'A2' },
              ],
            },
            { id: 'b', type: 'box', children: [] },
            { id: 'c', type: 'button', title: 'C' },
          ],
        },
      },
    ],
  };
}

function find(id: string): AdwNode | null {
  const visit = (node: AdwNode): AdwNode | null => {
    if (node.id === id) return node;
    for (const child of node.children ?? []) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  return visit(useMockupStore.getState().doc.screens[0].rootNode);
}

const childIds = (id: string) => (find(id)?.children ?? []).map((c) => c.id);

describe('moveNode', () => {
  beforeEach(() => {
    const doc = makeDoc();
    useMockupStore.setState({
      doc,
      history: [doc],
      historyIndex: 0,
      selectedNodeId: null,
      lintEnabled: false,
      violations: [],
    });
  });

  it('reparents a node into another container', () => {
    useMockupStore.getState().moveNode('a1', 'b', 0);
    expect(childIds('a')).toEqual(['a2']);
    expect(childIds('b')).toEqual(['a1']);
  });

  it('preserves node identity — the moved subtree is the same object, not a copy', () => {
    const before = find('a1');
    useMockupStore.getState().moveNode('a1', 'b', 0);
    const after = find('a1');
    expect(after).toBe(before);
  });

  it('reorders within the same parent using pre-removal index semantics', () => {
    // Drop "a" (index 0) at pre-removal position 2 → lands before "c".
    useMockupStore.getState().moveNode('a', 'root', 2);
    expect(childIds('root')).toEqual(['b', 'a', 'c']);
  });

  it('appends when index equals the child count', () => {
    useMockupStore.getState().moveNode('a', 'root', 3);
    expect(childIds('root')).toEqual(['b', 'c', 'a']);
  });

  it('clamps an out-of-range index', () => {
    useMockupStore.getState().moveNode('c', 'b', 99);
    expect(childIds('b')).toEqual(['c']);
  });

  it('records exactly one undo snapshot, and undo restores the original tree', () => {
    useMockupStore.getState().moveNode('a1', 'b', 0);
    expect(useMockupStore.getState().history).toHaveLength(2);
    useMockupStore.getState().undo();
    expect(childIds('a')).toEqual(['a1', 'a2']);
    expect(childIds('b')).toEqual([]);
  });

  it('applies a named slot when provided', () => {
    useMockupStore.getState().moveNode('a1', 'b', 0, 'top');
    expect(find('a1')?.slot).toBe('top');
  });

  it('refuses to move a node into itself', () => {
    useMockupStore.getState().moveNode('a', 'a', 0);
    expect(childIds('root')).toEqual(['a', 'b', 'c']);
    expect(useMockupStore.getState().history).toHaveLength(1);
  });

  it('refuses to move a node into its own descendant', () => {
    useMockupStore.getState().moveNode('a', 'a1', 0);
    expect(childIds('root')).toEqual(['a', 'b', 'c']);
    expect(useMockupStore.getState().history).toHaveLength(1);
  });

  it('refuses to move a screen root', () => {
    useMockupStore.getState().moveNode('root', 'b', 0);
    expect(childIds('b')).toEqual([]);
    expect(useMockupStore.getState().history).toHaveLength(1);
  });

  it('ignores unknown node or target ids', () => {
    useMockupStore.getState().moveNode('nope', 'b', 0);
    useMockupStore.getState().moveNode('a1', 'nope', 0);
    expect(childIds('a')).toEqual(['a1', 'a2']);
    expect(useMockupStore.getState().history).toHaveLength(1);
  });

  it('treats a same-position reorder as a no-op with no snapshot', () => {
    useMockupStore.getState().moveNode('b', 'root', 1);
    expect(childIds('root')).toEqual(['a', 'b', 'c']);
    expect(useMockupStore.getState().history).toHaveLength(1);
  });
});
