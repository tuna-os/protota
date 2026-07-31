import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMockupStore } from '../store/mockupStore';
import type { AdwNode, AdwNodeType } from '../types/mockup';
import { LEGAL_CHILDREN } from '../types/mockup';
import { findNodeById, findNodeLocation } from '../utils/treeHelpers';
import { useDndStore } from '../dnd/dndStore';

/** Where a row drop lands relative to the row (#79). */
type DropPosition = 'before' | 'inside' | 'after';

interface RowDrop {
  rowId: string;
  position: DropPosition;
  parentId: string;
  index: number;
  screenId: string;
}

/** One visible row of the layer tree, in document order. */
interface LayerRow {
  node: AdwNode;
  screenId: string;
  depth: number;
  parentId: string | null;
  hasChildren: boolean;
  expanded: boolean;
}

/** The id of the container holding `nodeId`, or null. */
function findParentIdOf(root: AdwNode, nodeId: string): string | null {
  if (root.children?.some((child) => child.id === nodeId)) return root.id;
  for (const child of root.children ?? []) {
    const found = findParentIdOf(child, nodeId);
    if (found) return found;
  }
  return null;
}

export const LayersPanel: React.FC = () => {
  const {
    doc, selectedNodeId, selectNode, updateNodeProps, moveNodeUp, moveNodeDown,
    moveNode, addChildNode,
  } = useMockupStore();

  // The panel had no expand state before keyboard navigation; collapse is a
  // view concern, so it lives here rather than in the document.
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const treeRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  // Flatten the trees into the visible order arrow keys walk through.
  const rows = useMemo(() => {
    const out: LayerRow[] = [];
    const visit = (node: AdwNode, screenId: string, depth: number, parentId: string | null) => {
      const hasChildren = (node.children?.length ?? 0) > 0;
      const expanded = hasChildren && !collapsedIds.has(node.id);
      out.push({ node, screenId, depth, parentId, hasChildren, expanded });
      if (expanded) node.children!.forEach((child) => visit(child, screenId, depth + 1, node.id));
    };
    doc.screens.forEach((screen) => visit(screen.rootNode, screen.id, 0, null));
    return out;
  }, [doc, collapsedIds]);

  // Roving tabindex: exactly one row is tabbable — the selection, else the top.
  const focusableId = rows.some((r) => r.node.id === selectedNodeId)
    ? selectedNodeId
    : rows[0]?.node.id ?? null;

  // Focus follows selection, but only while the tree owns focus — clicking a
  // node on the canvas must not yank focus into the panel.
  useEffect(() => {
    if (!selectedNodeId || renamingId) return;
    if (!treeRef.current?.contains(document.activeElement)) return;
    rowRefs.current.get(selectedNodeId)?.focus();
  }, [selectedNodeId, rows, renamingId]);

  const setCollapsed = (nodeId: string, collapsed: boolean) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (collapsed) next.add(nodeId);
      else next.delete(nodeId);
      return next;
    });
  };

  const beginRename = (row: LayerRow) => {
    setRenamingId(row.node.id);
    setDraftTitle(row.node.title ?? '');
  };

  const endRename = (commit: boolean) => {
    const nodeId = renamingId;
    if (!nodeId) return;
    if (commit) updateNodeProps(nodeId, { title: draftTitle });
    setRenamingId(null);
    // The input unmounts on the next render; hand focus back to the row.
    requestAnimationFrame(() => rowRefs.current.get(nodeId)?.focus());
  };

  const handleTreeKeyDown = (e: React.KeyboardEvent) => {
    if (renamingId) return; // The rename input owns the keyboard.
    const index = rows.findIndex((r) => r.node.id === selectedNodeId);
    const row = index >= 0 ? rows[index] : null;

    const handled = () => {
      // Stop before the window listeners in App/ViewportCanvas so tree
      // navigation never double-triggers a global shortcut.
      e.preventDefault();
      e.stopPropagation();
    };

    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.altKey && row) {
      handled();
      if (e.key === 'ArrowUp') moveNodeUp(row.node.id);
      else moveNodeDown(row.node.id);
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return; // Leave modified keys to the global handlers.

    switch (e.key) {
      case 'ArrowDown': {
        handled();
        const next = index < 0 ? rows[0] : rows[index + 1];
        if (next) selectNode(next.node.id, next.screenId);
        return;
      }
      case 'ArrowUp': {
        handled();
        const prev = index < 0 ? rows[rows.length - 1] : rows[index - 1];
        if (prev) selectNode(prev.node.id, prev.screenId);
        return;
      }
      case 'ArrowRight': {
        if (!row || !row.hasChildren) return;
        handled();
        if (!row.expanded) setCollapsed(row.node.id, false);
        else {
          const firstChild = rows[index + 1];
          if (firstChild) selectNode(firstChild.node.id, firstChild.screenId);
        }
        return;
      }
      case 'ArrowLeft': {
        if (!row) return;
        handled();
        if (row.expanded) setCollapsed(row.node.id, true);
        else if (row.parentId) selectNode(row.parentId, row.screenId);
        return;
      }
      case 'Enter':
      case 'F2': {
        if (!row) return;
        handled();
        beginRename(row);
        return;
      }
    }
  };

  // --- Drag to reorder/reparent (#79). Rows are the drop targets: the top
  // quarter inserts before the row, the bottom quarter after it, and the
  // middle drops into the row when it is a legal container. The drop commits
  // one moveNode (tree drags) or addChildNode (palette drags) — one undo
  // entry, nothing touched during hover.
  const [dropHint, setDropHint] = useState<RowDrop | null>(null);

  /** What is being dragged: the palette type, or a tree node's type + subtree. */
  const dragPayload = (): { type: AdwNodeType; dragged: AdwNode | null } | null => {
    const drag = useDndStore.getState().drag;
    if (!drag) return null;
    if (drag.kind === 'palette') return { type: drag.widgetType, dragged: null };
    for (const screen of doc.screens) {
      const node = findNodeById([screen.rootNode], drag.nodeId);
      if (node) return { type: node.type, dragged: node };
    }
    return null;
  };

  const canDropIn = (parent: AdwNode, type: AdwNodeType, dragged: AdwNode | null): boolean => {
    if (!(LEGAL_CHILDREN[parent.type] ?? []).includes(type)) return false;
    // A node cannot land in itself or its own descendant.
    return !dragged || findNodeById([dragged], parent.id) === null;
  };

  /** Resolve a hover over a row to `{ parent, index }`, or null when illegal. */
  const resolveRowDrop = (row: LayerRow, e: React.DragEvent): RowDrop | null => {
    const payload = dragPayload();
    if (!payload) return null;
    const screen = doc.screens.find((s) => s.id === row.screenId);
    if (!screen) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientY - rect.top) / Math.max(rect.height, 1);
    const primary: DropPosition = fraction < 0.25 ? 'before' : fraction > 0.75 ? 'after' : 'inside';
    const nearEdge: DropPosition = fraction < 0.5 ? 'before' : 'after';
    const candidates = [...new Set<DropPosition>([primary, nearEdge, 'inside', 'before', 'after'])];

    for (const position of candidates) {
      if (position === 'inside') {
        if (!canDropIn(row.node, payload.type, payload.dragged)) continue;
        return {
          rowId: row.node.id, position, parentId: row.node.id,
          index: row.node.children?.length ?? 0, screenId: row.screenId,
        };
      }
      if (!row.parentId) continue; // screen roots have no siblings
      const parent = findNodeById([screen.rootNode], row.parentId);
      if (!parent || !canDropIn(parent, payload.type, payload.dragged)) continue;
      const loc = findNodeLocation(screen.rootNode, row.node.id);
      if (!loc) continue;
      return {
        rowId: row.node.id, position, parentId: parent.id,
        index: loc.index + (position === 'after' ? 1 : 0), screenId: row.screenId,
      };
    }
    return null;
  };

  const handleRowDragStart = (row: LayerRow, e: React.DragEvent) => {
    if (renamingId) { e.preventDefault(); return; }
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', row.node.id);
    e.dataTransfer.effectAllowed = 'move';
    useDndStore.getState().startDrag({ kind: 'node', nodeId: row.node.id });
  };

  const handleRowDragOver = (row: LayerRow, e: React.DragEvent) => {
    const drop = resolveRowDrop(row, e);
    if (drop) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = useDndStore.getState().drag?.kind === 'palette' ? 'copy' : 'move';
    }
    setDropHint(drop);
  };

  const handleRowDrop = (row: LayerRow, e: React.DragEvent) => {
    const drop = resolveRowDrop(row, e);
    const drag = useDndStore.getState().drag;
    setDropHint(null);
    useDndStore.getState().endDrag();
    if (!drop || !drag) return;
    e.preventDefault();
    e.stopPropagation();
    if (drag.kind === 'palette') {
      const id = addChildNode(drop.parentId, drag.widgetType, undefined, drop.index);
      if (id) selectNode(id, drop.screenId);
    } else {
      // Moving to a new parent clears the old slot (the new container decides
      // placement); reordering under the same parent keeps it.
      const screen = doc.screens.find((s) => s.id === drop.screenId);
      const currentParent = screen ? findParentIdOf(screen.rootNode, drag.nodeId) : null;
      moveNode(drag.nodeId, drop.parentId, drop.index,
        currentParent === drop.parentId ? undefined : '');
      selectNode(drag.nodeId, drop.screenId);
    }
    // Make the result visible when dropping into a collapsed container.
    if (drop.position === 'inside') setCollapsed(drop.parentId, false);
  };

  const handleRowDragEnd = () => {
    setDropHint(null);
    useDndStore.getState().endDrag();
  };

  const renderRow = (row: LayerRow) => {
    const { node, depth, hasChildren, expanded } = row;
    const isSelected = selectedNodeId === node.id;
    const isRenaming = renamingId === node.id;
    const hint = dropHint?.rowId === node.id ? dropHint.position : null;

    return (
      <div
        key={node.id}
        ref={(el) => {
          if (el) rowRefs.current.set(node.id, el);
          else rowRefs.current.delete(node.id);
        }}
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? expanded : undefined}
        tabIndex={node.id === focusableId ? 0 : -1}
        data-testid="layer-row"
        data-node-id={node.id}
        {...(hint ? { 'data-drop-position': hint } : {})}
        draggable={!isRenaming}
        style={{ marginLeft: `${depth * 14}px` }}
        className={`protota-tree-item${isSelected ? ' protota-tree-item--selected' : ''}${hint ? ` protota-tree-item--drop-${hint}` : ''}`}
        onClick={() => selectNode(node.id, row.screenId)}
        onDoubleClick={() => beginRename(row)}
        onDragStart={(e) => handleRowDragStart(row, e)}
        onDragOver={(e) => handleRowDragOver(row, e)}
        onDragLeave={(e) => {
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node) &&
              dropHint?.rowId === node.id) setDropHint(null);
        }}
        onDrop={(e) => handleRowDrop(row, e)}
        onDragEnd={handleRowDragEnd}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 }}>
          <span
            aria-hidden="true"
            style={{ width: '12px', flexShrink: 0, opacity: 0.6 }}
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) setCollapsed(node.id, expanded);
            }}
          >
            {hasChildren ? (expanded ? '▾' : '▸') : ''}
          </span>
          {isRenaming ? (
            <input
              data-testid="layer-rename-input"
              aria-label="Rename layer"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- rename begins on explicit user action
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') endRename(true);
                else if (e.key === 'Escape') endRename(false);
              }}
              onBlur={() => endRename(true)}
              style={{ flex: 1, minWidth: 0, font: 'inherit' }}
            />
          ) : (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.type.replace('adw-', '')} ({node.title || 'Untitled'})
            </span>
          )}
        </span>
      </div>
    );
  };

  // Rows render flat (indent via margin); screens group their own subtrees.
  let cursor = 0;
  return (
    <div ref={treeRef} role="tree" aria-label="Layers" onKeyDown={handleTreeKeyDown} style={{ padding: '12px' }}>
      {doc.screens.map((screen) => {
        const screenRows: LayerRow[] = [];
        while (cursor < rows.length && rows[cursor].screenId === screen.id) {
          screenRows.push(rows[cursor]);
          cursor += 1;
        }
        return (
          <div key={screen.id} style={{ marginBottom: '16px' }}>
            <div className="protota-screen-label" style={{ marginBottom: '6px' }}>
              🖥 {screen.title}
            </div>
            {screenRows.map(renderRow)}
          </div>
        );
      })}
    </div>
  );
};
