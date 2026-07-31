/** Layout rules — docs/spec/tokens/spacing.md, hig/adaptive.md */
import type { AdwNode } from '../../types/mockup';
import type { HigRule } from './types';
import { HIG_UPSTREAM, report } from './types';

/** Audited GNOME spacing scale (docs/spec/tokens/spacing.md). */
export const SPACING_SCALE = [0, 3, 4, 6, 8, 10, 12, 18, 24, 32, 36, 40, 48];
const SPACING_SET = new Set(SPACING_SCALE);

/**
 * Ancestors that already constrain or contextualise text width, making an
 * explicit clamp unnecessary (preferences pages and status pages clamp
 * natively; controls and rows size their own labels).
 */
const WIDTH_CONSTRAINED_ANCESTORS = new Set<AdwNode['type']>([
  'clamp', 'preferences-page', 'preferences-group', 'status-page', 'header-bar',
  'alert-dialog', 'about-dialog', 'banner', 'popover', 'grid',
  'button', 'split-button', 'menu-button', 'toggle', 'toggle-group',
  'action-row', 'switch-row', 'combo-row', 'spin-row', 'button-row',
  'expander-row', 'entry-row', 'password-row', 'list-box-row', 'list-box',
]);

export const layoutRules: HigRule[] = [
  {
    id: 'HIG-W001',
    tier: 'warning',
    title: 'Spacing off the GNOME scale',
    citation: {
      specPath: 'docs/spec/tokens/spacing.md',
      url: `${HIG_UPSTREAM}/guidelines/ui-styling.html`,
      excerpt: 'Spacing scale extracted from 12 GNOME Core apps — 6/12/18/24 primary, with 0/3/4/8/10/32/36/40/48 in occasional use.',
    },
    appliesTo: ['box'],
    match(node, ctx) {
      if (node.spacing === undefined) return null;
      const s = Number(node.spacing);
      if (SPACING_SET.has(s)) return null;
      const nearest = SPACING_SCALE.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a));
      return report(node, ctx,
        `Spacing ${s}px not on HIG scale — use ${nearest}px`,
        { kind: 'set-props', nodeId: node.id, props: { spacing: nearest }, label: `Set spacing to ${nearest}px` });
    },
  },
  {
    id: 'HIG-S005',
    tier: 'suggestion',
    title: 'Unclamped content at desktop widths',
    citation: {
      specPath: 'docs/spec/reference/hig/adaptive.md',
      url: `${HIG_UPSTREAM}/guidelines/adaptive.html`,
      excerpt: 'For large size handling, place content within containers that have a maximum width.',
    },
    appliesTo: ['label', 'inscription'],
    match(node, ctx) {
      if (ctx.screen.width < 700) return null;
      if (!node.title || node.title.length < 40) return null; // short captions are fine unclamped
      if (ctx.ancestors.some((a) => WIDTH_CONSTRAINED_ANCESTORS.has(a.type))) return null;
      // A sidebar pane is already narrow.
      if (ctx.ancestors.some((a) => a.slot === 'sidebar')) return null;
      return report(node, ctx,
        'Text content at desktop width has no AdwClamp ancestor — long lines get hard to read');
    },
  },
];
