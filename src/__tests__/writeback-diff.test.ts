/**
 * diffDocuments — the document-level three-way diff behind planWriteback
 * (src/utils/writeback.ts). writeback-core.test.ts exercises the plan end
 * to end; this file pins every edit kind and unsupported condition of the
 * diff itself: set/unset/styles, insert with followingIds, remove, and the
 * refusals (class/type change, child reorder, opaque keys, removed screens,
 * added screens).
 */
import { describe, expect, it } from 'vitest';
import { diffDocuments } from '../utils/writeback';
import type { MockupDocument, AdwNode } from '../types/mockup';

function node(id: string, over: Partial<AdwNode> = {}): AdwNode {
  return { id, type: 'button', title: id, children: [], ...over };
}

function doc(over: Partial<MockupDocument> = {}): MockupDocument {
  return {
    id: 'd', title: 'Doc', colorScheme: 'auto', edges: [], screens: [
      { id: 's1', title: 'S1', type: 'standard', width: 800, height: 600, rootNode: node('root', { type: 'box' }) },
    ],
    ...over,
  };
}

const kinds = (diff: ReturnType<typeof diffDocuments>) => diff.edits.map((e) => e.kind);

describe('diffDocuments: property edits', () => {
  it('emits set for a changed property value', () => {
    const original = doc();
    const edited = doc();
    (edited.screens[0].rootNode.children as AdwNode[])!.push(node('b1', { title: 'Changed' }));
    original.screens[0].rootNode.children = [node('b1', { title: 'Original' })];
    edited.screens[0].rootNode.children = [node('b1', { title: 'Changed' })];

    const diff = diffDocuments(original, edited);
    expect(kinds(diff)).toEqual(['set']);
    expect(diff.edits[0]).toMatchObject({ kind: 'set', key: 'title', value: 'Changed' });
  });

  it('emits unset when a property is cleared (undefined / empty / false)', () => {
    for (const cleared of [undefined, '', false]) {
      const original = doc();
      const edited = doc();
      const before = node('b1', { title: 'X' });
      const after = node('b1', { title: 'X' });
      original.screens[0].rootNode.children = [before];
      edited.screens[0].rootNode.children = [after];
      (after as Record<string, unknown>).subtitle = cleared;
      (before as Record<string, unknown>).subtitle = 'keep';

      const diff = diffDocuments(original, edited);
      expect(kinds(diff)).toEqual(['unset']);
      expect(diff.edits[0]).toMatchObject({ kind: 'unset', key: 'subtitle' });
    }
  });

  it('emits a styles edit when a style key changes', () => {
    const original = doc();
    const edited = doc();
    original.screens[0].rootNode.children = [node('b1', { suggested: false })];
    edited.screens[0].rootNode.children = [node('b1', { suggested: true })];
    const diff = diffDocuments(original, edited);
    expect(kinds(diff)).toEqual(['styles']);
  });
});

describe('diffDocuments: structural edits', () => {
  it('emits remove for a deleted child', () => {
    const original = doc();
    const edited = doc();
    original.screens[0].rootNode.children = [node('b1'), node('b2')];
    edited.screens[0].rootNode.children = [node('b1')];
    const diff = diffDocuments(original, edited);
    expect(kinds(diff)).toEqual(['remove']);
    expect(diff.edits[0]).toMatchObject({ kind: 'remove', child: { id: 'b2' } });
  });

  it('emits insert with followingIds of the remaining original siblings', () => {
    const original = doc();
    const edited = doc();
    original.screens[0].rootNode.children = [node('b1'), node('b3')];
    edited.screens[0].rootNode.children = [node('b1'), node('b2'), node('b3')];
    const diff = diffDocuments(original, edited);
    expect(kinds(diff)).toEqual(['insert']);
    expect(diff.edits[0]).toMatchObject({ kind: 'insert', node: { id: 'b2' }, followingIds: ['b3'] });
  });

  it('recurses into matched children and combines edits', () => {
    const original = doc();
    const edited = doc();
    original.screens[0].rootNode.children = [node('b1', { type: 'box', children: [node('inner', { title: 'A' })] })];
    edited.screens[0].rootNode.children = [node('b1', { type: 'box', children: [node('inner', { title: 'B' })] })];
    const diff = diffDocuments(original, edited);
    expect(kinds(diff)).toEqual(['set']);
    expect(diff.edits[0]).toMatchObject({ key: 'title', value: 'B' });
  });
});

describe('diffDocuments: unsupported refusals', () => {
  it('refuses class/type changes', () => {
    const original = doc();
    const edited = doc();
    original.screens[0].rootNode.children = [node('b1', { type: 'button' })];
    edited.screens[0].rootNode.children = [node('b1', { type: 'label' })];
    const diff = diffDocuments(original, edited);
    expect(diff.edits).toEqual([]);
    expect(diff.unsupported.join('\n')).toContain('class/type changes are never written back');
  });

  it('refuses child reordering', () => {
    const original = doc();
    const edited = doc();
    original.screens[0].rootNode.children = [node('b1'), node('b2')];
    edited.screens[0].rootNode.children = [node('b2'), node('b1')];
    const diff = diffDocuments(original, edited);
    expect(diff.edits).toEqual([]);
    expect(diff.unsupported.join('\n')).toContain('reordering children is not written back');
  });

  it('refuses edits to opaque source facts (bindings/options/pages/...)', () => {
    const original = doc();
    const edited = doc();
    original.screens[0].rootNode.children = [node('b1')];
    edited.screens[0].rootNode.children = [node('b1', { bindings: { x: 'y' } as unknown as AdwNode['bindings'] })];
    const diff = diffDocuments(original, edited);
    expect(kinds(diff)).toEqual([]);
    expect(diff.unsupported.join('\n')).toContain('opaque source facts');
  });

  it('refuses removed screens when the edited document has fewer', () => {
    const original = doc({ screens: [
      { id: 's1', title: 'S1', type: 'standard', width: 800, height: 600, rootNode: node('r1', { type: 'box' }) },
      { id: 's2', title: 'S2', type: 'standard', width: 800, height: 600, rootNode: node('r2', { type: 'box' }) },
    ] });
    const edited = doc({ screens: [
      { id: 's1', title: 'S1', type: 'standard', width: 800, height: 600, rootNode: node('r1', { type: 'box' }) },
    ] });
    const diff = diffDocuments(original, edited);
    expect(diff.unsupported.join('\n')).toContain('screen "s2" was removed');
  });

  it('flags added screens (new top-level files are not created)', () => {
    const original = doc({ screens: [
      { id: 's1', title: 'S1', type: 'standard', width: 800, height: 600, rootNode: node('r1', { type: 'box' }) },
    ] });
    const edited = doc({ screens: [
      { id: 's1', title: 'S1', type: 'standard', width: 800, height: 600, rootNode: node('r1', { type: 'box' }) },
      { id: 's3', title: 'S3', type: 'standard', width: 800, height: 600, rootNode: node('r3', { type: 'box' }) },
    ] });
    const diff = diffDocuments(original, edited);
    expect(diff.unsupported.join('\n')).toContain('new top-level files are not created');
  });

  it('produces an empty diff for identical documents', () => {
    const original = doc();
    const edited = doc();
    original.screens[0].rootNode.children = [node('b1', { suggested: true })];
    edited.screens[0].rootNode.children = [node('b1', { suggested: true })];
    const diff = diffDocuments(original, edited);
    expect(diff.edits).toEqual([]);
    expect(diff.unsupported).toEqual([]);
  });
});
