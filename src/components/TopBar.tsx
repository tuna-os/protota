import React, { useState, useRef, useEffect } from "react";
import { persistDocumentSource, useMockupStore } from "../store/mockupStore";
import { exportDocumentFile, importDocumentFile } from "../utils/exportImport";
import { filterDiagnostics } from "../diagnostics/engine";
import { openMenuSymbolic, toolsCheckSpellingSymbolic } from "@gjsify/adwaita-icons/actions";
import { iconStyle } from "../utils/iconStyles";

const hamburgerIconStyle = iconStyle(openMenuSymbolic);
// The @gjsify/adwaita-icons package does not ship diagnostics-symbolic
// (upstream development category); the design's sanctioned fallback is the
// spell-check icon (design §5.2).
const diagnosticsIconStyle = iconStyle(toolsCheckSpellingSymbolic);

interface MenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  divider?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export const TopBar: React.FC = () => {
  const {
    doc,
    undo,
    redo,
    selectedNodeId,
    deleteNode,
    selectNode,
    toggleColorScheme,
    diagnosticsEnabled,
    toggleDiagnostics,
    diagnostics,
    exportCheck,
    liveBlueprintDiagnostics,
    ignoredRules,
    ignoredInstances,
    showFlows,
    toggleShowFlows,
    clearCanvas,
    setShowAddScreenModal,
  } = useMockupStore();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const themeLabel =
    doc.colorScheme === "dark" ? "Light" : doc.colorScheme === "light" ? "Auto" : "Dark";

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importDocumentFile(file);
      imported.colorScheme = imported.colorScheme || "auto";
      persistDocumentSource(imported);
      window.location.reload();
    } catch (err) {
      alert("Failed to import: " + (err as Error).message);
    }
    e.target.value = "";
  };

  const menus: MenuGroup[] = [
    {
      label: "File",
      items: [
        {
          label: "New Project",
          action: clearCanvas,
        },
        {
          label: "Load Preset",
          action: () => window.dispatchEvent(new CustomEvent("protota:show-presets")),
        },
        { label: "divider", divider: true },
        {
          label: "Import...",
          action: () => fileInputRef.current?.click(),
          shortcut: "Ctrl+I",
        },
        {
          // Import front door (#118): folder / zip / git URL, discovery
          // in-page. Mobile inherits this entry because mobileMenus spreads
          // these groups — same wiring pattern as the Icon Library.
          label: "Import App (Folder / Zip / URL)…",
          action: () => window.dispatchEvent(new CustomEvent("protota:show-import-app")),
        },
        {
          label: "Export as PNG",
          action: () => window.dispatchEvent(new CustomEvent("protota:export-png")),
        },
        {
          label: "Export Blueprint (.blp)",
          action: () => window.dispatchEvent(new CustomEvent("protota:export-blueprint")),
          shortcut: "Ctrl+E",
        },
        {
          // Write-back UX bridge (ADR 0001 Part 3 item 1): download +
          // generated protota-writeback command, plus the File System
          // Access direct path on Chromium. Host action stays explicit (#80).
          label: "Export → Patch into Checkout…",
          action: () => window.dispatchEvent(new CustomEvent("protota:show-writeback")),
        },
        { label: "divider", divider: true },
        {
          label: "Share URL",
          action: () => window.dispatchEvent(new CustomEvent("protota:share")),
          shortcut: "Ctrl+S",
        },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", action: undo, shortcut: "Ctrl+Z" },
        { label: "Redo", action: redo, shortcut: "Ctrl+Shift+Z" },
        { label: "divider", divider: true },
        {
          label: "Delete",
          action: () => {
            if (selectedNodeId) deleteNode(selectedNodeId);
          },
          shortcut: "Del",
        },
        { label: "Deselect", action: () => selectNode(null), shortcut: "Esc" },
        { label: "divider", divider: true },
        {
          label: `Diagnostics (HIG Lint) ${diagnosticsEnabled ? `ON (${countable.length})` : "OFF"}`,
          action: handleToggleDiagnostics,
          shortcut: "Ctrl+.",
        },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: "Zoom In",
          action: () => window.dispatchEvent(new CustomEvent("protota:zoom-in")),
          shortcut: "Ctrl+=",
        },
        {
          label: "Zoom Out",
          action: () => window.dispatchEvent(new CustomEvent("protota:zoom-out")),
          shortcut: "Ctrl+-",
        },
        {
          label: "Reset Zoom",
          action: () => window.dispatchEvent(new CustomEvent("protota:zoom-reset")),
          shortcut: "Ctrl+0",
        },
        { label: "divider", divider: true },
        {
          label: `Theme: ${doc.colorScheme} → ${themeLabel}`,
          action: toggleColorScheme,
        },
        { label: "divider", divider: true },
        {
          label: `Flows ${showFlows ? "ON" : "OFF"}`,
          action: toggleShowFlows,
        },
        { label: "divider", divider: true },
        {
          // Full Adwaita symbolic icon catalog, GNOME Icon Library style.
          // Lives in View for desktop; the mobile overflow menu inherits it
          // because mobileMenus spreads these groups.
          label: "Icon Library",
          action: () => window.dispatchEvent(new CustomEvent("protota:show-icon-library")),
        },
        { label: "divider", divider: true },
        {
          label: "Show Shortcuts",
          action: () => window.dispatchEvent(new CustomEvent("protota:show-shortcuts")),
          shortcut: "?",
        },
      ],
    },
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuClick = (label: string) => {
    setOpenMenu(openMenu === label ? null : label);
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.action) {
      item.action();
    }
    setOpenMenu(null);
  };

  // On narrow (mobile) viewports the menu bar and direct-access buttons do
  // not fit, so everything collapses into a single hamburger overflow menu
  // (issue #99). The extra "Actions" group surfaces the direct-access
  // toolbar buttons plus the header-bar actions that are hidden on mobile.
  // (Load Preset lives in the spread File group, so it is not repeated here.)
  const mobileMenus: MenuGroup[] = [
    {
      label: "Actions",
      items: [
        { label: "New Screen", action: () => setShowAddScreenModal(true), shortcut: "Ctrl+N" },
        { label: "divider", divider: true },
        { label: "Save JSON", action: () => exportDocumentFile(doc) },
        {
          label: "Code Export",
          action: () => window.dispatchEvent(new CustomEvent("protota:code-export")),
        },
      ],
    },
    ...menus,
  ];

  return (
    <div ref={menuBarRef} style={{ display: "flex", gap: "2px" }}>
      {/* Mobile: compact hamburger with every action in one overflow menu */}
      <div className="protota-mobile-only" style={{ position: "relative" }}>
        <button
          className={`adw-button flat${openMenu === "mobile" ? " active" : ""}`}
          onClick={() => handleMenuClick("mobile")}
          title="Menu"
          aria-label="Main Menu"
          aria-expanded={openMenu === "mobile"}
          data-testid="mobile-menu-button"
          style={
            openMenu === "mobile"
              ? { backgroundColor: "var(--button-active-color)" }
              : undefined
          }
        >
          <span style={hamburgerIconStyle} />
        </button>
        {openMenu === "mobile" && (
          <div
            className="protota-menu-dropdown protota-mobile-menu"
            data-testid="mobile-menu"
          >
            {mobileMenus.map((menu, groupIdx) => (
              <React.Fragment key={menu.label}>
                {groupIdx > 0 && <div className="protota-menu-divider" />}
                <div className="protota-menu-section-header">{menu.label}</div>
                {menu.items.map((item, idx) =>
                  item.divider ? (
                    <div key={idx} className="protota-menu-divider" />
                  ) : (
                    <button
                      key={idx}
                      className="protota-menu-item"
                      onClick={() => handleItemClick(item)}
                    >
                      <span className="protota-menu-item-label">{item.label}</span>
                      {item.shortcut && (
                        <span className="protota-menu-item-shortcut">{item.shortcut}</span>
                      )}
                    </button>
                  ),
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
      {/* Desktop: full menu bar */}
      {menus.map((menu) => (
        <div key={menu.label} className="protota-desktop-only" style={{ position: "relative" }}>
          <button
            className={`adw-button flat${openMenu === menu.label ? " active" : ""}`}
            onClick={() => handleMenuClick(menu.label)}
            onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
            style={
              openMenu === menu.label
                ? { backgroundColor: "var(--button-active-color)" }
                : undefined
            }
          >
            {menu.label}
          </button>
          {openMenu === menu.label && (
            <div className="protota-menu-dropdown">
              {menu.items.map((item, idx) =>
                item.divider ? (
                  <div key={idx} className="protota-menu-divider" />
                ) : (
                  <button
                    key={idx}
                    className="protota-menu-item"
                    onClick={() => handleItemClick(item)}
                  >
                    <span className="protota-menu-item-label">{item.label}</span>
                    {item.shortcut && (
                      <span className="protota-menu-item-shortcut">{item.shortcut}</span>
                    )}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
      {/* Direct-access toolbar actions */}
      <button
        className={`adw-button flat protota-desktop-only${showFlows ? " active" : ""}`}
        data-active={showFlows ? "true" : undefined}
        onClick={toggleShowFlows}
        title="Show navigation flow connectors between screens"
      >
        Flows
      </button>
      <button
        className={`adw-button flat protota-desktop-only${diagnosticsEnabled ? " active" : ""}`}
        data-active={diagnosticsEnabled ? "true" : undefined}
        data-testid="diagnostics-toggle"
        onClick={handleToggleDiagnostics}
        aria-label="Diagnostics — HIG lint"
        title={`Diagnostics (HIG lint)${countable.length ? ` — ${countable.length} issue(s)` : ""} (Ctrl+.)`}
        style={{ display: "flex", alignItems: "center", gap: "4px" }}
      >
        <span style={diagnosticsIconStyle} />
        Diagnostics
        {diagnosticsEnabled && countable.length > 0 && (
          <span
            data-testid="diagnostics-badge"
            style={{
              fontSize: "10px",
              fontWeight: 700,
              minWidth: "16px",
              padding: "0 4px",
              borderRadius: "8px",
              textAlign: "center",
              color: "#fff",
              background: errorCount > 0
                ? "var(--destructive-bg-color, #e01b24)"
                : "var(--dim-fg-color, rgba(0,0,6,0.55))",
            }}
          >
            {countable.length}
          </span>
        )}
      </button>
      <button
        className="adw-button flat protota-desktop-only"
        onClick={toggleColorScheme}
        title={`Switch theme (${themeLabel})`}
      >
        Theme
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".mockup.json,.json,.blp,.ui"
        onChange={handleImport}
        style={{ display: "none" }}
      />
    </div>
  );
};
