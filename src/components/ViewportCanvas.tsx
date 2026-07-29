import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useMockupStore } from "../store/mockupStore";
import { AdwaitaRenderer } from "./AdwaitaRenderer";
import { BottomBar } from "./BottomBar";
import { windowCloseSymbolic } from "@gjsify/adwaita-icons/ui";
import { toDataUri } from "@gjsify/adwaita-icons/utils";

const CANVAS_PADDING = 60;
const CANVAS_GAP = 40;
const CANVAS_BOTTOM_BAR_H = 48;

/** Total world-space width of all screens + gaps + padding. */
function getTotalContentWidth(screens: { width?: number }[]): number {
  return screens.reduce((sum, s) => sum + (s.width || 800), 0)
    + CANVAS_GAP * (screens.length - 1) + CANVAS_PADDING * 2;
}

/**
 * Compute new pan so that the world point under (mx, my) stays fixed
 * when zoom changes from oldZoom → newZoom.
 */
function zoomAtPoint(
  mx: number,
  my: number,
  oldZoom: number,
  newZoom: number,
  oldPan: { x: number; y: number },
): { x: number; y: number } {
  const wx = (mx - oldPan.x) / oldZoom;
  const wy = (my - oldPan.y) / oldZoom;
  return { x: mx - wx * newZoom, y: my - wy * newZoom };
}

