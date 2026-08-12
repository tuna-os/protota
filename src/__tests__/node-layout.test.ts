/**
 * Node layout semantics (src/utils/nodeGeometry.ts): GTK layout → CSS mapping.
 *
 * boundary-geometry.test.ts covers the evidence/facts half; this file pins
 * the layout half — parentFlowOf flow detection, alignmentStyle halign/valign
 * mapping (auto margins on the flex main axis, align-self on the cross
 * axis, justify/align-self in grids), placementLayout expansion/min-request/
 * grid-attach rules, containerLayout variants, and the native-evidence facts
 * branch of boundaryGeometryFacts.
 */
import { describe, expect, it } from 'vitest';
import {
  alignmentStyle,
  boundaryGeometryFacts,
  containerLayout,
  parentFlowOf,
  placementLayout,
} from '../utils/nodeGeometry';
import type { AdwNode } from '../types/mockup';

const node = (over: Partial<AdwNode> = {}): AdwNode => ({
  id: 'n', type: 'box', children: [], ...over,
});

// ── parentFlowOf ─────────────────────────────────────────────────────────────

describe('parentFlowOf', () => {
  it('treats grid and overlay as grid flow', () => {
    expect(parentFlowOf(node({ type: 'grid' }))).toBe('grid');
    expect(parentFlowOf(node({ type: 'overlay' }))).toBe('grid');
  });

  it('uses orientation for box-like containers', () => {
    expect(parentFlowOf(node({ type: 'box', orientation: 'horizontal' }))).toBe('row');
    expect(parentFlowOf(node({ type: 'box', orientation: 'vertical' }))).toBe('column');
    expect(parentFlowOf(node({ type: 'center-box', orientation: 'horizontal' }))).toBe('row');
    expect(parentFlowOf(node({ type: 'wrap-box', orientation: 'horizontal' }))).toBe('row');
  });

  it('treats header bar / overlay-split / list-box-row as rows', () => {
    expect(parentFlowOf(node({ type: 'header-bar' }))).toBe('row');
    expect(parentFlowOf(node({ type: 'overlay-split' }))).toBe('row');
    expect(parentFlowOf(node({ type: 'list-box-row' }))).toBe('row');
  });

  it('defaults to column flow', () => {
    expect(parentFlowOf(node({ type: 'window' }))).toBe('column');
    expect(parentFlowOf(node({ type: 'scrolled-window' }))).toBe('column');
  });
});

// ── alignmentStyle ───────────────────────────────────────────────────────────

describe('alignmentStyle', () => {
  it('maps grid halign/valign to justify-self/align-self', () => {
    const s = alignmentStyle(node({ type: 'grid', halign: 'fill', valign: 'center' }), 'grid');
    expect(s.justifySelf).toBe('stretch');
    expect(s.alignSelf).toBe('center');
    expect(alignmentStyle(node({ halign: 'end' }), 'grid').justifySelf).toBe('end');
    expect(alignmentStyle(node({ valign: 'end' }), 'grid').alignSelf).toBe('flex-end');
    expect(alignmentStyle(node({ valign: 'fill' }), 'grid').alignSelf).toBe('stretch');
  });

  it('positions a row child with auto inline margins on the main axis', () => {
    expect(alignmentStyle(node({ halign: 'center' }), 'row')).toEqual({
      marginInlineStart: 'auto', marginInlineEnd: 'auto',
    });
    expect(alignmentStyle(node({ halign: 'end' }), 'row')).toEqual({
      marginInlineStart: 'auto',
    });
    expect(alignmentStyle(node({ halign: 'start' }), 'row')).toEqual({
      marginInlineEnd: 'auto',
    });
  });

  it('grows a row child with halign fill', () => {
    expect(alignmentStyle(node({ halign: 'fill' }), 'row').flexGrow).toBe(1);
  });

  it('aligns a row child on the cross axis via align-self', () => {
    expect(alignmentStyle(node({ valign: 'center' }), 'row').alignSelf).toBe('center');
    expect(alignmentStyle(node({ valign: 'fill' }), 'row').alignSelf).toBe('stretch');
  });

  it('maps column-flow halign to align-self and valign to block margins', () => {
    expect(alignmentStyle(node({ halign: 'end' }), 'column').alignSelf).toBe('flex-end');
    expect(alignmentStyle(node({ valign: 'center' }), 'column')).toEqual({
      marginBlockStart: 'auto', marginBlockEnd: 'auto',
    });
    expect(alignmentStyle(node({ valign: 'end' }), 'column')).toEqual({
      marginBlockStart: 'auto',
    });
    expect(alignmentStyle(node({ valign: 'start' }), 'column')).toEqual({
      marginBlockEnd: 'auto',
    });
  });

  it('grows a column child with valign fill', () => {
    expect(alignmentStyle(node({ valign: 'fill' }), 'column').flexGrow).toBe(1);
  });
});

