import React, { useState, useRef, useEffect } from 'react';
import { useMockupStore } from '../store/mockupStore';
import { LayersPanel } from './LayersPanel';
import { ViewportCanvas } from './ViewportCanvas';
import { InspectorPanel } from './InspectorPanel';
import { AuditPanel } from './AuditPanel';
import { PresetGallery } from './PresetGallery';
import { CommandPalette } from './CommandPalette';
import { AddScreenModal } from './AddScreenModal';
import { exportDocumentFile, importDocumentFile } from '../utils/exportImport';

export const App: React.FC = () => {
  const { doc, undo, redo, setShowAddScreenModal, showAddScreenModal, toggleColorScheme,
    selectedNodeId, deleteNode, moveNodeUp, moveNodeDown, selectNode, addChildNode,
    lintEnabled, toggleLint, violations } =
    useMockupStore();

  const themeIcon = doc.colorScheme === 'dark' ? '☀' : doc.colorScheme === 'light' ? '🌙' : '◐';
  const themeLabel = doc.colorScheme === 'dark' ? 'Light' : doc.colorScheme === 'light' ? 'Auto' : 'Dark';

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showFlows, setShowFlows] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleShare = async () => {
    const json = JSON.stringify(doc);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const url = `${window.location.origin}${window.location.pathname}#doc=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt('Share this URL:', url);
    }
  };

  const handleExport = async () => {
    await exportDocumentFile(doc);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importDocumentFile(file);
      imported.colorScheme = imported.colorScheme || 'auto';
      localStorage.setItem('protota_doc_v1', JSON.stringify(imported));
      window.location.reload();
    } catch (err) {
      alert('Failed to import: ' + (err as Error).message);
    }
    e.target.value = '';
  };

  // Global keyboard shortcuts (Penpot/Figma/Canva conventions)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      // Don't intercept when typing in inputs
      if ((e.target as HTMLElement)?.tagName === 'INPUT' ||
          (e.target as HTMLElement)?.tagName === 'TEXTAREA' ||
          (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'z' && mod && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.key === 'z' && mod && e.shiftKey) || (e.key === 'Z' && mod)) { e.preventDefault(); redo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) { e.preventDefault(); deleteNode(selectedNodeId); return; }
      }
      if (e.key === 'ArrowUp' && mod && selectedNodeId) { e.preventDefault(); moveNodeUp(selectedNodeId); return; }
      if (e.key === 'ArrowDown' && mod && selectedNodeId) { e.preventDefault(); moveNodeDown(selectedNodeId); return; }
      if (e.key === 'Escape' && showShortcuts) { setShowShortcuts(false); return; }
      if (e.key === 'Escape' && showCommandPalette) { setShowCommandPalette(false); return; }
      if (e.key === 'Escape') { selectNode(null); return; }
      // Quick-add
      if (e.key === 'b' && !mod && selectedNodeId) { addChildNode(selectedNodeId, 'button'); return; }
      if (e.key === 't' && !mod && selectedNodeId) { addChildNode(selectedNodeId, 'label'); return; }
      if (e.key === 'l' && !mod && selectedNodeId) { addChildNode(selectedNodeId, 'list-box'); return; }
      // Help
      if (e.key === '?' && !mod) { e.preventDefault(); setShowShortcuts(true); return; }
      // Panel toggles
      if (e.key === '\\' && mod) { e.preventDefault(); setLeftOpen(v => !v); return; }
      if (e.key === ']' && mod) { e.preventDefault(); setRightOpen(v => !v); return; }
      // New screen
      if (e.key === 'k' && mod) { e.preventDefault(); setShowCommandPalette(true); return; }
      if (e.key === 'n' && mod) { e.preventDefault(); setShowAddScreenModal(true); return; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedNodeId, deleteNode, moveNodeUp, moveNodeDown, selectNode, addChildNode, showShortcuts, showCommandPalette]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top Toolbar — themed as an Adwaita headerbar */}
      <header
        className="protota-toolbar"
        style={{
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: '6px',
          flexShrink: 0,
        }}
      >
        <strong style={{ marginRight: '8px', fontSize: '14px' }}>
          Protota
        </strong>
        <button className="protota-btn" onClick={undo}>↩ Undo</button>
        <button className="protota-btn" onClick={redo}>↪ Redo</button>
        <span style={{ opacity: 0.25 }}>│</span>
        <button
          className="protota-btn protota-btn--primary"
          onClick={() => setShowAddScreenModal(true)}
        >
          + Add Screen
        </button>
        <span style={{ opacity: 0.25 }}>│</span>
        <button className="protota-btn" onClick={handleExport}>💾 Export</button>
        <button className="protota-btn" onClick={handleShare}>🔗 Share</button>
        <button className="protota-btn" onClick={() => fileInputRef.current?.click()}>📂 Import</button>
        <span style={{ opacity: 0.25 }}>│</span>
        <button
          className="protota-btn"
          onClick={toggleColorScheme}
          title={`Theme: ${doc.colorScheme} (click for ${themeLabel})`}
        >{themeIcon} {themeLabel}</button>
        <span style={{ opacity: 0.25 }}>│</span>
        <button
          className={`protota-btn${lintEnabled ? ' protota-btn--primary' : ''}`}
          onClick={toggleLint}
          title={`HIG Lint ${lintEnabled ? 'ON' : 'OFF'} (${violations.length} issues)`}
          data-active={lintEnabled ? 'true' : undefined}
        >🔍 Lint{lintEnabled ? ` (${violations.length})` : ''}</button>
        <span style={{ opacity: 0.25 }}>│</span>
        <button
          className="protota-btn"
          onClick={() => setShowPresets(true)}
        >📦 Presets</button>
        <span style={{ opacity: 0.25 }}>│</span>
        <button
          className={`protota-btn${showFlows ? ' protota-btn--primary' : ''}`}
          onClick={() => setShowFlows(!showFlows)}
          data-active={showFlows ? 'true' : undefined}
        >🔗 Flows</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mockup.json,.json"
          onChange={handleImport}
          style={{ display: 'none' }}
        />
      </header>

      {/* Main Workspace (D10 Three-Pane) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Drawer (Layers) */}
        {leftOpen && (
          <aside
            className="protota-panel"
            style={{
              width: '240px',
              borderRight: '1px solid var(--separator-color, rgba(0,0,6,0.1))',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              className="protota-panel-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.65 }}>Layers</h3>
              <button className="protota-btn" onClick={() => setLeftOpen(false)}>◀</button>
            </div>
            <LayersPanel />
          </aside>
        )}
        {!leftOpen && (
          <button
            className="protota-btn"
            onClick={() => setLeftOpen(true)}
            style={{ position: 'absolute', top: '56px', left: 0, zIndex: 10 }}
          >▶</button>
        )}

        {/* Center Canvas */}
        <ViewportCanvas />

        {/* Right Drawer (D6 Inspector) */}
        {rightOpen && (
          <aside
            className="protota-panel"
            style={{
              width: '280px',
              borderLeft: '1px solid var(--separator-color, rgba(0,0,6,0.1))',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              className="protota-panel-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.65 }}>Properties</h3>
              <button className="protota-btn" onClick={() => setRightOpen(false)}>▶</button>
            </div>
            <InspectorPanel />
          </aside>
        )}
        {!rightOpen && (
          <button
            className="protota-btn"
            onClick={() => setRightOpen(true)}
            style={{ position: 'absolute', top: '56px', right: 0, zIndex: 10 }}
          >◀</button>
        )}
      </div>

      <AuditPanel />

      <AddScreenModal
        isOpen={showAddScreenModal}
        onClose={() => setShowAddScreenModal(false)}
      />

      <PresetGallery
        isOpen={showPresets}
        onClose={() => setShowPresets(false)}
      />

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />

      {/* Keyboard shortcuts help overlay */}
      {showShortcuts && (
        <div className="protota-modal-backdrop" onClick={() => setShowShortcuts(false)} data-testid="shortcuts-overlay">
          <div className="protota-modal" onClick={(e) => e.stopPropagation()} style={{ width: '520px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Keyboard Shortcuts</h3>
            <p style={{ fontSize: '12px', opacity: 0.65, marginBottom: '16px' }}>
              Press <kbd style={kbdStyle}>?</kbd> to toggle this overlay. Platform: Ctrl = ⌘ on macOS.
            </p>
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title} style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.5, margin: '0 0 6px 0' }}>{group.title}</h4>
                {group.items.map((item) => (
                  <div key={item.keys} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', borderBottom: '1px solid var(--separator-color, rgba(0,0,6,0.06))' }}>
                    <span>{item.label}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', opacity: 0.7 }}>
                      {item.keys.split(' ').map((k) => <kbd key={k} style={kbdStyle}>{k}</kbd>).reduce((prev, curr) => <>{prev} {curr}</>)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const kbdStyle: React.CSSProperties = {
  background: 'var(--button-bg-color, rgba(0,0,6,0.08))',
  padding: '1px 6px',
  borderRadius: '4px',
  fontSize: '11px',
  border: '1px solid var(--separator-color, rgba(0,0,6,0.12))',
};

const SHORTCUT_GROUPS = [
  {
    title: 'Editing',
    items: [
      { keys: 'Ctrl+Z', label: 'Undo' },
      { keys: 'Ctrl+Shift+Z', label: 'Redo' },
      { keys: 'Delete', label: 'Delete selected element' },
      { keys: 'Ctrl+↑', label: 'Move element up' },
      { keys: 'Ctrl+↓', label: 'Move element down' },
      { keys: 'Escape', label: 'Deselect' },
    ],
  },
  {
    title: 'View',
    items: [
      { keys: 'Ctrl+=', label: 'Zoom in' },
      { keys: 'Ctrl+-', label: 'Zoom out' },
      { keys: 'Ctrl+0', label: 'Zoom to 100%' },
      { keys: 'Space+Drag', label: 'Pan canvas' },
    ],
  },
  {
    title: 'Quick Add',
    items: [
      { keys: 'B', label: 'Add button' },
      { keys: 'T', label: 'Add label' },
      { keys: 'L', label: 'Add list box' },
      { keys: 'Ctrl+N', label: 'New screen' },
    ],
  },
  {
    title: 'Interface',
    items: [
      { keys: 'Ctrl+\\', label: 'Toggle Layers panel' },
      { keys: 'Ctrl+]', label: 'Toggle Properties panel' },
      { keys: 'Ctrl+.', label: 'Toggle HIG lint' },
      { keys: 'Ctrl+/', label: 'Toggle Preview mode' },
      { keys: '?', label: 'Show this help' },
    ],
  },
];
