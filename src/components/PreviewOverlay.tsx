import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMockupStore } from '../store/mockupStore';
import { AdwaitaRenderer } from './AdwaitaRenderer';
import { PreviewContext, type PreviewInteraction } from '../preview/PreviewContext';
import type { AdwNode } from '../types/mockup';
import { breakpointOverrides } from '../utils/breakpoints';
import { windowCloseSymbolic } from '@gjsify/adwaita-icons/ui';
import { goPreviousSymbolic } from '@gjsify/adwaita-icons/actions';
import { toDataUri } from '@gjsify/adwaita-icons/utils';

const iconStyle = (svg: string): React.CSSProperties => ({
  display: 'inline-block',
  width: '14px',
  height: '14px',
  maskImage: toDataUri(svg),
  WebkitMaskImage: toDataUri(svg),
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  backgroundColor: 'currentColor',
});

interface PreviewOverlayProps {
  mode: 'phone' | 'desktop';
  /** Screen currently shown — owned by ViewportCanvas (BottomBar can drive it too). */
  screenId: string;
  onScreenChange: (screenId: string) => void;
  onExit: () => void;
}

/**
 * Full-screen interactive preview (prototype mode) — the "Phosh Phone View"
 * and "GNOME Desktop" previews, taken over the whole viewport with native
 * interaction on the mockup:
 *
 * - Activation taps (buttons, button rows, activatable action rows, list
 *   rows) follow the current screen's outgoing flow edge (doc.edges).
 * - Stateful widgets respond ephemerally (switches, checks, expanders,
 *   entries, view-switcher tabs) — component/DOM state only, NEVER a store
 *   mutation, never an undo entry.
 * - Back chip walks the navigation history; Escape or the close chip exits.
 *
 * Everything resets when the preview unmounts or the screen changes: the
 * rendered subtree is keyed per navigation step, so custom-element internal
 * state (a toggled switch) dies with it.
 */
