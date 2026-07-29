import React, { useState } from 'react';
import type { MockupDocument } from '../types/mockup';

interface PresetMeta {
  id: string;
  name: string;
  description: string;
  screens: number;
}

const PRESETS: PresetMeta[] = [
  { id: 'amberol', name: 'Amberol', description: 'GNOME Circle music player empty-library state with add-folder and add-song actions.', screens: 1 },
  { id: 'text-editor', name: 'GNOME Text Editor', description: 'Document editor with header bar, save/open buttons, and content area.', screens: 1 },
  { id: 'settings', name: 'GNOME Settings', description: 'ViewSwitcher with Wi-Fi, Bluetooth, and Display panels. Search in header bar.', screens: 1 },
  { id: 'calculator', name: 'GNOME Calculator', description: 'Button grid calculator with display and arithmetic operations.', screens: 1 },
  { id: 'files', name: 'GNOME Files (Nautilus)', description: 'Sidebar + content layout with bookmarks, search, and file grid.', screens: 1 },
  { id: 'calendar', name: 'GNOME Calendar', description: 'Event list with header bar, today/prev/next navigation, and new event button.', screens: 1 },
  { id: 'weather', name: 'GNOME Weather', description: 'City forecast view with status header and 7-day temperature trends.', screens: 1 },
  { id: 'clocks', name: 'GNOME Clocks', description: 'World clocks, alarms, stopwatch, and timers with ViewSwitcher tabs.', screens: 1 },
  { id: 'disks', name: 'GNOME Disks', description: 'Disk partition utility with drive list sidebar and volume allocation.', screens: 1 },
  { id: 'web', name: 'GNOME Web (Epiphany)', description: 'Browser window with tab bar, location entry, and status landing page.', screens: 1 },
  { id: 'software', name: 'GNOME Software', description: 'App store catalog with ViewSwitcher tabs (Explore, Installed, Updates).', screens: 1 },
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
      const res = await fetch(`${import.meta.env.BASE_URL}presets/${id}.mockup.json`);
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
        <h3 style={{ marginTop: 0 }}>Load Preset — GNOME Apps</h3>
        <p style={{ fontSize: '12px', opacity: 0.65, marginBottom: '16px' }}>
          Replace the current document with a pre-built mockup. Your current work will be lost.
          Use Undo (Ctrl+Z) to restore after loading.
        </p>

        {loading && <div style={{ padding: '16px', textAlign: 'center' }}>Loading…</div>}

        <div className="protota-preset-gallery" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', maxHeight: '480px', overflow: 'auto' }}>
          {PRESETS.map((preset) => (
            <div
              key={preset.id}
              className="protota-preset-item"
              style={{
                padding: '10px',
                borderRadius: '10px',
                border: '1px solid var(--separator-color, rgba(0,0,6,0.12))',
                cursor: 'pointer',
                background: 'var(--card-bg-color, #fff)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onClick={() => handleLoad(preset.id)}
            >
              <div style={{
                height: '110px',
                borderRadius: '6px',
                overflow: 'hidden',
                background: '#f6f6f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(0,0,0,0.06)'
              }}>
                <img
                  src={`${import.meta.env.BASE_URL}presets/thumbnails/${preset.id}.png`}
                  alt={`${preset.name} official preview`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top left' }}
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{preset.name}</span>
                  <span style={{ fontSize: '11px', opacity: 0.4 }}>{preset.screens} screen</span>
                </div>
                <div style={{ fontSize: '11px', opacity: 0.65, marginTop: '3px', lineHeight: '1.3' }}>{preset.description}</div>
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
