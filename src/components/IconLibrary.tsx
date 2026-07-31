import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMockupStore } from '../store/mockupStore';
import { WIDGET_SCHEMAS } from '../schemas/widgetSchemas';
import type { AdwNode } from '../types/mockup';
import { findNodeById } from '../utils/treeHelpers';
import { ICON_CATALOG, ICON_CATALOG_TOTAL } from '../data/iconCatalog';
import { iconClass } from '../data/icons';
import { ensureAdwIcon } from '../utils/adwIcons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Full-catalog icon browser, modeled on GNOME's "Icon Library" app: every
 * symbolic icon the installed @gjsify/adwaita-icons package ships, searchable
 * and filterable by the package's categories. Clicking an icon copies its
 * name to the clipboard, and — when the selected canvas node has an icon
 * property — applies it to that node, mirroring the inspector's IconPicker.
 */
export const IconLibrary: React.FC<Props> = ({ isOpen, onClose }) => {
  const { doc, selectedNodeId, selectedScreenId, updateNodeProps } = useMockupStore();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  // The same lookup the inspector does: the selected node's schema decides
  // whether it has an icon property (field type "icon") we can apply to.
  const selectedScreen = doc.screens.find((screen) => screen.id === selectedScreenId);
  const selectedNode: AdwNode | null =
    selectedNodeId && selectedScreen
      ? findNodeById([selectedScreen.rootNode], selectedNodeId)
      : null;
  const iconField = selectedNode
    ? (WIDGET_SCHEMAS[selectedNode.type] || []).find((field) => field.type === 'icon')
    : undefined;

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      ICON_CATALOG.map((category) => ({
        ...category,
        icons:
          (activeCat && category.id !== activeCat)
            ? []
            : query
              ? category.icons.filter((name) => name.includes(query))
              : category.icons,
      })).filter((category) => category.icons.length > 0),
    [query, activeCat],
  );
  const visibleCount = visible.reduce((sum, category) => sum + category.icons.length, 0);

  if (!isOpen) return null;

  const handlePick = (name: string) => {
    // Always copy — the library doubles as a reference tool, exactly like
    // GNOME's Icon Library app.
    navigator.clipboard?.writeText(name).catch(() => {
      /* Clipboard can be unavailable (permissions); applying still works. */
    });
    if (iconField && selectedNode) {
      updateNodeProps(selectedNode.id, { [iconField.key]: name });
    }
    setCopied(name);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="protota-modal-backdrop" onClick={onClose}>
      <div
        className="protota-modal"
        data-testid="icon-library"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 94vw)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '4px' }}>Icon Library</h3>
        <p style={{ fontSize: '12px', opacity: 0.65, margin: '0 0 12px' }}>
          All {ICON_CATALOG_TOTAL} symbolic icons from the installed Adwaita icon set.
          Click an icon to copy its name
          {iconField && selectedNode
            ? ` and set it as the selected ${selectedNode.type}'s ${iconField.label.toLowerCase()}`
            : ''}
          .
        </p>

        <input
          className="protota-input"
          data-testid="icon-library-search"
          type="text"
          placeholder={`Search ${ICON_CATALOG_TOTAL} icons…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          style={{ width: '100%', marginBottom: '8px' }}
        />

        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            gap: '4px',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--separator-color, rgba(0,0,6,0.08))',
          }}
        >
          {[{ id: null as string | null, label: 'All' }, ...ICON_CATALOG].map((category) => (
            <button
              key={category.id ?? 'all'}
              onClick={() => setActiveCat(category.id)}
              style={{
                padding: '4px 10px',
                borderRadius: '99px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                background:
                  activeCat === category.id
                    ? 'var(--accent-bg-color, #3584e4)'
                    : 'var(--button-bg-color, rgba(0,0,6,0.06))',
                color:
                  activeCat === category.id
                    ? 'var(--accent-fg-color, #fff)'
                    : 'var(--window-fg-color, rgba(0,0,6,0.7))',
              }}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div style={{ overflow: 'auto', flex: 1, padding: '8px 0' }}>
          {visibleCount === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
              No icons match “{search}”.
            </div>
          )}
          {visible.map((category) => (
            <div key={category.id} style={{ marginBottom: '8px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  opacity: 0.45,
                  padding: '6px 4px 4px',
                }}
              >
                {category.label} · {category.icons.length}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                  gap: '4px',
                }}
              >
                {category.icons.map((name) => {
                  // Inject the mask rule so every catalog icon actually
                  // renders — the same registration the canvas renderer uses.
                  ensureAdwIcon(name);
                  const isCopied = copied === name;
                  return (
                    <button
                      key={name}
                      className="protota-icon-library-item"
                      title={name}
                      onClick={() => handlePick(name)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '10px 4px 6px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        background: isCopied
                          ? 'var(--accent-bg-color, #3584e4)'
                          : 'var(--button-bg-color, rgba(0,0,6,0.04))',
                        color: isCopied
                          ? 'var(--accent-fg-color, #fff)'
                          : 'var(--window-fg-color, rgba(0,0,6,0.85))',
                      }}
                    >
                      <span
                        className={iconClass(name)}
                        style={{
                          width: '24px',
                          height: '24px',
                          display: 'inline-block',
                          backgroundColor: 'currentColor',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '9px',
                          maxWidth: '84px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.2,
                        }}
                      >
                        {isCopied ? 'Copied' : name.replace(/-symbolic$/, '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            paddingTop: '10px',
            borderTop: '1px solid var(--separator-color, rgba(0,0,6,0.08))',
          }}
        >
          <span style={{ fontSize: '12px', opacity: 0.6 }} data-testid="icon-library-status">
            {copied
              ? `Copied “${copied}” to clipboard${iconField && selectedNode ? ' and applied to selection' : ''}`
              : `${visibleCount} of ${ICON_CATALOG_TOTAL} icons`}
          </span>
          <button className="protota-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
