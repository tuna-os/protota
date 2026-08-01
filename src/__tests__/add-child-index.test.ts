import { beforeEach, describe, expect, it } from 'vitest';
import type { AdwNode, MockupDocument } from '../types/mockup';

/**
 * addChildNode's insertion index (#79): palette drops resolve to
 * container + index, so insertion must land at the index, clamp when out of
 * range, keep appending when omitted, and report the new node's id — all in
 * one undo snapshot.
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
            { id: 'x', type: 'button', title: 'X' },
            { id: 'y', type: 'label', title: 'Y' },
          ],
        },
      },
    ],
  };
}

const rootChildren = (): AdwNode[] =>
  useMockupStore.getState().doc.screens[0].rootNode.children ?? [];

describe('addChildNode with insertion index', () => {
  beforeEach(() => {
    const doc = makeDoc();
    useMockupStore.setState({
      doc,
      history: [doc],
      historyIndex: 0,
      selectedNodeId: null,
      diagnosticsEnabled: false,
      diagnostics: [],
    });
  });

  it('inserts at the given index among existing children', () => {
    const id = useMockupStore.getState().addChildNode('root', 'label', undefined, 1);
    expect(id).toBeTruthy();
    expect(rootChildren().map((c) => c.id)).toEqual(['x', id, 'y']);
  });

  it('inserts at the start with index 0', () => {
    const id = useMockupStore.getState().addChildNode('root', 'label', undefined, 0);
    expect(rootChildren()[0].id).toBe(id);
  });

  it('clamps an out-of-range index to append', () => {
    const id = useMockupStore.getState().addChildNode('root', 'label', undefined, 99);
    expect(rootChildren().at(-1)?.id).toBe(id);
  });

  it('appends when no index is given (existing call sites unchanged)', () => {
    const id = useMockupStore.getState().addChildNode('root', 'button');
    expect(rootChildren().at(-1)?.id).toBe(id);
  });

  it('returns null and records nothing for an unknown parent', () => {
    const id = useMockupStore.getState().addChildNode('nope', 'button');
    expect(id).toBeNull();
    expect(useMockupStore.getState().history).toHaveLength(1);
  });

  it('records exactly one undo snapshot per insertion', () => {
    useMockupStore.getState().addChildNode('root', 'button', undefined, 1);
    expect(useMockupStore.getState().history).toHaveLength(2);
    useMockupStore.getState().undo();
    expect(rootChildren().map((c) => c.id)).toEqual(['x', 'y']);
  });

  it('carries the slot through insertion at an index', () => {
    const id = useMockupStore.getState().addChildNode('root', 'button', 'end', 0);
    expect(rootChildren()[0]).toMatchObject({ id, slot: 'end' });
  });
});
