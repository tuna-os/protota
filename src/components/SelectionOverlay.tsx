import React, { useLayoutEffect, useRef, useState } from 'react';
import { LEGAL_CHILDREN } from '../types/mockup';
import { useMockupStore } from '../store/mockupStore';
import { findNodeById } from '../utils/treeHelpers';
import { AddChildChip } from './AddChildChip';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Screen-level selection chrome (#382): the type badge and "+" add chip for
 * the primary selection, in a canvas-level `position: fixed` overlay —
 * the same pattern as the marquee and drop-indicator chrome — instead of
 * inside the node's own wrapper.
 *
 * The old in-wrapper placement put an absolutely positioned box 28px below
 * the node *inside* the toolbar-view's `overflow: auto` scroller, so merely
 * selecting a node grew that scroller's scrollable overflow and Chromium
 * painted a phantom scrollbar (and clipped the badge above the edge). The
 * overlay is a sibling of every scroll container, so it can never extend an
 * ancestor scroller's overflow region — and nothing clips it at window
 * edges. It also has to live outside the zoomed surface: the surface's
 * transform traps descendant z-indexes below the zoom bar, while the
 * overlay's own layer keeps the add popover clickable wherever it opens.
 *
 * Geometry is a viewport rect re-measured every animation frame while a
 * node is selected. That single mechanism follows zoom, pan, zoom-glide
 * transitions, inner scroller scrolls, resizes, and late layout shifts
 * (adw element upgrades, font loads) with no listener bookkeeping; the
 * guarded setBox below commits a re-render only when the rect moved, so an
 * idle selection costs one cheap rect read per frame and no DOM churn.
 *
 * The anchor is the selected node's WRAPPER box — the same box the outline
 * draws on — not the node element's own box: a selected wrapper is a plain
 * block (often full row width), so this reproduces the old in-wrapper
 * placement exactly. In particular a childless node (e.g. a button) centers
 * the chip in the row rather than over its own click center, so clicks and
 * drags starting on the node never land on the chip.
 */
export const SelectionOverlay: React.FC = () => {
  const selectedNodeId = useMockupStore((s) => s.selectedNodeId);
  const doc = useMockupStore((s) => s.doc);
  const rootRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  let node = null;
  for (const screen of doc.screens) {
    node = selectedNodeId ? findNodeById([screen.rootNode], selectedNodeId) : null;
    if (node) break;
  }
  const legalAdds = node ? LEGAL_CHILDREN[node.type] ?? [] : [];

  // The node object identity changes on every document edit that touches it
  // (the store updates immutably), so the loop below always measures the
  // current selection; pan/zoom/scroll need no subscription since every
  // frame reads the live layout.
  useLayoutEffect(() => {
    if (!node) {
      setBox(null);
      return;
    }
    const id = node.id;
    let raf = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const target = document.querySelector<HTMLElement>(
        `.protota-canvas [data-node-id="${CSS.escape(id)}"]`,
      );
      // The outline's box, when the selected wrapper has materialised;
      // the node box itself as a fallback.
      const anchor = target?.closest('.adw-node-wrapper') ?? target;
      if (!anchor) {
        setBox(null);
      } else {
        const r = anchor.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          setBox(null);
        } else {
          const next: Box = { x: r.left, y: r.top, w: r.width, h: r.height };
          setBox((prev) =>
            prev !== null &&
            prev.x === next.x && prev.y === next.y &&
            prev.w === next.w && prev.h === next.h
              ? prev
              : next,
          );
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [node]);

  if (!node || !box) return <div ref={rootRef} className="protota-selection-overlay" aria-hidden="true" />;

  const empty = !node.children || node.children.length === 0;
  // An empty container centers the chip in the wrapper row, as the old
  // in-flow `--centered` placement did; a populated one keeps the chip at
  // the old pill-row position below the node.
  const chipStyle: React.CSSProperties = empty
    ? { left: box.x + box.w / 2, top: box.y + box.h / 2, bottom: 'auto', transform: 'translate(-50%, -50%)' }
    : { left: box.x, top: box.y + box.h + 4, bottom: 'auto' };

  return (
    <div ref={rootRef} className="protota-selection-overlay">
      <div
        className="protota-type-badge"
        style={{ left: box.x, top: box.y, transform: 'translateY(calc(-100% - 3px))' }}
      >
        {node.type}
      </div>
      {legalAdds.length > 0 && (
        <AddChildChip
          nodeId={node.id}
          nodeType={node.type}
          legalAdds={legalAdds}
          centered={empty}
          style={chipStyle}
        />
      )}
    </div>
  );
};
