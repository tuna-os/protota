import React from 'react';
import { useMockupStore } from '../store/mockupStore';

interface Props { x: number; y: number; onClose: () => void }

/** `<gtk-popover>` exposes `anchor` as a property, which React cannot set as an attribute. */
type GtkPopoverElement = HTMLElement & { anchor: HTMLElement | null };

export const ContextMenu: React.FC<Props> = ({ x, y, onClose }) => {
  const { deleteNode, selectedNodeId, undo, redo, screenSelected, selectedScreenId, deleteScreen } = useMockupStore();

  const bindPopover = (el: GtkPopoverElement | null) => {
    if (!el) return;
    // Anchoring to <body> disables the element's own pointerdown light-dismiss,
    // which would otherwise close the menu before the contextmenu toggle runs.
    el.anchor = document.body;
    // The element owns Escape (bound at the document in capture phase), so
    // notify::open is the only way React learns the menu closed.
    const onNotify = (e: Event) => {
      if ((e as CustomEvent<{ open: boolean }>).detail?.open === false) onClose();
    };
    el.addEventListener('notify::open', onNotify);
    return () => el.removeEventListener('notify::open', onNotify);
  };

  const items = [
    { label: 'Undo', action: () => { undo(); onClose(); } },
    { label: 'Redo', action: () => { redo(); onClose(); } },
    // Delete acts on the current selection: the whole screen when one is
    // selected (#138), else the selected node.
    screenSelected && selectedScreenId
      ? { label: 'Delete Screen', action: () => { deleteScreen(selectedScreenId); onClose(); }, danger: true }
      : { label: 'Delete', action: () => { if (selectedNodeId) { deleteNode(selectedNodeId); onClose(); } }, danger: true },
  ];

  return (
    <div className="protota-context-menu-anchor" style={{ left: x, top: y }}>
      <gtk-popover
        ref={bindPopover}
        className="protota-context-menu"
        menu=""
        position="bottom"
        align="start"
        open
      >
        {items.map(item => (
          <button
            key={item.label}
            type="button"
            className={`adw-popover-item${item.danger ? ' danger' : ''}`}
            onClick={item.action}
          >
            {item.label}
          </button>
        ))}
      </gtk-popover>
    </div>
  );
};
