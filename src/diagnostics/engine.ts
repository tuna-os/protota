/**
 * Diagnostics engine (design §2.2) — evolved from higLinter's lintDocument.
 *
 * A single depth-first walk per screen carries the ancestor chain and
 * dispatches each node to the rules indexed by `appliesTo`; the engine then
 * stamps `ruleId`/`tier`/`source`/`citation` onto the returned matches.
 */
import type { AdwNode, AdwNodeType, MockupDocument } from '../types/mockup';
import type { Diagnostic, DiagnosticTier } from './types';
import { instanceKey } from './types';
import type { HigRule, RuleContext } from './rules/types';
import { ALL_HIG_RULES } from './rules';
import { mapImportDiagnostics } from './blueprintSource';

const TIER_ORDER: Record<DiagnosticTier, number> = { error: 0, warning: 1, suggestion: 2 };

/** Rules indexed by the node types they apply to; 'any' rules run everywhere. */
function indexRules(rules: HigRule[]): { byType: Map<AdwNodeType, HigRule[]>; anyRules: HigRule[] } {
  const byType = new Map<AdwNodeType, HigRule[]>();
  const anyRules: HigRule[] = [];
  for (const rule of rules) {
    if (rule.appliesTo === 'any') { anyRules.push(rule); continue; }
    for (const type of rule.appliesTo) {
      const bucket = byType.get(type);
      if (bucket) bucket.push(rule);
      else byType.set(type, [rule]);
    }
  }
  return { byType, anyRules };
}

const INDEX = indexRules(ALL_HIG_RULES);

/** Run the HIG rule catalog over every screen of the document. */
export function runHigRules(doc: MockupDocument, rules: HigRule[] = ALL_HIG_RULES): Diagnostic[] {
  const { byType, anyRules } = rules === ALL_HIG_RULES ? INDEX : indexRules(rules);
  const results: Diagnostic[] = [];

  for (const screen of doc.screens) {
    const ancestors: AdwNode[] = [];
    const visit = (node: AdwNode) => {
      const ctx: RuleContext = { doc, screen, ancestors };
      const applicable = [...(byType.get(node.type) ?? []), ...anyRules];
      for (const rule of applicable) {
        const matches = rule.match(node, ctx);
        if (!matches) continue;
        for (const match of matches) {
          results.push({
            ...match,
            ruleId: rule.id,
            tier: rule.tier,
            source: 'hig',
            citation: rule.citation,
          });
        }
      }
      ancestors.push(node);
      for (const child of node.children ?? []) visit(child);
      ancestors.pop();
    };
    visit(screen.rootNode);
  }
  return results;
}

/**
 * Full diagnostic pass: HIG rules plus Blueprint-source diagnostics
 * (the ImportDiagnostics recorded by blueprintToDocument, design §2.3.1),
 * ordered error → warning → suggestion.
 */
export function runDiagnostics(doc: MockupDocument): Diagnostic[] {
  const all = [...runHigRules(doc), ...mapImportDiagnostics(doc)];
  return all.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
}

/** Diagnostics anchored to a specific screen + node. */
export function getDiagnosticsForNode(
  diagnostics: Diagnostic[],
  screenId: string,
  nodeId: string,
): Diagnostic[] {
  return diagnostics.filter((d) => d.screenId === screenId && d.nodeId === nodeId);
}

/**
 * Filtering by tier/ignore happens at selection time (panel + canvas), not
 * in the engine, so re-enabling a tier is instant (design §2.4).
 */
export function filterDiagnostics(
  diagnostics: Diagnostic[],
  tierFilters: Record<DiagnosticTier, boolean>,
  ignoredRules: string[],
  ignoredInstances: string[],
): Diagnostic[] {
  const rules = new Set(ignoredRules);
  const instances = new Set(ignoredInstances);
  return diagnostics.filter((d) =>
    // Blueprint-source diagnostics are included in the tier toggles
    // alongside HIG; rule/instance ignores still apply.
    tierFilters[d.tier] &&
    !rules.has(d.ruleId) &&
    !instances.has(instanceKey(d.ruleId, d.nodeId)));
}

/** The most severe tier present, for canvas outlines and the topbar badge. */
export function worstTier(diagnostics: Diagnostic[]): DiagnosticTier | null {
  let worst: DiagnosticTier | null = null;
  for (const d of diagnostics) {
    if (worst === null || TIER_ORDER[d.tier] < TIER_ORDER[worst]) worst = d.tier;
  }
  return worst;
}
