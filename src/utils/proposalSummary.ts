import type { AdwNode, MockupDocument } from '../types/mockup';

export interface ScreenChange {
  screenId: string;
  title: string;
  kind: 'added' | 'removed' | 'changed';
  nodesAdded: number;
  nodesRemoved: number;
  nodesChanged: number;
}

export interface ProposalSummary {
  changes: ScreenChange[];
  /** True when the candidate is the same document as the base. */
  empty: boolean;
}

function indexNodes(node: AdwNode, into: Map<string, AdwNode>): void {
  into.set(node.id, node);
  for (const child of node.children ?? []) indexNodes(child, into);
}

const index = (root: AdwNode): Map<string, AdwNode> => {
  const map = new Map<string, AdwNode>();
  indexNodes(root, map);
  return map;
};

/** Own properties only: children are compared by id membership, not deeply. */
function sameOwn(a: AdwNode, b: AdwNode): boolean {
  const { children: _a, ...restA } = a;
  const { children: _b, ...restB } = b;
  return JSON.stringify(restA) === JSON.stringify(restB)
    && (a.children ?? []).map((c) => c.id).join('\0') === (b.children ?? []).map((c) => c.id).join('\0');
}

/** Per-screen before/after node counts, keyed by screen id. */
export function summarizeProposal(base: MockupDocument, candidate: MockupDocument): ProposalSummary {
  const changes: ScreenChange[] = [];
  const baseScreens = new Map(base.screens.map((s) => [s.id, s]));
  const candScreens = new Map(candidate.screens.map((s) => [s.id, s]));

  for (const screen of candidate.screens) {
    const before = baseScreens.get(screen.id);
    if (!before) {
      changes.push({
        screenId: screen.id, title: screen.title, kind: 'added',
        nodesAdded: index(screen.rootNode).size, nodesRemoved: 0, nodesChanged: 0,
      });
      continue;
    }
    if (before === screen) continue;
    const a = index(before.rootNode);
    const b = index(screen.rootNode);
    let nodesAdded = 0;
    let nodesRemoved = 0;
    let nodesChanged = 0;
    for (const [id, node] of b) {
      const old = a.get(id);
      if (!old) nodesAdded += 1;
      else if (!sameOwn(old, node)) nodesChanged += 1;
    }
    for (const id of a.keys()) if (!b.has(id)) nodesRemoved += 1;
    const screenMetaChanged = before.title !== screen.title
      || before.width !== screen.width || before.height !== screen.height;
    if (nodesAdded || nodesRemoved || nodesChanged || screenMetaChanged) {
      changes.push({ screenId: screen.id, title: screen.title, kind: 'changed', nodesAdded, nodesRemoved, nodesChanged });
    }
  }
  for (const screen of base.screens) {
    if (!candScreens.has(screen.id)) {
      changes.push({
        screenId: screen.id, title: screen.title, kind: 'removed',
        nodesAdded: 0, nodesRemoved: index(screen.rootNode).size, nodesChanged: 0,
      });
    }
  }
  const otherChange = base.colorScheme !== candidate.colorScheme || base.edges !== candidate.edges;
  return { changes, empty: changes.length === 0 && !otherChange && base === candidate };
}