export const PreviewOverlay: React.FC<PreviewOverlayProps> = ({
  mode, screenId, onScreenChange, onExit,
}) => {
  const doc = useMockupStore((state) => state.doc);
  const screen = doc.screens.find((candidate) => candidate.id === screenId);

  // Navigation history (breadcrumb of screen ids). The screenId prop is
  // authoritative for what is SHOWN; the history only powers Back.
  const [history, setHistory] = useState<string[]>([screenId]);
  // Ephemeral render-time patches (e.g. a stack's visibleChildName after a
  // view-switcher tap). Reset on every navigation and on exit.
  const [previewState, setPreviewState] = useState<Record<string, Partial<AdwNode>>>({});

  const screenIdRef = useRef(screenId);
  screenIdRef.current = screenId;
  const onScreenChangeRef = useRef(onScreenChange);
  onScreenChangeRef.current = onScreenChange;
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // An external jump (BottomBar screen focus while previewing) resets the
  // trail; our own navigate() already pushed the new id, so it is a no-op.
  useEffect(() => {
    setHistory((trail) => (trail[trail.length - 1] === screenId ? trail : [screenId]));
    setPreviewState({});
  }, [screenId]);

  const navigate = useCallback((targetId: string) => {
    if (targetId === screenIdRef.current) return;
    setHistory((trail) => [...trail, targetId]);
    setPreviewState({});
    onScreenChangeRef.current(targetId);
  }, []);

  const goBack = useCallback(() => {
    setHistory((trail) => {
      if (trail.length < 2) return trail;
      const next = trail.slice(0, -1);
      onScreenChangeRef.current(next[next.length - 1]);
      return next;
    });
    setPreviewState({});
  }, []);

  // Prototype interaction contract for AdwaitaRenderer.
  const interaction = useMemo<PreviewInteraction>(() => ({
    activate: () => {
      const edges = useMockupStore.getState().doc.edges;
      const edge = edges.find((candidate) => candidate.sourceId === screenIdRef.current);
      if (edge) navigate(edge.targetId);
    },
    setNodeState: (nodeId, patch) => {
      setPreviewState((prev) => ({ ...prev, [nodeId]: { ...prev[nodeId], ...patch } }));
    },
  }), [navigate]);

  // While previewing: clear the editor selection (so Delete/Backspace can
  // never act on a node "through" the overlay) and flag the root so the
  // stylesheet hides the editor chrome behind the overlay.
  useEffect(() => {
    useMockupStore.getState().selectNode(null);
    document.documentElement.dataset.prototaPreview = 'true';
    return () => {
      delete document.documentElement.dataset.prototaPreview;
    };
  }, []);

  // Escape exits (capture phase, ahead of the canvas/App key handlers).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onExitRef.current();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // Active Adw.Breakpoints for the previewed screen (derived, non-mutating),
  // with the ephemeral preview patches layered on top per node.
  const overrides = useMemo(() => {
    if (!screen) return undefined;
    const base = breakpointOverrides(screen.rootNode, screen.width, screen.height);
    const merged: Record<string, Partial<AdwNode>> = { ...base };
    for (const [nodeId, patch] of Object.entries(previewState)) {
      merged[nodeId] = { ...merged[nodeId], ...patch };
    }
    return merged;
  }, [screen, previewState]);

  if (!screen) return null;

  const canGoBack = history.length > 1;
  // Remount the rendered subtree on every navigation step so widget-internal
  // ephemeral state (toggled switches, typed text) resets with the screen.
  const renderKey = `${screen.id}:${history.length}`;

  const screenPicker = (
    <select
      className="protota-preview-chip protota-preview-screen-select"
      data-testid="preview-screen-select"
      aria-label="Jump to screen"
      value={screen.id}
      onChange={(event) => onScreenChange(event.target.value)}
    >
      {doc.screens.map((candidate, index) => (
        <option key={candidate.id} value={candidate.id}>
          {index + 1}: {candidate.title}
        </option>
      ))}
    </select>
  );

  const backChip = canGoBack ? (
    <button
      type="button"
      className="protota-preview-chip"
      data-testid="preview-back"
      aria-label="Back"
      onClick={goBack}
    >
      <span style={iconStyle(goPreviousSymbolic)} />
      Back
    </button>
  ) : null;

  const exitChip = (
    <button
      type="button"
      className="protota-preview-chip protota-preview-exit"
      data-testid="preview-exit"
      aria-label="Exit Preview"
      title="Exit Preview (Esc)"
      onClick={onExit}
    >
      <span style={iconStyle(windowCloseSymbolic)} />
    </button>
  );

  const rendered = (
    <PreviewContext.Provider value={interaction}>
      <AdwaitaRenderer
        key={renderKey}
        node={screen.rootNode}
        screenId={screen.id}
        overrides={overrides}
      />
    </PreviewContext.Provider>
  );

  return createPortal(
    <div
      className={`protota-preview-overlay protota-preview-overlay--${mode}`}
      data-testid="preview-overlay"
      data-preview-screen={screen.id}
    >
      {mode === 'desktop' ? (
        <>
          <div className="protota-gnome-topbar">
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>Activities</span>
              {backChip}
              {screenPicker}
            </div>
            <div style={{ fontSize: '13px' }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {exitChip}
          </div>
          <div className="protota-gnome-window-frame">
            <div
              className="protota-preview-desktop-window"
              style={{
                width: `min(${screen.width}px, 96vw)`,
                height: `min(${screen.height}px, calc(100vh - 64px))`,
              }}
            >
              {rendered}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="protota-preview-chrome protota-preview-chrome--start">
            {backChip}
            {screenPicker}
          </div>
          <div className="protota-preview-chrome protota-preview-chrome--end">{exitChip}</div>
          <div className="protota-phosh-phone-frame protota-preview-phone-frame">{rendered}</div>
        </>
      )}
    </div>,
    document.body,
  );
};
