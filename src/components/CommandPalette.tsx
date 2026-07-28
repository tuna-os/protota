import React, { useState, useRef, useEffect } from 'react';
import { useMockupStore } from '../store/mockupStore';
import { LEGAL_CHILDREN, type AdwNodeType } from '../types/mockup';
import { findNodeById } from '../utils/treeHelpers';

const ALL_WIDGETS: { type: AdwNodeType; label: string; desc: string }[] = [
  { type: 'button', label: 'Button', desc: 'Clickable button' },
  { type: 'window-title', label: 'Window Title', desc: 'Title + subtitle' },
  { type: 'box', label: 'Box', desc: 'Directional container' },
  { type: 'label', label: 'Label', desc: 'Text' },
  { type: 'list-box', label: 'List Box', desc: 'Boxed-list container' },
  { type: 'clamp', label: 'Clamp', desc: 'Max-width container' },
  { type: 'header-bar', label: 'Header Bar', desc: 'Title bar with buttons' },
  { type: 'action-row', label: 'Action Row', desc: 'Title + subtitle + suffix' },
  { type: 'switch-row', label: 'Switch Row', desc: 'Toggle switch row' },
  { type: 'combo-row', label: 'Combo Row', desc: 'Dropdown row' },
  { type: 'entry-row', label: 'Entry Row', desc: 'Text input row' },
  { type: 'status-page', label: 'Status Page', desc: 'Empty/error/loading' },
  { type: 'banner', label: 'Banner', desc: 'Persistent info bar' },
  { type: 'spinner', label: 'Spinner', desc: 'Loading indicator' },
  { type: 'entry', label: 'Entry', desc: 'Text input' },
  { type: 'search-entry', label: 'Search Entry', desc: 'Search bar' },
  { type: 'toggle', label: 'Toggle', desc: 'Pill toggle button' },
  { type: 'preferences-group', label: 'Preferences Group', desc: 'Titled section' },
  { type: 'spin-row', label: 'Spin Row', desc: 'Numeric spinner row' },
  { type: 'button-row', label: 'Button Row', desc: 'Clickable action row' },
  { type: 'expander-row', label: 'Expander Row', desc: 'Expandable row' },
  { type: 'password-row', label: 'Password Row', desc: 'Password input row' },
  { type: 'center-box', label: 'Center Box', desc: 'Start/center/end' },
  { type: 'flow-box', label: 'Flow Box', desc: 'Wrapping grid' },
  { type: 'inscription', label: 'Inscription', desc: 'Text w/ ellipsis' },
  { type: 'menu-button', label: 'Menu Button', desc: 'Icon button w/ popover' },
  { type: 'split-button', label: 'Split Button', desc: 'Button + dropdown' },
  { type: 'switch-widget', label: 'Switch', desc: 'Binary toggle' },
  { type: 'check-button', label: 'Check Button', desc: 'Checkbox' },
  { type: 'toggle-group', label: 'Toggle Group', desc: 'Group of toggles' },
  { type: 'view-stack', label: 'View Stack', desc: 'Switched pages' },
  { type: 'tab-view', label: 'Tab View', desc: 'Multi-document tabs' },
  { type: 'overlay-split', label: 'Overlay Split', desc: 'Sidebar + content' },
  { type: 'view-switcher', label: 'View Switcher', desc: 'Flat tab bar' },
  { type: 'navigation-view', label: 'Navigation View', desc: 'Push/pop nav' },
  { type: 'preferences-page', label: 'Preferences Page', desc: 'Tab in prefs dialog' },
  { type: 'toolbar-view', label: 'Toolbar View', desc: 'Header + content + bottom' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<Props> = ({ isOpen, onClose }) => {
  const { doc, selectedNodeId, selectedScreenId, addChildNode } = useMockupStore();
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) { setSearch(''); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedNode = (() => {
    if (!selectedNodeId || !selectedScreenId) return null;
    const screen = doc.screens.find(s => s.id === selectedScreenId);
    if (!screen) return null;
    return findNodeById([screen.rootNode], selectedNodeId);
  })();
  const legalTypes = selectedNode ? (LEGAL_CHILDREN[selectedNode.type] || []) : null;

  const filtered = ALL_WIDGETS.filter(w => {
    const matchesSearch = !search || w.label.toLowerCase().includes(search.toLowerCase());
    if (!legalTypes) return false;
    return legalTypes.includes(w.type) && matchesSearch;
  });

  const handleSelect = (type: AdwNodeType) => {
    if (selectedNodeId) addChildNode(selectedNodeId, type);
    onClose();
  };

  return (
    <div className="protota-modal-backdrop" onClick={onClose} style={{ zIndex: 2000 }}>
      <div className="protota-command-palette" onClick={e => e.stopPropagation()} style={{
        width: '440px', maxHeight: '340px', background: 'var(--popover-bg-color, #fff)',
        borderRadius: '12px', boxShadow: '0 12px 32px rgba(0,0,6,0.28)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--separator-color)' }}>
          <input ref={inputRef} className="protota-input protota-command-palette-search"
            type="text" placeholder={selectedNode ? 'Add widget…' : 'Select a container first'}
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '15px', outline: 'none', fontFamily: 'inherit' }}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && filtered.length > 0) handleSelect(filtered[0].type);
            }}
          />
        </div>
        <div style={{ overflow: 'auto', flex: 1, padding: '6px' }}>
          {!selectedNode && (
            <div style={{ padding: '12px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
              Select a container on the canvas first, then use the palette.
            </div>
          )}
          {filtered.map(w => (
            <div key={w.type}
              onClick={() => handleSelect(w.type)}
              style={{
                padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--button-bg-color)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{w.label}</div>
                <div style={{ fontSize: '11px', opacity: 0.5 }}>{w.desc}</div>
              </div>
              <span style={{ fontSize: '10px', opacity: 0.3, fontFamily: 'monospace' }}>{w.type}</span>
            </div>
          ))}
          {filtered.length === 0 && search && selectedNode && (
            <div style={{ padding: '12px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
              No widgets match "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
