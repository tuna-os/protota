import type { AdwNode } from '../types/mockup';

/**
 * What renderer-drawn window chrome a header bar carries.
 *
 * Libadwaita semantics (AdwHeaderBar):
 * - `show-start-title-buttons` / `show-end-title-buttons` (default true)
 *   control whether the platform window controls are drawn on each side.
 *   With GNOME's default decoration layout every control — minimize,
 *   maximize, close — sits at the end, so a false on the end side (or on
 *   GtkHeaderBar's single `show-title-buttons`) removes them all.
 * - Inside an Adw.Dialog (and its Preferences/Alert/About subclasses) a
 *   header bar never shows minimize/maximize; it shows only a close button,
 *   and only while end title buttons are enabled. The Files compress dialog
 *   disables them, so its header shows no controls at all.
 */
export type HeaderBarControls = 'window' | 'close' | 'none';

export function headerBarControls(
  node: AdwNode,
  context: { inDialog: boolean; isPrimary: boolean },
): HeaderBarControls {
  if (node.type !== 'header-bar' || !context.isPrimary) return 'none';
  const endButtons = node.showTitleButtons !== false && node.showEndTitleButtons !== false;
  if (!endButtons) return 'none';
  return context.inDialog ? 'close' : 'window';
}

/**
 * AdwHeaderBar with no title-widget falls back to the enclosing window's or
 * dialog's title, centered. Applies only when the bar declares no title of
 * its own and carries no window-title child; never invents a title.
 */
export function headerBarFallbackTitle(
  node: AdwNode,
  surfaceTitle: string | undefined,
): string | undefined {
  if (node.type !== 'header-bar' || node.title || !surfaceTitle) return undefined;
  const hasTitleWidget = node.children?.some(
    (child) => child.type === 'window-title' && child.visible !== false,
  );
  return hasTitleWidget ? undefined : surfaceTitle;
}
