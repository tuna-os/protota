/**
 * React driver for the live Blueprint syntax tier (design §2.3 level 3).
 *
 * Mounted by DiagnosticsPanel, so checks only run while the Diagnostics
 * panel exists and the user has opted in — the Pyodide download never
 * happens on app start. Re-checks are debounced per document change; stale
 * results are dropped via the effect's cancellation flag.
 */
import { useEffect } from 'react';
import { useMockupStore } from '../store/mockupStore';
import { buildScreenSources, mapLiveErrors } from './liveBlueprint';
import {
  checkBlueprintSources,
  getLiveBlueprintStatus,
  startLiveBlueprint,
} from './liveBlueprintClient';

const DEBOUNCE_MS = 250;

export function useLiveBlueprint(): void {
  const doc = useMockupStore((state) => state.doc);
  const diagnosticsEnabled = useMockupStore((state) => state.diagnosticsEnabled);
  const liveBlueprintEnabled = useMockupStore((state) => state.liveBlueprintEnabled);
  const setLiveBlueprintState = useMockupStore((state) => state.setLiveBlueprintState);

  useEffect(() => {
    if (!diagnosticsEnabled || !liveBlueprintEnabled) return;
    let cancelled = false;

    const run = async () => {
      try {
        if (getLiveBlueprintStatus() !== 'ready') {
          setLiveBlueprintState({ liveBlueprintStatus: 'loading', liveBlueprintError: null });
          await startLiveBlueprint();
          if (cancelled) return;
        }
        setLiveBlueprintState({ liveBlueprintStatus: 'ready', liveBlueprintError: null });
        const files = buildScreenSources(doc);
        const results = await checkBlueprintSources(files);
        if (cancelled) return;
        const diagnostics = files.flatMap((file) =>
          mapLiveErrors(doc, file.screenId, file.source, results[file.screenId] ?? []));
        setLiveBlueprintState({ liveBlueprintDiagnostics: diagnostics });
      } catch (error) {
        if (cancelled) return;
        setLiveBlueprintState({
          liveBlueprintStatus: 'error',
          liveBlueprintError: (error as Error).message,
          liveBlueprintDiagnostics: [],
        });
      }
    };

    const timer = setTimeout(run, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [doc, diagnosticsEnabled, liveBlueprintEnabled, setLiveBlueprintState]);
}
