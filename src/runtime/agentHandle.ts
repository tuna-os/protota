/**
 * Live handle onto the running editor store (ADR 0001 Part 3 item 4,
 * docs/penpot-study.md §8).
 *
 * `MockupBuilder` (`src/utils/mockupBuilder.ts`) stays the detached
 * *construction* API; `protota` is the tiny *live* handle onto the running
 * editor store — the same split Penpot makes between document types and the
 * runtime `penpot` global. Store-bound and DOM-touching by nature, so it
 * lives outside `src/utils/`, which the rest of the tree treats as
 * dependency-free from the store (see `scripts/round-trip-lib.mjs`'s
 * extraction of `src/utils/writeback.ts` for the same convention).
 */

import type { MockupDocument } from '../types/mockup';
import { useMockupStore } from '../store/mockupStore';
import { resolveScreenshotTarget, type ScreenshotOptions } from '../utils/renderRequest';

/**
 * Events the live handle emits. Payloads:
 * - `selectionchange`: `{ selection: string[] }` — the new ordered selected
 *   node ids (primary last). Fired only when membership or order actually
 *   changes; re-selecting the identical set is a no-op.
 * - `documentchange`: `{ doc: MockupDocument }` — fired exactly once per
 *   undo snapshot: a committed mutation, a `transaction()` commit, an undo,
 *   or a redo. Editor-only state (selection, panel toggles, diagnostics
 *   filters) and the intermediate states inside a transaction never fire it.
 */
export interface PrototaEventMap {
  selectionchange: { selection: string[] };
  documentchange: { doc: MockupDocument };
}

type PrototaEventName = keyof PrototaEventMap;
type PrototaListener<E extends PrototaEventName> = (payload: PrototaEventMap[E]) => void;

const liveListeners: { [E in PrototaEventName]: Set<PrototaListener<E>> } = {
  selectionchange: new Set(),
  documentchange: new Set(),
};

let liveUnsubscribe: (() => void) | null = null;

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Push-based wiring: one zustand subscription exists while any listener is
 * registered, torn down when the last one leaves. No polling anywhere.
 */
function ensureLiveSubscription(): void {
  if (liveUnsubscribe) return;
  liveUnsubscribe = useMockupStore.subscribe((state, prev) => {
    if (!sameIds(state.selectedNodeIds, prev.selectedNodeIds)) {
      const payload = { selection: [...state.selectedNodeIds] };
      liveListeners.selectionchange.forEach((cb) => cb(payload));
    }
    // A snapshot happened iff the history advanced (mutation / transaction
    // commit) or the cursor moved (undo / redo). Transient transaction
    // states change `doc` alone and stay silent.
    if (state.history !== prev.history || state.historyIndex !== prev.historyIndex) {
      const payload = { doc: state.doc };
      liveListeners.documentchange.forEach((cb) => cb(payload));
    }
  });
}

function releaseLiveSubscriptionIfIdle(): void {
  if (!liveUnsubscribe) return;
  if (liveListeners.selectionchange.size === 0 && liveListeners.documentchange.size === 0) {
    liveUnsubscribe();
    liveUnsubscribe = null;
  }
}

/**
 * The live handle: a small window onto the running editor, for agents (and
 * tests) that drive the same store humans do — one selection model, one
 * undo history, one legality engine for everybody.
 */
