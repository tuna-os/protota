/**
 * Web Worker hosting blueprint-compiler's parser under Pyodide.
 *
 * Loaded lazily and only after the user opts in (the runtime plus stdlib is
 * a ~14 MB download, self-hosted under <base>/pyodide/ — no CDN). The worker
 * fetches the vendored blueprint-compiler v0.22.2 tree (LGPL, see
 * public/vendor/blueprint-compiler/NOTICE) into the Pyodide filesystem and
 * answers per-screen syntax checks. See liveBlueprint.ts for the protocol
 * and the tier boundary (syntax only; GIR validation is host-only).
 */
import type { LiveBlueprintRequest, LiveBlueprintResponse, WorkerSyntaxError } from './liveBlueprint';

interface PyodideLike {
  FS: {
    mkdirTree: (path: string) => void;
    writeFile: (path: string, data: Uint8Array) => void;
  };
  globals: { set: (name: string, value: unknown) => void };
  runPython: (code: string) => unknown;
}

const post = (message: LiveBlueprintResponse) => {
  (self as unknown as Worker).postMessage(message);
};

let pyodide: PyodideLike | null = null;

async function fetchInto(pyodideInstance: PyodideLike, vendorBase: string): Promise<void> {
  const manifestResponse = await fetch(`${vendorBase}manifest.json`);
  if (!manifestResponse.ok) throw new Error(`fetch manifest.json: HTTP ${manifestResponse.status}`);
  const manifest = (await manifestResponse.json()) as { files: string[] };

  const dirs = new Set<string>(['/vendor']);
  for (const file of manifest.files) {
    const slash = file.lastIndexOf('/');
    if (slash > 0) dirs.add(`/vendor/${file.slice(0, slash)}`);
  }
  for (const dir of dirs) pyodideInstance.FS.mkdirTree(dir);

  await Promise.all(manifest.files.map(async (file) => {
    const response = await fetch(`${vendorBase}${file}`);
    if (!response.ok) throw new Error(`fetch ${file}: HTTP ${response.status}`);
    const data = new Uint8Array(await response.arrayBuffer());
    pyodideInstance.FS.writeFile(`/vendor/${file}`, data);
  }));
}

async function init(assetBase: string): Promise<void> {
  const indexURL = `${assetBase}pyodide/`;
  // Runtime import of the self-hosted asset; deliberately not bundled.
  const loader = (await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`)) as {
    loadPyodide: (options: { indexURL: string }) => Promise<PyodideLike>;
  };
  const instance = await loader.loadPyodide({ indexURL });
  await fetchInto(instance, `${assetBase}vendor/blueprint-compiler/`);
  instance.runPython("import sys; sys.path.insert(0, '/vendor')");
  instance.runPython('import blueprint_check');
  pyodide = instance;
}

function check(source: string): WorkerSyntaxError[] {
  if (!pyodide) throw new Error('worker not initialized');
  pyodide.globals.set('__protota_source', source);
  const json = pyodide.runPython('blueprint_check.check_json(__protota_source)') as string;
  return JSON.parse(json) as WorkerSyntaxError[];
}

self.onmessage = async (event: MessageEvent<LiveBlueprintRequest>) => {
  const message = event.data;
  if (message.type === 'init') {
    try {
      if (!pyodide) await init(message.assetBase);
      post({ type: 'ready' });
    } catch (error) {
      post({ type: 'init-error', message: (error as Error).message });
    }
    return;
  }
  if (message.type === 'check') {
    try {
      const results: Record<string, WorkerSyntaxError[]> = {};
      for (const file of message.files) results[file.screenId] = check(file.source);
      post({ type: 'result', requestId: message.requestId, results });
    } catch (error) {
      post({ type: 'check-error', requestId: message.requestId, message: (error as Error).message });
    }
  }
};
