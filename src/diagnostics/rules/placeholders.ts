/** Placeholder page rules — docs/spec/reference/hig/placeholders.md */
import type { HigRule } from './types';
import { HIG_UPSTREAM, report } from './types';

export const placeholderRules: HigRule[] = [
  {
    id: 'HIG-W012',
    tier: 'warning',
    title: 'Empty status page',
    citation: {
      specPath: 'docs/spec/reference/hig/placeholders.md',
      url: `${HIG_UPSTREAM}/patterns/feedback/placeholders.html`,
      excerpt: 'Placeholder pages fill a view with an image, a heading, and an optional line of descriptive text.',
    },
    appliesTo: ['status-page'],
    match(node, ctx) {
      const missing: string[] = [];
      if (!node.iconName) missing.push('an icon');
      if (!node.title) missing.push('a title');
      if (missing.length === 0) return null;
      return report(node, ctx,
        `Status page is missing ${missing.join(' and ')} — placeholders need an image and a heading`);
    },
  },
];
