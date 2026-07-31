import type { AdwNode, Screen } from '../types/mockup';
import { findNodeById } from './treeHelpers';

/**
 * Multi-select set logic (#79, docs/penpot-study.md §3). Selection is an
 * ordered id array — order matters for the primary (last-selected) node the
 * inspector shows and for range anchors. All helpers are pure so the
 * reducer logic is unit-testable without a store.
 */

/** Ctrl/Cmd-click semantics: add when absent, remove when present. */
export function toggleSelection(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

/** Union that keeps the existing order and appends new ids in given order. */
export function unionSelection(ids: readonly string[], added: readonly string[]): string[] {
  return [...ids, ...added.filter((id) => !ids.includes(id))];
}

/**
 * Shift-click range in a flat visible order (the layer tree's row order):
 * every id between anchor and target inclusive, in visible order.
 */
export function rangeSelection(
  visibleOrder: readonly string[], anchorId: string, targetId: string,
): string[] {
  const a = visibleOrder.indexOf(anchorId);
  const b = visibleOrder.indexOf(targetId);
  if (a === -1 || b === -1) return [targetId];
  return visibleOrder.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/**
 * Shallowest-ancestor filtering (§3 adaptation): when a selection covers both
 * a container and its descendants, keep only the shallowest — selecting a box
 * and three of its children makes align/distribute and drag ambiguous.
 */
export function filterShallowest(ids: readonly string[], screens: readonly Screen[]): string[] {
  const isDescendantOfOther = (id: string): boolean =>
    ids.some((otherId) => {
      if (otherId === id) return false;
      let other: AdwNode | null = null;
      for (const screen of screens) {
        other = findNodeById([screen.rootNode], otherId);
        if (other) break;
      }
      // The candidate is inside the other selected node's subtree.
      return !!other && findNodeById(other.children ?? [], id) !== null;
    });
  return ids.filter((id) => !isDescendantOfOther(id));
}

/** The screen containing a node id, or null. */
export function screenOf(screens: readonly Screen[], nodeId: string): Screen | null {
  for (const screen of screens) {
    if (findNodeById([screen.rootNode], nodeId)) return screen;
  }
  return null;
}
