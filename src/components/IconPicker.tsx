import React, { useState, useRef, useEffect } from 'react';
import { ICON_CATEGORIES, iconClass } from '../data/icons';

interface Props {
  value: string;
  onChange: (iconName: string) => void;
}

export const IconPicker: React.FC<Props> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = search.trim()
    ? ICON_CATEGORIES.map(cat => ({
        label: cat.label,
        icons: cat.icons.filter(i => i.includes(search.toLowerCase())),
      })).filter(cat => cat.icons.length > 0)
    : ICON_CATEGORIES;

  const displayValue = value ? value.replace(/-symbolic$/, '') : '';

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="protota-icon-trigger"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 8px',
          borderRadius: '6px',
          border: '1px solid var(--entry-border-color, rgba(0,0,6,0.18))',
          background: 'var(--entry-bg-color, #fff)',
          cursor: 'pointer',
          width: '100%',
          fontFamily: 'inherit',
          fontSize: '13px',
          color: value ? 'var(--window-fg-color)' : 'var(--window-fg-color, rgba(0,0,6,0.4))',
        }}
      >
        {value ? (
          <>
            <span className={iconClass(value)} style={{ width: '18px', height: '18px', display: 'inline-block' }} />
            <span style={{ flex: 1, textAlign: 'left' }}>{displayValue}</span>
            <span
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              style={{ opacity: 0.4, cursor: 'pointer', fontSize: '14px' }}
              title="Clear"
            >×</span>
          </>
        ) : (
          <span style={{ opacity: 0.4 }}>Select icon…</span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="protota-icon-picker"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 200,
            width: '320px',
            maxHeight: '420px',
            background: 'var(--popover-bg-color, #fff)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,6,0.18)',
            border: '1px solid var(--separator-color, rgba(0,0,6,0.1))',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search */}
          <div style={{ padding: '8px', borderBottom: '1px solid var(--separator-color, rgba(0,0,6,0.06))' }}>
            <input
              className="protota-icon-picker-search protota-input"
              type="text"
              placeholder="Search icons…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveCat(null); }}
              autoFocus
              style={{ width: '100%' }}
            />
          </div>

          {/* Category tabs */}
          {!search && (
            <div style={{
              display: 'flex', overflowX: 'auto', gap: '2px', padding: '4px 8px',
              borderBottom: '1px solid var(--separator-color, rgba(0,0,6,0.06))',
            }}>
              {ICON_CATEGORIES.map(cat => (
                <button
                  key={cat.label}
                  onClick={() => setActiveCat(activeCat === cat.label ? null : cat.label)}
                  style={{
                    padding: '3px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap',
                    background: activeCat === cat.label
                      ? 'var(--accent-bg-color, #3584e4)'
                      : 'var(--button-bg-color, rgba(0,0,6,0.06))',
                    color: activeCat === cat.label
                      ? 'var(--accent-fg-color, #fff)'
                      : 'var(--window-fg-color, rgba(0,0,6,0.6))',
                    fontFamily: 'inherit',
                  }}
                >{cat.label}</button>
              ))}
            </div>
          )}

          {/* Icon grid */}
          <div style={{ overflow: 'auto', flex: 1, padding: '6px' }}>
            {(activeCat && !search
              ? filtered.filter(c => c.label === activeCat)
              : filtered
            ).map(cat => (
              <div key={cat.label} style={{ marginBottom: '4px' }}>
                {!search && !activeCat && (
                  <div style={{
                    fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
                    opacity: 0.4, padding: '4px 6px 2px',
                  }}>{cat.label}</div>
                )}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
                  gap: '2px',
                }}>
                  {cat.icons.map(name => (
                    <button
                      key={name}
                      className="protota-icon-item"
                      onClick={() => { onChange(name); setOpen(false); }}
                      title={name}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                        padding: '6px 2px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        background: value === name
                          ? 'var(--accent-bg-color, #3584e4)'
                          : 'transparent',
                        color: value === name
                          ? 'var(--accent-fg-color, #fff)'
                          : 'var(--window-fg-color, rgba(0,0,6,0.8))',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span className={iconClass(name)} style={{
                        width: '20px', height: '20px', display: 'inline-block',
                        backgroundColor: value === name ? 'var(--accent-fg-color, #fff)' : 'currentColor',
                      }} />
                      <span style={{
                        fontSize: '9px', maxWidth: '52px', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        lineHeight: 1.1, textAlign: 'center',
                      }}>
                        {name.replace(/-symbolic$/, '')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
