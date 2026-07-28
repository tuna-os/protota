import React, { useState } from 'react';
import type { MockupDocument } from '../types/mockup';

interface PresetMeta {
  id: string;
  name: string;
  description: string;
  screens: number;
}

const PRESETS: PresetMeta[] = [
  { id: 'text-editor', name: 'GNOME Text Editor', description: 'Document editor with header bar, save/open buttons, and content area.', screens: 1 },
  { id: 'settings', name: 'GNOME Settings', description: 'ViewSwitcher with Wi-Fi, Bluetooth, and Display panels. Search in header bar.', screens: 1 },
  { id: 'calculator', name: 'GNOME Calculator', description: 'Button grid calculator with display and arithmetic operations.', screens: 1 },
  { id: 'files', name: 'GNOME Files (Nautilus)', description: 'Sidebar + content layout with bookmarks, search, and file grid.', screens: 1 },
  { id: 'calendar', name: 'GNOME Calendar', description: 'Event list with header bar, today/prev/next navigation, and new event button.', screens: 1 },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PresetGallery: React.FC<Props> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoad = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/presets/${id}.mockup.json`);
      const payload = await res.json();
      const doc: MockupDocument = payload.document;
      doc.colorScheme = doc.colorScheme || 'auto';

      // Save to localStorage and reload
      localStorage.setItem('protota_doc_v1', JSON.stringify(doc));
      localStorage.setItem('protota_was_preset', 'true');
      window.location.reload();
    } catch (err) {
      alert('Failed to load preset: ' + (err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="protota-modal-backdrop" onClick={onClose}>
      <div className="protota-modal" onClick={(e) => e.stopPropagation()} style={{ width: '520px', maxHeight: '80vh' }}>
        <h3 style={{ marginTop: 0 }}>Load Preset — GNOME Core Apps</h3>
        <p style={{ fontSize: '12px', opacity: 0.65, marginBottom: '16px' }}>
          Replace the current document with a pre-built mockup. Your current work will be lost.
          Use Undo (Ctrl+Z) to restore after loading.
        </p>

        {loading && <div style={{ padding: '16px', textAlign: 'center' }}>Loading…</div>}

        <div className="protota-preset-gallery" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflow: 'auto' }}>
          {PRESETS.map((preset) => (
            <div
              key={preset.id}
              className="protota-preset-item"
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--separator-color, rgba(0,0,6,0.1))',
                cursor: 'pointer',
                background: 'var(--card-bg-color, #fff)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onClick={() => handleLoad(preset.id)}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{preset.name}</div>
                <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>{preset.description}</div>
              </div>
              <div style={{ fontSize: '11px', opacity: 0.4, flexShrink: 0 }}>
                {preset.screens} screen{preset.screens !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button className="protota-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
