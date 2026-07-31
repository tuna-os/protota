import React from "react";
import { useMockupStore } from "../store/mockupStore";
import { WIDGET_SCHEMAS } from "../schemas/widgetSchemas";
import { LEGAL_SLOTS } from "../types/mockup";
import type { AdwNode } from "../types/mockup";
import { findNodeById } from "../utils/treeHelpers";
import { NodeActions } from "./NodeActions";
import { IconPicker } from "./IconPicker";
import { MultiSelectPanel } from "./MultiSelectPanel";

export const InspectorPanel: React.FC = () => {
  const { doc, selectedNodeId, selectedNodeIds, selectedScreenId, updateNodeProps, addEdge, removeEdge } = useMockupStore();

  const selectedScreen = doc.screens.find((s) => s.id === selectedScreenId);
  const selectedNode: AdwNode | null = (() => {
    if (!selectedNodeId || !selectedScreen) return null;
    return findNodeById([selectedScreen.rootNode], selectedNodeId);
  })();
  // The slot decides where a container places this child — a header bar's
  // start, a toolbar view's top, a row's suffix. Editable here so users get
  // the placement control the agent API has.
  const parentNode: AdwNode | null = (() => {
    if (!selectedNode || !selectedScreen) return null;
    const search = (node: AdwNode): AdwNode | null => {
      if (node.children?.some((child) => child.id === selectedNode.id)) return node;
      for (const child of node.children ?? []) {
        const found = search(child);
        if (found) return found;
      }
      return null;
    };
    return search(selectedScreen.rootNode);
  })();
  const availableSlots: string[] = parentNode ? LEGAL_SLOTS[parentNode.type] ?? [] : [];

  // Flow edges belong to the screen containing the selection.
  const showFlowEditor = !!selectedScreen && doc.screens.length > 1;
  const outgoingEdges = showFlowEditor
    ? doc.edges.filter((edge) => edge.sourceId === selectedScreen.id)
    : [];
  const flowTargets = showFlowEditor
    ? doc.screens.filter((screen) =>
        screen.id !== selectedScreen.id &&
        !outgoingEdges.some((edge) => edge.targetId === screen.id))
    : [];

  // Multi-selection replaces the single-node inspector with the
  // align/distribute toolbar (#79).
  if (selectedNodeIds.length >= 2) {
    return <MultiSelectPanel />;
  }

  if (!selectedNode) {
    return (
      <div style={{ padding: "16px", opacity: 0.5, fontStyle: "italic" }}>
        Select an element on the canvas to inspect.
      </div>
    );
  }

  const schema = WIDGET_SCHEMAS[selectedNode.type] || [];

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <NodeActions nodeId={selectedNode.id} />

      <div>
        <span className="protota-field-label" style={{ fontSize: "10px" }}>
          Widget Type
        </span>
        <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: "Adwaita Mono" }}>
          {selectedNode.type}
        </div>
      </div>

      {showFlowEditor && (
        <div data-testid="flow-editor">
          <span className="protota-field-label" style={{ fontSize: "10px" }}>
            Flows from “{selectedScreen.title}”
          </span>
          {outgoingEdges.map((edge) => {
            const target = doc.screens.find((screen) => screen.id === edge.targetId);
            return (
              <div key={edge.id} style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                <span style={{ flex: 1, fontSize: "12px" }}>→ {target?.title ?? edge.targetId}</span>
                <button className="adw-button flat" aria-label={`Remove flow to ${target?.title ?? edge.targetId}`} onClick={() => removeEdge(edge.id)}>
                  ✕
                </button>
              </div>
            );
          })}
          {flowTargets.length > 0 && (
            <select
              className="protota-input"
              aria-label="Add flow to screen"
              value=""
              onChange={(event) => { if (event.target.value) addEdge(selectedScreen.id, event.target.value); }}
              style={{ marginTop: "6px", width: "100%" }}
            >
              <option value="">Add flow to…</option>
              {flowTargets.map((screen) => (
                <option key={screen.id} value={screen.id}>{screen.title}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {availableSlots.length > 0 && (
        <div data-testid="slot-selector">
          <label className="protota-field-label" htmlFor="protota-slot">
            Slot in {parentNode?.type}
          </label>
          <select
            id="protota-slot"
            className="protota-input"
            style={{ width: "100%" }}
            value={typeof selectedNode.slot === "string" ? selectedNode.slot : ""}
            onChange={(event) =>
              updateNodeProps(selectedNode.id, { slot: event.target.value || undefined })
            }
          >
            <option value="">Default placement</option>
            {availableSlots.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
        </div>
      )}

      {/* Alignment is how GTK positions a widget: there are no coordinates,
          so these properties are the equivalent of a design tool's align and
          fill controls. */}
      <div data-testid="alignment-controls">
        <span className="protota-field-label" style={{ fontSize: "10px" }}>Alignment</span>
        <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
          {(["halign", "valign"] as const).map((axis) => (
            <select
              key={axis}
              className="protota-input"
              aria-label={axis === "halign" ? "Horizontal alignment" : "Vertical alignment"}
              value={typeof selectedNode[axis] === "string" ? (selectedNode[axis] as string) : ""}
              onChange={(event) =>
                updateNodeProps(selectedNode.id, { [axis]: event.target.value || undefined })
              }
              style={{ flex: 1 }}
            >
              <option value="">{axis === "halign" ? "H: default" : "V: default"}</option>
              <option value="fill">fill</option>
              <option value="start">start</option>
              <option value="center">center</option>
              <option value="end">end</option>
            </select>
          ))}
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
          {(["hexpand", "vexpand"] as const).map((flag) => (
            <label key={flag} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
              <input
                type="checkbox"
                checked={selectedNode[flag] === true}
                onChange={(event) =>
                  updateNodeProps(selectedNode.id, { [flag]: event.target.checked || undefined })
                }
              />
              {flag}
            </label>
          ))}
        </div>
      </div>

      <hr className="protota-divider" />

      {schema.map((field) => {
        const value = selectedNode[field.key] ?? field.defaultValue ?? "";

        return (
          <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label className="protota-field-label">{field.label}</label>

            {field.type === "string" && (
              <input
                type="text"
                className="protota-input"
                value={String(value)}
                onChange={(e) => updateNodeProps(selectedNode.id, { [field.key]: e.target.value })}
              />
            )}
            {field.type === "boolean" && (
              <label
                style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) =>
                    updateNodeProps(selectedNode.id, { [field.key]: e.target.checked })
                  }
                />
                <span style={{ fontSize: "13px" }}>Enabled</span>
              </label>
            )}
            {field.type === "number" && (
              <input
                type="number"
                className="protota-input"
                value={Number(value)}
                onChange={(e) =>
                  updateNodeProps(selectedNode.id, { [field.key]: Number(e.target.value) })
                }
              />
            )}
            {field.type === "icon" && (
              <IconPicker
                value={String(value)}
                onChange={(iconName: string) =>
                  updateNodeProps(selectedNode.id, { [field.key]: iconName })
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
