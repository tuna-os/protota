import React, { useState, useRef, useEffect } from "react";
import { useMockupStore } from "../store/mockupStore";
import { LayersPanel } from "./LayersPanel";
import { ViewportCanvas } from "./ViewportCanvas";
import { InspectorPanel } from "./InspectorPanel";
import { AuditPanel } from "./AuditPanel";
import { ContextMenu } from "./ContextMenu";
import { PresetGallery } from "./PresetGallery";
import { CommandPalette } from "./CommandPalette";
import { AddScreenModal } from "./AddScreenModal";
import { TopBar } from "./TopBar";
import {
  sidebarShowSymbolic,
  goPreviousSymbolic,
  goNextSymbolic,
  listAddSymbolic,
  viewGridSymbolic,
  sidebarShowRightSymbolic,
} from "@gjsify/adwaita-icons/actions";
import { toDataUri } from "@gjsify/adwaita-icons/utils";

const iconStyle = (svg: string): React.CSSProperties => ({
  display: "inline-block",
  width: "16px",
  height: "16px",
  maskImage: toDataUri(svg),
  WebkitMaskImage: toDataUri(svg),
  maskSize: "contain",
  WebkitMaskSize: "contain",
  backgroundColor: "currentColor",
});

export const App: React.FC = () => {
  const {
    doc,
    undo,
    redo,
    setShowAddScreenModal,
    showAddScreenModal,
    selectedNodeId,
    deleteNode,
    moveNodeUp,
    moveNodeDown,
    selectNode,
    addChildNode,
  } = useMockupStore();

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { importDocumentFile } = await import("../utils/exportImport");
      const imported = await importDocumentFile(file);
      imported.colorScheme = imported.colorScheme || "auto";
      localStorage.setItem("protota_doc_v1", JSON.stringify(imported));
      window.location.reload();
    } catch (err) {
      alert("Failed to import: " + (err as Error).message);
    }
    e.target.value = "";
  };

  // Listen for MenuBar custom events
  useEffect(() => {
    const onToggleLayers = () => setLeftOpen((v) => !v);
    const onToggleProperties = () => setRightOpen((v) => !v);
    const onShowShortcuts = () => setShowShortcuts((v) => !v);
    window.addEventListener("protota:toggle-layers", onToggleLayers);
    window.addEventListener("protota:toggle-properties", onToggleProperties);
    window.addEventListener("protota:show-shortcuts", onShowShortcuts);
    return () => {
      window.removeEventListener("protota:toggle-layers", onToggleLayers);
      window.removeEventListener("protota:toggle-properties", onToggleProperties);
      window.removeEventListener("protota:show-shortcuts", onShowShortcuts);
    };
  }, []);

  // Global keyboard shortcuts (Penpot/Figma/Canva conventions)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      // Don't intercept when typing in inputs
      if (
        (e.target as HTMLElement)?.tagName === "INPUT" ||
        (e.target as HTMLElement)?.tagName === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;

      if (e.key === "z" && mod && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.key === "z" && mod && e.shiftKey) || (e.key === "Z" && mod)) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId) {
          e.preventDefault();
          deleteNode(selectedNodeId);
          return;
        }
      }
      if (e.key === "ArrowUp" && mod && selectedNodeId) {
        e.preventDefault();
        moveNodeUp(selectedNodeId);
        return;
      }
      if (e.key === "ArrowDown" && mod && selectedNodeId) {
        e.preventDefault();
        moveNodeDown(selectedNodeId);
        return;
      }
      if (e.key === "Escape" && showShortcuts) {
        setShowShortcuts(false);
        return;
      }
      if (e.key === "Escape" && showCommandPalette) {
        setShowCommandPalette(false);
        return;
      }
      if (e.key === "Escape") {
        selectNode(null);
        return;
      }
      // Quick-add
      if (e.key === "b" && !mod && selectedNodeId) {
        addChildNode(selectedNodeId, "button");
        return;
      }
      if (e.key === "t" && !mod && selectedNodeId) {
        addChildNode(selectedNodeId, "label");
        return;
      }
      if (e.key === "l" && !mod && selectedNodeId) {
        addChildNode(selectedNodeId, "list-box");
        return;
      }
      // Help
      if (e.key === "?" && !mod) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }
      // Panel toggles
      if (e.key === "\\" && mod) {
        e.preventDefault();
        setLeftOpen((v) => !v);
        return;
      }
      if (e.key === "]" && mod) {
        e.preventDefault();
        setRightOpen((v) => !v);
        return;
      }
      // New screen
      if (e.key === "k" && mod) {
        e.preventDefault();
        setShowCommandPalette(true);
        return;
      }
      if (e.key === "n" && mod) {
        e.preventDefault();
        setShowAddScreenModal(true);
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    undo,
    redo,
    selectedNodeId,
    deleteNode,
    moveNodeUp,
    moveNodeDown,
    selectNode,
    addChildNode,
    showShortcuts,
    showCommandPalette,
  ]);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100vh" }}
      onContextMenu={handleContextMenu}
    >
      {/* Adwaita Toolbar View — frames the entire app */}
      <adw-toolbar-view style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header Bar — combines menu + actions */}
        <adw-header-bar slot="top" title={doc.title || "Protota"}>
          {/* Start slot: Layers toggle + Menu buttons */}
          <div slot="start" style={{ display: "flex", gap: "2px", alignItems: "center" }}>
            <button
              className={`adw-button flat${leftOpen ? " active" : ""}`}
              onClick={() => setLeftOpen((v) => !v)}
              title="Toggle Layers Panel (Ctrl+\)"
              style={leftOpen ? { backgroundColor: "var(--button-active-color)" } : undefined}
            >
              <span style={iconStyle(sidebarShowSymbolic)} />
            </button>
            <TopBar />
          </div>
          {/* End slot: Core actions + Properties toggle */}
          <div slot="end" style={{ display: "flex", gap: "2px", alignItems: "center" }}>
            <button className="adw-button flat" onClick={undo} title="Undo (Ctrl+Z)">
              <span style={iconStyle(goPreviousSymbolic)} />
            </button>
            <button className="adw-button flat" onClick={redo} title="Redo (Ctrl+Shift+Z)">
              <span style={iconStyle(goNextSymbolic)} />
            </button>
            <button
              className="adw-button suggested-action"
              onClick={() => setShowAddScreenModal(true)}
              title="Add Screen (Ctrl+N)"
            >
              <span style={iconStyle(listAddSymbolic)} />
            </button>
            <button
              className="adw-button flat"
              onClick={() => setShowPresets(true)}
              title="Presets"
            >
              <span style={iconStyle(viewGridSymbolic)} />
            </button>
            <button
              className={`adw-button flat${rightOpen ? " active" : ""}`}
              onClick={() => setRightOpen((v) => !v)}
              title="Toggle Properties Panel (Ctrl+])"
              style={rightOpen ? { backgroundColor: "var(--button-active-color)" } : undefined}
            >
              <span style={iconStyle(sidebarShowRightSymbolic)} />
            </button>
          </div>
        </adw-header-bar>

        {/* Main Workspace — content slot of toolbar-view */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left Drawer (Layers) — Adwaita sidebar styling */}
          {leftOpen && (
            <aside
              className="protota-panel adw-sidebar-like"
              style={{
                width: "240px",
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <LayersPanel />
            </aside>
          )}

          {/* Center Canvas */}
          <ViewportCanvas />

          {/* Right Drawer (Inspector) — Adwaita sidebar styling */}
          {rightOpen && (
            <aside
              className="protota-panel adw-sidebar-like"
              style={{
                width: "280px",
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <InspectorPanel />
            </aside>
          )}
        </div>
      </adw-toolbar-view>

      <AuditPanel />

      <AddScreenModal isOpen={showAddScreenModal} onClose={() => setShowAddScreenModal(false)} />

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} />
      )}

      <PresetGallery isOpen={showPresets} onClose={() => setShowPresets(false)} />

      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      {/* Keyboard shortcuts help overlay */}
      {showShortcuts && (
        <div
          className="protota-modal-backdrop"
          onClick={() => setShowShortcuts(false)}
          data-testid="shortcuts-overlay"
        >
          <div
            className="protota-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "520px", maxHeight: "80vh", overflow: "auto" }}
          >
            <h3 style={{ marginTop: 0 }}>Keyboard Shortcuts</h3>
            <p style={{ fontSize: "12px", opacity: 0.65, marginBottom: "16px" }}>
              Press <kbd style={kbdStyle}>?</kbd> to toggle this overlay. Platform: Ctrl = ⌘ on
              macOS.
            </p>
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title} style={{ marginBottom: "16px" }}>
                <h4
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    opacity: 0.5,
                    margin: "0 0 6px 0",
                  }}
                >
                  {group.title}
                </h4>
                {group.items.map((item) => (
                  <div
                    key={item.keys}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "4px 0",
                      fontSize: "13px",
                      borderBottom: "1px solid var(--separator-color, rgba(0,0,6,0.06))",
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontFamily: "Adwaita Sans", fontSize: "12px", opacity: 0.7 }}>
                      {item.keys
                        .split(" ")
                        .map((k) => (
                          <kbd key={k} style={kbdStyle}>
                            {k}
                          </kbd>
                        ))
                        .reduce((prev, curr) => (
                          <>
                            {prev} {curr}
                          </>
                        ))}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mockup.json,.json"
        onChange={handleImport}
        style={{ display: "none" }}
      />
    </div>
  );
};

