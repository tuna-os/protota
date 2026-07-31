/** Button rules — docs/spec/reference/hig/buttons.md, tooltips.md */
import type { AdwNode } from '../../types/mockup';
import type { HigRule } from './types';
import { collectInSubtree, hasAncestor, HIG_UPSTREAM, report } from './types';

/** A tooltip recorded by the Blueprint importer satisfies accessibility too. */
function hasTooltip(node: AdwNode): boolean {
  const raw = node['tooltipText'] ?? node['tooltip-text'];
  return typeof raw === 'string' && raw.length > 0;
}

/** Title-case an icon name: 'open-menu-symbolic' → 'Open Menu'. */
function labelFromIcon(iconName: string): string {
  return iconName
    .replace(/-symbolic$/, '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const buttonRules: HigRule[] = [
  {
    id: 'HIG-E002',
    tier: 'error',
    title: 'Icon-only button without label or tooltip',
    citation: {
      specPath: 'docs/spec/reference/hig/tooltips.md',
      url: `${HIG_UPSTREAM}/patterns/feedback/tooltips.html`,
      excerpt: 'Controls in the header bars of primary windows should all have tooltips.',
    },
    appliesTo: ['button'],
    match(node, ctx) {
      if (!node.iconName || node.title || hasTooltip(node)) return null;
      return report(node, ctx,
        'Icon-only button missing label/tooltip — inaccessible',
        { kind: 'set-props', nodeId: node.id, props: { title: labelFromIcon(node.iconName) }, label: 'Add label from icon name' });
    },
  },
  {
    id: 'HIG-W005',
    tier: 'warning',
    title: 'More than one suggested/destructive button per view',
    citation: {
      specPath: 'docs/spec/reference/hig/buttons.md',
      url: `${HIG_UPSTREAM}/patterns/controls/buttons.html`,
      excerpt: 'Each view should only ever include a single button using either the suggested or destructive styles.',
    },
    appliesTo: ['button'],
    match(node, ctx) {
      if (!node.suggested && !node.destructive) return null;
      const styled = collectInSubtree(ctx.screen.rootNode,
        (n) => n.type === 'button' && (n.suggested === true || n.destructive === true));
      const isRootStyled = ctx.screen.rootNode.type === 'button' &&
        (ctx.screen.rootNode.suggested || ctx.screen.rootNode.destructive);
      const total = styled.length + (isRootStyled ? 1 : 0);
      if (total <= 1) return null;
      // Anchor every styled button after the first, so the card points at
      // the extras rather than blaming the legitimate one.
      if (styled.length > 0 && styled[0].id === node.id && !isRootStyled) return null;
      return report(node, ctx,
        `${total} suggested/destructive buttons in one view — keep a single accented action`);
    },
  },
  {
    id: 'HIG-W006',
    tier: 'warning',
    title: 'Wrong button style in a primary window header bar',
    citation: {
      specPath: 'docs/spec/reference/hig/header-bars.md',
      url: `${HIG_UPSTREAM}/patterns/containers/header-bars.html`,
      excerpt: 'Text buttons, suggested/destructive styles: these button types should generally be avoided for primary window header bars.',
    },
    appliesTo: ['button'],
    match(node, ctx) {
      // Dialog header bars legitimately carry text/suggested buttons
      // (e.g. Cancel/Save); the guideline is about primary windows.
      if (ctx.screen.rootNode.type !== 'window') return null;
      if (!hasAncestor(ctx, 'header-bar')) return null;
      const textOnly = !!node.title && !node.iconName;
      if (!textOnly && !node.suggested && !node.destructive) return null;
      const why = node.suggested ? 'suggested-style' : node.destructive ? 'destructive-style' : 'text-only';
      return report(node, ctx,
        `${why} button in a primary window header bar — prefer icon buttons`);
    },
  },
  {
    id: 'HIG-W007',
    tier: 'warning',
    title: 'Content button with both icon and label',
    citation: {
      specPath: 'docs/spec/reference/hig/buttons.md',
      url: `${HIG_UPSTREAM}/patterns/controls/buttons.html`,
      excerpt: 'Outside of header bars, buttons should contain either an icon or a label, and not both.',
    },
    appliesTo: ['button'],
    match(node, ctx) {
      if (!node.iconName || !node.title) return null;
      if (hasAncestor(ctx, 'header-bar')) return null;
      return report(node, ctx,
        `Button "${node.title}" has both an icon and a label — use one or the other outside header bars`);
    },
  },
];
