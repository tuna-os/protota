/**
 * Flow-edge geometry. `buildFlowPaths` is pure; `useFlowPaths` also decides
 * when to re-measure. Frames are read from the DOM, so a resize drag changes
 * their size through `resizePreview` and leaves `doc` alone. If `geometry`
 * leaves the dependency list, the curves stay at the pre-drag position.
 *
 * Vitest runs in a node environment here, so the harness stubs the DOM and
 * takes frame offsets from the fixture below.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import EventTarget from 'node:events';
import { createElement, useEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { RefObject } from 'react';
import type { MockupDocument } from '../types/mockup';
import { buildFlowPaths, useFlowPaths, type FlowFrameMetrics } from '../hooks/useFlowPaths';

// ── a DOM just large enough for React DOM ────────────────────────────────────

class FakeNode {
  parentNode: FakeNode | null = null;
  childNodes: FakeNode[] = [];
  nodeType = 1;
  nodeName = 'DIV';
  textContent = '';
  style = {
    setProperty() {},
    removeProperty() {},
    getPropertyValue: () => '',
  };

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
  appendChild(child: FakeNode) {
    return this.insertBefore(child, null);
  }
  insertBefore(child: FakeNode, before: FakeNode | null) {
    this.childNodes = this.childNodes.filter((existing) => existing !== child);
    const at = before ? this.childNodes.indexOf(before) : this.childNodes.length;
    this.childNodes.splice(at < 0 ? this.childNodes.length : at, 0, child);
    child.parentNode = this;
    return child;
  }
  removeChild(child: FakeNode) {
    this.childNodes = this.childNodes.filter((existing) => existing !== child);
    child.parentNode = null;
    return child;
  }
  setAttribute() {}
  removeAttribute() {}
  getAttribute() {
    return null;
  }
  hasAttribute() {
    return false;
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
  getRootNode() {
    return globalThis.document;
  }
}

const touched = [
  'document',
  'window',
  'HTMLElement',
  'Element',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;
const saved = new Map<string, unknown>();

function installDom() {
  for (const key of touched) saved.set(key, Reflect.get(globalThis, key));

  const win = new EventTarget() as unknown as Record<string, unknown>;

  class FakeDocument extends FakeNode {
    ownerDocument: unknown = null;
    defaultView: unknown = null;
    documentElement = new FakeNode();
    body = new FakeNode();
    head = new FakeNode();
    activeElement: unknown = null;

    createElement() {
      return new FakeNode();
    }
    createTextNode(text: string) {
      return Object.assign(new FakeNode(), { textContent: text, nodeType: 3 });
    }
    createComment(text: string) {
      return Object.assign(new FakeNode(), { textContent: text, nodeType: 8 });
    }
  }

  const doc = new FakeDocument();
  doc.nodeType = 9;
  doc.ownerDocument = doc;
  doc.defaultView = win;

  Object.assign(win, {
    document: doc,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    HTMLIFrameElement: class {},
  });

  Reflect.set(globalThis, 'document', doc);
  Reflect.set(globalThis, 'window', win);
  Reflect.set(globalThis, 'HTMLElement', FakeNode);
  Reflect.set(globalThis, 'Element', FakeNode);
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
}

function restoreDom() {
  for (const [key, value] of saved) Reflect.set(globalThis, key, value);
  saved.clear();
}

// ── fixtures ─────────────────────────────────────────────────────────────────

/** Frame geometry the stubbed surface reports, keyed by screen id. */
let layout: Map<string, FlowFrameMetrics>;
/** Frames the hook's querySelectorAll returns, in document order. */
let rendered: Array<{ dataset: { prototaFlowScreen: string } }>;

/**
 * A frame as the hook sees it. Offsets come from `layout`, so a changed entry
 * acts as a layout pass.
 */
function frame(screenId: string) {
  return {
    dataset: { prototaFlowScreen: screenId },
    get offsetLeft() {
      return layout.get(screenId)!.left;
    },
    get offsetTop() {
      return layout.get(screenId)!.top;
    },
    get offsetWidth() {
      return layout.get(screenId)!.width;
    },
    get offsetHeight() {
      return layout.get(screenId)!.height;
    },
  };
}

function surfaceRef(): RefObject<HTMLDivElement | null> {
  return {
    current: { querySelectorAll: () => rendered } as unknown as HTMLDivElement,
  };
}

function mockDoc(edgeCount = 1): MockupDocument {
  return {
    id: 'doc',
    title: 'document',
    colorScheme: 'light',
    screens: [],
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `edge-${index}`,
      sourceId: 'source',
      targetId: 'target',
    })),
  };
}

/** The paths the hook should produce for the current `layout`. */
function expectedPaths(doc: MockupDocument) {
  return buildFlowPaths(doc.edges, layout);
}

