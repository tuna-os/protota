import React, { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMockupStore } from '../store/mockupStore';
import { AdwaitaRenderer } from './AdwaitaRenderer';
import { PreviewContext, type PreviewInteraction } from '../preview/PreviewContext';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import type { AdwNode } from '../types/mockup';
import { breakpointOverrides } from '../utils/breakpoints';
import { windowCloseSymbolic } from '@gjsify/adwaita-icons/ui';
import { goPreviousSymbolic } from '@gjsify/adwaita-icons/actions';
import type { AdwMenuNode } from '@gjsify/adwaita-web';
import {
  batteryLevel60ChargingSymbolic,
  bluetoothActiveSymbolic,
  networkWirelessSignalExcellentSymbolic,
  notificationsDisabledSymbolic,
} from '@gjsify/adwaita-icons/status';
import { toDataUri } from '@gjsify/adwaita-icons/utils';

/** `<gtk-menu-button>` surface for the preview screen switcher (portable menu model). */
type ScreenSwitcherElement = HTMLElement & {
  menuModel: AdwMenuNode[];
};

const iconStyle = (svg: string, size = 14): React.CSSProperties => ({
  display: 'inline-block',
  width: `${size}px`,
  height: `${size}px`,
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

  // Static preview-chrome clock: computed once per mount so render stays pure
  // and the React Compiler can optimize this component.
  const [clock] = useState(
    () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );

  // Navigation actions: honest deps (screenId, onScreenChange) so the
  // preview context always drives the current screen.
  const navigate = useCallback((targetId: string) => {
    if (targetId === screenId) return;
    setHistory((trail) => [...trail, targetId]);
    setPreviewState({});
    onScreenChange(targetId);
  }, [screenId, onScreenChange]);

  const goBack = useCallback(() => {
    setHistory((trail) => {
      if (trail.length < 2) return trail;
      const next = trail.slice(0, -1);
      onScreenChange(next[next.length - 1]);
      return next;
    });
    setPreviewState({});
  }, [onScreenChange]);

  const handleExitKey = useEffectEvent(() => {
    onExit();
  });

  // The screen switcher is a <gtk-menu-button>: its popover lists the
  // document's screens — the same portable-menu surface the header
  // Open/Export menus use, not a native <select>. Trigger text differs per
  // mode: desktop reads `time • Screen Title` (bold, centred in the shell
  // bar); phone keeps just the title — no clock, no interpunct.
  // Activation comes back as a bubbling menu-item-activated CustomEvent with
  // {id} — the model cannot carry callbacks.
  const handleSwitcherActivate = useEffectEvent((id: string) => {
    onScreenChange(id);
  });
  const switcherRef = useRef<ScreenSwitcherElement>(null);
  const activeScreenIdx = screen ? doc.screens.findIndex((c) => c.id === screen.id) : -1;

  useEffect(() => {
    const el = switcherRef.current;
    if (!el) return;
    const onActivate = (event: Event) => {
      const id = (event as CustomEvent).detail?.id;
      if (typeof id === 'string') handleSwitcherActivate(id);
    };
    el.addEventListener('menu-item-activated', onActivate);
    return () => el.removeEventListener('menu-item-activated', onActivate);
  }, []);

  // Rebuild the menu model and redraw the clock trigger text whenever the
  // screens or the active one change.
  useEffect(() => {
    const el = switcherRef.current;
    if (!el || !screen) return;
    el.menuModel = [{
      kind: 'section',
      items: doc.screens.map((candidate, index) => ({
        kind: 'item' as const,
        id: candidate.id,
        label: `${index + 1}: ${candidate.title}`,
      })),
    }];
    // The element's trigger is icon-only, so draw the label over it:
    // desktop `time • title`, phone just the title.
    const btn = el.querySelector<HTMLButtonElement>('.adw-menu-button-button');
    if (btn) {
      btn.replaceChildren();
      btn.setAttribute(
        'aria-label',
        `Switch screen, current ${activeScreenIdx + 1} of ${doc.screens.length}: ${screen.title}`,
      );
      btn.setAttribute('title', 'Switch Screen');
      const name = document.createElement('span');
      name.textContent = screen.title;
      if (mode === 'desktop') {
        const time = document.createElement('span');
        time.textContent = clock;
        const separator = document.createElement('span');
        separator.setAttribute('aria-hidden', 'true');
        // Non-breaking spaces: the bullet always keeps space on both sides.
        separator.textContent = ' • ';
        btn.append(time, separator);
      }
      btn.append(name);
    }
    // Tag the skin's popover surface so tests can address it directly.
    // (Both triggers center their surface via CSS overrides scoped to the
    // desktop topbar and the phone header cluster.)
    const popover = el.querySelector('gtk-popover');
    if (popover) {
      popover.setAttribute('data-testid', 'preview-screen-menu');
    }
  }, [doc.screens, screen, activeScreenIdx, clock, mode]);

  // An external jump (BottomBar screen focus while previewing) resets the
  // trail; our own navigate() already pushed the new id, so it is a no-op.
  // Syncing an external prop to local navigation state: one intentional
  // cascading render per screen change.
  /* eslint-disable react/set-state-in-effect */
  useEffect(() => {
    setHistory((trail) => (trail[trail.length - 1] === screenId ? trail : [screenId]));
    setPreviewState({});
  }, [screenId]);
  /* eslint-enable react/set-state-in-effect */

  // Prototype interaction contract for AdwaitaRenderer.
  const interaction = useMemo<PreviewInteraction>(() => ({
    activate: () => {
      const edges = useMockupStore.getState().doc.edges;
      const edge = edges.find((candidate) => candidate.sourceId === screenId);
      if (edge) navigate(edge.targetId);
    },
    setNodeState: (nodeId, patch) => {
      setPreviewState((prev) => ({ ...prev, [nodeId]: { ...prev[nodeId], ...patch } }));
    },
  }), [navigate, screenId]);

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
      handleExitKey();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // Active Adw.Breakpoints for the previewed screen (derived, non-mutating),
  // with the ephemeral preview patches layered on top per node. The phone
  // preview evaluates them at the frame's size (360×720, the Phone device
  // preset) so adaptive layouts actually collapse — the desktop preview
  // keeps the authored size.
  const overrides = useMemo(() => {
    if (!screen) return undefined;
    const width = mode === 'phone' ? 360 : screen.width;
    const height = mode === 'phone' ? 720 : screen.height;
    const base = breakpointOverrides(screen.rootNode, width, height);
    const merged: Record<string, Partial<AdwNode>> = { ...base };
    for (const [nodeId, patch] of Object.entries(previewState)) {
      merged[nodeId] = { ...merged[nodeId], ...patch };
    }
    return merged;
  }, [screen, previewState, mode]);

  if (!screen) return null;

  const canGoBack = history.length > 1;
  // Remount the rendered subtree on every navigation step so widget-internal
  // ephemeral state (toggled switches, typed text) resets with the screen.
  const renderKey = `${screen.id}:${history.length}`;

  const screenPicker = (
    <gtk-menu-button
      ref={switcherRef}
      data-testid="preview-screen-select"
    />
  );

  // Static workspace indicator (active screen as a pill, the rest as
  // filled dots) — a pure visual, the clock trigger owns the popover.
  const workspaceIndicator = (
    <span
      className="protota-workspace-indicator"
      data-testid="workspace-indicator"
      aria-hidden="true"
    >
      {doc.screens.map((candidate, index) => (
        <span
          key={candidate.id}
          className={index === activeScreenIdx ? 'protota-workspace-pill' : 'protota-workspace-dot'}
        />
      ))}
    </span>
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
      {/* Same commit-phase containment as the canvas (#137): a crash inside
          the preview shows a card instead of blanking the overlay. */}
      <CanvasErrorBoundary resetKey={renderKey}>
        {/* screenWidth/screenHeight pin the desktop window to its authored
            size and unlock primary-header-bar resolution (window controls).
            The phone preview omits them on purpose: the app fills the frame
            responsively, and a phone shell has no window chrome to resolve
            anyway. */}
        <AdwaitaRenderer
          key={renderKey}
          node={screen.rootNode}
          screenId={screen.id}
          {...(mode === 'desktop' ? { screenWidth: screen.width, screenHeight: screen.height } : {})}
          overrides={overrides}
        />
      </CanvasErrorBoundary>
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
              {workspaceIndicator}
              {backChip}
            </div>
            <div className="protota-gnome-topbar-clock" data-testid="desktop-clock">
              {screenPicker}
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span className="protota-gnome-status-icons" aria-hidden="true">
                <span style={iconStyle(networkWirelessSignalExcellentSymbolic)} data-testid="desktop-status-wireless" />
                <span style={iconStyle(bluetoothActiveSymbolic)} data-testid="desktop-status-bluetooth" />
                <span style={iconStyle(batteryLevel60ChargingSymbolic)} data-testid="desktop-status-battery" />
              </span>
              {exitChip}
            </div>
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
          </div>
          <div className="protota-preview-chrome protota-preview-chrome--center">
            {screenPicker}
          </div>
          <div className="protota-preview-chrome protota-preview-chrome--end">{exitChip}</div>
          <div className="protota-phosh-phone-frame protota-preview-phone-frame">
            {/* Phosh status bar — preview chrome like the desktop mode's
                GNOME top bar, never document content: wifi + bluetooth
                left, clock centred, silent + charged battery right. */}
            <div className="protota-phosh-status-bar" data-testid="phosh-status-bar">
              <span className="protota-phosh-status-side">
                <span style={iconStyle(networkWirelessSignalExcellentSymbolic, 12)} data-testid="phosh-status-wifi" />
                <span style={iconStyle(bluetoothActiveSymbolic, 12)} data-testid="phosh-status-bluetooth" />
              </span>
              <span className="protota-phosh-status-clock">
                {clock}
              </span>
              <span className="protota-phosh-status-side">
                <span style={iconStyle(notificationsDisabledSymbolic, 12)} data-testid="phosh-status-silent" />
                <span style={iconStyle(batteryLevel60ChargingSymbolic, 12)} data-testid="phosh-status-battery" />
              </span>
            </div>
            {rendered}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
};
