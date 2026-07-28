import React, { useState, useRef } from 'react';
import { useMockupStore } from '../store/mockupStore';
import { LayersPanel } from './LayersPanel';
import { ViewportCanvas } from './ViewportCanvas';
import { InspectorPanel } from './InspectorPanel';
import { AddScreenModal } from './AddScreenModal';
import { exportDocumentFile, importDocumentFile } from '../utils/exportImport';

export const App: React.FC = () => {
  const { doc, undo, redo, setShowAddScreenModal, showAddScreenModal, toggleColorScheme } =
    useMockupStore();

  const themeIcon = doc.colorScheme === 'dark' ? '☀' : doc.colorScheme === 'light' ? '🌙' : '◐';
  const themeLabel = doc.colorScheme === 'dark' ? 'Light' : doc.colorScheme === 'light' ? 'Auto' : 'Dark';

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <button className="protota-btn" onClick={() => fileInputRef.current?.click()}>📂 Import</button>
        <span style={{ opacity: 0.25 }}>│</span>
        <button
          className="protota-btn"
          onClick={toggleColorScheme}
          title={`Theme: ${doc.colorScheme} (click for ${themeLabel})`}
        >{themeIcon} {themeLabel}</button>
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

      <AddScreenModal
        isOpen={showAddScreenModal}
        onClose={() => setShowAddScreenModal(false)}
      />
    </div>
  );
};