// ── placementLayout ──────────────────────────────────────────────────────────

describe('placementLayout', () => {
  it('returns undefined for a node with no placement properties', () => {
    expect(placementLayout(node({}))).toBeUndefined();
  });

  it('stretches grid children that expand without an explicit alignment', () => {
    const s = placementLayout(node({ type: 'grid', hexpand: true, vexpand: true }), 'grid');
    expect(s).toMatchObject({ justifySelf: 'stretch', alignSelf: 'stretch' });
    // An explicit alignment is honored (not stretched over).
    const aligned = placementLayout(node({ type: 'grid', hexpand: true, halign: 'center' }), 'grid');
    expect(aligned?.justifySelf).toBe('center');
  });

  it('expands on the parent main axis as flex growth', () => {
    const row = placementLayout(node({ hexpand: true }), 'row');
    expect(row).toMatchObject({ flexGrow: 1, minWidth: 0 });
    const col = placementLayout(node({ vexpand: true }), 'column');
    expect(col).toMatchObject({ flexGrow: 1, minHeight: 0 });
  });

  it('cross-axis expansion stretches unless aligned', () => {
    // hexpand inside a vertical box stretches cross-axis.
    const s = placementLayout(node({ hexpand: true }), 'column');
    expect(s?.alignSelf).toBe('stretch');
    expect(s?.minWidth).toBe(0);
    // Explicit cross alignment is honored, not stretched over.
    const aligned = placementLayout(node({ hexpand: true, halign: 'start' }), 'column');
    expect(aligned?.alignSelf).toBe('flex-start');
  });

  it('treats size requests as minimums and keeps the larger of the two', () => {
    const s = placementLayout(node({ widthRequest: 146, heightRequest: 40 }));
    expect(s).toMatchObject({ minWidth: 146, minHeight: 40 });
    const both = placementLayout(node({ minWidth: 200, widthRequest: 146 }));
    expect(both?.minWidth).toBe(200);
  });

  it('applies declared margins unless alignment already claimed the side', () => {
    const s = placementLayout(node({ marginStart: 8, marginTop: 4 }));
    expect(s).toMatchObject({ marginInlineStart: 8, marginBlockStart: 4 });
    // auto margin from alignment wins (widget hugs its aligned edge).
    const aligned = placementLayout(node({ halign: 'center', marginStart: 8 }), 'row');
    expect(aligned?.marginInlineStart).toBe('auto');
  });

  it('places grid-attached children with explicit columns/rows and spans', () => {
    const s = placementLayout(node({ type: 'grid', column: 2, row: 1, columnSpan: 2, rowSpan: 1 }), 'grid');
    expect(s).toMatchObject({ gridColumn: '3 / span 2', gridRow: '2 / span 1' });
  });

  it('freezes a runtime-evidenced boundary to its measured bounds', () => {
    const n = node({
      runtimeEvidence: {
        probeVersion: 1, matchedBy: 'buildable-id', buildableId: 'x', gtype: 'GtkBox',
        mapped: true, visible: true,
        bounds: { x: 0, y: 0, width: 240, height: 48 },
      },
    });
    const s = placementLayout(n);
    expect(s).toMatchObject({ width: 240, height: 48, flexGrow: 0, flexShrink: 0 });
  });

  it('hides overflow on a zero-sized runtime allocation', () => {
    const n = node({
      runtimeEvidence: {
        probeVersion: 1, matchedBy: 'structure', buildableId: null, gtype: 'GtkBox',
        mapped: true, visible: true,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
      },
    });
    expect(placementLayout(n)?.overflow).toBe('hidden');
  });

  it('positions relatively when the runtime probe supplied relative bounds', () => {
    const n = node({
      runtimeEvidence: {
        probeVersion: 1, matchedBy: 'structure', buildableId: null, gtype: 'GtkBox',
        mapped: true, visible: true,
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        relativeBounds: { x: 5, y: 6, width: 10, height: 10 },
      },
    });
    expect(placementLayout(n)).toMatchObject({ position: 'absolute', left: 5, top: 6 });
  });
});

