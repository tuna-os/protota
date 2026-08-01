import { describe, expect, it } from 'vitest';
import {
  SPACING_SCALE,
  isOnSpacingScale,
  nearestSpacingValue,
  stepSpacingValue,
} from '../utils/spacingScale';
import { SPACING_SCALE as RULE_SCALE, layoutRules } from '../diagnostics/rules/layout';
import { WIDGET_SCHEMAS } from '../schemas/widgetSchemas';

/**
 * Spacing-scale quantisation (#79, penpot-study.md §5): the snap affordance
 * and the HIG-W001 diagnostic must agree on the scale and on "nearest".
 */

describe('SPACING_SCALE', () => {
  it('is the exact scale HIG-W001 enforces (same array, not a copy)', () => {
    expect(SPACING_SCALE).toBe(RULE_SCALE);
  });

  it('is sorted ascending with the 6/12/18/24 primaries present', () => {
    expect([...SPACING_SCALE]).toEqual([...SPACING_SCALE].sort((a, b) => a - b));
    for (const primary of [6, 12, 18, 24]) expect(SPACING_SCALE).toContain(primary);
  });
});

describe('isOnSpacingScale', () => {
  it('accepts every scale value and rejects neighbours', () => {
    for (const s of SPACING_SCALE) expect(isOnSpacingScale(s)).toBe(true);
    expect(isOnSpacingScale(5)).toBe(false);
    expect(isOnSpacingScale(13)).toBe(false);
    expect(isOnSpacingScale(-6)).toBe(false);
  });
});

describe('nearestSpacingValue', () => {
  it('quantises to the closest scale value', () => {
    expect(nearestSpacingValue(13)).toBe(12);
    expect(nearestSpacingValue(16)).toBe(18);
    expect(nearestSpacingValue(100)).toBe(48);
    expect(nearestSpacingValue(-5)).toBe(0);
  });

  it('is the identity on scale values', () => {
    for (const s of SPACING_SCALE) expect(nearestSpacingValue(s)).toBe(s);
  });

  it('matches the HIG-W001 quick-fix value for an off-scale box', () => {
    const rule = layoutRules.find((r) => r.id === 'HIG-W001')!;
    const node = { id: 'n1', type: 'box' as const, spacing: 13 };
    const screen = { id: 's1', title: 'S', width: 800, height: 600, rootNode: node };
    const ctx = { doc: { screens: [screen] }, screen, ancestors: [] };
    // Rule contexts carry more than the rule reads; the shape above is what
    // HIG-W001's match() touches.
    const matches = rule.match(node as never, ctx as never);
    expect(matches?.[0]?.quickFix).toMatchObject({
      kind: 'set-props',
      props: { spacing: nearestSpacingValue(13) },
    });
  });
});

describe('stepSpacingValue', () => {
  it('walks the scale from on-scale values', () => {
    expect(stepSpacingValue(12, 1)).toBe(18);
    expect(stepSpacingValue(12, -1)).toBe(10);
    expect(stepSpacingValue(0, 1)).toBe(3);
  });

  it('lands on scale immediately from off-scale values', () => {
    expect(stepSpacingValue(13, 1)).toBe(18);
    expect(stepSpacingValue(13, -1)).toBe(12);
    expect(stepSpacingValue(5, -1)).toBe(4);
  });

  it('clamps at both ends of the scale', () => {
    expect(stepSpacingValue(0, -1)).toBe(0);
    expect(stepSpacingValue(48, 1)).toBe(48);
    expect(stepSpacingValue(999, 1)).toBe(48);
    expect(stepSpacingValue(-10, -1)).toBe(0);
  });
});

describe('widget schemas', () => {
  it('marks every spacing-named number field with snap: spacing', () => {
    for (const [type, fields] of Object.entries(WIDGET_SCHEMAS)) {
      for (const field of fields) {
        if (field.type === 'number' && /spacing/i.test(field.key)) {
          expect(field.snap, `${type}.${field.key}`).toBe('spacing');
        }
      }
    }
  });
});
