import React, { useState, useRef, useEffect } from "react";
import { useMockupStore } from "../store/mockupStore";
import { LEGAL_CHILDREN, type AdwNodeType } from "../types/mockup";
import { findNodeById } from "../utils/treeHelpers";
import { ALL_WIDGETS } from "./widgetCatalog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<Props> = ({ isOpen, onClose }) => {
  const { doc, selectedNodeId, selectedScreenId, addChildNode } = useMockupStore();
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (isOpen) {
      (el as any).present?.();
    } else {
      (el as any).close?.();
    }
  }, [isOpen]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => onClose();
    el.addEventListener('closed', handler);
    return () => el.removeEventListener('closed', handler);
  }, [isOpen, onClose]);
  const selectedNode = (() => {
    if (!selectedNodeId || !selectedScreenId) return null;
    const screen = doc.screens.find((s) => s.id === selectedScreenId);
    if (!screen) return null;
    return findNodeById([screen.rootNode], selectedNodeId);
  })();
  const legalTypes = selectedNode ? LEGAL_CHILDREN[selectedNode.type] || [] : null;

  const filtered = ALL_WIDGETS.filter((w) => {
    const matchesSearch = !search || w.label.toLowerCase().includes(search.toLowerCase());
    if (!legalTypes) return false;
    return legalTypes.includes(w.type) && matchesSearch;
  });

  const handleSelect = (type: AdwNodeType) => {
    if (selectedNodeId) addChildNode(selectedNodeId, type);
    onClose();
  };

  return (
    <adw-dialog
      ref={dialogRef}
      title="Add Widget"
      content-width={440}
      can-close=""
      style={{ zIndex: 2000 }}
    >
      <div
        className="protota-modal protota-command-palette"
        style={{
          maxHeight: "340px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--separator-color)" }}>
          <input
            ref={inputRef}
            className="protota-input protota-command-palette-search"
            type="text"
            placeholder={selectedNode ? "Add widget…" : "Select a container first"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              fontSize: "15px",
              outline: "none",
              fontFamily: "inherit",
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && filtered.length > 0) handleSelect(filtered[0].type);
            }}
          />
        </div>
        <div style={{ overflow: "auto", flex: 1, padding: "6px" }}>
          {!selectedNode && (
            <div style={{ padding: "12px", textAlign: "center", opacity: 0.5, fontSize: "13px" }}>
              Select a container on the canvas first, then use the palette.
            </div>
          )}
          {filtered.map((w) => (
            <div
              key={w.type}
              onClick={() => handleSelect(w.type)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--button-bg-color)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>{w.label}</div>
                <div style={{ fontSize: "11px", opacity: 0.5 }}>{w.desc}</div>
              </div>
              <span style={{ fontSize: "10px", opacity: 0.3, fontFamily: "Adwaita Mono" }}>
                {w.type}
              </span>
            </div>
          ))}
          {filtered.length === 0 && search && selectedNode && (
            <div style={{ padding: "12px", textAlign: "center", opacity: 0.5, fontSize: "13px" }}>
              No widgets match "{search}"
            </div>
          )}
        </div>
      </div>
    </adw-dialog>
  );
};
