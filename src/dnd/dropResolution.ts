import type { AdwNode, AdwNodeType, MockupDocument } from '../types/mockup';
import { LEGAL_CHILDREN, LEGAL_SLOTS } from '../types/mockup';
import { findNodeById } from '../utils/treeHelpers';
import type { DropTarget } from './dndStore';

/**
 * Drop-target resolution (#79), adapted from Penpot's flex-layout drop path
 * (docs/penpot-study.md §4): a drop never resolves to coordinates. From the
 * hovered DOM element, walk the node ancestry to the deepest container whose
 * LEGAL_CHILDREN accepts the dragged type, then convert the pointer position
 * into an insertion index by comparing against the container's children's
 * midpoints along the container's flow axis.
 */

interface NodeInfo {
  node: AdwNode;
  parent: AdwNode | null;
  screenId: string;
}

/** id → node/parent/screen for the whole document. Documents are tens of nodes. */
function indexDocument(doc: MockupDocument): Map<string, NodeInfo> {
  const map = new Map<string, NodeInfo>();
  for (const screen of doc.screens) {
    const visit = (node: AdwNode, parent: AdwNode | null) => {
      map.set(node.id, { node, parent, screenId: screen.id });
      node.children?.forEach((child) => visit(child, node));
    };
    visit(screen.rootNode, null);
  }
  return map;
}

/** The axis along which a container lays out its children. */
function flowAxis(node: AdwNode): 'x' | 'y' {
  if (node.type === 'box' || node.type === 'center-box' || node.type === 'wrap-box') {
    return node.orientation === 'horizontal' ? 'x' : 'y';
  }
  if (node.type === 'header-bar' || node.type === 'overlay-split' || node.type === 'list-box-row') {
    return 'x';
  }
  return 'y';
}

/**
 * The node's rendered canvas element. Scoped to the canvas: layer-tree rows
 * carry the same data-node-id attribute and must never anchor canvas
 * geometry.
 */
function elementForNode(nodeId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `.protota-canvas [data-node-id="${CSS.escape(nodeId)}"]`,
  );
}

/**
 * The insertion index among `container.children` for a pointer position:
 * the index of the first child whose midpoint (along the container's flow
 * axis) lies past the pointer, or the child count to append.
 */
export function insertionIndexFor(
  container: AdwNode,
  clientX: number,
  clientY: number,
): number {
  const children = container.children ?? [];
  const axis = flowAxis(container);
  const pointer = axis === 'x' ? clientX : clientY;
  for (let i = 0; i < children.length; i++) {
    const el = elementForNode(children[i].id);
    if (!el) continue; // hidden or unrendered child — cannot anchor on it
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const mid = axis === 'x' ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
    if (pointer < mid) return i;
  }
  return children.length;
}

export interface ResolveOptions {
  /** Widget type being dragged (palette entry type, or the node's own type). */
  draggedType: AdwNodeType;
  /** For reparent drags: this node and its whole subtree are not targets. */
  excludeNodeId?: string;
}

/**
 * Resolve the element under the pointer to `{ container, index, slot? }`,
 * or null when no legal container is on the ancestry path.
 */
export function resolveDropTarget(
  doc: MockupDocument,
  hit: Element | null,
  clientX: number,
  clientY: number,
  options: ResolveOptions,
): DropTarget | null {
  if (!hit) return null;
  const byId = indexDocument(doc);

  const excluded = options.excludeNodeId
    ? byId.get(options.excludeNodeId)?.node ?? null
    : null;
  const isExcluded = (id: string): boolean =>
    excluded !== null && findNodeById([excluded], id) !== null;

  // Node-element ancestry chain, deepest first.
  const chain: HTMLElement[] = [];
  let cursor: Element | null = hit.closest('[data-node-id]');
  while (cursor) {
    chain.push(cursor as HTMLElement);
    cursor = cursor.parentElement?.closest('[data-node-id]') ?? null;
  }

  for (let i = 0; i < chain.length; i++) {
    const id = chain[i].dataset.nodeId!;
    if (isExcluded(id)) continue;
    const info = byId.get(id);
    if (!info) continue;
    const legal = LEGAL_CHILDREN[info.node.type] ?? [];
    if (!legal.includes(options.draggedType)) continue;

    const container = info.node;
    const index = insertionIndexFor(container, clientX, clientY);

    // Slot: for slotted containers, adopt the slot of the direct model child
    // the pointer path goes through — its wrapper carries the resolved slot
    // attribute. Dropping on the container's own surface leaves the slot to
    // the renderer's defaulting.
    let slot: string | undefined;
    if (LEGAL_SLOTS[container.type]) {
      for (let j = i - 1; j >= 0; j--) {
        const childId = chain[j].dataset.nodeId!;
        const childInfo = byId.get(childId);
        if (childInfo?.parent?.id === container.id) {
          slot = childInfo.node.slot
            ?? chain[j].parentElement?.getAttribute('slot')
            ?? undefined;
          break;
        }
      }
    }

    return { parentId: container.id, index, slot, screenId: info.screenId };
  }
  return null;
}
