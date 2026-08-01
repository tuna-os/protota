import { beforeEach, describe, expect, it } from 'vitest';
import type { MockupDocument, Screen } from '../types/mockup';

/**
 * Screen selection and deletion (#138): selectScreen/deleteScreen store
 * semantics — mutual exclusion with node selection, one undo snapshot per
 * deletion (nodes + edges together), the last-screen rule, and layout
 * auto-adjustment falling out of array order (screens carry no x/y).
 *
 * The store persists snapshots to localStorage at module scope; stub before
 * the dynamic import (same pattern as multi-select.test.ts).
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

function makeScreen(id: string, title: string): Screen {
  return {
    id, title, type: 'empty', width: 800, height: 600,
    rootNode: {
      id: `${id}-root`, type: 'box',
      children: [
        { id: `${id}-a`, type: 'button', title: 'A' },
        { id: `${id}-b`, type: 'label', title: 'B' },
      ],
    },
  };
}

function makeDoc(screenCount = 3): MockupDocument {
  const screens = Array.from({ length: screenCount }, (_, i) => makeScreen(`s${i + 1}`, `Screen ${i + 1}`));
  return {
    id: 'doc-test', title: 'Test', colorScheme: 'auto', screens,
    edges: [
      { id: 'e12', sourceId: 's1', targetId: 's2' },
      { id: 'e23', sourceId: 's2', targetId: 's3' },
      { id: 'e31', sourceId: 's3', targetId: 's1' },
    ],
  };
}

function seed(doc: MockupDocument) {
  useMockupStore.setState({
    doc,
    history: [doc],
    historyIndex: 0,
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedScreenId: doc.screens[0]?.id ?? null,
    screenSelected: false,
    screenDeleteNotice: null,
  });
}

beforeEach(() => seed(makeDoc()));

describe('selectScreen', () => {
  it('marks the screen as the explicit selection and clears node selection', () => {
    useMockupStore.getState().selectNodes(['s1-a', 's1-b'], 's1');
    useMockupStore.getState().selectScreen('s2');
    const s = useMockupStore.getState();
    expect(s.screenSelected).toBe(true);
    expect(s.selectedScreenId).toBe('s2');
    expect(s.selectedNodeId).toBeNull();
    expect(s.selectedNodeIds).toEqual([]);
  });

  it('is cleared by any node-selection action (mutual exclusion)', () => {
    const store = useMockupStore.getState();
    store.selectScreen('s2');
    store.selectNode('s2-a', 's2');
    expect(useMockupStore.getState().screenSelected).toBe(false);

    store.selectScreen('s2');
    store.toggleNodeSelection('s2-a', 's2');
    expect(useMockupStore.getState().screenSelected).toBe(false);

    store.selectScreen('s2');
    store.selectNodes(['s2-a'], 's2');
    expect(useMockupStore.getState().screenSelected).toBe(false);
  });

  it('selectNode(null) — canvas click / Escape — also drops the screen selection', () => {
    useMockupStore.getState().selectScreen('s2');
    useMockupStore.getState().selectNode(null);
    const s = useMockupStore.getState();
    expect(s.screenSelected).toBe(false);
    expect(s.selectedScreenId).toBe('s2'); // active-screen context survives
  });

  it('ignores unknown screen ids and clears on null', () => {
    useMockupStore.getState().selectScreen('nope');
    expect(useMockupStore.getState().screenSelected).toBe(false);
    useMockupStore.getState().selectScreen('s3');
    useMockupStore.getState().selectScreen(null);
    const s = useMockupStore.getState();
    expect(s.screenSelected).toBe(false);
    expect(s.selectedScreenId).toBe('s3');
  });

  it('selection is editor state — never a history entry', () => {
    const before = useMockupStore.getState().history.length;
    useMockupStore.getState().selectScreen('s2');
    expect(useMockupStore.getState().history.length).toBe(before);
  });
});

describe('deleteScreen', () => {
  it('removes the screen and its edges in ONE undo snapshot', () => {
    const before = useMockupStore.getState().history.length;
    const ok = useMockupStore.getState().deleteScreen('s2');
    const s = useMockupStore.getState();
    expect(ok).toBe(true);
    expect(s.doc.screens.map((screen) => screen.id)).toEqual(['s1', 's3']);
    // Edges touching s2 die with it; the unrelated edge survives.
    expect(s.doc.edges.map((edge) => edge.id)).toEqual(['e31']);
    expect(s.history.length).toBe(before + 1);
  });

  it('remaining screens keep their relative order (canvas auto-fills the gap)', () => {
    // Screens carry no x/y: the canvas flex row lays them out in array
    // order, so deleting an entry IS the position auto-adjustment.
    useMockupStore.getState().deleteScreen('s1');
    expect(useMockupStore.getState().doc.screens.map((screen) => screen.id)).toEqual(['s2', 's3']);
  });

  it('moves the screen selection to the neighbour so repeated Delete walks on', () => {
    useMockupStore.getState().selectScreen('s2');
    useMockupStore.getState().deleteScreen('s2');
    let s = useMockupStore.getState();
    expect(s.selectedScreenId).toBe('s3');
    expect(s.screenSelected).toBe(true);

    // Deleting the last-in-order screen falls back to the previous one.
    useMockupStore.getState().deleteScreen('s3');
    s = useMockupStore.getState();
    expect(s.selectedScreenId).toBe('s1');
    expect(s.screenSelected).toBe(true);
  });

  it('keeps the active-screen context untouched when deleting another screen', () => {
    useMockupStore.getState().selectNode('s1-a', 's1');
    useMockupStore.getState().deleteScreen('s3');
    const s = useMockupStore.getState();
    expect(s.selectedScreenId).toBe('s1');
    expect(s.selectedNodeId).toBe('s1-a');
  });

  it('drops selected node ids that lived on the deleted screen', () => {
    useMockupStore.getState().selectNodes(['s1-a', 's2-a'], 's2');
    useMockupStore.getState().deleteScreen('s2');
    const s = useMockupStore.getState();
    expect(s.selectedNodeIds).toEqual(['s1-a']);
    expect(s.selectedNodeId).toBe('s1-a');
  });

  it('refuses the last screen with a visible reason and no history entry', () => {
    seed(makeDoc(1));
    const before = useMockupStore.getState().history.length;
    const ok = useMockupStore.getState().deleteScreen('s1');
    const s = useMockupStore.getState();
    expect(ok).toBe(false);
    expect(s.doc.screens).toHaveLength(1);
    expect(s.screenDeleteNotice).toMatch(/last screen/i);
    expect(s.history.length).toBe(before);
    s.clearScreenDeleteNotice();
    expect(useMockupStore.getState().screenDeleteNotice).toBeNull();
  });

  it('returns false for an unknown screen id', () => {
    expect(useMockupStore.getState().deleteScreen('nope')).toBe(false);
    expect(useMockupStore.getState().doc.screens).toHaveLength(3);
  });

  it('undo restores the screen fully — nodes, edges, and position', () => {
    useMockupStore.getState().deleteScreen('s2');
    useMockupStore.getState().undo();
    const s = useMockupStore.getState();
    expect(s.doc.screens.map((screen) => screen.id)).toEqual(['s1', 's2', 's3']);
    const restored = s.doc.screens[1];
    expect(restored.title).toBe('Screen 2');
    expect(restored.rootNode.children?.map((child) => child.id)).toEqual(['s2-a', 's2-b']);
    expect(s.doc.edges.map((edge) => edge.id)).toEqual(['e12', 'e23', 'e31']);
  });

  it('redo re-applies the deletion', () => {
    useMockupStore.getState().deleteScreen('s2');
    useMockupStore.getState().undo();
    useMockupStore.getState().redo();
    const s = useMockupStore.getState();
    expect(s.doc.screens.map((screen) => screen.id)).toEqual(['s1', 's3']);
    expect(s.doc.edges.map((edge) => edge.id)).toEqual(['e31']);
  });
});
