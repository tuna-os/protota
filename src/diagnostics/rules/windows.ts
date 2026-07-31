/** Window sizing rules — docs/spec/reference/hig/adaptive.md */
import type { HigRule } from './types';
import { HIG_UPSTREAM, report } from './types';

export const windowRules: HigRule[] = [
  {
    id: 'HIG-E001',
    tier: 'error',
    title: 'Window narrower than supported minimum',
    citation: {
      specPath: 'docs/spec/reference/hig/adaptive.md',
      url: `${HIG_UPSTREAM}/guidelines/adaptive.html`,
      excerpt: 'Apps that are appropriate for a phone form factor should scale down to 360×294px; the anti-pattern checklist records "width-request: 360" as the supported minimum.',
    },
    appliesTo: ['window'],
    match(node, ctx) {
      if (ctx.screen.rootNode.id !== node.id) return null;
      if (ctx.screen.width >= 360) return null;
      return report(node, ctx,
        `Window width ${ctx.screen.width}px < 360px minimum (HIG)`,
        { kind: 'set-screen-props', screenId: ctx.screen.id, props: { width: 360 }, label: 'Set width to 360px' });
    },
  },
];
