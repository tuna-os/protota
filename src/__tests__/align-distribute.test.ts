import { describe, expect, it } from 'vitest';
import type { MockupDocument } from '../types/mockup';
import { computeAlignEdits, computeDistributeEdits } from '../utils/alignDistribute';

/**
 * Align/distribute as constraint property edits (#79, penpot-study.md §6).
 * Align maps the six-button vocabulary to halign/valign per node; distribute
 * maps to expand flags on siblings of a matching-orientation box, and
 * reports a reason when the selection has no constraint meaning.
 */

function makeDoc(): MockupDocument {
  return {
    id: 'doc', title: 'T', edges: [], colorScheme: 'auto',
    screens: [
      {
        id: 's1', title: 'S1', type: 'empty', width: 800, height: 600,
        rootNode: {
          id: 'root', type: 'box', orientation: 'vertical',
          children: [
            {
              id: 'hbox', type: 'box', orientation: 'horizontal',
              children: [
                { id: 'h1', type: 'button' },
                { id: 'h2', type: 'button' },
              ],
            },
            {
              id: 'vbox', type: 'box',
              children: [
                { id: 'v1', type: 'label' },
                { id: 'v2', type: 'label' },
              ],
            },
            { id: 'lone', type: 'button' },
          ],
        },
      },
    ],
  };
}

describe('computeAlignEdits', () => {
  const doc = makeDoc();

  it.each([
    ['start', { halign: 'start' }],
    ['center-h', { halign: 'center' }],
    ['end', { halign: 'end' }],
    ['top', { valign: 'start' }],
    ['center-v', { valign: 'center' }],
    ['bottom', { valign: 'end' }],
  ] as const)('maps %s to the constraint props', (mode, props) => {
    const edits = computeAlignEdits(doc, ['h1', 'h2'], mode);
    expect(edits).toEqual([
      { nodeId: 'h1', props },
      { nodeId: 'h2', props },
    ]);
  });

  it('skips screen roots — they are anchors, not laid-out children', () => {
    expect(computeAlignEdits(doc, ['root', 'h1'], 'end')).toEqual([
      { nodeId: 'h1', props: { halign: 'end' } },
    ]);
  });

  it('skips unknown ids', () => {
    expect(computeAlignEdits(doc, ['ghost'], 'end')).toEqual([]);
  });
});

describe('computeDistributeEdits', () => {
  const doc = makeDoc();

  it('distributes siblings of a horizontal box via hexpand', () => {
    const result = computeDistributeEdits(doc, ['h1', 'h2'], 'horizontal');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.edits).toEqual([
        { nodeId: 'h1', props: { hexpand: true, halign: undefined } },
        { nodeId: 'h2', props: { hexpand: true, halign: undefined } },
      ]);
    }
  });

  it('distributes siblings of a vertical (default-orientation) box via vexpand', () => {
    const result = computeDistributeEdits(doc, ['v1', 'v2'], 'vertical');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.edits.map((edit) => edit.props)).toEqual([
        { vexpand: true, valign: undefined },
        { vexpand: true, valign: undefined },
      ]);
    }
  });

  it('rejects an axis that does not match the parent orientation', () => {
    const result = computeDistributeEdits(doc, ['h1', 'h2'], 'vertical');
    expect(result).toEqual({ ok: false, reason: 'Parent box is horizontal' });
  });

  it('rejects a selection spanning multiple containers', () => {
    const result = computeDistributeEdits(doc, ['h1', 'v1'], 'horizontal');
    expect(result).toEqual({ ok: false, reason: 'Selection spans multiple containers' });
  });

  it('rejects fewer than two nodes', () => {
    expect(computeDistributeEdits(doc, ['h1'], 'horizontal').ok).toBe(false);
  });
});
