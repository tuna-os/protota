import { useDndStore } from './dndStore';
import { findNodeById } from '../utils/treeHelpers';
import { isOnSpacingScale, nearestSpacingValue } from '../utils/spacingScale';
import type { MockupDocument } from '../types/mockup';

/**
 * Inspect a drop's parent and record a quantise offer when it mirrors
 * HIG-W001: a box with a defined, off-scale spacing (#79, penpot-study.md
 * §5). Call after a drop commits; no-op otherwise. The offer is rendered by
 * QuantiseHintChip and proposes the diagnostic's own nearest-scale fix.
 */
export function noteDropQuantise(doc: MockupDocument, parentId: string, screenId: string): void {
  const screen = doc.screens.find((s) => s.id === screenId);
  if (!screen) return;
  const parent = findNodeById([screen.rootNode], parentId);
  // Same guards as the rule: box only, explicit spacing only.
  if (!parent || parent.type !== 'box' || parent.spacing === undefined) return;
  const spacing = Number(parent.spacing);
  if (!Number.isFinite(spacing) || isOnSpacingScale(spacing)) return;
  useDndStore.getState().setQuantiseHint({
    parentId, screenId, spacing, nearest: nearestSpacingValue(spacing),
  });
}
