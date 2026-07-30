import React, { useState, useRef, useEffect } from "react";
import { persistDocumentSource, useMockupStore } from "../store/mockupStore";
import { exportDocumentFile, importDocumentFile } from "../utils/exportImport";
import { mockupToBlueprint } from "../utils/blueprint";
import { downloadPng, renderScreenToPng } from "../utils/pngExport";
import { ExportModal } from "./ExportModal";

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
  const [showExportModal, setShowExportModal] = useState(false);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const themeLabel =
    doc.colorScheme === "dark" ? "Light" : doc.colorScheme === "light" ? "Auto" : "Dark";

  const handleExportPNG = async () => {
    downloadPng(await renderScreenToPng());
  };

  const handleExportBlueprint = () => {
    const xml = mockupToBlueprint(doc);
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.toLowerCase().replace(/\s+/g, "-")}.blp`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const json = JSON.stringify(doc);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const url = `${window.location.origin}${window.location.pathname}#doc=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt("Share this URL:", url);
    }
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
        { label: "divider", divider: true },
        {
          label: "Import...",
          action: () => fileInputRef.current?.click(),
          shortcut: "Ctrl+I",
        },
        { label: "Export as PNG", action: handleExportPNG },
        { label: "Export Blueprint (.blp)", action: handleExportBlueprint, shortcut: "Ctrl+E" },
        { label: "divider", divider: true },
        { label: "Share URL", action: handleShare, shortcut: "Ctrl+S" },
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
      {/* Direct-access toolbar actions. These are the working contract of
          issues #5/#8/#11/#12/#17/#24/#25 — visible buttons, not only menu
          entries. */}
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
      <button className="adw-button flat" onClick={toggleColorScheme} title={`Switch theme (${themeLabel})`}>
        Theme
      </button>
      <button className="adw-button flat" onClick={handleShare} title="Copy a shareable link">
        Share
      </button>
      <button className="adw-button flat" onClick={() => exportDocumentFile(doc)} title="Download the document as .mockup.json">
        Save JSON
      </button>
      <button className="adw-button flat" onClick={() => setShowExportModal(true)} title="View generated Blueprint code">
        Code Export
      </button>
      <button className="adw-button flat" onClick={handleExportPNG} title="Export the focused screen as PNG">
        PNG
      </button>
      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
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
