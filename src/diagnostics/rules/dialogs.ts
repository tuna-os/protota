/** Dialog rules — docs/spec/reference/hig/dialogs.md */
import type { HigRule } from './types';
import { hasAncestor, HIG_UPSTREAM, report } from './types';

const DIALOGS_URL = `${HIG_UPSTREAM}/patterns/feedback/dialogs.html`;
const DIALOGS_SPEC = 'docs/spec/reference/hig/dialogs.md';

export const dialogRules: HigRule[] = [
  {
    id: 'HIG-E003',
    tier: 'error',
    title: 'Alert dialog with zero or more than three buttons',
    citation: {
      specPath: DIALOGS_SPEC,
      url: DIALOGS_URL,
      excerpt: 'Alert dialogs present a message or question, along with between one and three buttons.',
    },
    appliesTo: ['alert-dialog'],
    match(node, ctx) {
      const buttons = (node.children ?? []).filter((c) => c.type === 'button');
      if (buttons.length >= 1 && buttons.length <= 3) return null;
      return report(node, ctx,
        `Alert dialog has ${buttons.length} buttons — the HIG requires between one and three`);
    },
  },
  {
    id: 'HIG-W003',
    tier: 'warning',
    title: 'Destructive action without confirmation',
    citation: {
      specPath: DIALOGS_SPEC,
      url: DIALOGS_URL,
      excerpt: 'Destructive actions should always be accompanied by either a confirmation dialog or an offer to undo the action.',
    },
    appliesTo: ['button'],
    match(node, ctx) {
      if (!node.destructive) return null;
      if (ctx.screen.rootNode.type === 'alert-dialog' || hasAncestor(ctx, 'alert-dialog')) return null;
      return report(node, ctx,
        'Destructive button outside confirmation dialog');
    },
  },
  {
    id: 'HIG-W009',
    tier: 'warning',
    title: 'Generic affirmative dialog button',
    citation: {
      specPath: DIALOGS_SPEC,
      url: DIALOGS_URL,
      excerpt: 'Label the affirmative button with a specific imperative verb, for example: Save or Print — clearer than a generic label like OK or Done.',
    },
    appliesTo: ['button'],
    match(node, ctx) {
      if (!node.suggested || !node.title) return null;
      const inDialog = ctx.screen.rootNode.type === 'dialog' || hasAncestor(ctx, 'dialog');
      if (!inDialog) return null;
      if (!/^(ok|okay|done|yes)$/i.test(node.title.trim())) return null;
      return report(node, ctx,
        `Dialog button labelled "${node.title}" — use a specific imperative verb such as Save or Print`);
    },
  },
  {
    id: 'HIG-W010',
    tier: 'warning',
    title: 'Confirmation without a cancel option',
    citation: {
      specPath: DIALOGS_SPEC,
      url: DIALOGS_URL,
      excerpt: 'Confirmation dialogs have two buttons: one to confirm that the action should be carried out and one to cancel the action.',
    },
    appliesTo: ['alert-dialog'],
    match(node, ctx) {
      const buttons = (node.children ?? []).filter((c) => c.type === 'button');
      if (buttons.length < 2) return null;
      if (buttons.some((b) => /^cancel$/i.test((b.title ?? '').trim()))) return null;
      return report(node, ctx,
        'Alert dialog with multiple buttons has no Cancel — confirmations need a way out');
    },
  },
];
