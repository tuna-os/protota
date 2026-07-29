import React from "react";
import { useMockupStore } from "../store/mockupStore";
import { computerSymbolic, phoneSymbolic } from "@gjsify/adwaita-icons/devices";
import { toDataUri } from "@gjsify/adwaita-icons/utils";

interface BottomBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  desktopScreenId: string | null;
  onToggleDesktop: () => void;
  phoshScreenId: string | null;
  onTogglePhone: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  desktopScreenId,
  onToggleDesktop,
  phoshScreenId,
  onTogglePhone,
}) => {
  return (
    <div className="protota-zoom-bar">
      <button
        className="adw-button icon-only flat"
        onClick={onZoomOut}
        title="Zoom Out (Ctrl+-)"
      >
        <span className="adw-icon adw-icon--list-remove"></span>
      </button>
      <span
        style={{ fontSize: "var(--font-size-small, 9pt)", minWidth: "40px", textAlign: "center" }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        className="adw-button icon-only flat"
        onClick={onZoomIn}
        title="Zoom In (Ctrl+=)"
      >
        <span className="adw-icon adw-icon--list-add"></span>
      </button>
      <button
        className="adw-button flat"
        onClick={onZoomReset}
        title="Reset Zoom (Ctrl+0)"
      >
        Reset
      </button>
      <span style={{ width: '1px', height: '16px', background: 'var(--separator-color, rgba(0,0,6,0.12))', margin: '0 4px' }} />
      <button
        className={`adw-button flat${desktopScreenId ? " active" : ""}`}
        onClick={onToggleDesktop}
        title="Toggle Desktop Preview"
      >
        <span
          style={{
            display: "inline-block",
            width: "16px",
            height: "16px",
            maskImage: toDataUri(computerSymbolic),
            WebkitMaskImage: toDataUri(computerSymbolic),
            maskSize: "contain",
            WebkitMaskSize: "contain",
            backgroundColor: "currentColor",
          }}
        />
        Desktop
      </button>
      <button
        className={`adw-button flat${phoshScreenId ? " active" : ""}`}
        onClick={onTogglePhone}
        title="Toggle Phone Preview"
      >
        <span
          style={{
            display: "inline-block",
            width: "16px",
            height: "16px",
            maskImage: toDataUri(phoneSymbolic),
            WebkitMaskImage: toDataUri(phoneSymbolic),
            maskSize: "contain",
            WebkitMaskSize: "contain",
            backgroundColor: "currentColor",
          }}
        />
        Phone
      </button>
    </div>
  );
};
