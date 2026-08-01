import { beforeEach, describe, expect, it } from 'vitest';
import type { AdwNode, MockupDocument } from '../types/mockup';

/**
 * deleteNode regression tests for #137.
 *
 * Imported presets reuse node ids across screens (every GNOME Clocks screen
 * roots at `imported-1` and repeats its subtree ids), so deleteNode must be
 * screen-aware: deleting the selected node removes it from the selected
 * screen, never a same-id node on a screen the user never touched. And a
 * delete that removes nothing (a screen root — roots are anchors) must leave
 * both the document and the undo history untouched.
 *
 * The store persists snapshots to localStorage at module scope, and vitest
 * runs in a plain node environment, so a stub must exist before the store
 * module is evaluated — hence the dynamic import below.
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
 * Two screens with IDENTICAL trees — the shape every multi-screen preset
 * import produces:
 *
 * s1: root(window) > content(box) > child(button)
 * s2: root(window) > content(box) > child(button)
 */
function makeDoc(): MockupDocument {
  const tree = (): AdwNode => ({
    id: 'root',
    type: 'window',
    children: [
      {
        id: 'content',
        type: 'box',
        children: [{ id: 'child', type: 'button', title: 'B' }],
      },
    ],
  });
  return {
    id: 'doc-test',
    title: 'Test',
    edges: [],
    colorScheme: 'auto',
    screens: [
      { id: 's1', title: 'One', type: 'empty', width: 800, height: 600, rootNode: tree() },
      { id: 's2', title: 'Two', type: 'empty', width: 800, height: 600, rootNode: tree() },
    ],
  };
}

const screen = (id: string) =>
  useMockupStore.getState().doc.screens.find((s) => s.id === id)!;

const has = (screenId: string, nodeId: string): boolean => {
  const visit = (node: AdwNode): boolean =>
    node.id === nodeId || (node.children ?? []).some(visit);
  return visit(screen(screenId).rootNode);
};

describe('deleteNode (#137)', () => {
  beforeEach(() => {
    const doc = makeDoc();
    useMockupStore.setState({
      doc,
      history: [doc],
      historyIndex: 0,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedScreenId: 's1',
      diagnosticsEnabled: false,
      diagnostics: [],
    });
  });

  it('deleting a screen root is a no-op: document and history untouched', () => {
    const { doc, history } = useMockupStore.getState();
    useMockupStore.getState().selectNode('root', 's1');
    useMockupStore.getState().deleteNode('root');
    const after = useMockupStore.getState();
    expect(after.doc).toBe(doc);
    expect(after.history).toHaveLength(history.length);
    // In particular: no phantom history entry that would make the next undo
    // a visible no-op.
    expect(after.historyIndex).toBe(0);
  });

  it('never deletes a same-id node from another screen when the root is selected', () => {
    // s2's root is an anchor; s1 has no node whose id is 'root' EXCEPT its
    // own root. Before the fix the global first-match search could walk into
    // other screens and delete an unrelated node carrying the same id.
    useMockupStore.getState().selectNode('root', 's2');
    useMockupStore.getState().deleteNode('root');
    expect(has('s1', 'content')).toBe(true);
    expect(has('s2', 'content')).toBe(true);
  });

  it('deletes the selected node from the SELECTED screen, not the first id match', () => {
    useMockupStore.getState().selectNode('content', 's2');
    useMockupStore.getState().deleteNode('content');
    // Screen 1 keeps its identical-id subtree; screen 2 loses it.
    expect(has('s1', 'content')).toBe(true);
    expect(has('s2', 'content')).toBe(false);
  });

  it('clears the selection and records one undoable snapshot on a real delete', () => {
    useMockupStore.getState().selectNode('child', 's1');
    useMockupStore.getState().deleteNode('child');
    const after = useMockupStore.getState();
    expect(has('s1', 'child')).toBe(false);
    expect(after.selectedNodeId).toBeNull();
    expect(after.history).toHaveLength(2);
    useMockupStore.getState().undo();
    expect(has('s1', 'child')).toBe(true);
  });

  it('falls back to a global search for a programmatic delete without selection', () => {
    // Diagnostics quick-fixes call deleteNode with ids that are not the
    // current selection; those still resolve (first match, roots skipped).
    useMockupStore.getState().deleteNode('child');
    expect(has('s1', 'child')).toBe(false);
    expect(has('s2', 'child')).toBe(true);
  });
});
