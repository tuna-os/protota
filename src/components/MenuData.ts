import { useMockupStore } from "../store/mockupStore";
import { filterDiagnostics } from "../diagnostics/engine";

export interface MenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  divider?: boolean;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

/**
 * The hidden file input the menus' "Import…" item clicks. App.tsx mounts it
 * (it owns the import input) — one import front door for desktop and mobile
 * (#118).
 */
export const IMPORT_FILE_INPUT_ID = "protota-file-input";

/**
 * Shared menu data (renamed from topBarMenuData.ts). The desktop File/Edit/View
 * menu bar is gone: "Open" and "Export" are labelled <adw-menu-button>s built
 * by Header.tsx from their own item lists. This module keeps what the header
 * and the app-menu button (AppMenuButton) still share: the hamburger's items,
 * the mobile overflow groups, and the diagnostics counts behind the header's
 * badge. Open/Export render on every viewport, so they are not spread into
 * mobileMenus — the hamburger integration was dropped.
 */
export function useMenus() {
  const {
    diagnosticsEnabled,
    toggleDiagnostics,
    diagnostics,
    exportCheck,
    liveBlueprintDiagnostics,
    ignoredRules,
    ignoredInstances,
    setShowAddScreenModal,
  } = useMockupStore();

  // Badge counts ignore dismissed diagnostics but not the panel's tier chips,
  // so the number on the toggle always matches "what would I see with all
  // tiers on". Destructive red when any error remains (design §5.3).
  const countable = filterDiagnostics(
    [...diagnostics, ...exportCheck, ...liveBlueprintDiagnostics],
    { error: true, warning: true, suggestion: true },
    ignoredRules,
    ignoredInstances,
  );
  const errorCount = countable.filter((d) => d.tier === "error").length;

  const handleToggleDiagnostics = () => {
    if (!diagnosticsEnabled) {
      // Opening the report belongs with turning it on (design §5.3).
      window.dispatchEvent(new CustomEvent("protota:show-diagnostics"));
    }
    toggleDiagnostics();
  };

  // App-menu entries (the hamburger's own items, desktop): full Adwaita
  // symbolic icon catalog + keyboard shortcuts. Icon Library and Show
  // Shortcuts were dropped from the menu bar with the Edit/View groups — the
  // app-menu button covers them on every viewport.
  const iconLibraryItem: MenuItem = {
    label: "Icon Library",
    action: () => window.dispatchEvent(new CustomEvent("protota:show-icon-library")),
  };
  const showShortcutsItem: MenuItem = {
    label: "Show Shortcuts",
    action: () => window.dispatchEvent(new CustomEvent("protota:show-shortcuts")),
    shortcut: "?",
  };
  const appMenuItems: MenuItem[] = [iconLibraryItem, showShortcutsItem];

  // Mobile overflow: the header keeps Layers/Undo/Redo + Open + Export on
  // every viewport, so the hamburger only needs the mobile-only Actions entry
  // plus the app-menu items. The trailing divider separates the group from
  // the flat app-menu entries (AppMenuButton skips empty-label group headers).
  const mobileMenus: MenuGroup[] = [
    {
      label: "Actions",
      items: [
        { label: "New Screen", action: () => setShowAddScreenModal(true), shortcut: "Ctrl+N" },
        { label: "divider", divider: true },
      ],
    },
    { label: "", items: appMenuItems },
  ];

  return { mobileMenus, appMenuItems, countable, errorCount, handleToggleDiagnostics };
}
