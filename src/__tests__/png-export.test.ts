/**
 * PNG export helpers (src/utils/pngExport.ts) — renderScreenToPng and
 * downloadPng. Previously 0% coverage.
 *
 * The render path is exercised with a minimal DOM stub and a mocked
 * html2canvas; no real browser needed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock html2canvas before importing the module under test.
vi.mock('html2canvas', () => ({
  default: vi.fn(async () => fakeCanvas),
}));

interface FakeCanvasLike {
  toBlob: (cb: (blob: Blob | null) => void, type: string) => void;
}
let fakeCanvas: FakeCanvasLike;

const { renderScreenToPng, downloadPng } = await import('../utils/pngExport');

// ── minimal DOM stub ─────────────────────────────────────────────────────────

class FakeElement {
  id = '';
  textContent = '';
  href = '';
  download = '';
  click = vi.fn();
  appendChild = vi.fn((el: unknown) => el);
  querySelector: ((sel: string) => unknown) | null = null;
  setAttribute = vi.fn();
}

let surface: FakeElement | null;
let anchors: FakeElement[] = [];

function installDom() {
  const head = new FakeElement();
  surface = new FakeElement();
  anchors = [];

  globalThis.document = {
    head,
    querySelector: (sel: string) => {
      if (sel === '[data-protota-render-surface="true"]') return surface;
      return null;
    },
    createElement: (tag: string) => {
      if (tag === 'a') {
        const a = new FakeElement();
        anchors.push(a);
        return a;
      }
      return new FakeElement();
    },
  } as unknown as Document;

  globalThis.URL = {
    createObjectURL: vi.fn(() => 'blob:fake-url'),
    revokeObjectURL: vi.fn(),
  } as unknown as typeof URL;
}

beforeEach(() => {
  installDom();
  fakeCanvas = {
    toBlob: (cb, _type) => cb(new Blob(['png-bytes'], { type: 'image/png' })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  delete (globalThis as Record<string, unknown>).document;
});

// ── renderScreenToPng ────────────────────────────────────────────────────────

describe('renderScreenToPng', () => {
  it('throws when no render surface exists', async () => {
    surface = null;
    await expect(renderScreenToPng()).rejects.toThrow(
      'No rendered screen is available to export',
    );
  });

  it('rasterises the surface at the requested scale', async () => {
    const html2canvas = (await import('html2canvas')).default as ReturnType<typeof vi.fn>;
    const blob = await renderScreenToPng(3);
    expect(html2canvas).toHaveBeenCalledWith(
      expect.any(FakeElement),
      expect.objectContaining({ scale: 3, backgroundColor: null }),
    );
    expect(blob).toBeInstanceOf(Blob);
  });

  it('rejects when the canvas cannot be encoded', async () => {
    fakeCanvas = { toBlob: (cb) => cb(null) };
    await expect(renderScreenToPng()).rejects.toThrow(
      'Unable to encode rendered screen as PNG',
    );
  });
});

// ── downloadPng ──────────────────────────────────────────────────────────────

describe('downloadPng', () => {
  it('creates an object URL, clicks a download anchor and revokes', () => {
    const blob = new Blob(['x']);
    downloadPng(blob, 'my-screen.png');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].href).toBe('blob:fake-url');
    expect(anchors[0].download).toBe('my-screen.png');
    expect(anchors[0].click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('uses the default filename when none is given', () => {
    downloadPng(new Blob(['x']));
    expect(anchors[0].download).toBe('protota-screen.png');
  });
});
