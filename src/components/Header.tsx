import React from "react";
import { useMockupStore } from "../store/mockupStore";
import {
  sidebarShowSymbolic,
  editUndoSymbolic,
  editRedoSymbolic,
  sidebarShowRightSymbolic,
} from "@gjsify/adwaita-icons/actions";
import { exportDocumentFile } from "../utils/exportImport";
import { iconStyle } from "../utils/iconStyles";
import { TopBar } from "./TopBar";
import { AppMenuButton } from "./AppMenuButton";

interface HeaderProps {
  leftOpen: boolean;
  onToggleLeft: () => void;
  rightOpen: boolean;
  onToggleRight: () => void;
}

/**
 * The app's adw-header-bar: start slot = Layers toggle + Undo/Redo + the
 * desktop menu bar (TopBar); end slot = export actions + the app-menu button
 * (hamburger: theme switcher + overflow) + the Properties toggle.
 */
export const Header: React.FC<HeaderProps> = ({
  leftOpen,
  onToggleLeft,
  rightOpen,
  onToggleRight,
}) => {
  const { doc, undo, redo } = useMockupStore();

  return (
    <adw-header-bar slot="top">
      {/* Start slot: Layers toggle + Undo/Redo + Menu buttons */}
      <div slot="start" style={{ display: "flex", gap: "2px", alignItems: "center" }}>
        <button
          className={`adw-button flat${leftOpen ? " active" : ""}`}
          onClick={onToggleLeft}
          title="Toggle Layers Panel (Ctrl+\)"
          aria-label="Toggle Layers"
        >
          <span style={iconStyle(sidebarShowSymbolic)} />
        </button>
        <button className="adw-button flat" onClick={undo} title="Undo (Ctrl+Z)">
          <span style={iconStyle(editUndoSymbolic)} />
        </button>
        <button className="adw-button flat" onClick={redo} title="Redo (Ctrl+Shift+Z)">
          <span style={iconStyle(editRedoSymbolic)} />
        </button>
        <TopBar />
      </div>
      {/* End slot: Export actions + app-menu button + Properties toggle */}
      <div slot="end" style={{ display: "flex", gap: "2px", alignItems: "center" }}>
        <button
          className="adw-button flat protota-desktop-only"
          onClick={() => window.dispatchEvent(new CustomEvent("protota:share"))}
          title="Copy a shareable link"
        >
          Share
        </button>
        <button
          className="adw-button flat protota-desktop-only"
          onClick={() => exportDocumentFile(doc)}
          title="Download the document as .mockup.json"
        >
          Save JSON
        </button>
        <button
          className="adw-button flat protota-desktop-only"
          onClick={() => window.dispatchEvent(new CustomEvent("protota:code-export"))}
          title="View generated Blueprint code"
        >
          Code Export
        </button>
        <button
          className="adw-button flat protota-desktop-only"
          onClick={() => window.dispatchEvent(new CustomEvent("protota:export-png"))}
          title="Export the focused screen as PNG"
        >
          PNG
        </button>
        {/* The header app-menu button (hamburger): theme switcher + overflow.
            Before the Properties toggle, on every viewport. */}
        <AppMenuButton />
        <button
          className={`adw-button flat${rightOpen ? " active" : ""}`}
          onClick={onToggleRight}
          title="Toggle Properties Panel (Ctrl+])"
          aria-label="Toggle Properties"
        >
          <span style={iconStyle(sidebarShowRightSymbolic)} />
        </button>
      </div>
    </adw-header-bar>
  );
};
