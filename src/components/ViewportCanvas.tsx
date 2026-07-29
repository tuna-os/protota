import React, { useState, useRef, useCallback, useEffect } from "react";
import { useMockupStore } from "../store/mockupStore";
// import { BreakpointBar } from "./BreakpointBar";
import { AdwaitaRenderer } from "./AdwaitaRenderer";

export const ViewportCanvas: React.FC = () => {
  const { doc, selectNode } = useMockupStore();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const startPan = useRef({ x: 0, y: 0 });
  const spaceDown = useRef(false);

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
      if (e.code === "Space") {
        e.preventDefault();
        spaceDown.current = true;
      }
      if (e.key === "Escape") {
        selectNode(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown.current = false;
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

  const handleCanvasClick = useCallback(() => selectNode(null), [selectNode]);

  return (
    <div
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
        cursor: isPanning ? "grabbing" : "default",
      }}
    >
      {/* Zoom Controls */}
      <div className="protota-zoom-bar">
        <button
          className="adw-button icon-only flat"
          onClick={() => setZoom((z) => Math.max(z - 0.1, 0.3))}
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
          onClick={() => setZoom((z) => Math.min(z + 0.1, 2.5))}
          title="Zoom In (Ctrl+=)"
        >
          <span className="adw-icon adw-icon--list-add"></span>
        </button>
        <button
          className="adw-button flat"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          title="Reset Zoom (Ctrl+0)"
        >
          Reset
        </button>
      </div>

      {/* Transformable Canvas Surface */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          transition: isPanning ? "none" : "transform 0.05s ease-out",
          display: "inline-flex",
          gap: "40px",
          padding: "60px",
        }}
      >
        {doc.screens.map((screen) => (
          <div
            key={screen.id}
            style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
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
