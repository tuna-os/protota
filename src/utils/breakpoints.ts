/**
 * Adw.Breakpoint evaluation (render-time, pure).
 *
 * Libadwaita semantics (adwaita docs, AdwBreakpointBin/AdwWindow): a host
 * widget owns an ordered list of breakpoints; at any size AT MOST ONE of them
 * is current — "if multiple breakpoints can be used for a given size, the
 * last one is always picked" (AdwBreakpointBin documentation). The current
 * breakpoint's setters apply; leaving it restores the unset values.
 *
 * Protota's approximation: breakpoints are evaluated against the SCREEN's
 * dimensions. For window-attached breakpoints that is exact; for a nested
 * Adw.BreakpointBin it assumes the bin tracks the window size, which holds
 * for every host in the imported corpus (the bin is the window's content).
 *
 * Overrides are derived state in the same family as the runtime-evidence
 * geometry overrides (utils/nodeGeometry.ts): the document is never mutated.
 */
import type { AdwNode, BreakpointSetter } from '../types/mockup';
import { editorPropertyName } from './blueprint';

/** One parsed comparison of a breakpoint condition. */
interface LengthCondition {
  kind: 'max-width' | 'min-width' | 'max-height' | 'min-height';
  /** Pixels. sp is treated as px (this renderer has no font scaling). */
  value: number;
}

const LENGTH_PATTERN = /^(max-width|min-width|max-height|min-height)\s*:\s*(-?\d+(?:\.\d+)?)\s*(px|sp|pt)?$/;

function parseLength(term: string): LengthCondition | null {
  const match = LENGTH_PATTERN.exec(term.trim());
  if (!match) return null;
  let value = Number(match[2]);
  // 1pt = 4/3 px (CSS reference pixel); sp equals px without font scaling.
  if (match[3] === 'pt') value = (value * 4) / 3;
  return { kind: match[1] as LengthCondition['kind'], value };
}

function lengthMatches(condition: LengthCondition, width: number, height: number): boolean {
  switch (condition.kind) {
    case 'max-width': return width <= condition.value;
    case 'min-width': return width >= condition.value;
    case 'max-height': return height <= condition.value;
    case 'min-height': return height >= condition.value;
  }
}

/**
 * Evaluate an Adw.BreakpointCondition string against the given dimensions.
 * Supports the grammar present in the corpus: length comparisons combined
 * with `and` / `or` (no parentheses; `and` binds tighter than `or`, matching
 * the libadwaita parser). An unparseable term never matches — an honest
 * "don't know" rather than a guessed layout switch.
 */
export function breakpointConditionMatches(condition: string, width: number, height: number): boolean {
  return condition.split(/\bor\b/).some((disjunct) =>
    disjunct.split(/\band\b/).every((term) => {
      const parsed = parseLength(term);
      return parsed !== null && lengthMatches(parsed, width, height);
    }),
  );
}

/** A node is a preserved Adw.Breakpoint when import kept its condition. */
export function isBreakpointNode(node: AdwNode): boolean {
  return typeof node.breakpointCondition === 'string';
}

export interface ActiveBreakpoint {
  /** The host widget (window or BreakpointBin) owning the breakpoint. */
  hostId: string;
  /** The breakpoint node itself. */
  node: AdwNode;
  condition: string;
}

/**
 * The current breakpoint of every host in the tree, at the given screen
 * dimensions. Per host, the LAST matching breakpoint in declaration order
 * wins (libadwaita's documented tie-break); hosts are independent.
 */
export function activeBreakpoints(root: AdwNode, width: number, height: number): ActiveBreakpoint[] {
  const active: ActiveBreakpoint[] = [];
  const visit = (node: AdwNode) => {
    const owned = (node.children ?? []).filter(isBreakpointNode);
    if (owned.length) {
      const matching = owned.filter((candidate) =>
        breakpointConditionMatches(candidate.breakpointCondition!, width, height));
      const current = matching[matching.length - 1];
      if (current) active.push({ hostId: node.id, node: current, condition: current.breakpointCondition! });
    }
    node.children?.forEach(visit);
  };
  visit(root);
  return active;
}

/**
 * Render-time property overrides derived from the active breakpoints:
 * target node id → editor-spelled property patch. Setter property names are
 * stored in source spelling (`visible-child-name`) and translated per target
 * node type, so a stack's visible child switches exactly like an authored
 * `visibleChildName`. A `null` setter value unsets the property.
 */
export function breakpointOverrides(
  root: AdwNode,
  width: number,
  height: number,
): Record<string, Partial<AdwNode>> {
  const byId = new Map<string, AdwNode>();
  const index = (node: AdwNode) => { byId.set(node.id, node); node.children?.forEach(index); };
  index(root);

  const overrides: Record<string, Partial<AdwNode>> = {};
  for (const { node } of activeBreakpoints(root, width, height)) {
    for (const setter of node.breakpointSetters ?? []) {
      const target = byId.get(setter.target);
      if (!target) continue; // reported at import as breakpoint-setter-target-missing
      const key = editorPropertyName(setter.property, target.type);
      (overrides[setter.target] ??= {})[key] = setter.value === null ? undefined : setter.value;
    }
  }
  return overrides;
}

/** Setters whose target id does not exist anywhere in the given roots. */
export function missingSetterTargets(roots: AdwNode[]): BreakpointSetter[] {
  const ids = new Set<string>();
  const index = (node: AdwNode) => { ids.add(node.id); node.children?.forEach(index); };
  roots.forEach(index);
  const missing: BreakpointSetter[] = [];
  const visit = (node: AdwNode) => {
    for (const setter of node.breakpointSetters ?? []) {
      if (!ids.has(setter.target)) missing.push(setter);
    }
    node.children?.forEach(visit);
  };
  roots.forEach(visit);
  return missing;
}
