/** Menu rules — docs/spec/reference/hig/menus.md */
import type { AdwNode } from '../../types/mockup';
import type { HigRule, RuleContext } from './types';
import { collectInSubtree, hasAncestor, HIG_UPSTREAM, report } from './types';

const MENUS_URL = `${HIG_UPSTREAM}/patterns/controls/menus.html`;
const MENUS_SPEC = 'docs/spec/reference/hig/menus.md';

/** Node types that read as activatable menu items inside a popover menu. */
const MENU_ITEM_TYPES = new Set<AdwNode['type']>([
  'button', 'button-row', 'action-row', 'list-box-row', 'check-button', 'toggle',
]);

/**
 * Whether this popover is the widget's own menu surface (a MenuButton's
 * popover slot) rather than a nested submenu. The direct popover of a
 * menu-button/split-button/entry is legitimate structure.
 */
function isOwnPopover(node: AdwNode, ctx: RuleContext): boolean {
  if (node.type !== 'popover') return false;
  const parent = ctx.ancestors[ctx.ancestors.length - 1];
  return !!parent && ['menu-button', 'split-button', 'search-entry', 'entry'].includes(parent.type);
}

export const menuRules: HigRule[] = [
  {
    id: 'HIG-E004',
    tier: 'error',
    title: 'Nested submenu',
    citation: {
      specPath: MENUS_SPEC,
      url: MENUS_URL,
      excerpt: 'Don’t nest submenus, since nesting can be difficult to use ergonomically, as well as being hard to navigate.',
    },
    appliesTo: ['menu-button', 'popover'],
    match(node, ctx) {
      const inMenuContext = hasAncestor(ctx, 'menu-button', 'popover');
      if (!inMenuContext) return null;
      // A menu-button's own popover is its menu, not a submenu.
      if (isOwnPopover(node, ctx)) return null;
      return report(node, ctx,
        `Nested ${node.type} inside a menu — don’t nest submenus`);
    },
  },
  {
    id: 'HIG-W008',
    tier: 'warning',
    title: 'Menu size out of range',
    citation: {
      specPath: MENUS_SPEC,
      url: MENUS_URL,
      excerpt: 'Menus should contain between three and twelve items, and submenus should contain between three and six items.',
    },
    appliesTo: ['menu-button'],
    match(node, ctx) {
      const items = collectInSubtree(node, (n) => MENU_ITEM_TYPES.has(n.type));
      // An empty menu is a mockup that has not modelled its menu content yet
      // — reporting it would make the linter cry wolf (design §3.4).
      if (items.length === 0) return null;
      if (items.length >= 3 && items.length <= 12) return null;
      return report(node, ctx,
        `Menu has ${items.length} item${items.length === 1 ? '' : 's'} — the HIG recommends between three and twelve`);
    },
  },
  {
    id: 'HIG-W013',
    tier: 'warning',
    title: 'Quit/Close in a primary menu',
    citation: {
      specPath: MENUS_SPEC,
      url: MENUS_URL,
      excerpt: 'Primary menus shouldn’t include menu items for Close or Quit.',
    },
    appliesTo: ['menu-button'],
    match(node, ctx) {
      if (!hasAncestor(ctx, 'header-bar')) return null;
      const offender = collectInSubtree(node,
        (n) => MENU_ITEM_TYPES.has(n.type) && /^(quit|close)$/i.test((n.title ?? '').trim()))[0];
      if (!offender) return null;
      return report(node, ctx,
        `Primary menu contains "${offender.title}" — windows are closed from the window controls, not the menu`);
    },
  },
  {
    id: 'HIG-S006',
    tier: 'suggestion',
    title: 'Primary menu button icon',
    citation: {
      specPath: MENUS_SPEC,
      url: MENUS_URL,
      excerpt: 'The button for primary menus should use the open-menu-symbolic icon.',
    },
    appliesTo: ['menu-button'],
    match(node, ctx) {
      if (!hasAncestor(ctx, 'header-bar')) return null;
      if (node.title || !node.iconName) return null;
      // view-more-symbolic marks a secondary menu, which is fine.
      if (node.iconName === 'open-menu-symbolic' || node.iconName === 'view-more-symbolic') return null;
      return report(node, ctx,
        `Header-bar menu button uses "${node.iconName}" — primary menus should use open-menu-symbolic`,
        { kind: 'set-props', nodeId: node.id, props: { iconName: 'open-menu-symbolic' }, label: 'Use open-menu-symbolic' });
    },
  },
];
