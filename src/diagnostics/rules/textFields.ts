/** Text field rules — docs/spec/reference/hig/text-fields.md */
import type { HigRule } from './types';
import { HIG_UPSTREAM, report } from './types';

export const textFieldRules: HigRule[] = [
  {
    id: 'HIG-W011',
    tier: 'warning',
    title: 'Text field with no placeholder or label',
    citation: {
      specPath: 'docs/spec/reference/hig/text-fields.md',
      url: `${HIG_UPSTREAM}/patterns/controls/text-fields.html`,
      excerpt: 'Text fields should have placeholder text or a label.',
    },
    appliesTo: ['entry', 'search-entry'],
    match(node, ctx) {
      if (node.placeholder) return null;
      // An adjacent label counts: any label sibling in the same container.
      const parent = ctx.ancestors[ctx.ancestors.length - 1];
      const hasSiblingLabel = (parent?.children ?? []).some(
        (sibling) => sibling.id !== node.id && sibling.type === 'label');
      if (hasSiblingLabel) return null;
      return report(node, ctx,
        `${node.type === 'search-entry' ? 'Search entry' : 'Text field'} has neither placeholder text nor an adjacent label`);
    },
  },
];
