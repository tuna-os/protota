import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdwNode, MockupDocument } from '../types/mockup';
import { insertionIndexFor, resolveDropTarget } from '../dnd/dropResolution';

class FakeElement {
  dataset: DOMStringMap;
  parentElement: FakeElement | null;

  constructor(nodeId: string, parentElement: FakeElement | null = null) {
    this.dataset = { nodeId } as DOMStringMap;
    this.parentElement = parentElement;
  }

  closest(selector: string): FakeElement | null {
    return selector === '[data-node-id]' ? this : null;
  }

  getAttribute(): string | null {
    return null;
  }
}

function makeDoc(rootNode: AdwNode): MockupDocument {
  return {
    id: 'doc',
    title: 'Drag test',
    colorScheme: 'auto',
    edges: [],
    screens: [{
      id: 'screen',
      title: 'Screen',
      type: 'empty',
      width: 800,
      height: 600,
      rootNode,
    }],
  };
}

function installGeometry(rects: Record<string, Partial<DOMRect>>): void {
  vi.stubGlobal('CSS', { escape: (value: string) => value });
  vi.stubGlobal('document', {
    querySelector: (selector: string) => {
      const id = selector.match(/data-node-id="([^"]+)"/)?.[1];
      const rect = id ? rects[id] : undefined;
      return rect ? { getBoundingClientRect: () => ({
        left: 0, top: 0, width: 0, height: 0, ...rect,
      }) } : null;
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('insertionIndexFor', () => {
  const children: AdwNode[] = [
    { id: 'first', type: 'button' },
    { id: 'second', type: 'button' },
  ];

  it('uses horizontal child midpoints for horizontal boxes', () => {
    installGeometry({
      first: { left: 10, width: 20, height: 10 },
      second: { left: 40, width: 20, height: 10 },
    });
    const box: AdwNode = { id: 'box', type: 'box', orientation: 'horizontal', children };

    expect(insertionIndexFor(box, 19, 0)).toBe(0);
    expect(insertionIndexFor(box, 35, 0)).toBe(1);
    expect(insertionIndexFor(box, 60, 0)).toBe(2);
  });

  it('uses vertical midpoints by default and ignores unrendered children', () => {
    installGeometry({ second: { top: 40, width: 10, height: 20 } });
    const box: AdwNode = { id: 'box', type: 'box', children };

    expect(insertionIndexFor(box, 0, 49)).toBe(1);
    expect(insertionIndexFor(box, 0, 51)).toBe(2);
  });
});

describe('resolveDropTarget', () => {
  it('walks from an illegal leaf to the nearest legal container', () => {
    installGeometry({ child: { top: 20, width: 20, height: 20 } });
    const child: AdwNode = { id: 'child', type: 'label' };
    const doc = makeDoc({ id: 'root', type: 'box', children: [child] });
    const rootElement = new FakeElement('root');
    const childElement = new FakeElement('child', rootElement);

    expect(resolveDropTarget(doc, childElement as unknown as Element, 0, 10, {
      draggedType: 'button',
    })).toEqual({ parentId: 'root', index: 0, screenId: 'screen' });
  });

  it('does not resolve a node or any descendant within the dragged subtree', () => {
    installGeometry({});
    const nested: AdwNode = { id: 'nested', type: 'box', children: [] };
    const dragged: AdwNode = { id: 'dragged', type: 'box', children: [nested] };
    const doc = makeDoc({ id: 'root', type: 'box', children: [dragged] });
    const draggedElement = new FakeElement('dragged');
    const nestedElement = new FakeElement('nested', draggedElement);

    expect(resolveDropTarget(doc, nestedElement as unknown as Element, 0, 0, {
      draggedType: 'button', excludeNodeId: 'dragged',
    })).toBeNull();
  });

  it('returns null for no hit element', () => {
    installGeometry({});
    expect(resolveDropTarget(makeDoc({ id: 'root', type: 'box' }), null, 0, 0, {
      draggedType: 'button',
    })).toBeNull();
  });
});
