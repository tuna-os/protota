import type { AdwNode, Screen } from '../types/mockup';
import { LEGAL_CHILDREN } from '../types/mockup';
import { findNodeLocation, findNodeById } from '../utils/treeHelpers';
import { uid } from './templates';

/** The container holding a node, so paste can fall back to placing beside it. */
export function findParentOf(root: AdwNode, nodeId: string): AdwNode | null {
  if (root.children?.some((child) => child.id === nodeId)) return root;
  for (const child of root.children ?? []) {
    const found = findParentOf(child, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * Legality resolution shared by paste and duplicate, applied to an immer
 * draft: prefer placing the tree INTO the target; fall back to BESIDE it
 * when the target cannot legally hold the tree but its parent can.
 * `besideOffset` is how many earlier trees of the same batch already landed
 * beside the target, so a sequential forest paste keeps clipboard order.
 * Returns where the tree landed, or null when it cannot legally land.
 */
export function placeTreeAt(
  screens: Screen[],
  targetId: string,
  tree: AdwNode,
  besideOffset: number,
): 'into' | 'beside' | null {
  for (const screen of screens) {
    const target = findNodeById([screen.rootNode], targetId);
    if (!target) continue;
    if ((LEGAL_CHILDREN[target.type] ?? []).includes(tree.type)) {
      target.children = target.children ?? [];
      target.children.push(tree);
      return 'into';
    }
    const location = findNodeLocation(screen.rootNode, targetId);
    const parent = location ? findParentOf(screen.rootNode, targetId) : null;
    if (location && parent && (LEGAL_CHILDREN[parent.type] ?? []).includes(tree.type)) {
      location.parentChildren.splice(location.index + 1 + besideOffset, 0, tree);
      return 'beside';
    }
    return null;
  }
  return null;
}

/** A pasted subtree needs fresh ids, or two nodes would answer to one name. */
export function withFreshIds(node: AdwNode): AdwNode {
  return {
    ...node,
    id: uid(node.type),
    children: node.children?.map(withFreshIds),
  };
}
