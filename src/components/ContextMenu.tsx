import React from 'react';
import { useMockupStore } from '../store/mockupStore';
import type { MenuItem } from './MenuData';

/** A menu entry as this component renders it: `danger` tints the destructive one. */
type ContextMenuItem = MenuItem & { danger?: boolean };

interface Props {
  x: number; y: number;
  kind: 'node' | 'screen' | 'canvas';
  /** Start renaming the right-clicked node or screen (its id). */
  onRename: (id: string) => void;
  onClose: () => void;
}

/** `<gtk-popover>` exposes `anchor` as a property, which React cannot set as an attribute. */
type GtkPopoverElement = HTMLElement & { anchor: HTMLElement | null };

export const ContextMenu: React.FC<Props> = ({ x, y, kind, onRename, onClose }) => {
  const {
    deleteNode, selectedNodeId, undo, redo, screenSelected, selectedScreenId,
    deleteScreen, cutNodes, copyNodes, pasteNodes, duplicateNodes, selectNodes,
    selectedNodeIds, setShowAddScreenModal,
  } = useMockupStore();

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

  // Items follow the selection the right-click made (App's handleContextMenu).
  // Undo/Redo are history, not object commands: only the empty-canvas menu,
  // where nothing is selected, has anything else to offer.
  const items: ContextMenuItem[] =
    kind === 'screen' && screenSelected && selectedScreenId
      ? [
          { label: 'Rename…', action: () => { onRename(selectedScreenId); onClose(); } },
          { label: 'Delete Screen', action: () => { deleteScreen(selectedScreenId); onClose(); }, danger: true },
        ]
      : kind === 'node' && selectedNodeId
        ? [
            { label: 'Cut', action: () => { cutNodes(selectedNodeIds); onClose(); } },
            { label: 'Copy', action: () => { copyNodes(selectedNodeIds); onClose(); } },
            { label: 'Paste', action: () => {
                const { pastedIds } = pasteNodes(selectedNodeId);
                if (pastedIds.length) selectNodes(pastedIds, selectedScreenId ?? undefined);
                onClose();
              } },
            { label: 'Duplicate', action: () => {
                const created = duplicateNodes(selectedNodeIds);
                if (created.length) selectNodes(created, selectedScreenId ?? undefined);
                onClose();
              } },
            { label: 'Rename…', action: () => { onRename(selectedNodeId); onClose(); } },
            { label: 'Delete', action: () => { deleteNode(selectedNodeId); onClose(); }, danger: true },
          ]
        : [
            { label: 'Undo', action: () => { undo(); onClose(); } },
            { label: 'Redo', action: () => { redo(); onClose(); } },
            { label: 'Add Screen', action: () => { setShowAddScreenModal(true); onClose(); } },
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
