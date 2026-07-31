import React from "react";
import { useMockupStore } from "../store/mockupStore";
import {
  computeAlignEdits, computeDistributeEdits,
  type AlignMode, type DistributeAxis,
} from "../utils/alignDistribute";

/**
 * Inspector content when 2+ nodes are selected (#79): the six standard align
 * buttons plus distribute, implemented as constraint property edits
 * (penpot-study.md §6 — "adopt the UI vocabulary, reject the
 * implementation"). Each operation commits ONE undo snapshot via
 * updateNodesProps. Distribute is disabled with an inline reason when the
 * selection has no constraint meaning for it.
 */

const ALIGN_BUTTONS: Array<{ mode: AlignMode; label: string; title: string }> = [
  { mode: "start", label: "⇤", title: "Align start (halign: start)" },
  { mode: "center-h", label: "⇹", title: "Center horizontally (halign: center)" },
  { mode: "end", label: "⇥", title: "Align end (halign: end)" },
  { mode: "top", label: "⤒", title: "Align top (valign: start)" },
  { mode: "center-v", label: "⇳", title: "Center vertically (valign: center)" },
  { mode: "bottom", label: "⤓", title: "Align bottom (valign: end)" },
];

export const MultiSelectPanel: React.FC = () => {
  const { doc, selectedNodeIds, updateNodesProps, deleteSelectedNodes } = useMockupStore();

  const applyAlign = (mode: AlignMode) => {
    const edits = computeAlignEdits(doc, selectedNodeIds, mode);
    if (edits.length) updateNodesProps(edits);
  };

  const distribute = (axis: DistributeAxis) => computeDistributeEdits(doc, selectedNodeIds, axis);
  const distH = distribute("horizontal");
  const distV = distribute("vertical");

  const applyDistribute = (axis: DistributeAxis) => {
    const result = axis === "horizontal" ? distH : distV;
    if (result.ok) updateNodesProps(result.edits);
  };

  return (
    <div data-testid="multi-select-panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "14px", fontWeight: 700 }}>
        {selectedNodeIds.length} items selected
      </div>

      <div>
        <span className="protota-field-label" style={{ fontSize: "10px" }}>Align</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", marginTop: "4px" }}>
          {ALIGN_BUTTONS.map(({ mode, label, title }) => (
            <button
              key={mode}
              className="adw-button flat"
              data-testid={`align-${mode}`}
              title={title}
              aria-label={title}
              onClick={() => applyAlign(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="protota-field-label" style={{ fontSize: "10px" }}>Distribute</span>
        <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
          <button
            className="adw-button flat"
            data-testid="distribute-horizontal"
            title="Distribute horizontally (hexpand on each sibling)"
            disabled={!distH.ok}
            onClick={() => applyDistribute("horizontal")}
            style={{ flex: 1 }}
          >
            ⇿ H
          </button>
          <button
            className="adw-button flat"
            data-testid="distribute-vertical"
            title="Distribute vertically (vexpand on each sibling)"
            disabled={!distV.ok}
            onClick={() => applyDistribute("vertical")}
            style={{ flex: 1 }}
          >
            ⇕ V
          </button>
        </div>
        {!distH.ok && !distV.ok && (
          <div data-testid="distribute-note" style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px" }}>
            {distH.reason === distV.reason
              ? distH.reason
              : `H: ${distH.reason} · V: ${distV.reason}`}
          </div>
        )}
      </div>

      <hr className="protota-divider" />

      <button
        className="adw-button destructive"
        data-testid="delete-selected"
        onClick={deleteSelectedNodes}
      >
        Delete {selectedNodeIds.length} items
      </button>
    </div>
  );
};