export const ViewportCanvas: React.FC = () => {
  const { doc, selectNode } = useMockupStore();

  // Ref mirror of doc — lets stable callbacks read latest screens without re-creating
  const docRef = useRef(doc);
  docRef.current = doc;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Ref versions so event handlers always read latest values without re-attaching
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const startPan = useRef({ x: 0, y: 0 });
  const spaceDown = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- Stable zoom helpers (read from refs, never re-create) ---

  const zoomAtCenter = useCallback((factor: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const oldZ = zoomRef.current;
    const newZ = Math.min(Math.max(oldZ * factor, 0.3), 2.5);
    setPan(zoomAtPoint(mx, my, oldZ, newZ, panRef.current));
    setZoom(newZ);
  }, []);

  const resetView = useCallback(() => {
    const el = canvasRef.current;
    if (!el || docRef.current.screens.length === 0) return;
    setPan({
      x: (el.clientWidth - getTotalContentWidth(docRef.current.screens)) / 2,
      y: CANVAS_PADDING,
    });
    setZoom(1);
  }, []);

  // --- Wheel handler (stable, reads from refs) ---

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const isOverCanvas = el.contains(e.target as Node);
      if ((e.ctrlKey || e.metaKey) && isOverCanvas) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const oldZ = zoomRef.current;
        const newZ = Math.min(Math.max(oldZ * factor, 0.3), 2.5);
        setPan(zoomAtPoint(mx, my, oldZ, newZ, panRef.current));
        setZoom(newZ);
      } else if (e.shiftKey && isOverCanvas) {
        e.preventDefault();
        setPan((p) => ({ x: p.x - e.deltaY, y: p.y }));
      } else if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // --- Mouse handlers (all stable via refs) ---

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || spaceDown.current) {
      e.preventDefault();
      isPanningRef.current = true;
      setIsPanning(true);
      startPan.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanningRef.current) {
      setPan({ x: e.clientX - startPan.current.x, y: e.clientY - startPan.current.y });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  const handleCanvasClick = useCallback(() => {
    canvasRef.current?.focus();
    selectNode(null);
  }, [selectNode]);

  // --- Keyboard: Escape + Space (pan mode) ---

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        selectNode(null);
      }
      if (e.code === "Space") {
        if (!canvasRef.current?.contains(e.target as Node)) return;
        e.preventDefault();
        spaceDown.current = true;
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        if (!canvasRef.current?.contains(e.target as Node)) return;
        spaceDown.current = false;
        setSpaceHeld(false);
        isPanningRef.current = false;
        setIsPanning(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectNode]);

  // --- Keyboard: zoom shortcuts (Ctrl+= / - / 0) — uses stable callbacks, no stale closure ---

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.tagName === "INPUT" ||
        (e.target as HTMLElement)?.tagName === "TEXTAREA"
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "=" && mod) {
        e.preventDefault();
        zoomAtCenter(1.1);
      }
      if (e.key === "-" && mod) {
        e.preventDefault();
        zoomAtCenter(0.9);
      }
      if (e.key === "0" && mod) {
        e.preventDefault();
        resetView();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomAtCenter, resetView]);

  // --- Custom events: zoom from MenuBar — uses stable callbacks, no stale closure ---

  useEffect(() => {
    const onZoomIn = () => zoomAtCenter(1.1);
    const onZoomOut = () => zoomAtCenter(0.9);
    const onZoomReset = () => resetView();
    window.addEventListener("protota:zoom-in", onZoomIn);
    window.addEventListener("protota:zoom-out", onZoomOut);
    window.addEventListener("protota:zoom-reset", onZoomReset);
    return () => {
      window.removeEventListener("protota:zoom-in", onZoomIn);
      window.removeEventListener("protota:zoom-out", onZoomOut);
      window.removeEventListener("protota:zoom-reset", onZoomReset);
    };
  }, [zoomAtCenter, resetView]);

  // --- Auto-fit zoom on mobile screens (< 768px wide) ---

  useEffect(() => {
    const autoFitMobile = () => {
      const screens = docRef.current.screens;
      if (window.innerWidth <= 768 && screens.length > 0) {
        const primaryWidth = screens[0].width || 800;
        const availableWidth = window.innerWidth - 32;
        if (primaryWidth > availableWidth) {
          const fittedZoom = Math.max(availableWidth / primaryWidth, 0.35);
          setZoom(fittedZoom);
          setPan({ x: 16, y: 16 });
        }
      }
    };
    autoFitMobile();
    window.addEventListener('resize', autoFitMobile);
    return () => window.removeEventListener('resize', autoFitMobile);
  }, [doc.screens]);

  // --- Screen focus state ---

  const [phoshScreenId, setPhoshScreenId] = useState<string | null>(null);
  const [desktopScreenId, setDesktopScreenId] = useState<string | null>(null);
  const [focusedScreenIdx, setFocusedScreenIdx] = useState(0);

  const focusedScreenIdxRef = useRef(focusedScreenIdx);
  focusedScreenIdxRef.current = focusedScreenIdx;
  const desktopScreenIdRef = useRef(desktopScreenId);
  desktopScreenIdRef.current = desktopScreenId;
  const phoshScreenIdRef = useRef(phoshScreenId);
  phoshScreenIdRef.current = phoshScreenId;

  // Clamp focusedScreenIdx when screens shrink (e.g. deletion)
  useEffect(() => {
    if (doc.screens.length > 0 && focusedScreenIdx >= doc.screens.length) {
      setFocusedScreenIdx(doc.screens.length - 1);
    }
  }, [doc.screens.length, focusedScreenIdx]);

  const activePhoshScreen = doc.screens.find((s) => s.id === phoshScreenId);
  const activeDesktopScreen = doc.screens.find((s) => s.id === desktopScreenId);

  // Memoized screen list for BottomBar — only recomputes when screen ids/titles change,
  // not on every node edit inside a screen.
  const screensForBottomBar = useMemo(
    () => doc.screens.map((s, i) => ({ id: s.id, title: `${i + 1}: ${s.title}` })),
    [doc.screens.map((s) => `${s.id}:${s.title}`).join('|')], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // --- Stable screen-focus callbacks (read from refs) ---

  const panToScreen = useCallback((idx: number) => {
    const screens = docRef.current.screens;
    if (!canvasRef.current || screens.length === 0) return;
    const clampedIdx = Math.max(0, Math.min(idx, screens.length - 1));
    const screen = screens[clampedIdx];
    if (!screen) return;

    const canvasW = canvasRef.current.clientWidth;
    const currentZoom = zoomRef.current;

    let screenX = CANVAS_PADDING;
    for (let i = 0; i < clampedIdx; i++) {
      screenX += (screens[i].width || 800) + CANVAS_GAP;
    }

    const screenW = screen.width || 800;
    setPan({
      x: (canvasW - screenW * currentZoom) / 2 - screenX * currentZoom,
      y: CANVAS_PADDING,
    });
  }, []);

  const handleFocusScreen = useCallback((idx: number) => {
    const screens = docRef.current.screens;
    if (screens.length === 0) return;
    if (idx < 0 || idx >= screens.length) return;
    setFocusedScreenIdx(idx);

    if (desktopScreenIdRef.current !== null) {
      setDesktopScreenId(screens[idx].id);
    } else if (phoshScreenIdRef.current !== null) {
      setPhoshScreenId(screens[idx].id);
    } else {
      panToScreen(idx);
    }
  }, [panToScreen]);

  const handleFocusPrev = useCallback(() => {
    handleFocusScreen(focusedScreenIdxRef.current - 1);
  }, [handleFocusScreen]);

  const handleFocusNext = useCallback(() => {
    handleFocusScreen(focusedScreenIdxRef.current + 1);
  }, [handleFocusScreen]);

  // --- Stable BottomBar zoom callbacks (additive, distinct from keyboard multiplicative) ---

  const handleZoomIn = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const oldZ = zoomRef.current;
    const newZ = Math.min(oldZ + 0.1, 2.5);
    setPan(zoomAtPoint(mx, my, oldZ, newZ, panRef.current));
    setZoom(newZ);
  }, []);

  const handleZoomOut = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const oldZ = zoomRef.current;
    const newZ = Math.max(oldZ - 0.1, 0.3);
    setPan(zoomAtPoint(mx, my, oldZ, newZ, panRef.current));
    setZoom(newZ);
  }, []);

  const handleZoomFit = useCallback(() => {
    const el = canvasRef.current;
    if (!el || docRef.current.screens.length === 0) return;
    const screens = docRef.current.screens;
    const canvasW = el.clientWidth;
    const canvasH = el.clientHeight;
    const totalContentW = getTotalContentWidth(screens);
    const maxContentH = Math.max(...screens.map((s) => s.height || 600))
      + 28 /* label */ + CANVAS_PADDING * 2;
    const fitZoom = Math.min(canvasW / totalContentW, canvasH / maxContentH, 1.5);
    setZoom(fitZoom);
    const scaledW = totalContentW * fitZoom;
    const scaledH = maxContentH * fitZoom;
    setPan({
      x: (canvasW - scaledW) / 2,
      y: (canvasH - scaledH - CANVAS_BOTTOM_BAR_H) / 2,
    });
  }, []);

  // --- Stable Desktop/Phosh toggle callbacks ---

  const handleToggleDesktop = useCallback(() => {
    setDesktopScreenId((prev) => {
      if (prev) return null;
      setPhoshScreenId(null);
      return docRef.current.screens[focusedScreenIdxRef.current]?.id || null;
    });
  }, []);

  const handleTogglePhone = useCallback(() => {
    setPhoshScreenId((prev) => {
      if (prev) return null;
      setDesktopScreenId(null);
      return docRef.current.screens[focusedScreenIdxRef.current]?.id || null;
    });
  }, []);

  return (
    <div
      ref={canvasRef}
      tabIndex={0}
      className="protota-canvas"

      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
      style={{
        flex: 1,
        overflow: "hidden",
        position: "relative",
        outline: "none",
        cursor: isPanning ? "grabbing" : "default",
        backgroundImage: "radial-gradient(circle, rgba(128,128,128,0.25) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      {/* GNOME Desktop Fullscreen Live Interactive Preview Mode */}
      {activeDesktopScreen && (
        <div className="protota-gnome-desktop-container">
          <div className="protota-gnome-topbar">
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>Activities</span>
              <select
                value={desktopScreenId || ''}
                onChange={(e) => setDesktopScreenId(e.target.value)}
                style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }}
              >
                {doc.screens.map((s) => (
                  <option key={s.id} value={s.id} style={{ color: '#000' }}>{s.title}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: '13px' }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button
              className="protota-btn suggested"
              onClick={() => setDesktopScreenId(null)}
              style={{ fontSize: '11px', padding: '2px 8px' }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  maskImage: toDataUri(windowCloseSymbolic),
                  WebkitMaskImage: toDataUri(windowCloseSymbolic),
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  backgroundColor: "currentColor",
                  marginRight: "4px",
                }}
              />
              Exit Desktop Mode
            </button>
          </div>

          <div className="protota-gnome-window-frame">
            <AdwaitaRenderer
              node={activeDesktopScreen.rootNode}
              screenId={activeDesktopScreen.id}
            />
          </div>
        </div>
      )}

      {/* Phosh Fullscreen Phone Overlay Mode */}
      {activePhoshScreen && (
        <div className="protota-phosh-container">
          <div className="protota-phosh-header">
            <span>📱 Phosh Phone View</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={phoshScreenId || ''}
                onChange={(e) => setPhoshScreenId(e.target.value)}
                style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}
              >
                {doc.screens.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <button
                className="protota-btn suggested"
                onClick={() => setPhoshScreenId(null)}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "12px",
                    height: "12px",
                    maskImage: toDataUri(windowCloseSymbolic),
                    WebkitMaskImage: toDataUri(windowCloseSymbolic),
                    maskSize: "contain",
                    WebkitMaskSize: "contain",
                    backgroundColor: "currentColor",
                    marginRight: "4px",
                  }}
                />
                Exit Phone Mode
              </button>
            </div>
          </div>

          <div className="protota-phosh-phone-frame">
            <AdwaitaRenderer
              node={activePhoshScreen.rootNode}
              screenId={activePhoshScreen.id}
            />
          </div>
        </div>
      )}

      {/* Bottom Bar — Zoom + Desktop/Phone toggles */}
      <BottomBar
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
        onZoomReset={resetView}
        desktopScreenId={desktopScreenId}
        onToggleDesktop={handleToggleDesktop}
        phoshScreenId={phoshScreenId}
        onTogglePhone={handleTogglePhone}
        screens={screensForBottomBar}
        focusedScreenIdx={focusedScreenIdx}
        canFocusPrev={focusedScreenIdx > 0}
        canFocusNext={focusedScreenIdx < doc.screens.length - 1}
        onFocusPrev={handleFocusPrev}
        onFocusNext={handleFocusNext}
        onSelectScreen={handleFocusScreen}
      />

      {/* Transformable Canvas Surface */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          transition: isPanning ? "none" : "transform 0.05s ease-out",
          display: "inline-flex",
          gap: `${CANVAS_GAP}px`,
          padding: `${CANVAS_PADDING}px`,
          pointerEvents: spaceHeld || isPanning ? "none" : undefined,
        }}
      >
        {doc.screens.map((screen) => (
          <div
            key={screen.id}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}
          >
            <div className="protota-screen-label" style={{ marginBottom: "8px" }}>
              {screen.title}
            </div>
            <AdwaitaRenderer
              node={screen.rootNode}
              screenId={screen.id}
              screenWidth={screen.width}
              screenHeight={screen.height}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
