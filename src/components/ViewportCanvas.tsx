import React, { useState, useRef, useCallback, useEffect } from "react";
import { useMockupStore } from "../store/mockupStore";
// import { BreakpointBar } from "./BreakpointBar";
import { AdwaitaRenderer } from "./AdwaitaRenderer";
import { BottomBar } from "./BottomBar";
import { windowCloseSymbolic } from "@gjsify/adwaita-icons/ui";
import { toDataUri } from "@gjsify/adwaita-icons/utils";

export const ViewportCanvas: React.FC = () => {
  const { doc, selectNode } = useMockupStore();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const startPan = useRef({ x: 0, y: 0 });
  const spaceDown = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.min(Math.max(z * zoomFactor, 0.3), 2.5));
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || spaceDown.current) {
        e.preventDefault();
        setIsPanning(true);
        startPan.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - startPan.current.x, y: e.clientY - startPan.current.y });
      }
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  React.useEffect(() => {
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
        setIsPanning(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Auto-fit zoom on mobile screens (< 768px wide)
  useEffect(() => {
    const autoFitMobile = () => {
      if (window.innerWidth <= 768 && doc.screens.length > 0) {
        const primaryWidth = doc.screens[0].width || 800;
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

  // Zoom keyboard shortcuts (handled here since zoom state is local)
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
        setZoom((z) => Math.min(z * 1.1, 2.5));
      }
      if (e.key === "-" && mod) {
        e.preventDefault();
        setZoom((z) => Math.max(z * 0.9, 0.3));
      }
      if (e.key === "0" && mod) {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Listen for zoom events from MenuBar
  useEffect(() => {
    const onZoomIn = () => setZoom((z) => Math.min(z * 1.1, 2.5));
    const onZoomOut = () => setZoom((z) => Math.max(z * 0.9, 0.3));
    const onZoomReset = () => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    window.addEventListener("protota:zoom-in", onZoomIn);
    window.addEventListener("protota:zoom-out", onZoomOut);
    window.addEventListener("protota:zoom-reset", onZoomReset);
    return () => {
      window.removeEventListener("protota:zoom-in", onZoomIn);
      window.removeEventListener("protota:zoom-out", onZoomOut);
      window.removeEventListener("protota:zoom-reset", onZoomReset);
    };
  }, []);

  const handleCanvasClick = useCallback(() => {
    canvasRef.current?.focus();
    selectNode(null);
  }, [selectNode]);

  const [phoshScreenId, setPhoshScreenId] = useState<string | null>(null);
  const [desktopScreenId, setDesktopScreenId] = useState<string | null>(null);

  const activePhoshScreen = doc.screens.find((s) => s.id === phoshScreenId);
  const activeDesktopScreen = doc.screens.find((s) => s.id === desktopScreenId);

  return (
    <div
      ref={canvasRef}
      tabIndex={0}
      className="protota-canvas"
      onWheel={handleWheel}
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
        onZoomIn={() => setZoom((z) => Math.min(z + 0.1, 2.5))}
        onZoomOut={() => setZoom((z) => Math.max(z - 0.1, 0.3))}
        onZoomFit={() => {
          if (!canvasRef.current || doc.screens.length === 0) return;
          const canvasW = canvasRef.current.clientWidth;
          const canvasH = canvasRef.current.clientHeight;
          const padding = 60;
          const gap = 40;
          const totalContentW = doc.screens.reduce((sum, s) => sum + (s.width || 800), 0)
            + gap * (doc.screens.length - 1)
            + padding * 2;
          const maxContentH = Math.max(...doc.screens.map((s) => s.height || 600))
            + 28 /* label */ + padding * 2;
          const fitZoom = Math.min(canvasW / totalContentW, canvasH / maxContentH, 1.5);
          setZoom(fitZoom);
          const scaledW = totalContentW * fitZoom;
          const scaledH = maxContentH * fitZoom;
          const bottomBarH = 48;
          setPan({
            x: (canvasW - scaledW) / 2,
            y: (canvasH - scaledH - bottomBarH) / 2,
          });
        }}
        onZoomReset={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
        desktopScreenId={desktopScreenId}
        onToggleDesktop={() => setDesktopScreenId((prev) => {
          if (prev) return null;
          setPhoshScreenId(null);
          return doc.screens[0]?.id || null;
        })}
        phoshScreenId={phoshScreenId}
        onTogglePhone={() => setPhoshScreenId((prev) => {
          if (prev) return null;
          setDesktopScreenId(null);
          return doc.screens[0]?.id || null;
        })}
      />

      {/* Transformable Canvas Surface */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          transition: isPanning ? "none" : "transform 0.05s ease-out",
          display: "inline-flex",
          gap: "40px",
          padding: "60px",
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
