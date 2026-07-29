import React from "react";
import { useMockupStore } from "../store/mockupStore";
import { computerSymbolic, phoneSymbolic } from "@gjsify/adwaita-icons/devices";
import { zoomFitBestSymbolic, zoomInSymbolic, zoomOriginalSymbolic, zoomOutSymbolic } from "@gjsify/adwaita-icons/actions";
import { toDataUri } from "@gjsify/adwaita-icons/utils";

interface BottomBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
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
  onZoomFit,
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
        onClick={onZoomReset}
        title="Reset Zoom (Ctrl+0)"
      >
        <span
          className="adw-toolbar-icon"
          style={{
            maskImage: toDataUri(zoomOriginalSymbolic),
            WebkitMaskImage: toDataUri(zoomOriginalSymbolic),
          }}
        />
      </button>
      <button
        className="adw-button icon-only flat"
        onClick={onZoomOut}
        title="Zoom Out (Ctrl+-)"
      >
        <span
          className="adw-toolbar-icon"
          style={{
            maskImage: toDataUri(zoomOutSymbolic),
            WebkitMaskImage: toDataUri(zoomOutSymbolic),
          }}
        />
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
        <span
          className="adw-toolbar-icon"
          style={{
            maskImage: toDataUri(zoomInSymbolic),
            WebkitMaskImage: toDataUri(zoomInSymbolic),
          }}
        />
      </button>
      <button
        className="adw-button icon-only flat"
        onClick={onZoomFit}
        title="Fit All Screens"
      >
        <span
          className="adw-toolbar-icon"
          style={{
            maskImage: toDataUri(zoomFitBestSymbolic),
            WebkitMaskImage: toDataUri(zoomFitBestSymbolic),
          }}
        />
      </button>
      <span style={{ width: '1px', height: '16px', background: 'var(--separator-color, rgba(0,0,6,0.12))', margin: '0 4px' }} />
      <button
        className={`adw-button flat${desktopScreenId ? " active" : ""}`}
        onClick={onToggleDesktop}
        title="Toggle Desktop Preview"
      >
        <span
          className="adw-toolbar-icon"
          style={{
            maskImage: toDataUri(computerSymbolic),
            WebkitMaskImage: toDataUri(computerSymbolic),
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
          className="adw-toolbar-icon"
          style={{
            maskImage: toDataUri(phoneSymbolic),
            WebkitMaskImage: toDataUri(phoneSymbolic),
          }}
        />
        Phone
      </button>
    </div>
  );
};
