import React, { useState, useRef, useEffect } from "react";
import { persistDocumentSource, useMockupStore } from "../store/mockupStore";
import { importDocumentFile } from "../utils/exportImport";

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
    lintEnabled,
    toggleLint,
    showFlows,
    toggleShowFlows,
    violations,
    clearCanvas,
  } = useMockupStore();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const themeLabel =
    doc.colorScheme === "dark" ? "Light" : doc.colorScheme === "light" ? "Auto" : "Dark";

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
          label: "Export as PNG",
          action: () => window.dispatchEvent(new CustomEvent("protota:export-png")),
        },
        {
          label: "Export Blueprint (.blp)",
          action: () => window.dispatchEvent(new CustomEvent("protota:export-blueprint")),
          shortcut: "Ctrl+E",
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
          label: `HIG Lint ${lintEnabled ? `ON (${violations.length})` : "OFF"}`,
          action: toggleLint,
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

  return (
    <div ref={menuBarRef} style={{ display: "flex", gap: "2px" }}>
      {menus.map((menu) => (
        <div key={menu.label} style={{ position: "relative" }}>
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
        className={`adw-button flat${showFlows ? " active" : ""}`}
        data-active={showFlows ? "true" : undefined}
        onClick={toggleShowFlows}
        title="Show navigation flow connectors between screens"
      >
        Flows
      </button>
      <button
        className={`adw-button flat${lintEnabled ? " active" : ""}`}
        data-active={lintEnabled ? "true" : undefined}
        onClick={toggleLint}
        title={`HIG lint${violations.length ? ` — ${violations.length} issue(s)` : ""}`}
      >
        HIG Lint
      </button>
      <button
        className="adw-button flat"
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