beforeEach(() => {
  installDom();
  layout = new Map<string, FlowFrameMetrics>([
    ['source', { left: 0, top: 0, width: 100, height: 100 }],
    ['target', { left: 200, top: 0, width: 100, height: 100 }],
  ]);
  rendered = [frame('source'), frame('target')];
});

afterEach(restoreDom);

interface HookProps {
  surfaceRef: RefObject<HTMLDivElement | null>;
  doc: MockupDocument;
  showFlows: boolean;
  geometry: { screenId: string; width: number; height: number } | null;
}

/** The latest value the hook returned, captured on each commit. */
interface Probe {
  current: ReturnType<typeof buildFlowPaths>;
}

/**
 * Mount `useFlowPaths` and re-render it. No JSX: the vitest transform keeps
 * `.ts` files without the `.tsx` JSX transform.
 */
function mountHook(probe: Probe) {
  /** Assign in an effect: React forbids writing to an outer binding in render. */
  function Harness(props: HookProps) {
    const value = useFlowPaths(props);
    useEffect(() => {
      probe.current = value;
    }, [value]);
    return null;
  }
  const render = (props: HookProps) => createElement(Harness, props);
  return { render };
}

describe('buildFlowPaths', () => {
  it('routes a forward edge from the source right edge to the target left edge', () => {
    expect(buildFlowPaths([
      { id: 'forward', sourceId: 'source', targetId: 'target' },
    ], new Map<string, FlowFrameMetrics>([
      ['source', { left: 0, top: 10, width: 100, height: 200 }],
      ['target', { left: 200, top: 30, width: 100, height: 100 }],
    ]))).toEqual([
      { id: 'forward', d: 'M 100 110 C 133.33333333333334 110, 166.66666666666666 80, 200 80' },
    ]);
  });

  it('routes a reverse edge from the source left edge to the target right edge', () => {
    expect(buildFlowPaths([
      { id: 'reverse', sourceId: 'source', targetId: 'target' },
    ], new Map<string, FlowFrameMetrics>([
      ['source', { left: 300, top: 10, width: 80, height: 100 }],
      ['target', { left: 100, top: 40, width: 50, height: 60 }],
    ]))).toEqual([
      { id: 'reverse', d: 'M 300 60 C 250 60, 200 70, 150 70' },
    ]);
  });

  it('omits edges whose screen frame is not laid out', () => {
    expect(buildFlowPaths([
      { id: 'missing-target', sourceId: 'source', targetId: 'target' },
    ], new Map<string, FlowFrameMetrics>([
      ['source', { left: 0, top: 0, width: 100, height: 100 }],
    ]))).toEqual([]);
  });
});

describe('useFlowPaths', () => {
  let root: Root | null = null;

  afterEach(async () => {
    if (root) await act(async () => { root!.unmount(); });
    root = null;
  });

  it('re-measures while a resize changes frame size without touching the document', async () => {
    const doc = mockDoc();
    const probe: Probe = { current: [] };
    const harness = mountHook(probe);
    // Only `geometry` differs between the renders, so only it can re-measure.
    const surface = surfaceRef();
    const baseProps = { surfaceRef: surface, doc, showFlows: true, geometry: null };

    root = createRoot(document as unknown as Element);
    await act(async () => {
      root!.render(harness.render(baseProps));
    });
    expect(probe.current).toEqual(expectedPaths(doc));
    const before = probe.current[0]!.d;

    // Mid-drag: the frame widens, `doc` does not change.
    layout.set('source', { left: 0, top: 0, width: 160, height: 100 });
    await act(async () => {
      root!.render(harness.render({
        ...baseProps,
        geometry: { screenId: 'source', width: 160, height: 100 },
      }));
    });

    // The curve follows the widened frame, not the pre-drag geometry.
    expect(probe.current).toEqual(expectedPaths(doc));
    expect(probe.current[0]!.d).toBe('M 160 50 C 190 50, 170 50, 200 50');
    expect(probe.current[0]!.d).not.toBe(before);
  });

  it('clears the overlay when flows are hidden', async () => {
    const doc = mockDoc();
    const probe: Probe = { current: [] };
    const harness = mountHook(probe);

    root = createRoot(document as unknown as Element);
    await act(async () => {
      root!.render(harness.render({ surfaceRef: surfaceRef(), doc, showFlows: true, geometry: null }));
    });
    expect(probe.current.length).toBe(1);

    await act(async () => {
      root!.render(harness.render({ surfaceRef: surfaceRef(), doc, showFlows: false, geometry: null }));
    });
    expect(probe.current).toEqual([]);
  });

  it('renders nothing when the document has no edges', async () => {
    const doc = mockDoc(0);
    const probe: Probe = { current: [] };
    const harness = mountHook(probe);

    root = createRoot(document as unknown as Element);
    await act(async () => {
      root!.render(harness.render({ surfaceRef: surfaceRef(), doc, showFlows: true, geometry: null }));
    });
    expect(probe.current).toEqual([]);
  });
});
