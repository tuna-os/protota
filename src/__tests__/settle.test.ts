import { afterEach, describe, expect, it, vi } from 'vitest';
import { settleRender } from '../utils/settle';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubDom(fontsReady: Promise<unknown> | undefined) {
  const frames: Array<() => void> = [];
  vi.stubGlobal('document', { fonts: fontsReady === undefined ? undefined : { ready: fontsReady } });
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    frames.push(cb);
    return frames.length;
  });
  return frames;
}

describe('settleRender', () => {
  it('waits for fonts, then for two animation frames', async () => {
    const frames = stubDom(Promise.resolve());
    let done = false;
    const p = settleRender().then(() => { done = true; });

    await vi.waitFor(() => expect(frames).toHaveLength(1));
    expect(done).toBe(false);
    frames.shift()!();
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    expect(done).toBe(false);
    frames.shift()!();
    await p;
    expect(done).toBe(true);
  });

  it('does not request a frame until document.fonts.ready resolves', async () => {
    let release!: () => void;
    const frames = stubDom(new Promise<void>((r) => { release = r; }));
    const p = settleRender();
    await Promise.resolve();
    expect(frames).toHaveLength(0);
    release();
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    frames.shift()!();
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    frames.shift()!();
    await p;
  });

  it('still waits for the frames when the font API rejects', async () => {
    const frames = stubDom(Promise.reject(new Error('no fonts')));
    const p = settleRender();
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    frames.shift()!();
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    frames.shift()!();
    await expect(p).resolves.toBeUndefined();
  });
});
