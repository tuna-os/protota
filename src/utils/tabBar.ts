import type { AdwNode } from '../types/mockup';
import { findNodeById } from './treeHelpers';

/**
 * Adw.TabBar rendering model.
 *
 * A TabBar owns no tab content: its tabs are the pages of the Adw.TabView its
 * `view` property names. Statically, those pages are the view's declared
 * page children (`stack-page` nodes — Adw.TabPage/StackPage records with a
 * title and optional icon). Everything here derives from that source
 * structure; nothing is invented:
 *
 * - view resolves, ≥1 declared page  → tabs from the pages (first selected,
 *   GTK's default).
 * - view resolves, no declared pages → no tabs. Real apps (Files, Text
 *   Editor) populate the view at runtime, which is #58 probe territory; the
 *   strip's runtime allocation may be pinned by a finishing `heightRequest`,
 *   in which case the bar chrome renders at that height with no tab labels.
 * - no view resolves → a single labelled placeholder tab, so an editor user
 *   who drops a TabBar sees the widget they added.
 *
 * `hidden` mirrors Adw.TabBar `autohide` (default true): the bar disappears
 * when the view has fewer than two tabs, unless a finishing file recorded a
 * runtime allocation for it.
 */
export interface TabBarTab {
  id: string;
  title: string;
  iconName?: string;
}

export interface TabBarModel {
  tabs: TabBarTab[];
  /** Whether `view` named an Adw.TabView present in this screen. */
  viewResolved: boolean;
  /** Adw.TabBar autohide: render nothing at all. */
  hidden: boolean;
}

export function tabBarModel(node: AdwNode, screenRoot: AdwNode | undefined): TabBarModel {
  const viewId = typeof node.view === 'string' ? node.view : '';
  const view = viewId && screenRoot ? findNodeById([screenRoot], viewId) : null;
  const viewResolved = !!view && view.type === 'tab-view';

  const tabs: TabBarTab[] = viewResolved
    ? (view!.children ?? [])
        .filter((child) => child.type === 'stack-page' && child.visible !== false)
        .map((page) => ({
          id: page.id,
          title: typeof page.title === 'string' && page.title ? page.title : 'Untitled',
          iconName: typeof page.iconName === 'string' && page.iconName ? page.iconName : undefined,
        }))
    : [{
        id: `${node.id}-placeholder`,
        title: typeof node.title === 'string' && node.title ? node.title : 'Tab',
      }];

  const hidden = viewResolved && node.autohide !== false && tabs.length < 2 &&
    node.heightRequest === undefined;
  return { tabs, viewResolved, hidden };
}