const kbdStyle: React.CSSProperties = {
  background: "var(--button-bg-color, rgba(0,0,6,0.08))",
  padding: "1px 6px",
  borderRadius: "4px",
  fontSize: "11px",
  border: "1px solid var(--separator-color, rgba(0,0,6,0.12))",
};

const SHORTCUT_GROUPS = [
  {
    title: "Editing",
    items: [
      { keys: "Ctrl+Z", label: "Undo" },
      { keys: "Ctrl+Shift+Z", label: "Redo" },
      { keys: "Delete", label: "Delete selected element" },
      { keys: "Ctrl+↑", label: "Move element up" },
      { keys: "Ctrl+↓", label: "Move element down" },
      { keys: "Escape", label: "Deselect" },
    ],
  },
  {
    title: "View",
    items: [
      { keys: "Ctrl+=", label: "Zoom in" },
      { keys: "Ctrl+-", label: "Zoom out" },
      { keys: "Ctrl+0", label: "Zoom to 100%" },
      { keys: "Space+Drag", label: "Pan canvas" },
    ],
  },
  {
    title: "Quick Add",
    items: [
      { keys: "B", label: "Add button" },
      { keys: "T", label: "Add label" },
      { keys: "L", label: "Add list box" },
      { keys: "Ctrl+N", label: "New screen" },
    ],
  },
  {
    title: "Interface",
    items: [
      { keys: "Ctrl+\\", label: "Toggle Layers panel" },
      { keys: "Ctrl+]", label: "Toggle Properties panel" },
      { keys: "Ctrl+.", label: "Toggle HIG lint" },
      { keys: "Ctrl+/", label: "Toggle Preview mode" },
      { keys: "?", label: "Show this help" },
    ],
  },
];
