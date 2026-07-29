import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useMockupStore } from '../store/mockupStore';
// import { BreakpointBar } from "./BreakpointBar";
import { AdwaitaRenderer } from './AdwaitaRenderer';

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
      if (e.code === 'Space') { e.preventDefault(); spaceDown.current = true; }
      if (e.key === 'Escape') { selectNode(null); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceDown.current = false; setIsPanning(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
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
      if ((e.target as HTMLElement)?.tagName === 'INPUT' ||
          (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === '=' && mod) { e.preventDefault(); setZoom((z) => Math.min(z * 1.1, 2.5)); }
      if (e.key === '-' && mod) { e.preventDefault(); setZoom((z) => Math.max(z * 0.9, 0.3)); }
      if (e.key === '0' && mod) { e.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleCanvasClick = useCallback(() => selectNode(null), [selectNode]);

  const [phoshScreenId, setPhoshScreenId] = useState<string | null>(null);

  const activePhoshScreen = doc.screens.find((s) => s.id === phoshScreenId);

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
        overflow: 'hidden',
        position: 'relative',
        cursor: isPanning ? 'grabbing' : 'default',
      }}
    >
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
                ✕ Exit Phone Mode
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

      {/* Zoom Controls */}
      <div className="protota-zoom-bar">
        <button className="protota-btn" onClick={() => setZoom((z) => Math.max(z - 0.1, 0.3))}>−</button>
        <span style={{ fontSize: '12px', minWidth: '40px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button className="protota-btn" onClick={() => setZoom((z) => Math.min(z + 0.1, 2.5))}>+</button>
        <button className="protota-btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</button>
        <button
          className="protota-btn suggested"
          onClick={() => setPhoshScreenId(doc.screens[0]?.id || null)}
        >
          📱 Phosh Phone
        </button>
      </div>

      {/* Transformable Canvas Surface */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          transition: isPanning ? 'none' : 'transform 0.05s ease-out',
          display: 'inline-flex',
          gap: '40px',
          padding: '60px',
        }}
      >
        {doc.screens.map((screen) => (
          <div key={screen.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="protota-screen-label" style={{ marginBottom: '8px' }}>
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
