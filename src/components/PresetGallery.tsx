import React, { useState } from 'react';
import { persistDocumentSource } from '../store/mockupStore';
import { registerSourceIcons, SOURCE_ICONS_STORAGE_KEY } from '../utils/adwIcons';
import { loadPresetDocument, PRESET_CATALOG as PRESETS } from '../utils/presetCatalog';

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
      const loaded = await loadPresetDocument(id);
      const doc = loaded.doc;
      if (loaded.kind === 'mockup') {
        // Artwork the app ships in its own source, embedded by the generator.
        registerSourceIcons(loaded.sourceIcons);
        localStorage.setItem(SOURCE_ICONS_STORAGE_KEY, JSON.stringify(loaded.sourceIcons ?? {}));
      }

      // Save to localStorage and reload
      persistDocumentSource(doc);
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
                cursor: preset.sourceImportPending ? 'not-allowed' : 'pointer',
                opacity: preset.sourceImportPending ? 0.65 : 1,
                background: 'var(--card-bg-color, #fff)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onClick={() => !preset.sourceImportPending && handleLoad(preset.id)}
              aria-disabled={preset.sourceImportPending || undefined}
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
                  <span style={{ fontSize: '11px', opacity: 0.4 }}>{preset.sourceImportPending ? 'source import pending' : `${preset.screens} screen`}</span>
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
