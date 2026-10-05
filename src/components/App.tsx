import React, { useState, useRef, useEffect, useCallback } from "react";
import { isStarterDocument, persistDocumentSource, useMockupStore } from "../store/mockupStore";
import { LayersPanel } from "./LayersPanel";
import { WidgetPalette } from "./WidgetPalette";
import { ViewportCanvas } from "./ViewportCanvas";
import { InspectorPanel } from "./InspectorPanel";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { ContextMenu } from "./ContextMenu";
import { PresetGallery } from "./PresetGallery";
import { IconLibrary } from "./IconLibrary";
import { ImportAppDialog } from "./ImportAppDialog";
import { ExportWritebackDialog } from "./ExportWritebackDialog";
import { CommandPalette } from "./CommandPalette";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { AddScreenModal } from "./AddScreenModal";
import { ExportModal } from "./ExportModal";
import { Header } from "./Header";
import { IMPORT_FILE_INPUT_ID } from "./MenuData";
import { setAdwaitaColorScheme } from "@gjsify/adwaita-core";
import { useIsMobile } from "../hooks/useIsMobile";
import { downloadPng, renderScreenToPng } from "../utils/pngExport";
import { mockupToBlueprint } from "../utils/blueprint";
import { settleRender } from "../utils/settle";
import { findNodeById } from "../utils/treeHelpers";

/** Single share implementation (tests/sharing.spec.ts): base64 of the UTF-8
 * document JSON in the URL hash. TextEncoder replaces the deprecated
 * `unescape` spelling while producing byte-identical URLs. */
const shareDocument = async () => {
  const { doc } = useMockupStore.getState();
  const json = JSON.stringify(doc);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary);
  const url = `${window.location.origin}${window.location.pathname}#doc=${encoded}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    prompt("Share this URL:", url);
  }
};

const exportPng = async () => {
  downloadPng(await renderScreenToPng());
};

const exportBlueprint = () => {
  const { doc, runExportCheck } = useMockupStore.getState();
  // Round-trip fidelity check (BLP-E001, design flow D): export proceeds,
  // but anything the importer cannot faithfully read back gets a card.
  runExportCheck();
  const xml = mockupToBlueprint(doc);
  // Blueprint is plain text, not XML.
  const blob = new Blob([xml], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.title.toLowerCase().replace(/\s+/g, "-")}.blp`;
  a.click();
  URL.revokeObjectURL(url);
};

