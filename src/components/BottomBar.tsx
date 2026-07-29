import React, { useRef, useEffect } from "react";
import { computerSymbolic, phoneSymbolic } from "@gjsify/adwaita-icons/devices";
import {
  zoomFitBestSymbolic,
  zoomInSymbolic,
  zoomOriginalSymbolic,
  zoomOutSymbolic,
  goPreviousSymbolic,
  goNextSymbolic,
} from "@gjsify/adwaita-icons/actions";
import { toDataUri } from "@gjsify/adwaita-icons/utils";

interface ScreenOption {
  id: string;
  title: string;
}

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
  screens: ScreenOption[];
  focusedScreenIdx: number;
  canFocusPrev: boolean;
  canFocusNext: boolean;
  onFocusPrev: () => void;
  onFocusNext: () => void;
  onSelectScreen: (idx: number) => void;
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
  screens,
  focusedScreenIdx,
  canFocusPrev,
  canFocusNext,
  onFocusPrev,
  onFocusNext,
  onSelectScreen,
}) => {
  const dropDownRef = useRef<HTMLElement & {
    options: { value: string; label: string }[];
    selected: number;
  }>(null);
  const showFocusControls = screens.length > 1;

  // Set options on the adw-drop-down web component
  useEffect(() => {
    const el = dropDownRef.current;
    if (!el) return;
    el.options = screens.map((s) => ({ value: s.id, label: s.title }));
  }, [screens]);

  // Sync selected index from parent state → web component, then override
  // the button label to show just the 1-based number instead of the title.
  useEffect(() => {
    const el = dropDownRef.current;
    if (!el) return;
    el.selected = focusedScreenIdx;
    const labelEl = el.querySelector('.adw-drop-down-label');
    if (labelEl) {
      labelEl.textContent = String(focusedScreenIdx + 1);
    }
  }, [focusedScreenIdx]);

  // Listen for user-initiated selection changes (change fires only on user interaction)
  useEffect(() => {
    const el = dropDownRef.current;
    if (!el) return;
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.index === "number") {
        onSelectScreen(detail.index);
      }
    };
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, [onSelectScreen]);

  return (
    <div className="protota-zoom-bar">
      {showFocusControls && (
        <>
          <button
            className={`adw-button icon-only flat${canFocusPrev ? "" : " disabled"}`}
            onClick={onFocusPrev}
            disabled={!canFocusPrev}
            title="Previous Screen"
          >
            <span
              className="adw-toolbar-icon"
              style={{
                maskImage: toDataUri(goPreviousSymbolic),
                WebkitMaskImage: toDataUri(goPreviousSymbolic),
              }}
            />
          </button>
          <adw-drop-down
            ref={dropDownRef}
            className="protota-screen-dropdown"
          />
          <button
            className={`adw-button icon-only flat${canFocusNext ? "" : " disabled"}`}
            onClick={onFocusNext}
            disabled={!canFocusNext}
            title="Next Screen"
          >
            <span
              className="adw-toolbar-icon"
              style={{
                maskImage: toDataUri(goNextSymbolic),
                WebkitMaskImage: toDataUri(goNextSymbolic),
              }}
            />
          </button>
          <span
            style={{
              width: "1px",
              height: "16px",
              background: "var(--separator-color, rgba(0,0,6,0.12))",
              margin: "0 4px",
            }}
          />
        </>
      )}
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
