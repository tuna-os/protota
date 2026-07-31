/**
 * Main-thread lifecycle for the Blueprint syntax worker.
 *
 * Owns the singleton worker so the ~14 MB Pyodide download happens at most
 * once per session, no matter how often the panel mounts or the feature is
 * toggled. The worker factory is injectable so unit tests can drive the
 * client with a fake worker; nothing here loads at app start.
 */
import type { LiveBlueprintRequest, LiveBlueprintResponse, ScreenSource, WorkerSyntaxError } from './liveBlueprint';

/** The subset of Worker the client uses (and tests fake). */
export interface WorkerLike {
  postMessage: (message: LiveBlueprintRequest) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<LiveBlueprintResponse>) => void) | null;
}

export type LiveBlueprintStatus = 'off' | 'loading' | 'ready' | 'error';

const defaultFactory = (): WorkerLike =>
  new Worker(new URL('./blueprintSyntax.worker.ts', import.meta.url), { type: 'module' }) as WorkerLike;

let factory: () => WorkerLike = defaultFactory;
let worker: WorkerLike | null = null;
let readyPromise: Promise<void> | null = null;
let status: LiveBlueprintStatus = 'off';
let nextRequestId = 1;
const pending = new Map<number, {
  resolve: (results: Record<string, WorkerSyntaxError[]>) => void;
  reject: (error: Error) => void;
}>();

/** Test seam: inject a fake worker factory; pass null to restore the default. */
export function setLiveBlueprintWorkerFactory(custom: (() => WorkerLike) | null): void {
  factory = custom ?? defaultFactory;
}

export function getLiveBlueprintStatus(): LiveBlueprintStatus {
  return status;
}

function handleMessage(event: MessageEvent<LiveBlueprintResponse>): void {
  const message = event.data;
  if (message.type === 'result' || message.type === 'check-error') {
    const entry = pending.get(message.requestId);
    if (!entry) return;
    pending.delete(message.requestId);
    if (message.type === 'result') entry.resolve(message.results);
    else entry.reject(new Error(message.message));
  }
}

/**
 * Start (or reuse) the worker and resolve once Pyodide and the vendored
 * compiler are loaded. On failure the worker is torn down so a later call
 * retries from scratch — the offline story is "try again when you're back".
 */
export function startLiveBlueprint(): Promise<void> {
  if (readyPromise) return readyPromise;
  status = 'loading';
  const instance = factory();
  worker = instance;
  readyPromise = new Promise<void>((resolve, reject) => {
    instance.onmessage = (event) => {
      const message = event.data;
      if (message.type === 'ready') {
        status = 'ready';
        instance.onmessage = handleMessage;
        resolve();
      } else if (message.type === 'init-error') {
        stopLiveBlueprint();
        status = 'error';
        reject(new Error(message.message));
      }
    };
    // Base-relative asset root; the worker cannot know the app's base path.
    // (location is absent under vitest's node environment.)
    const origin = typeof location !== 'undefined' ? location.origin : 'http://localhost';
    const assetBase = new URL(import.meta.env.BASE_URL ?? '/', origin).href;
    instance.postMessage({ type: 'init', assetBase });
  });
  return readyPromise;
}

/** Syntax-check per-screen sources; requires a ready worker. */
export function checkBlueprintSources(
  files: ScreenSource[],
): Promise<Record<string, WorkerSyntaxError[]>> {
  const instance = worker;
  if (!instance || status !== 'ready') {
    return Promise.reject(new Error('live Blueprint worker is not ready'));
  }
  const requestId = nextRequestId++;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    instance.postMessage({ type: 'check', requestId, files });
  });
}

/** Terminate the worker and reset all state (failure path and tests). */
export function stopLiveBlueprint(): void {
  worker?.terminate();
  worker = null;
  readyPromise = null;
  status = 'off';
  for (const entry of pending.values()) entry.reject(new Error('live Blueprint worker stopped'));
  pending.clear();
}