// ── containerLayout ──────────────────────────────────────────────────────────

describe('containerLayout', () => {
  it('applies box spacing with a default gap of 12', () => {
    expect(containerLayout(node({ type: 'box', spacing: 4 }))).toMatchObject({ gap: 4 });
    expect(containerLayout(node({ type: 'box' }))).toMatchObject({ gap: 12 });
  });

  it('derives grid columns from children attach positions and spans', () => {
    const n = node({
      type: 'grid',
      children: [
        node({ id: 'a', type: 'button', column: 0, columnSpan: 1 }),
        node({ id: 'b', type: 'button', column: 3, columnSpan: 2 }),
      ],
    });
    const s = containerLayout(n) as Record<string, string>;
    expect(s.gridTemplateColumns).toBe('repeat(5, minmax(0, 1fr))');
  });

  it('honors explicit columns and per-axis spacing', () => {
    const s = containerLayout(node({
      type: 'grid', columns: 4, columnSpacing: 8, rowSpacing: 10,
    })) as Record<string, string | number>;
    expect(s.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    expect(s.columnGap).toBe(8);
    expect(s.rowGap).toBe(10);
  });

  it('fills rows when row-homogeneous', () => {
    const s = containerLayout(node({ type: 'grid', rowHomogeneous: true }));
    expect(s).toMatchObject({ gridAutoRows: 'minmax(0, 1fr)', height: '100%' });
  });

  it('sets overflow on scrolled-window and a clamp max via CSS variable', () => {
    expect(containerLayout(node({ type: 'scrolled-window' }))).toMatchObject({ overflow: 'auto' });
    const s = containerLayout(node({ type: 'clamp', maximumSize: 600 }));
    expect(s).toMatchObject({ '--protota-clamp-max': '600px' });
  });

  it('returns undefined for containers without layout rules', () => {
    expect(containerLayout(node({ type: 'window' }))).toBeUndefined();
  });
});

// ── boundaryGeometryFacts: native evidence branch ───────────────────────────

describe('boundaryGeometryFacts with runtime evidence', () => {
  it('publishes native bounds/mapped/visible at the native confidence tier', () => {
    const n = node({
      type: 'custom-widget',
      runtimeEvidence: {
        probeVersion: 1, matchedBy: 'buildable-id', buildableId: 'calc', gtype: 'GtkGrid',
        mapped: true, visible: false,
        bounds: { x: 4, y: 5, width: 320, height: 240 },
      },
    });
    const facts = boundaryGeometryFacts(n);
    const byProp = Object.fromEntries(facts.map((f) => [f.property, f]));
    expect(byProp['bounds'].value).toBe('4,5 320x240');
    expect(byProp['bounds'].confidence).toBe('native');
    expect(byProp['mapped'].value).toBe(true);
    expect(byProp['visible'].value).toBe(false);
    expect(facts.every((f) => f.confidence === 'native')).toBe(true);
  });
});
