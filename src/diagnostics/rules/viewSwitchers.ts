/** View switcher rules — docs/spec/reference/hig/view-switchers.md */
import type { HigRule } from './types';
import { findInSubtree, HIG_UPSTREAM, report } from './types';

export const viewSwitcherRules: HigRule[] = [
  {
    id: 'HIG-W004',
    tier: 'warning',
    title: 'View switcher with too many or too few views',
    citation: {
      specPath: 'docs/spec/reference/hig/view-switchers.md',
      url: `${HIG_UPSTREAM}/patterns/nav/view-switchers.html`,
      excerpt: 'As a rule of thumb, a view switcher should contain between three and five views.',
    },
    appliesTo: ['view-stack'],
    match(node, ctx) {
      const pageCount = (node.children ?? []).length;
      if (pageCount > 5) {
        return report(node, ctx,
          `ViewSwitcher has ${pageCount} pages (HIG recommends 3–5) — reduce, or use AdwTabView`);
      }
      if (pageCount < 3) {
        // Only meaningful when a switcher actually presents the stack.
        const root = ctx.screen.rootNode;
        const hasSwitcher = root.type === 'view-switcher' ||
          !!findInSubtree(root, (n) => n.type === 'view-switcher');
        if (!hasSwitcher) return null;
        return report(node, ctx,
          `ViewSwitcher has only ${pageCount} page${pageCount === 1 ? '' : 's'} (HIG recommends 3–5) — with so few views, consider another navigation pattern`);
      }
      return null;
    },
  },
];
