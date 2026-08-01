import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMockupStore } from '../store/mockupStore';
import type { AdwNodeType } from '../types/mockup';
import { ALL_WIDGETS } from './widgetCatalog';

/**
 * Compact in-place add affordance (#pill-flood): a single "+" chip that
 * replaces the old row of one-pill-per-legal-child-type buttons. With
 * CONTAINER_CHILDREN at 50+ types, the pill row flooded the canvas below
 * any selected generic container; the chip opens a small searchable popover
 * over the same legality data instead.
 *
 * Insertion semantics are identical to the old pills: one addChildNode()
 * call per pick, so undo/redo history is unchanged.
 */

/**
 * Front-loaded "Common" shortcuts per container type. This is a small,
 * deliberately static map — NOT a usage-tracking heuristic. It only
 * reorders the popover's first row; every legal type stays reachable
 * through the searchable list below it. Entries not legal for the node
 * (or absent here) are simply skipped.
 */
const COMMON_CHILDREN: Partial<Record<AdwNodeType, AdwNodeType[]>> = {
  'list-box': ['action-row', 'switch-row', 'entry-row', 'combo-row', 'expander-row'],
  'preferences-group': ['action-row', 'switch-row', 'combo-row', 'entry-row', 'button-row'],
  'header-bar': ['button', 'menu-button', 'window-title', 'toggle-group', 'search-entry'],
  'toolbar-view': ['header-bar', 'box', 'clamp', 'scrolled-window', 'status-page'],
  window: ['toolbar-view', 'header-bar', 'box', 'clamp'],
  dialog: ['toolbar-view', 'header-bar', 'box', 'clamp'],
  'scrolled-window': ['box', 'clamp', 'list-box', 'grid'],
  clamp: ['box', 'list-box', 'preferences-group', 'status-page'],
  'flow-box': ['button', 'label', 'box'],
  'wrap-box': ['button', 'label', 'box'],
  'status-page': ['button', 'box', 'list-box'],
};

/** Fallback commons for any other generic container. */
const DEFAULT_COMMON: AdwNodeType[] = ['box', 'label', 'button', 'list-box'];

/** Catalog lookup with a readable fallback for types the catalog lacks. */
const widgetMeta = (type: AdwNodeType): { type: AdwNodeType; label: string; desc: string } =>
  ALL_WIDGETS.find((w) => w.type === type) ??
  { type, label: type.replace(/-/g, ' '), desc: '' };

interface Props {
  nodeId: string;
  nodeType: AdwNodeType;
  legalAdds: AdwNodeType[];
  /** Empty container: center the chip over the node instead of the below-edge row position. */
  centered: boolean;
}

export const AddChildChip: React.FC<Props> = ({ nodeId, nodeType, legalAdds, centered }) => {
  const addChildNode = useMockupStore((s) => s.addChildNode);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => legalAdds.map(widgetMeta), [legalAdds]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    // Same filtering idiom as the command palette: substring on the label,
    // plus the raw type id so "list-box" style queries also hit.
    return entries.filter((w) =>
      w.label.toLowerCase().includes(q) || w.type.includes(q));
  }, [entries, search]);

  const common = useMemo(() => {
    const wanted = COMMON_CHILDREN[nodeType] ?? DEFAULT_COMMON;
    return wanted.filter((t) => legalAdds.includes(t)).slice(0, 6);
  }, [nodeType, legalAdds]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setActiveIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    // Close on any pointer-down outside the chip + popover.
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  // Keep the active row scrolled into view during keyboard navigation.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-add-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const pick = (type: AdwNodeType) => {
    addChildNode(nodeId, type);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      pick(filtered[Math.min(activeIndex, filtered.length - 1)].type);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`protota-add-affordance${centered ? ' protota-add-affordance--centered' : ''}`}
    >
      <button
        className="protota-add-btn protota-add-chip"
        title="Add child widget"
        aria-label="Add child widget"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        +
      </button>
      {open && (
        <div className="protota-add-popover" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            className="protota-input protota-add-popover-search"
            type="text"
            placeholder="Add widget…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveIndex(0); }}
            onKeyDown={onKeyDown}
          />
          {!search && common.length > 0 && (
            <div className="protota-add-popover-common">
              {common.map((type) => (
                <button
                  key={type}
                  className="protota-add-btn"
                  onClick={() => pick(type)}
                >
                  + {widgetMeta(type).label}
                </button>
              ))}
            </div>
          )}
          <div ref={listRef} className="protota-add-popover-list">
            {filtered.map((w, index) => (
              <div
                key={w.type}
                data-add-index={index}
                className={`protota-add-popover-item${index === activeIndex ? ' active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(w.type)}
              >
                <span className="protota-add-popover-item-label">{w.label}</span>
                {w.desc && <span className="protota-add-popover-item-desc">{w.desc}</span>}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="protota-add-popover-empty">No widgets match "{search}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
