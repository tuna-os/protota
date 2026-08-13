/**
 * Tree traversal helpers (src/utils/treeHelpers.ts) — findNodeLocation and
 * findNodeById over the AdwNode tree. Previously 0% coverage.
 */
import { describe, expect, it } from 'vitest';
import { findNodeById, findNodeLocation } from '../utils/treeHelpers';
import type { AdwNode } from '../types/mockup';

const node = (id: string, children: AdwNode[] = []): AdwNode => ({
  id, type: 'box', children,
});

const tree = node('root', [
  node('a', [node('a1'), node('a2', [node('a2x')])]),
  node('b'),
]);

describe('findNodeLocation', () => {
  it('finds a direct child', () => {
    const loc = findNodeLocation(tree, 'b');
    expect(loc).not.toBeNull();
    expect(loc!.index).toBe(1);
    expect(loc!.parentChildren.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('finds a nested child and reports its own parent array', () => {
    const loc = findNodeLocation(tree, 'a2');
    expect(loc!.parentChildren.map((c) => c.id)).toEqual(['a1', 'a2']);
    expect(loc!.index).toBe(1);
  });

  it('finds nodes at any depth', () => {
    const loc = findNodeLocation(tree, 'a2x');
    expect(loc!.index).toBe(0);
    expect(loc!.parentChildren[0].id).toBe('a2x');
  });

  it('returns null for an unknown id', () => {
    expect(findNodeLocation(tree, 'missing')).toBeNull();
  });

  it('returns null for a leaf node (no children)', () => {
    expect(findNodeLocation(node('leaf'), 'anything')).toBeNull();
  });

  it('does not return the root itself', () => {
    expect(findNodeLocation(tree, 'root')).toBeNull();
  });
});

describe('findNodeById', () => {
  it('finds a node at the top level', () => {
    expect(findNodeById([tree], 'b')?.id).toBe('b');
  });

  it('finds a deeply nested node', () => {
    expect(findNodeById([tree], 'a2x')?.id).toBe('a2x');
  });

  it('returns null when the id is absent', () => {
    expect(findNodeById([tree], 'nope')).toBeNull();
  });

  it('returns null for an empty forest', () => {
    expect(findNodeById([], 'a')).toBeNull();
  });

  it('searches multiple roots', () => {
    expect(findNodeById([node('x'), tree], 'a1')?.id).toBe('a1');
  });
});
