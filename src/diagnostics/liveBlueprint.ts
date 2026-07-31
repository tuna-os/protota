/**
 * Live Blueprint syntax tier (ADR 0001 Part 3 item 2, design §2.3 level 3).
 *
 * blueprint-compiler's tokenizer + parser run under Pyodide in a Web Worker
 * and report *syntax* errors on the exported source as BLP-L001. This is
 * explicitly not a compile: GIR-backed validation (unknown classes, bad
 * properties, signals) needs typelibs the browser does not have, so the
 * blueprint-export CI job and host compiles remain the authority. Every
 * message is labeled "Syntax check (browser)" to keep that distinction
 * visible.
 *
 * This module is the pure part — per-screen source building and mapping the
 * worker's errors into the unified Diagnostic model — so it unit-tests
 * without a worker.
 */
import type { AdwNode, MockupDocument, Screen } from '../types/mockup';
import type { Diagnostic } from './types';
import { mockupToBlueprint } from '../utils/blueprint';

/** One parse error from blueprint_check.py; line/col are 1-based. */
export interface WorkerSyntaxError {
  message: string;
  line: number;
  col: number;
  endLine: number;
  endCol: number;
}

/** Messages into the worker. */
export type LiveBlueprintRequest =
  | { type: 'init'; assetBase: string }
  | { type: 'check'; requestId: number; files: Array<{ screenId: string; source: string }> };

/** Messages out of the worker. */
export type LiveBlueprintResponse =
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  | { type: 'result'; requestId: number; results: Record<string, WorkerSyntaxError[]> }
  | { type: 'check-error'; requestId: number; message: string };

export interface ScreenSource {
  screenId: string;
  source: string;
}

/**
 * Export each screen separately — the same shape scripts/export-blueprint.mjs
 * feeds the host compiler — so an error attributes to its screen.
 */
export function buildScreenSources(doc: MockupDocument): ScreenSource[] {
  return doc.screens.map((screen) => ({
    screenId: screen.id,
    source: mockupToBlueprint({ ...doc, screens: [screen] }, { standalone: true }),
  }));
}

/** node.id -> node, for anchoring errors back onto the canvas. */
function indexScreenNodes(screen: Screen): Map<string, AdwNode> {
  const byId = new Map<string, AdwNode>();
  const visit = (node: AdwNode) => {
    if (node.id) byId.set(node.id, node);
    node.children?.forEach(visit);
  };
  visit(screen.rootNode);
  return byId;
}

/**
 * Anchor heuristic: the exporter writes `ClassName node_id {` lines using the
 * node's own id (`mockupToBlueprint`'s idMap keeps first-claim ids stable), so
 * the nearest preceding line that mentions a known node id is the enclosing
 * widget of the error. Suffixed duplicates (`id_2`) simply fail the lookup
 * and fall back to the screen root.
 */
function anchorNode(
  sourceLines: string[],
  errorLine: number,
  byId: Map<string, AdwNode>,
): AdwNode | null {
  for (let i = Math.min(errorLine, sourceLines.length) - 1; i >= 0; i--) {
    for (const word of sourceLines[i].split(/[^A-Za-z0-9_-]+/)) {
      const node = word && byId.get(word);
      if (node) return node;
    }
  }
  return null;
}

/** Map one screen's worker errors into BLP-L001 diagnostics. */
export function mapLiveErrors(
  doc: MockupDocument,
  screenId: string,
  source: string,
  errors: WorkerSyntaxError[],
): Diagnostic[] {
  const screen = doc.screens.find((s) => s.id === screenId);
  const byId = screen ? indexScreenNodes(screen) : new Map<string, AdwNode>();
  const sourceLines = source.split('\n');
  return errors.map((e) => {
    const anchor = screen ? anchorNode(sourceLines, e.line, byId) : null;
    const node = anchor ?? screen?.rootNode ?? null;
    return {
      ruleId: 'BLP-L001',
      tier: 'error' as const,
      source: 'blueprint' as const,
      message: `Syntax check (browser): ${e.message} (line ${e.line})`,
      screenId: screen?.id ?? '',
      nodeId: node?.id ?? '',
      nodeType: node?.type ?? null,
    };
  });
}
