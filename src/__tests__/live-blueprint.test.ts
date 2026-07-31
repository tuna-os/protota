/**
 * Live Blueprint syntax tier (BLP-L001) — pure mapping + client lifecycle,
 * with the worker faked at the postMessage boundary. The real-Pyodide proof
 * lives in pyodide-blueprint.integration.test.ts.
 */
import { describe, expect, it, afterEach } from 'vitest';
import type { MockupDocument, AdwNode } from '../types/mockup';
import { buildScreenSources, mapLiveErrors, type LiveBlueprintRequest, type LiveBlueprintResponse, type WorkerSyntaxError } from '../diagnostics/liveBlueprint';
import {
  checkBlueprintSources,
  getLiveBlueprintStatus,
  setLiveBlueprintWorkerFactory,
  startLiveBlueprint,
  stopLiveBlueprint,
  type WorkerLike,
} from '../diagnostics/liveBlueprintClient';

const node = (id: string, type: AdwNode['type'], children: AdwNode[] = []): AdwNode =>
  ({ id, type, children } as AdwNode);

const doc = (screens: Array<{ id: string; root: AdwNode }>): MockupDocument =>
  ({
    title: 'Test',
    screens: screens.map((s) => ({ id: s.id, title: s.id, width: 800, height: 600, rootNode: s.root })),
    edges: [],
  } as unknown as MockupDocument);

describe('buildScreenSources', () => {
  it('exports each screen separately, like the blueprint-export CI job', () => {
    const d = doc([
      { id: 'screen-a', root: node('root-a', 'window', [node('box-a', 'box')]) },
      { id: 'screen-b', root: node('root-b', 'window') },
    ]);
    const sources = buildScreenSources(d);
    expect(sources.map((s) => s.screenId)).toEqual(['screen-a', 'screen-b']);
    expect(sources[0].source).toContain('using Gtk 4.0;');
    expect(sources[0].source).toContain('box-a');
    expect(sources[1].source).not.toContain('box-a');
  });
});

describe('mapLiveErrors', () => {
  const error = (line: number, message = 'Expected `;`'): WorkerSyntaxError =>
    ({ message, line, col: 3, endLine: line, endCol: 4 });

  it('produces BLP-L001 error diagnostics labeled as a browser syntax check', () => {
    const d = doc([{ id: 's1', root: node('root1', 'window') }]);
    const [source] = buildScreenSources(d);
    const [diag] = mapLiveErrors(d, 's1', source.source, [error(2, 'Unexpected tokens')]);
    expect(diag.ruleId).toBe('BLP-L001');
    expect(diag.tier).toBe('error');
    expect(diag.source).toBe('blueprint');
    expect(diag.message).toContain('Syntax check (browser):');
    expect(diag.message).toContain('Unexpected tokens');
    expect(diag.screenId).toBe('s1');
  });

  it('anchors to the nearest preceding widget id in the exported source', () => {
    const inner = node('inner-box', 'box');
    const d = doc([{ id: 's1', root: node('root1', 'window', [inner]) }]);
    const [{ source }] = buildScreenSources(d);
    const lines = source.split('\n');
    const innerLine = lines.findIndex((l) => l.includes('inner-box')) + 1;
    const [diag] = mapLiveErrors(d, 's1', source, [error(innerLine + 1)]);
    expect(diag.nodeId).toBe('inner-box');
    expect(diag.nodeType).toBe('box');
  });

  it('falls back to the screen root when no id line precedes the error', () => {
    const d = doc([{ id: 's1', root: node('root1', 'window') }]);
    const [diag] = mapLiveErrors(d, 's1', 'using Gtk 4.0;\n???', [error(1)]);
    expect(diag.nodeId).toBe('root1');
  });

  it('leaves diagnostics unanchored for an unknown screen', () => {
    const d = doc([{ id: 's1', root: node('root1', 'window') }]);
    const [diag] = mapLiveErrors(d, 'nope', 'x', [error(1)]);
    expect(diag.screenId).toBe('');
    expect(diag.nodeId).toBe('');
  });
});

/** Fake worker driving the protocol from the other side. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<LiveBlueprintResponse>) => void) | null = null;
  terminated = false;
  private behavior: 'ok' | 'init-fails';
  constructor(behavior: 'ok' | 'init-fails') { this.behavior = behavior; }
  postMessage(message: LiveBlueprintRequest): void {
    queueMicrotask(() => {
      if (!this.onmessage) return;
      if (message.type === 'init') {
        this.onmessage(this.behavior === 'ok'
          ? ({ data: { type: 'ready' } } as MessageEvent<LiveBlueprintResponse>)
          : ({ data: { type: 'init-error', message: 'offline' } } as MessageEvent<LiveBlueprintResponse>));
      } else {
        const results = Object.fromEntries(message.files.map((f) => [
          f.screenId,
          f.source.includes('???') ? [{ message: 'Unexpected tokens', line: 1, col: 1, endLine: 1, endCol: 2 }] : [],
        ]));
        this.onmessage({ data: { type: 'result', requestId: message.requestId, results } } as MessageEvent<LiveBlueprintResponse>);
      }
    });
  }
  terminate(): void { this.terminated = true; }
}

describe('liveBlueprintClient', () => {
  afterEach(() => {
    stopLiveBlueprint();
    setLiveBlueprintWorkerFactory(null);
  });

  it('starts lazily, reports ready, and round-trips a check', async () => {
    const workers: FakeWorker[] = [];
    setLiveBlueprintWorkerFactory(() => { const w = new FakeWorker('ok'); workers.push(w); return w; });
    expect(getLiveBlueprintStatus()).toBe('off');
    expect(workers).toHaveLength(0); // nothing loads before opt-in

    await startLiveBlueprint();
    expect(getLiveBlueprintStatus()).toBe('ready');
    expect(workers).toHaveLength(1);

    // A second start reuses the warm worker.
    await startLiveBlueprint();
    expect(workers).toHaveLength(1);

    const results = await checkBlueprintSources([
      { screenId: 'good', source: 'Box {}' },
      { screenId: 'bad', source: 'Box { ???' },
    ]);
    expect(results.good).toEqual([]);
    expect(results.bad).toHaveLength(1);
    expect(results.bad[0].message).toBe('Unexpected tokens');
  });

  it('degrades gracefully when the runtime cannot load, and can retry', async () => {
    const workers: FakeWorker[] = [];
    setLiveBlueprintWorkerFactory(() => { const w = new FakeWorker('init-fails'); workers.push(w); return w; });
    await expect(startLiveBlueprint()).rejects.toThrow('offline');
    expect(getLiveBlueprintStatus()).toBe('error');
    expect(workers[0].terminated).toBe(true);

    // Back online: a fresh start creates a fresh worker.
    setLiveBlueprintWorkerFactory(() => { const w = new FakeWorker('ok'); workers.push(w); return w; });
    await startLiveBlueprint();
    expect(getLiveBlueprintStatus()).toBe('ready');
    expect(workers).toHaveLength(2);
  });

  it('rejects checks while the worker is not ready', async () => {
    await expect(checkBlueprintSources([{ screenId: 's', source: 'x' }]))
      .rejects.toThrow('not ready');
  });
});
