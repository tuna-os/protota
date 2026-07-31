import React, { useRef, useEffect } from "react";
import { computerSymbolic, phoneSymbolic } from "@gjsify/adwaita-icons/devices";
import {
  zoomFitBestSymbolic,
  zoomInSymbolic,
  zoomOriginalSymbolic,
  zoomOutSymbolic,
  goPreviousSymbolic,
  goNextSymbolic,
  documentNewSymbolic,
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

/** Cached data URIs for SVG icons — avoids re-encoding on every render. */
const dataUriCache = new Map<string, string>();
function cachedDataUri(svg: string): string {
  let uri = dataUriCache.get(svg);
  if (uri === undefined) {
    uri = toDataUri(svg);
    dataUriCache.set(svg, uri);
  }
  return uri;
}

/** Reusable toolbar icon button — memoized so it skips re-render when props are unchanged. */
const ToolbarIconButton = React.memo(
  ({
    icon,
    onClick,
    title,
    disabled,
    active,
    children,
  }: {
    icon: string;
    onClick?: () => void;
    title: string;
    disabled?: boolean;
    active?: boolean;
    children?: React.ReactNode;
  }) => (
    <button
      className={`adw-button flat${children ? "" : " icon-only"}${active ? " active" : ""}${disabled ? " disabled" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <span
        className="adw-toolbar-icon"
        style={{
          maskImage: cachedDataUri(icon),
          WebkitMaskImage: cachedDataUri(icon),
        }}
      />
      {children}
    </button>
  ),
);
ToolbarIconButton.displayName = "ToolbarIconButton";

const Separator = () => (
  <span
    style={{
      width: "1px",
      height: "16px",
      background: "var(--separator-color, rgba(0,0,6,0.12))",
      margin: "0 4px",
    }}
  />
);

export const BottomBar: React.FC<BottomBarProps> = React.memo(
  ({
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
    const dropDownRef = useRef<
      HTMLElement & {
        options: { value: string; label: string }[];
        selected: number;
      }
    >(null);
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
      const labelEl = el.querySelector(".adw-drop-down-label");
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
            <ToolbarIconButton
              icon={goPreviousSymbolic}
              onClick={onFocusPrev}
              title="Previous Screen"
              disabled={!canFocusPrev}
            />
            <adw-drop-down ref={dropDownRef} className="protota-screen-dropdown" />
            <ToolbarIconButton
              icon={goNextSymbolic}
              onClick={onFocusNext}
              title="Next Screen"
              disabled={!canFocusNext}
            />
            <Separator />
          </>
        )}
        <ToolbarIconButton
          icon={zoomOriginalSymbolic}
          onClick={onZoomReset}
          title="Reset Zoom (Ctrl+0)"
        />
        <ToolbarIconButton icon={zoomOutSymbolic} onClick={onZoomOut} title="Zoom Out (Ctrl+-)" />
        <span
          style={{ fontSize: "var(--font-size-small, 9pt)", minWidth: "40px", textAlign: "center" }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <ToolbarIconButton icon={zoomInSymbolic} onClick={onZoomIn} title="Zoom In (Ctrl+=)" />
        <ToolbarIconButton icon={zoomFitBestSymbolic} onClick={onZoomFit} title="Fit All Screens" />
        <Separator />
        <ToolbarIconButton
          icon={documentNewSymbolic}
          onClick={() => window.dispatchEvent(new CustomEvent("protota:new-screen"))}
          title="New Screen (Ctrl+N)"
        >
          New Screen
        </ToolbarIconButton>
        <Separator />
        <ToolbarIconButton
          icon={computerSymbolic}
          onClick={onToggleDesktop}
          title="Toggle Desktop Preview"
          active={!!desktopScreenId}
        />
        <ToolbarIconButton
          icon={phoneSymbolic}
          onClick={onTogglePhone}
          title="Toggle Phone Preview"
          active={!!phoshScreenId}
        />
      </div>
    );
  },
);
BottomBar.displayName = "BottomBar";
