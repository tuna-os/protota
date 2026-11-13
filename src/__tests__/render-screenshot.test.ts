/**
 * protota.renderScreenshot (src/runtime/agentHandle.ts) — the live-agent
 * capture path: target resolution, offscreen render, html2canvas
 * rasterisation, PNG encoding and teardown.
 *
 * Runs node-side with a minimal DOM stub; react-dom, the renderer, the
 * settle helper and html2canvas are mocked (same style as png-export.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockupDocument, Screen } from '../types/mockup';

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  unmount: vi.fn(),
  createRoot: vi.fn(),
  settle: vi.fn(async () => {}),
  html2canvas: vi.fn(),
}));

vi.mock('react-dom/client', () => ({ createRoot: mocks.createRoot }));
vi.mock('../components/AdwaitaRenderer', () => ({ AdwaitaRenderer: 'AdwaitaRenderer' }));
vi.mock('../utils/settle', () => ({ settleRender: mocks.settle }));
vi.mock('html2canvas', () => ({ default: mocks.html2canvas }));

const { protota } = await import('../runtime/agentHandle');
const { useMockupStore } = await import('../store/mockupStore');

// The store persists mutations to localStorage — absent under node.
const backing = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => backing.get(key) ?? null,
  setItem: (key: string, value: string) => { backing.set(key, value); },
  removeItem: (key: string) => { backing.delete(key); },
  clear: () => { backing.clear(); },
  key: (index: number) => [...backing.keys()][index] ?? null,
  get length() { return backing.size; },
} as Storage;

// ── minimal DOM stub ─────────────────────────────────────────────────────────

class FakeElement {
  attributes = new Map<string, string>();
  style = { cssText: '' };
  remove = vi.fn();
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  querySelector = vi.fn((): unknown => surface);
}

let surface: object | null;
let container: FakeElement;
let appended: unknown[];

function screen(id: string, width: number, height: number): Screen {
  return { id, title: id, type: 'standard', width, height, rootNode: { id: `${id}-root`, type: 'window', children: [] } };
}

function seedDoc(selectedScreenId: string | null) {
  const doc: MockupDocument = {
    id: 'doc-shot', title: 'Shot', edges: [], colorScheme: 'auto',
    screens: [screen('s1', 800, 600), screen('s2', 400, 300)],
  };
  useMockupStore.setState({
    doc, history: [doc], historyIndex: 0, clipboard: [],
    selectedNodeId: null, selectedNodeIds: [], selectedScreenId,
  });
}

function canvasEncoding(blob: Blob | null) {
  return { toBlob: (cb: (b: Blob | null) => void) => cb(blob) };
}

beforeEach(() => {
  surface = {};
  container = new FakeElement();
  appended = [];
  globalThis.document = {
    createElement: () => container,
    body: { appendChild: (el: unknown) => { appended.push(el); return el; } },
  } as unknown as Document;
  mocks.createRoot.mockReturnValue({ render: mocks.render, unmount: mocks.unmount });
  mocks.html2canvas.mockResolvedValue(canvasEncoding(new Blob(['png'], { type: 'image/png' })));
  seedDoc('s2');
});

afterEach(() => {
  vi.clearAllMocks();
  delete (globalThis as Record<string, unknown>).document;
});

function renderedProps(): Record<string, unknown> {
  return (mocks.render.mock.calls[0][0] as { props: Record<string, unknown> }).props;
}

describe('protota.renderScreenshot', () => {
  it('captures the selected screen at its own size and returns the PNG blob', async () => {
    const blob = await protota.renderScreenshot();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(renderedProps()).toMatchObject({ screenId: 's2', screenWidth: 400, screenHeight: 300 });
    expect(renderedProps().forcedColorScheme).toBeUndefined();
    expect(mocks.html2canvas).toHaveBeenCalledWith(surface, { scale: 1, backgroundColor: null });
    expect(mocks.settle).toHaveBeenCalledTimes(1);
  });

  it('falls back to the first screen when none is selected', async () => {
    seedDoc(null);
    await protota.renderScreenshot();
    expect(renderedProps()).toMatchObject({ screenId: 's1', screenWidth: 800, screenHeight: 600 });
  });

  it('passes requested screen, dimensions, theme and scale through', async () => {
    await protota.renderScreenshot({ screenId: 's1', width: 500, height: 440, theme: 'dark', scale: 2 });
    expect(renderedProps()).toMatchObject({
      screenId: 's1', screenWidth: 500, screenHeight: 440, forcedColorScheme: 'dark',
    });
    expect(mocks.html2canvas).toHaveBeenCalledWith(surface, { scale: 2, backgroundColor: null });
  });

  it('mounts a hidden, capture-scoped container and tears it down on success', async () => {
    await protota.renderScreenshot();
    expect(appended).toEqual([container]);
    expect(container.attributes.get('data-protota-capture-scope')).toBe('true');
    expect(container.attributes.get('aria-hidden')).toBe('true');
    expect(container.style.cssText).toContain('pointer-events:none');
    expect(mocks.unmount).toHaveBeenCalledTimes(1);
    expect(container.remove).toHaveBeenCalledTimes(1);
  });

  it('rejects before touching the DOM when the options are invalid', async () => {
    await expect(protota.renderScreenshot({ screenId: 'nope' })).rejects.toThrow('unknown screen "nope"');
    expect(mocks.createRoot).not.toHaveBeenCalled();
    expect(appended).toEqual([]);
  });

  it('rejects and still cleans up when the screen produces no render surface', async () => {
    surface = null;
    await expect(protota.renderScreenshot()).rejects.toThrow('produced no render surface');
    expect(mocks.html2canvas).not.toHaveBeenCalled();
    expect(mocks.unmount).toHaveBeenCalledTimes(1);
    expect(container.remove).toHaveBeenCalledTimes(1);
  });

  it('rejects and still cleans up when the canvas cannot be encoded', async () => {
    mocks.html2canvas.mockResolvedValue(canvasEncoding(null));
    await expect(protota.renderScreenshot()).rejects.toThrow('unable to encode the capture as PNG');
    expect(mocks.unmount).toHaveBeenCalledTimes(1);
    expect(container.remove).toHaveBeenCalledTimes(1);
  });

  it('cleans up when html2canvas itself rejects', async () => {
    mocks.html2canvas.mockRejectedValue(new Error('raster failed'));
    await expect(protota.renderScreenshot()).rejects.toThrow('raster failed');
    expect(mocks.unmount).toHaveBeenCalledTimes(1);
    expect(container.remove).toHaveBeenCalledTimes(1);
  });

  it('leaves the editor selection and document untouched', async () => {
    const before = useMockupStore.getState();
    await protota.renderScreenshot({ screenId: 's1' });
    const after = useMockupStore.getState();
    expect(after.doc).toBe(before.doc);
    expect(after.selectedScreenId).toBe('s2');
    expect(after.historyIndex).toBe(before.historyIndex);
  });
});
