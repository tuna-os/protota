import type { AdwNode } from '../types/mockup';

export interface NodeLocation {
  parentChildren: AdwNode[];
  index: number;
}

/**
 * Searches a node tree recursively to find the parent array
 * and child index for a given target node ID.
 */
export const findNodeLocation = (
  current: AdwNode,
  targetId: string,
): NodeLocation | null => {
  if (!current.children) return null;

  const idx = current.children.findIndex((child) => child.id === targetId);
  if (idx !== -1) {
    return { parentChildren: current.children, index: idx };
  }

  for (const child of current.children) {
    const result = findNodeLocation(child, targetId);
    if (result) return result;
  }

  return null;
};

/**
 * Recursively finds a node by ID in the tree.
 */
export const findNodeById = (
  nodes: AdwNode[],
  id: string,
): AdwNode | null => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
};
