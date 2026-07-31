/**
 * Blueprint-source diagnostics (design §2.3).
 *
 * Level 1: surface the ImportDiagnostics blueprintToDocument already records
 * (BLP-W001/S001/S002). Level 2: the export round-trip check (BLP-E001) —
 * anything mockupToBlueprint emits that blueprintToDocument cannot read back
 * is a real fidelity bug, reported at error tier.
 */
import type { AdwNode, ImportDiagnostic, MockupDocument } from '../types/mockup';
import type { Diagnostic, DiagnosticTier } from './types';
import { blueprintToDocument, mockupToBlueprint } from '../utils/blueprint';

const CODE_MAP: Record<ImportDiagnostic['code'], { ruleId: string; tier: DiagnosticTier }> = {
  // A $Class reference had no template definition in the imported source.
  'template-not-in-bundle': { ruleId: 'BLP-W001', tier: 'warning' },
  // A known GTK/Adw class survives as a custom-widget boundary. This is by
  // design an honest result, not an error (docs/source-widget-architecture.md).
  'renderer-does-not-support-class': { ruleId: 'BLP-S001', tier: 'suggestion' },
  // Informational provenance note for code-defined composites.
  'static-source-expansion': { ruleId: 'BLP-S002', tier: 'suggestion' },
};

/** Anchor an import diagnostic to the matching custom-widget node, if live. */
function findAnchor(
  doc: MockupDocument,
  d: ImportDiagnostic,
): { screenId: string; nodeId: string; nodeType: AdwNode['type'] | null } {
  for (const screen of doc.screens) {
    let found: AdwNode | null = null;
    const visit = (node: AdwNode) => {
      if (found) return;
      if (node.sourceClass === d.sourceClass) {
        found = node;
        return;
      }
      node.children?.forEach(visit);
    };
    visit(screen.rootNode);
    if (found) {
      const anchor = found as AdwNode;
      return { screenId: screen.id, nodeId: anchor.id, nodeType: anchor.type };
    }
  }
  return { screenId: '', nodeId: '', nodeType: null };
}

/** Map the document's recorded ImportDiagnostics into unified Diagnostics. */
export function mapImportDiagnostics(doc: MockupDocument): Diagnostic[] {
  return (doc.importDiagnostics ?? []).map((d) => {
    const { ruleId, tier } = CODE_MAP[d.code];
    return {
      ruleId,
      tier,
      source: 'blueprint' as const,
      message: d.message,
      ...findAnchor(doc, d),
    };
  });
}

/**
 * Export round-trip check (BLP-E001, design flow D): re-import the exported
 * Blueprint and report anything lossy. Runs on demand — export time — not
 * per keystroke.
 */
export function runRoundTripCheck(doc: MockupDocument): Diagnostic[] {
  const unanchored = (message: string): Diagnostic => ({
    ruleId: 'BLP-E001',
    tier: 'error',
    source: 'blueprint',
    message,
    screenId: '',
    nodeId: '',
    nodeType: null,
  });
  try {
    const source = mockupToBlueprint(doc);
    const reimported = blueprintToDocument(source, doc.title);
    const results: Diagnostic[] = [];
    if (reimported.screens.length !== doc.screens.length) {
      results.push(unanchored(
        `Export round-trip: ${doc.screens.length} screens exported but ${reimported.screens.length} re-imported`));
    }
    for (const d of reimported.importDiagnostics ?? []) {
      results.push(unanchored(`Export round-trip: ${d.message}`));
    }
    return results;
  } catch (error) {
    return [unanchored(`Export round-trip failed: ${(error as Error).message}`)];
  }
}
