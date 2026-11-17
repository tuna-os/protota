import { beforeEach, describe, expect, it } from 'vitest';
import type { AdwNode, MockupDocument } from '../types/mockup';
import { useDndStore } from '../dnd/dndStore';
import { noteDropQuantise } from '../dnd/quantise';

function makeDoc(rootNode: AdwNode): MockupDocument {
  return {
    id: 'doc',
    title: 'Quantise test',
    colorScheme: 'auto',
    edges: [],
    screens: [{ id: 'screen', title: 'Screen', type: 'empty', width: 800, height: 600, rootNode }],
  };
}

function box(id: string, spacing?: number | string, children: AdwNode[] = []): AdwNode {
  return { id, type: 'box', spacing, children } as AdwNode;
}

beforeEach(() => {
  useDndStore.setState({ drag: null, target: null, quantiseHint: null });
});

describe('noteDropQuantise', () => {
  it('offers the nearest scale value for an off-scale box spacing', () => {
    noteDropQuantise(makeDoc(box('root', 13)), 'root', 'screen');
    expect(useDndStore.getState().quantiseHint).toEqual({
      parentId: 'root', screenId: 'screen', spacing: 13, nearest: 12,
    });
  });

  it('finds a nested parent, not just the root', () => {
    const doc = makeDoc(box('root', 12, [box('inner', 16)]));
    noteDropQuantise(doc, 'inner', 'screen');
    expect(useDndStore.getState().quantiseHint).toMatchObject({
      parentId: 'inner', spacing: 16, nearest: 18,
    });
  });

  it('coerces a numeric string spacing', () => {
    noteDropQuantise(makeDoc(box('root', '13')), 'root', 'screen');
    expect(useDndStore.getState().quantiseHint).toMatchObject({ spacing: 13, nearest: 12 });
  });

  it.each([
    ['spacing is already on the scale', makeDoc(box('root', 12)), 'root', 'screen'],
    ['spacing is not defined', makeDoc(box('root')), 'root', 'screen'],
    ['spacing is not a finite number', makeDoc(box('root', 'wide')), 'root', 'screen'],
    ['the parent is not a box', makeDoc({ id: 'root', type: 'label', spacing: 13, children: [] } as unknown as AdwNode), 'root', 'screen'],
    ['the parent id is unknown', makeDoc(box('root', 13)), 'missing', 'screen'],
    ['the screen id is unknown', makeDoc(box('root', 13)), 'root', 'missing'],
  ])('records no offer when %s', (_why, doc, parentId, screenId) => {
    noteDropQuantise(doc, parentId, screenId);
    expect(useDndStore.getState().quantiseHint).toBeNull();
  });
});

describe('useDndStore', () => {
  it('startDrag stores the payload and clears the target and any stale hint', () => {
    useDndStore.setState({
      target: { parentId: 'p', index: 0, screenId: 's' },
      quantiseHint: { parentId: 'p', screenId: 's', spacing: 13, nearest: 12 },
    });
    useDndStore.getState().startDrag({ kind: 'node', nodeId: 'n1' });
    expect(useDndStore.getState()).toMatchObject({
      drag: { kind: 'node', nodeId: 'n1' }, target: null, quantiseHint: null,
    });
  });

  it('endDrag clears the gesture but keeps the post-drop quantise offer', () => {
    const hint = { parentId: 'p', screenId: 's', spacing: 13, nearest: 12 };
    useDndStore.setState({
      drag: { kind: 'palette', widgetType: 'box' },
      target: { parentId: 'p', index: 1, screenId: 's' },
      quantiseHint: hint,
    });
    useDndStore.getState().endDrag();
    const s = useDndStore.getState();
    expect(s.drag).toBeNull();
    expect(s.target).toBeNull();
    expect(s.quantiseHint).toEqual(hint);
  });

  it('setQuantiseHint(null) dismisses the offer', () => {
    useDndStore.getState().setQuantiseHint({ parentId: 'p', screenId: 's', spacing: 13, nearest: 12 });
    useDndStore.getState().setQuantiseHint(null);
    expect(useDndStore.getState().quantiseHint).toBeNull();
  });
});
