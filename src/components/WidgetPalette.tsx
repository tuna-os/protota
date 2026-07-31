import React, { useState } from 'react';
import { ALL_WIDGETS } from './widgetCatalog';
import { PALETTE_MIME, useDndStore } from '../dnd/dndStore';

/**
 * Draggable widget palette (#79), in the left panel beside the layer tree.
 * Entries use native HTML5 drag events (docs/penpot-study.md §4): they are
 * plain DOM rows, and the canvas resolves the drop to container + index +
 * slot. The payload rides in the dnd store; DataTransfer carries a marker
 * MIME so the canvas can tell our drags from OS file drags.
 */
export const WidgetPalette: React.FC = () => {
  const [search, setSearch] = useState('');
  const { startDrag, endDrag } = useDndStore();

  const filtered = ALL_WIDGETS.filter(
    (w) => !search || w.label.toLowerCase().includes(search.toLowerCase())
      || w.type.includes(search.toLowerCase()),
  );

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input
        className="protota-input"
        type="search"
        placeholder="Filter widgets…"
        aria-label="Filter widgets"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px' }}
      />
      <div style={{ fontSize: '11px', opacity: 0.55 }}>
        Drag a widget onto the canvas to insert it.
      </div>
      <div role="list" aria-label="Widget palette">
        {filtered.map((w) => (
          <div
            key={w.type}
            role="listitem"
            draggable
            data-testid="palette-item"
            data-widget-type={w.type}
            className="protota-palette-item"
            onDragStart={(e) => {
              e.dataTransfer.setData(PALETTE_MIME, w.type);
              e.dataTransfer.effectAllowed = 'copy';
              startDrag({ kind: 'palette', widgetType: w.type });
            }}
            onDragEnd={endDrag}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '12px' }}>{w.label}</div>
              <div style={{ fontSize: '10px', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {w.desc}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '12px', textAlign: 'center', opacity: 0.5, fontSize: '12px' }}>
            No widgets match "{search}"
          </div>
        )}
      </div>
    </div>
  );
};
