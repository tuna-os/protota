/**
 * Adwaita spacing-scale snapping (#79, docs/penpot-study.md §5).
 *
 * Penpot's coordinate snapping evaporates in a constraint model — there is no
 * arbitrary x/y to snap. What survives is quantising spacing *values* to the
 * scale the linter already enforces. The scale itself is imported from the
 * HIG-W001 rule so the snap affordance and the diagnostic can never disagree.
 */
import { SPACING_SCALE } from '../diagnostics/rules/layout';

export { SPACING_SCALE };

const SPACING_SET = new Set(SPACING_SCALE);

/** True when the value sits exactly on the audited GNOME spacing scale. */
export function isOnSpacingScale(value: number): boolean {
  return SPACING_SET.has(value);
}

/** Nearest scale value — the same reduction HIG-W001 uses for its quick fix. */
export function nearestSpacingValue(value: number): number {
  return SPACING_SCALE.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
}

/**
 * Step along the scale: the next scale value strictly above (dir = 1) or
 * below (dir = -1) the current value, clamped at the scale's ends. An
 * off-scale start lands on scale immediately, so one keypress is a fix.
 */
export function stepSpacingValue(value: number, dir: 1 | -1): number {
  if (dir === 1) {
    for (const s of SPACING_SCALE) if (s > value) return s;
    return SPACING_SCALE[SPACING_SCALE.length - 1];
  }
  for (let i = SPACING_SCALE.length - 1; i >= 0; i--) {
    if (SPACING_SCALE[i] < value) return SPACING_SCALE[i];
  }
  return SPACING_SCALE[0];
}