export const protota = {
  /**
   * Ordered selected node ids, primary last — the same array the editor's
   * multi-select uses. Assigning replaces the selection (unknown ids are
   * tolerated the way the store tolerates them). Never touches undo.
   */
  get selection(): string[] {
    return [...useMockupStore.getState().selectedNodeIds];
  },
  set selection(ids: string[]) {
    useMockupStore.getState().selectNodes(ids);
  },

  /** Subscribe to a live event. See {@link PrototaEventMap} for payloads. */
  on<E extends PrototaEventName>(event: E, cb: PrototaListener<E>): void {
    (liveListeners[event] as Set<PrototaListener<E>>).add(cb);
    ensureLiveSubscription();
  },

  /** Remove a listener registered with {@link protota.on}. */
  off<E extends PrototaEventName>(event: E, cb: PrototaListener<E>): void {
    (liveListeners[event] as Set<PrototaListener<E>>).delete(cb);
    releaseLiveSubscriptionIfIdle();
  },

  /**
   * Batch several store mutations into ONE undo snapshot (the same
   * primitive align/distribute uses via `updateNodesProps`, generalized as
   * the store's `runInTransaction`). Emits a single `documentchange` at
   * commit. Nested transactions are no-ops: the inner call runs its
   * function inline and the outermost transaction owns the snapshot. An
   * empty transaction pushes nothing and emits nothing.
   */
  transaction(fn: () => void): void {
    useMockupStore.getState().runInTransaction(fn);
  },

  /**
   * Capture ONE screen of the live document as a PNG blob, at the requested
   * dimensions and color scheme, WITHOUT disturbing the editor: the screen
   * renders into a hidden offscreen container (the same AdwaitaRenderer +
   * Adw.Breakpoint override path the canvas uses — `width`/`height`
   * re-evaluate the breakpoints), html2canvas rasterises the render surface,
   * and the container is torn down. Zoom, pan, selection, undo history, and
   * the persisted document are all untouched.
   *
   * Defaults: the selected screen (else the first), its own dimensions, the
   * document's color scheme, scale 1 (PNG pixels == CSS pixels, so the blob
   * decodes to exactly `width` x `height`).
   *
   * Fidelity caveat (html2canvas): CSS `mask-image` is unsupported, so
   * symbolic icons drawn via masks can come out as solid boxes or be
   * missing; shadows and some blend modes are approximate. Pixel-faithful
   * captures should drive the URL render mode with a real browser
   * screenshot instead (docs/render-api.md).
   */
  async renderScreenshot(options: ScreenshotOptions = {}): Promise<Blob> {
    const state = useMockupStore.getState();
    const target = resolveScreenshotTarget(state.doc, options, state.selectedScreenId);

    // Dynamic imports keep this DOM-heavy path out of the module graph that
    // node-side consumers (unit tests, the round-trip CLI) load.
    const [{ createRoot }, React, { AdwaitaRenderer }, { breakpointOverrides }, { settleRender }, html2canvas] =
      await Promise.all([
        import('react-dom/client'),
        import('react'),
        import('../components/AdwaitaRenderer'),
        import('../utils/breakpoints'),
        import('../utils/settle'),
        import('html2canvas').then((module) => module.default),
      ]);

    const container = document.createElement('div');
    // Scoped capture hygiene (index.css): selection outlines, badges, and
    // diagnostics chrome never reach the capture, even though the offscreen
    // render shares the live store (and therefore the live selection).
    container.setAttribute('data-protota-capture-scope', 'true');
    container.setAttribute('aria-hidden', 'true');
    // In-viewport but behind everything: html2canvas is unreliable for
    // far-offscreen subtrees, and the editor's opaque chrome covers this.
    container.style.cssText = 'position:fixed;top:0;left:0;z-index:-2147483647;pointer-events:none;';
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      root.render(
        React.createElement(AdwaitaRenderer, {
          node: target.screen.rootNode,
          screenId: target.screen.id,
          screenWidth: target.width,
          screenHeight: target.height,
          overrides: breakpointOverrides(target.screen.rootNode, target.width, target.height),
          forcedColorScheme: target.theme,
        }),
      );
      await settleRender();
      const surface = container.querySelector<HTMLElement>('[data-protota-render-surface="true"]');
      if (!surface) throw new Error('renderScreenshot: the screen produced no render surface.');
      const canvas = await html2canvas(surface, { scale: target.scale, backgroundColor: null });
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('renderScreenshot: unable to encode the capture as PNG.'));
        }, 'image/png');
      });
    } finally {
      root.unmount();
      container.remove();
    }
  },
};
