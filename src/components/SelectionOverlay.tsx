import React, { useLayoutEffect, useRef, useState } from 'react';
import { LEGAL_CHILDREN } from '../types/mockup';
import { useMockupStore } from '../store/mockupStore';
import { findNodeById } from '../utils/treeHelpers';
import { AddChildChip } from './AddChildChip';

interface Props {
  screenId: string;
  /** Current canvas zoom: the overlay lives inside the scaled surface, so
      measured viewport px are divided back to surface px. Pan needs no math —
      the surface transform carries the overlay along with the content. */
  zoom: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Screen-level selection chrome (#382): the type badge and "+" add chip for
 * the primary selection, positioned over the screen frame instead of inside
 * the node's own wrapper.
 *
 * The old in-wrapper placement put an absolutely positioned box 28px below
 * the node *inside* the toolbar-view's `overflow: auto` scroller, so merely
 * selecting a node grew that scroller's scrollable overflow and Chromium
 * painted a phantom scrollbar (and clipped the badge above the edge). The
 * overlay is a sibling of the scroll content, so it can never extend any
 * ancestor scroller's overflow region — and nothing clips it at window edges.
 *
 * Geometry is measured from the laid-out DOM after commit (a render-phase
 * read would see the pre-commit transform under zoom), and re-measured on
 * inner scroller scrolls, window resizes, and node-box resizes (adw element
 * upgrades, font loads). Zoom/pan/doc edits re-render through props/store.
 */
export const SelectionOverlay: React.FC<Props> = ({ screenId, zoom }) => {
  const selectedNodeId = useMockupStore((s) => s.selectedNodeId);
  const doc = useMockupStore((s) => s.doc);
  const rootRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  const screen = doc.screens.find((s) => s.id === screenId);
  const node = screen && selectedNodeId
    ? findNodeById([screen.rootNode], selectedNodeId)
    : null;
  const legalAdds = node ? LEGAL_CHILDREN[node.type] ?? [] : [];

  // The node object identity changes on every document edit that touches it
  // (the store updates immutably), so [node, zoom] covers selection, edits,
  // and zoom; pan re-renders through the parent without moving the node
  // relative to its frame.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const frame = root?.parentElement;
    if (!root || !frame || !node) {
      setBox(null);
      return;
    }
    const id = node.id;
    const measure = () => {
      const target = frame.querySelector<HTMLElement>(
        `[data-node-id="${CSS.escape(id)}"]`,
      );
      if (!target) {
        setBox(null);
        return;
      }
      const r = target.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setBox(null);
        return;
      }
      const fr = root.getBoundingClientRect();
      const scale = zoom || 1;
      const next: Box = {
        x: (r.left - fr.left) / scale,
        y: (r.top - fr.top) / scale,
        w: r.width / scale,
        h: r.height / scale,
      };
      setBox((prev) =>
        prev !== null &&
        prev.x === next.x && prev.y === next.y &&
        prev.w === next.w && prev.h === next.h
          ? prev
          : next,
      );
    };
    measure();
    frame.addEventListener('scroll', measure, { capture: true, passive: true });
    window.addEventListener('resize', measure);
    const nodeEl = frame.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
    const ro = new ResizeObserver(measure);
    if (nodeEl) ro.observe(nodeEl);
    return () => {
      frame.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [node, zoom]);

  if (!node || !box) return <div ref={rootRef} className="protota-selection-overlay" aria-hidden="true" />;

  const empty = !node.children || node.children.length === 0;
  // An empty container centers the chip over its (near-zero) box, as the old
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
