import React, { useEffect, useMemo, useState } from 'react';
import { useMockupStore } from '../store/mockupStore';
import { AdwaitaRenderer } from './AdwaitaRenderer';
import { breakpointOverrides } from '../utils/breakpoints';
import { loadPresetDocument } from '../utils/presetCatalog';
import { registerSourceIcons } from '../utils/adwIcons';
import { settleRender } from '../utils/settle';
import { resolveScreen, type RenderRequest } from '../utils/renderRequest';

/**
 * URL render mode (docs/render-api.md): `?render=1&…` mounts THIS component
 * instead of the editor — no top bar, panels, bottom bar, or canvas ever
 * exist in the DOM. One screen renders at 1:1 zoom inside
 * `#protota-render-root`, anchored at the page origin, so an external agent
 * (Playwright/CDP) can `page.screenshot()` that element after
 * `html[data-protota-ready="true"]` appears.
 *
 * Failures are loud: a bad preset or screen selector renders visible error
 * text (`[data-protota-render-error]`) inside the render root — never a
 * silently-wrong frame — and the ready flag still fires so automation can
 * observe the error instead of timing out.
 */
interface Props {
  request?: RenderRequest;
  /** Pre-resolved parse/validation failure from parseRenderParams. */
  error?: string;
}

export const RenderView: React.FC<Props> = ({ request, error }) => {
  const [failure, setFailure] = useState<string | null>(error ?? null);
  const [screenId, setScreenId] = useState<string | null>(null);
  const doc = useMockupStore((state) => state.doc);

  // Screenshot hygiene: the capture flag suppresses selection outlines and
  // other editor-chrome CSS should any of it sneak into a frame.
  useEffect(() => {
    document.documentElement.dataset.prototaCapture = 'true';
    return () => { delete document.documentElement.dataset.prototaCapture; };
  }, []);

  // Resolve the document (preset fetch is async) and the target screen.
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    (async () => {
      try {
        let effectiveDoc = useMockupStore.getState().doc;
        if (request.preset) {
          const loaded = await loadPresetDocument(request.preset);
          if (cancelled) return;
          registerSourceIcons(loaded.sourceIcons);
          // In-memory only: render mode never persists, so a visitor's own
          // saved document is untouched by rendering a preset.
          useMockupStore.setState({ doc: loaded.doc, history: [loaded.doc], historyIndex: 0 });
          effectiveDoc = loaded.doc;
        }
        const screen = resolveScreen(effectiveDoc, request.screen);
        if (!screen) {
          const known = effectiveDoc.screens
            .map((candidate) => `${candidate.id} ("${candidate.title}")`).join(', ');
          throw new Error(`Unknown screen "${request.screen}". Screens: ${known}`);
        }
        if (!cancelled) setScreenId(screen.id);
      } catch (err) {
        if (!cancelled) setFailure((err as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [request]);

  // Publish the readiness flag once the outcome — screen or error — has
  // painted and rendering has settled (fonts, icon CSS, custom elements).
  const outcomeReady = failure !== null || screenId !== null;
  useEffect(() => {
    if (!outcomeReady) return;
    let cancelled = false;
    const root = document.documentElement;
    delete root.dataset.prototaReady;
    void settleRender().then(() => {
      if (!cancelled) root.dataset.prototaReady = 'true';
    });
    return () => { cancelled = true; };
  }, [outcomeReady, doc, failure]);

  const screen = screenId ? doc.screens.find((candidate) => candidate.id === screenId) ?? null : null;
  const width = request?.width ?? screen?.width ?? 0;
  const height = request?.height ?? screen?.height ?? 0;
  // Adw.Breakpoints evaluate against the EFFECTIVE dimensions — the
  // `width`/`height` params reproduce the same adaptive states the editor's
  // live resize shows (utils/breakpoints.ts, #141).
  const overrides = useMemo(
    () => (screen ? breakpointOverrides(screen.rootNode, width, height) : undefined),
    [screen, width, height],
  );

  return (
    <div
      id="protota-render-root"
      data-protota-render-mode="true"
      style={{ position: 'absolute', top: 0, left: 0, display: 'inline-block', background: 'transparent' }}
    >
      {failure !== null ? (
        <div
          data-protota-render-error="true"
          role="alert"
          style={{
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#c01c28',
            background: '#fff',
            border: '2px solid #c01c28',
            borderRadius: '6px',
            padding: '16px',
            margin: '16px',
            maxWidth: '640px',
          }}
        >
          Protota render error: {failure}
        </div>
      ) : screen ? (
        <AdwaitaRenderer
          node={screen.rootNode}
          screenId={screen.id}
          screenWidth={width}
          screenHeight={height}
          overrides={overrides}
          forcedColorScheme={request?.theme}
        />
      ) : null}
    </div>
  );
};
