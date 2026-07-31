import type { AdwNode, MockupDocument } from '../types/mockup';
import { findNodeById } from './treeHelpers';

/**
 * Align/distribute as constraint property edits (#79, penpot-study.md §6).
 *
 * Protota's model has no coordinates: position is the container's decision.
 * So the six standard align buttons are honest property edits — setting
 * `halign`/`valign` on each selected node — and distribute maps to GTK
 * expand semantics inside a matching Box: each sibling claims an equal share
 * of the parent's free allocation (gaps in a Box are already uniform by
 * construction via `spacing`). Every operation returns a batch of node
 * edits so the store can apply them in ONE undo snapshot.
 */

export type AlignMode =
  | 'start' | 'center-h' | 'end'      // horizontal: halign
  | 'top' | 'center-v' | 'bottom';    // vertical: valign

export type DistributeAxis = 'horizontal' | 'vertical';

export interface NodeEdit {
  nodeId: string;
  props: Partial<AdwNode>;
}

const ALIGN_PROPS: Record<AlignMode, Partial<AdwNode>> = {
  start: { halign: 'start' },
  'center-h': { halign: 'center' },
  end: { halign: 'end' },
  top: { valign: 'start' },
  'center-v': { valign: 'center' },
  bottom: { valign: 'end' },
};

/** Whether the node holding `nodeId` is a screen root (never alignable). */
function isScreenRoot(doc: MockupDocument, nodeId: string): boolean {
  return doc.screens.some((screen) => screen.rootNode.id === nodeId);
}

/**
 * Align: set halign/valign per selected node. Screen roots are skipped —
 * they are anchors, not laid-out children. Returns [] when nothing applies.
 */
export function computeAlignEdits(
  doc: MockupDocument, ids: readonly string[], mode: AlignMode,
): NodeEdit[] {
  return ids
    .filter((id) => !isScreenRoot(doc, id))
    .filter((id) => doc.screens.some((screen) => findNodeById([screen.rootNode], id)))
    .map((nodeId) => ({ nodeId, props: { ...ALIGN_PROPS[mode] } }));
}

/** The container node whose `children` array holds `nodeId`, or null. */
function findParentOf(root: AdwNode, nodeId: string): AdwNode | null {
  if (root.children?.some((child) => child.id === nodeId)) return root;
  for (const child of root.children ?? []) {
    const found = findParentOf(child, nodeId);
    if (found) return found;
  }
  return null;
}

export type DistributeResult =
  | { ok: true; edits: NodeEdit[] }
  | { ok: false; reason: string };

/**
 * Distribute: honest only when all selected nodes are siblings inside one
 * `box` whose orientation matches the axis. The edit sets `hexpand`
 * (horizontal) or `vexpand` (vertical) on each selected child and clears its
 * main-axis alignment, so the box divides its free space equally between
 * them — the constraint-model equivalent of equal spacing. Any other
 * combination has no constraint meaning and is reported as a reason string
 * for the UI to show on the disabled control.
 */
export function computeDistributeEdits(
  doc: MockupDocument, ids: readonly string[], axis: DistributeAxis,
): DistributeResult {
  if (ids.length < 2) return { ok: false, reason: 'Select two or more nodes' };
  let parent: AdwNode | null = null;
  for (const id of ids) {
    let thisParent: AdwNode | null = null;
    for (const screen of doc.screens) {
      thisParent = findParentOf(screen.rootNode, id);
      if (thisParent) break;
    }
    if (!thisParent) return { ok: false, reason: 'Selection must be siblings in one box' };
    if (parent && thisParent.id !== parent.id) {
      return { ok: false, reason: 'Selection spans multiple containers' };
    }
    parent = thisParent;
  }
  if (!parent || parent.type !== 'box') {
    return { ok: false, reason: 'Distribute needs a box container' };
  }
  const orientation = parent.orientation === 'horizontal' ? 'horizontal' : 'vertical';
  if (orientation !== axis) {
    return { ok: false, reason: `Parent box is ${orientation}` };
  }
  const edits: NodeEdit[] = ids.map((nodeId) => ({
    nodeId,
    props: axis === 'horizontal'
      ? { hexpand: true, halign: undefined }
      : { vexpand: true, valign: undefined },
  }));
  return { ok: true, edits };
}
