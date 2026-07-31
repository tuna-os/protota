/**
 * Unified diagnostic model (#95).
 *
 * One record type regardless of source, superseding the old `LintViolation`
 * from src/utils/higLinter.ts. See docs/diagnostics-design.md §2.1.
 */
import type { AdwNode, AdwNodeType } from '../types/mockup';

export type DiagnosticTier = 'error' | 'warning' | 'suggestion';
export type DiagnosticSource = 'hig' | 'blueprint';

export interface HigCitation {
  /** Mirrored corpus file, e.g. 'docs/spec/reference/hig/menus.md' */
  specPath: string;
  /** Upstream page, e.g. 'https://developer.gnome.org/hig/patterns/controls/menus.html' */
  url: string;
  /** Short quote or paraphrase shown in the panel card */
  excerpt: string;
}

/**
 * A machine-applicable fix expressed as data over EXISTING store mutations —
 * no new mutation paths, so undo/redo and Blueprint persistence work
 * unchanged (design §6). `set-screen-props` is the one addition the design
 * itself calls for (HIG-E001: `Screen.width` lives beside `rootNode`).
 */
export type QuickFix =
  | { kind: 'set-props'; nodeId: string; props: Partial<AdwNode>; label: string }
  | { kind: 'add-child'; parentId: string; childType: AdwNodeType; slot?: string; label: string }
  | { kind: 'delete-node'; nodeId: string; label: string }
  | { kind: 'set-screen-props'; screenId: string; props: { width?: number; height?: number }; label: string };

export interface Diagnostic {
  ruleId: string;              // 'HIG-E001' | 'BLP-W001' | ...
  tier: DiagnosticTier;
  source: DiagnosticSource;
  message: string;             // one-line, user-facing
  screenId: string;            // '' for source diagnostics without a live anchor
  nodeId: string;              // anchor node on the canvas; '' when unanchored
  nodeType: AdwNodeType | null;
  citation?: HigCitation;      // absent for blueprint-source diagnostics
  quickFix?: QuickFix;         // machine-applicable, optional
}

/** Instance-ignore key: one dismissed card, not a disabled rule. */
export function instanceKey(ruleId: string, nodeId: string): string {
  return `${ruleId}:${nodeId}`;
}