export const App: React.FC = () => {
  const {
    doc,
    undo,
    redo,
    setShowAddScreenModal,
    showAddScreenModal,
    selectedNodeId,
    selectedNodeIds,
    deleteNode,
    deleteSelectedNodes,
    moveNodeUp,
    moveNodeDown,
    selectNode,
    selectNodes,
    addChildNode,
    selectedScreenId,
    copyNodes,
    cutNodes,
    pasteNodes,
    duplicateNodes,
    toggleDiagnostics,
    toggleShowFlows,
    diagnosticsEnabled,
  } = useMockupStore();

  // Panel defaults: both drawers start closed on mobile viewports, on a
  // blank canvas, and on first start while the pristine starter template is
  // shown. A real document — imported, opened, or the user's own edited work
  // restored from persistence — opens both on desktop.
  const panelsOpenAtStart = () => {
    if (typeof window === "undefined") return true;
    if (window.innerWidth < 768) return false;
    const state = useMockupStore.getState();
    return state.doc.screens.length > 0 && !isStarterDocument(state.doc);
  };
  const [leftOpen, setLeftOpen] = useState(panelsOpenAtStart);
  const [rightOpen, setRightOpen] = useState(panelsOpenAtStart);
  /** Two-tab right drawer: Properties (inspector) | Diagnostics (design §5.1). */
  const [rightTab, setRightTab] = useState<"properties" | "diagnostics">("properties");
  /** Two-tab left drawer: Layers (tree) | Widgets (draggable palette, #79). */
  const [leftTab, setLeftTab] = useState<"layers" | "widgets">("layers");
  const isMobile = useIsMobile();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showIconLibrary, setShowIconLibrary] = useState(false);
  const [showImportApp, setShowImportApp] = useState(false);
  const [showWriteback, setShowWriteback] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; kind: "node" | "screen" | "canvas";
  } | null>(null);
  /** Row the context menu asked to rename, handed to the Layers panel. */
  const [renameRequest, setRenameRequest] = useState<{ id: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // LayersPanel clears the request from an effect, so this identity must hold.
  const clearRenameRequest = useCallback(() => setRenameRequest(null), []);

  // Rename edits a row in place, so the panel has to be on screen — the canvas
  // menu can ask for one while the drawer is closed or on the Widgets tab.
  const handleRename = (id: string) => {
    const screen = doc.screens.find((candidate) => candidate.id === id);
    const node = screen ? null : findNodeById(doc.screens.map((candidate) => candidate.rootNode), id);
    if (!screen && !node) return;
    setLeftOpen(true);
    setLeftTab("layers");
    setRenameRequest({ id, title: screen?.title ?? node?.title ?? "" });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Canvas and Layers own the editor's menu; header, preview chrome and the
    // zoom bar keep the browser's native one.
    const inCanvas = !!target.closest?.(".protota-canvas");
    const inLayers = !!target.closest?.(".protota-layers");
    if (!inCanvas && !inLayers) return;
    if (inCanvas && target.closest(".protota-preview-overlay, .protota-zoom-bar, .protota-resize-handle, .protota-screen-delete-notice, .protota-add-affordance")) return;
    e.preventDefault();
    // Right-click selects what it lands on, so the menu acts on the target.
    const store = useMockupStore.getState();
    let kind: "node" | "screen" | "canvas";
    if (inLayers) {
      // Rows carry their own ids. Branching also keeps the shared
      // `.protota-screen-label` from crossing the two surfaces.
      const nodeId = target.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null;
      const screenId = target.closest("[data-screen-id]")?.getAttribute("data-screen-id") ?? null;
      if (nodeId) {
        // A multi-selection member keeps the whole selection (#79).
        const ids = store.selectedNodeIds.includes(nodeId) ? store.selectedNodeIds : [nodeId];
        store.selectNodes(ids, screenId ?? undefined);
        kind = "node";
      } else if (screenId) {
        store.selectScreen(screenId);
        kind = "screen";
      } else {
        store.selectNode(null);
        kind = "canvas";
      }
    } else {
      const nodeEl = target.closest("[data-node-id]");
      const labelEl = target.closest(".protota-screen-label");
      const screenEl = target.closest("[data-protota-flow-screen]");
      const screenId = screenEl?.getAttribute("data-protota-flow-screen") ?? null;
      if (nodeEl) {
        store.selectNode(nodeEl.getAttribute("data-node-id"), screenId ?? undefined);
        kind = "node";
      } else if (labelEl) {
        store.selectScreen(screenId);
        kind = "screen";
      } else {
        store.selectNode(null);
        kind = "canvas";
      }
    }
    // Right-click dismisses an open menu rather than re-anchoring it.
    setContextMenu((prev) => (prev ? null : { x: e.clientX, y: e.clientY, kind }));
  };

  // Capture so a child's stopPropagation cannot strand the menu open; on click,
  // not pointerdown, so the click still reaches the canvas and selects.
  const handleAppClick = (e: React.MouseEvent) => {
    if (!contextMenu) return;
    if ((e.target as HTMLElement).closest?.(".protota-context-menu")) return;
    setContextMenu(null);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { importDocumentFile } = await import("../utils/exportImport");
      const imported = await importDocumentFile(file);
      imported.colorScheme = imported.colorScheme || "auto";
      persistDocumentSource(imported);
      window.location.reload();
    } catch (err) {
      alert("Failed to import: " + (err as Error).message);
    }
    e.target.value = "";
  };

  // Publish a readiness flag once rendering has settled (utils/settle.ts) so
  // automation — screenshot tests, the capture tooling, anything driving the
  // editor — can wait for a settled frame instead of guessing with a timeout.
  useEffect(() => {
    let cancelled = false;
    const root = document.documentElement;
    delete root.dataset.prototaReady;
    void settleRender().then(() => {
      if (!cancelled) root.dataset.prototaReady = "true";
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  // Manual theme selection (desktop cycle button, mobile 3-circle switcher)
  // applies to the app chrome AND the mockup: adwaita-web's skin re-scopes
  // its variable palettes at :root.theme-light/:root.theme-dark, and the
  // core color-scheme machine is told the effective scheme ('auto' resolves
  // to the system preference app-side; the core state is binary light|dark).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    if (doc.colorScheme === "light") root.classList.add("theme-light");
    else if (doc.colorScheme === "dark") root.classList.add("theme-dark");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setAdwaitaColorScheme(
      doc.colorScheme === "auto" ? (prefersDark ? "dark" : "light") : doc.colorScheme,
    );
  }, [doc.colorScheme]);

  // Auto-close panels when the viewport transitions to mobile. Returning to
  // a desktop viewport reopens them — unless the canvas is blank or the
  // pristine starter template is up (the first-start case above). Runs only
  // on viewport transitions, never on document edits.
  const wasMobileRef = useRef(isMobile);
  useEffect(() => {
    const wasMobile = wasMobileRef.current;
    wasMobileRef.current = isMobile;
    if (isMobile) {
      setLeftOpen(false);
      setRightOpen(false);
    } else if (wasMobile) {
      const state = useMockupStore.getState();
      if (state.doc.screens.length > 0 && !isStarterDocument(state.doc)) {
        setLeftOpen(true);
        setRightOpen(true);
      }
    }
  }, [isMobile]);

  // Blank canvas (New Project, or every screen deleted): close both drawers
  // so the empty state owns the viewport. They reopen when the first screen
  // arrives — same starter-template exception as the viewport rule.
  const screenCount = doc.screens.length;
  const prevScreenCountRef = useRef(screenCount);
  useEffect(() => {
    const prevCount = prevScreenCountRef.current;
    prevScreenCountRef.current = screenCount;
    if (prevCount === screenCount) return;
    if (screenCount === 0) {
      setLeftOpen(false);
      setRightOpen(false);
    } else if (prevCount === 0 && !isMobile && !isStarterDocument(useMockupStore.getState().doc)) {
      setLeftOpen(true);
      setRightOpen(true);
    }
  }, [screenCount, isMobile]);

  useEffect(() => {
    const onToggleLayers = () => setLeftOpen((v) => !v);
    const onToggleProperties = () => setRightOpen((v) => !v);
    const onShowShortcuts = () => setShowShortcuts((v) => !v);
    const onShowPresets = () => setShowPresets(true);
    // Enabling diagnostics with the drawer closed opens it on that tab (§5.3).
    const onShowDiagnostics = () => {
      setRightOpen(true);
      setRightTab("diagnostics");
    };
    const onShowIconLibrary = () => setShowIconLibrary(true);
    const onShowImportApp = () => setShowImportApp(true);
    const onShowWriteback = () => setShowWriteback(true);
    const onNewScreen = () => useMockupStore.getState().setShowAddScreenModal(true);
    const onCodeExport = () => setShowExportModal(true);
    const onExportPng = () => void exportPng();
    const onExportBlueprint = () => exportBlueprint();
    const onShare = () => void shareDocument();
    window.addEventListener("protota:show-import-app", onShowImportApp);
    window.addEventListener("protota:show-writeback", onShowWriteback);
    window.addEventListener("protota:toggle-layers", onToggleLayers);
    window.addEventListener("protota:toggle-properties", onToggleProperties);
    window.addEventListener("protota:show-shortcuts", onShowShortcuts);
    window.addEventListener("protota:show-presets", onShowPresets);
    window.addEventListener("protota:show-diagnostics", onShowDiagnostics);
    window.addEventListener("protota:show-icon-library", onShowIconLibrary);
    window.addEventListener("protota:new-screen", onNewScreen);
    window.addEventListener("protota:code-export", onCodeExport);
    window.addEventListener("protota:export-png", onExportPng);
    window.addEventListener("protota:export-blueprint", onExportBlueprint);
    window.addEventListener("protota:share", onShare);
    return () => {
      window.removeEventListener("protota:toggle-layers", onToggleLayers);
      window.removeEventListener("protota:toggle-properties", onToggleProperties);
      window.removeEventListener("protota:show-shortcuts", onShowShortcuts);
      window.removeEventListener("protota:show-presets", onShowPresets);
      window.removeEventListener("protota:show-diagnostics", onShowDiagnostics);
      window.removeEventListener("protota:show-icon-library", onShowIconLibrary);
      window.removeEventListener("protota:show-import-app", onShowImportApp);
      window.removeEventListener("protota:show-writeback", onShowWriteback);
      window.removeEventListener("protota:new-screen", onNewScreen);
      window.removeEventListener("protota:code-export", onCodeExport);
      window.removeEventListener("protota:export-png", onExportPng);
      window.removeEventListener("protota:export-blueprint", onExportBlueprint);
      window.removeEventListener("protota:share", onShare);
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
      // Forest clipboard (ADR 0001 Part 3): the shortcuts every design tool
      // uses, operating on the whole ordered selection. `selectedNodeIds`
      // mirrors single selection, so single-node behavior is unchanged.
      if (mod && selectedNodeIds.length > 0 && (e.key === "c" || e.key === "x" || e.key === "d")) {
        e.preventDefault();
        if (e.key === "c") copyNodes(selectedNodeIds);
        else if (e.key === "x") cutNodes(selectedNodeIds);
        else {
          const created = duplicateNodes(selectedNodeIds);
          if (created.length) selectNodes(created, selectedScreenId ?? undefined);
        }
        return;
      }
      if (mod && e.key === "v" && selectedNodeId) {
        e.preventDefault();
        // Paste targets the primary selection; trees that cannot legally
        // land there report and are skipped while the rest paste.
        const { pastedIds, skipped } = pasteNodes(selectedNodeId);
        if (skipped.length) {
          console.warn(`Paste skipped ${skipped.length} widget(s) not legal here: ${skipped.join(", ")}`);
        }
        if (pastedIds.length) selectNodes(pastedIds, selectedScreenId ?? undefined);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        // Multi-selection deletes as one batch — one undo snapshot (#79).
        if (selectedNodeIds.length > 1) {
          e.preventDefault();
          deleteSelectedNodes();
          return;
        }
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
      if (e.key === "?" && mod) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }
      // Panel toggles
      if (e.key === "[" && mod) {
        e.preventDefault();
        setLeftOpen((v) => !v);
        return;
      }
      if (e.key === "]" && mod) {
        e.preventDefault();
        setRightOpen((v) => !v);
        return;
      }
      // Diagnostics toggle
      if (e.key === "'" && mod) {
        e.preventDefault();
        if (!diagnosticsEnabled) {
          window.dispatchEvent(new CustomEvent("protota:show-diagnostics"));
        }
        toggleDiagnostics();
        return;
      }
      // Screen Flows toggle
      if (e.key === ";" && mod) {
        e.preventDefault();
        toggleShowFlows();
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
    selectedNodeIds,
    deleteNode,
    deleteSelectedNodes,
    moveNodeUp,
    moveNodeDown,
    selectNode,
    selectNodes,
    addChildNode,
    selectedScreenId,
    copyNodes,
    cutNodes,
    pasteNodes,
    duplicateNodes,
    setShowAddScreenModal,
    showShortcuts,
    showCommandPalette,
    toggleDiagnostics,
    toggleShowFlows,
    diagnosticsEnabled,
  ]);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100vh" }}
      onContextMenu={handleContextMenu}
      onClickCapture={handleAppClick}
    >
      {/* Adwaita Toolbar View — frames the entire app */}
      <adw-toolbar-view style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header Bar — menu bar, app-menu button, export actions, panel toggles */}
        <Header
          leftOpen={leftOpen}
          onToggleLeft={() => setLeftOpen((v) => !v)}
          rightOpen={rightOpen}
          onToggleRight={() => setRightOpen((v) => !v)}
        />

        {/* Main Workspace — content slot of toolbar-view */}
        <div
          className="protota-workspace-container"
          style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}
        >
          {/* Left Drawer (Layers) Backdrop on Mobile */}
          {leftOpen && <div className="protota-mobile-scrim" onClick={() => setLeftOpen(false)} />}

          {/* Left Drawer (Layers) — Adwaita sidebar styling */}
          {leftOpen && (
            <aside
              className="protota-panel protota-left-panel adw-sidebar-like"
              style={{
                width: "240px",
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Two-tab segment: Layers | Widgets (#79) */}
              <div
                role="tablist"
                aria-label="Left panel tabs"
                style={{ display: "flex", gap: "4px", padding: "8px 8px 0 8px", flexShrink: 0 }}
              >
                {(["layers", "widgets"] as const).map((tab) => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={leftTab === tab}
                    data-testid={`left-tab-${tab}`}
                    className={`adw-button flat${leftTab === tab ? " active" : ""}`}
                    onClick={() => setLeftTab(tab)}
                    style={{ flex: 1, fontSize: "12px" }}
                  >
                    {tab === "layers" ? "Layers" : "Widgets"}
                  </button>
                ))}
              </div>
              {leftTab === "layers"
                ? <LayersPanel renameRequest={renameRequest} onRenameConsumed={clearRenameRequest} />
                : <WidgetPalette />}
            </aside>
          )}

          {/* Center Canvas */}
          <ViewportCanvas />

          {/* Right Drawer (Inspector) Backdrop on Mobile */}
          {rightOpen && <div className="protota-mobile-scrim" onClick={() => setRightOpen(false)} />}

          {/* Right Drawer (Inspector) — Adwaita sidebar styling */}
          {rightOpen && (
            <aside
              className="protota-panel protota-right-panel adw-sidebar-like"
              style={{
                width: "280px",
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Two-tab segment: Properties | Diagnostics (design §5.1) */}
              <div
                role="tablist"
                aria-label="Right panel tabs"
                style={{ display: "flex", gap: "4px", padding: "8px 8px 0 8px", flexShrink: 0 }}
              >
                {(["properties", "diagnostics"] as const).map((tab) => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={rightTab === tab}
                    data-testid={`right-tab-${tab}`}
                    className={`adw-button flat${rightTab === tab ? " active" : ""}`}
                    onClick={() => setRightTab(tab)}
                    style={{ flex: 1, fontSize: "12px" }}
                  >
                    {tab === "properties" ? "Properties" : "Diagnostics"}
                  </button>
                ))}
              </div>
              {rightTab === "properties" ? <InspectorPanel /> : <DiagnosticsPanel />}
            </aside>
          )}
        </div>
      </adw-toolbar-view>

      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />

      <AddScreenModal isOpen={showAddScreenModal} onClose={() => setShowAddScreenModal(false)} />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          kind={contextMenu.kind}
          onRename={handleRename}
          onClose={() => setContextMenu(null)}
        />
      )}

      <PresetGallery isOpen={showPresets} onClose={() => setShowPresets(false)} />

      <IconLibrary isOpen={showIconLibrary} onClose={() => setShowIconLibrary(false)} />
      <ImportAppDialog isOpen={showImportApp} onClose={() => setShowImportApp(false)} />
      <ExportWritebackDialog isOpen={showWriteback} onClose={() => setShowWriteback(false)} />

      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Hidden file input for import (shared by the desktop and mobile
          overflow menus' Import… items — one import front door, #118) */}
      <input
        id={IMPORT_FILE_INPUT_ID}
        ref={fileInputRef}
        type="file"
        accept=".mockup.json,.json,.blp,.ui"
        onChange={handleImport}
        style={{ display: "none" }}
      />
    </div>
  );
};


