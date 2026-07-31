/**
 * Declarative HIG rule interface (design §2.2).
 *
 * Rules are data objects instead of bare functions so the panel, the docs,
 * and a future generated rule index all read the same metadata. Every rule
 * cites the mirrored HIG corpus under docs/spec/ — no rule without a
 * quotable sentence (design §3).
 */
import type { AdwNode, AdwNodeType, MockupDocument, Screen } from '../../types/mockup';
import type { Diagnostic, DiagnosticTier, HigCitation } from '../types';

export interface RuleContext {
  doc: MockupDocument;
  screen: Screen;
  /** Ancestor chain, root first — replaces higLinter's ad-hoc findParent. */
  ancestors: AdwNode[];
}

/**
 * What a rule reports: everything the engine does not stamp itself
 * (`ruleId`/`tier`/`source`/`citation`). Matches may carry their own
 * `quickFix`, which keeps per-field fixes (e.g. HIG-S002) next to the
 * predicate that found them.
 */
export type RuleMatch = Omit<Diagnostic, 'ruleId' | 'tier' | 'source' | 'citation'>;

export interface HigRule {
  id: string;                  // 'HIG-E001'
  tier: DiagnosticTier;
  title: string;               // 'Window narrower than supported minimum'
  citation: HigCitation;
  /** Cheap pre-filter; the walker only calls match() for these node types. */
  appliesTo: AdwNodeType[] | 'any';
  /** Pure predicate + report builder. Never mutates. */
  match(node: AdwNode, ctx: RuleContext): RuleMatch[] | null;
}

/** Shorthand for the common single-match case anchored on the current node. */
export function report(
  node: AdwNode,
  ctx: RuleContext,
  message: string,
  quickFix?: Diagnostic['quickFix'],
): RuleMatch[] {
  return [{
    message,
    screenId: ctx.screen.id,
    nodeId: node.id,
    nodeType: node.type,
    ...(quickFix ? { quickFix } : {}),
  }];
}

/** Whether any ancestor (root first) has one of the given types. */
export function hasAncestor(ctx: RuleContext, ...types: AdwNodeType[]): boolean {
  return ctx.ancestors.some((a) => types.includes(a.type));
}

/** Depth-first search of a node's descendants (self excluded). */
export function findInSubtree(
  node: AdwNode,
  predicate: (n: AdwNode) => boolean,
): AdwNode | null {
  for (const child of node.children ?? []) {
    if (predicate(child)) return child;
    const found = findInSubtree(child, predicate);
    if (found) return found;
  }
  return null;
}

/** Collect all descendants (self excluded) matching a predicate, in document order. */
export function collectInSubtree(node: AdwNode, predicate: (n: AdwNode) => boolean): AdwNode[] {
  const out: AdwNode[] = [];
  const visit = (n: AdwNode) => {
    for (const child of n.children ?? []) {
      if (predicate(child)) out.push(child);
      visit(child);
    }
  };
  visit(node);
  return out;
}

export const HIG_UPSTREAM = 'https://developer.gnome.org/hig';
