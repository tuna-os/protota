/** Header bar rules — docs/spec/reference/hig/header-bars.md */
import type { AdwNode } from '../../types/mockup';
import type { HigRule } from './types';
import { HIG_UPSTREAM, report } from './types';

const HB_URL = `${HIG_UPSTREAM}/patterns/containers/header-bars.html`;
const HB_SPEC = 'docs/spec/reference/hig/header-bars.md';

/** Types that occupy the header bar's center, not a control slot. */
const CENTER_TYPES = new Set<AdwNode['type']>([
  'window-title', 'view-switcher', 'search-entry', 'entry', 'combo-row', 'toggle-group',
]);

/**
 * Controls per side, mirroring the renderer's slot heuristic
 * (AdwaitaRenderer childSlot): explicit slots win; otherwise children split
 * around the first center-type child, defaulting menu buttons to the end.
 */
export function headerBarSideCounts(headerBar: AdwNode): { start: number; end: number } {
  const children = headerBar.children ?? [];
  const centerIndex = children.findIndex((c) => !c.slot && CENTER_TYPES.has(c.type));
  let start = 0;
  let end = 0;
  children.forEach((child, index) => {
    if (CENTER_TYPES.has(child.type)) return;
    const slot = child.slot ?? (
      centerIndex !== -1
        ? (index < centerIndex ? 'start' : 'end')
        : (child.type === 'menu-button' ? 'end' : 'start')
    );
    if (slot === 'title' || slot === 'center') return;
    if (slot === 'end') end += 1;
    else start += 1;
  });
  return { start, end };
}

export const headerBarRules: HigRule[] = [
  {
    id: 'HIG-W002',
    tier: 'warning',
    title: 'Header bar without a title widget',
    citation: {
      specPath: HB_SPEC,
      url: HB_URL,
      excerpt: 'A window heading, which is placed in the center of the header bar; the anti-pattern list records "title text directly in header bar → use AdwWindowTitle".',
    },
    appliesTo: ['header-bar'],
    match(node, ctx) {
      const hasTitle = (node.children ?? []).some(
        (c) => c.type === 'window-title' || c.type === 'view-switcher');
      if (hasTitle) return null;
      return report(node, ctx,
        'Header bar has no AdwWindowTitle or ViewSwitcher',
        { kind: 'add-child', parentId: node.id, childType: 'window-title', label: 'Add a window title' });
    },
  },
  {
    id: 'HIG-W014',
    tier: 'warning',
    title: 'Crowded header bar',
    citation: {
      specPath: HB_SPEC,
      url: HB_URL,
      excerpt: 'Header bars should only contain a small number of controls; always ensure that there is some blank space so the window can be dragged.',
    },
    appliesTo: ['header-bar'],
    match(node, ctx) {
      const { start, end } = headerBarSideCounts(node);
      const limit = 6;
      if (start <= limit && end <= limit) return null;
      const side = start > limit ? 'start' : 'end';
      const count = Math.max(start, end);
      return report(node, ctx,
        `Header bar has ${count} controls on its ${side} side — keep header bars sparse so the window stays draggable`);
    },
  },
];
