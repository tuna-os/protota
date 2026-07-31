/** Writing style rules — docs/spec/reference/hig/writing-style.md */
import type { AdwNodeType } from '../../types/mockup';
import type { HigRule, RuleMatch } from './types';
import { HIG_UPSTREAM, report } from './types';

const WS_URL = `${HIG_UPSTREAM}/guidelines/writing-style.html`;
const WS_SPEC = 'docs/spec/reference/hig/writing-style.md';

/** Widgets whose `title` is a short control label, styled in Header Case. */
const TITLE_TEXT_WIDGETS: AdwNodeType[] = [
  'button', 'action-row', 'switch-row', 'combo-row', 'spin-row',
  'button-row', 'preferences-group', 'tab-view',
];

/** Widgets whose `title` is a heading/label rather than body copy. */
const NON_BODY_TITLE_WIDGETS: AdwNodeType[] = [
  ...TITLE_TEXT_WIDGETS, 'window-title', 'status-page', 'expander-row',
];

function headerCase(text: string): string {
  return text.split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

export const writingStyleRules: HigRule[] = [
  {
    id: 'HIG-S001',
    tier: 'suggestion',
    title: 'Header Capitalization for control titles',
    citation: {
      specPath: WS_SPEC,
      url: WS_URL,
      excerpt: 'Header capitalization should be used for any headings, including headings in header bars, tab titles, and view titles — and for short control labels.',
    },
    appliesTo: TITLE_TEXT_WIDGETS,
    match(node, ctx) {
      const title = node.title;
      if (!title || title.length <= 3 || title.includes('…')) return null;
      const words = title.split(/\s+/);
      const hasLowerCase = words.some(
        (w) => w.length > 1 && w[0] === w[0].toLowerCase() && w[0] !== w[0].toUpperCase());
      if (!hasLowerCase) return null;
      return report(node, ctx,
        `"${title}" should use Header Case for a ${node.type} title — e.g. "${headerCase(title)}"`);
    },
  },
  {
    id: 'HIG-S002',
    tier: 'suggestion',
    title: 'Use the ellipsis character, not three periods',
    citation: {
      specPath: WS_SPEC,
      url: WS_URL,
      excerpt: 'Use an ellipsis (…) at the end of a label if further input or confirmation is required — the single character, as in "Save As…".',
    },
    appliesTo: 'any',
    match(node, ctx) {
      const fields = ['title', 'subtitle', 'description', 'placeholder'] as const;
      const matches: RuleMatch[] = [];
      for (const field of fields) {
        const value = node[field];
        if (typeof value === 'string' && value.includes('...')) {
          matches.push(...report(node, ctx,
            `"..." should be "…" (ellipsis character) in ${node.type} ${field}`,
            { kind: 'set-props', nodeId: node.id, props: { [field]: value.replace(/\.\.\./g, '…') }, label: 'Replace with …' }));
        }
      }
      return matches.length ? matches : null;
    },
  },
  {
    id: 'HIG-S003',
    tier: 'suggestion',
    title: 'No trailing period on labels and headings',
    citation: {
      specPath: WS_SPEC,
      url: WS_URL,
      excerpt: 'Text generally shouldn’t end with a period. This applies to headings, descriptions, and includes text that is written as a complete sentence.',
    },
    appliesTo: NON_BODY_TITLE_WIDGETS,
    match(node, ctx) {
      const title = node.title;
      if (!title || !title.endsWith('.') || title.endsWith('...')) return null;
      // Multi-sentence titles are body copy that a different widget should
      // carry; the trailing-period rule targets single labels/headings.
      if (title.slice(0, -1).includes('. ')) return null;
      return report(node, ctx,
        `"${title}" — labels and headings shouldn’t end with a period`,
        { kind: 'set-props', nodeId: node.id, props: { title: title.replace(/\.+$/, '') }, label: 'Remove trailing period' });
    },
  },
  {
    id: 'HIG-S004',
    tier: 'suggestion',
    title: 'No ellipsis on Preferences/Properties',
    citation: {
      specPath: WS_SPEC,
      url: WS_URL,
      excerpt: 'Do not add an ellipsis to labels such as Properties or Preferences.',
    },
    appliesTo: 'any',
    match(node, ctx) {
      const title = node.title;
      if (!title) return null;
      const match = title.match(/^(Preferences|Properties)(…|\.\.\.)$/);
      if (!match) return null;
      return report(node, ctx,
        `"${title}" — do not add an ellipsis to labels such as Properties or Preferences`,
        { kind: 'set-props', nodeId: node.id, props: { title: match[1] }, label: `Rename to "${match[1]}"` });
    },
  },
];
