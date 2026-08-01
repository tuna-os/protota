/**
 * Render-request parsing and validation (pure — no DOM, no fetch).
 *
 * Two agent-facing surfaces share these rules (docs/render-api.md):
 *
 * 1. URL render mode: `?render=1&preset=files&screen=…&width=…&height=…&theme=dark`
 *    puts the app into a chromeless single-screen view for external
 *    screenshot tooling (Playwright/CDP driving `page.screenshot()`).
 * 2. The live handle's `protota.renderScreenshot({ screenId, width, height,
 *    theme })`, which captures a PNG offscreen without touching the editor.
 *
 * Validation fails loudly: an agent must never screenshot a silently-wrong
 * frame, so a bad parameter becomes visible error text in the render root
 * (URL mode) or a thrown Error (API), never a fallback render.
 */
import type { MockupDocument, Screen } from '../types/mockup';

/** Inclusive bounds for width/height overrides, in CSS pixels. */
export const MIN_RENDER_DIMENSION = 100;
export const MAX_RENDER_DIMENSION = 10000;

export type RenderTheme = 'light' | 'dark';

export interface RenderRequest {
  /** Public preset id to load; absent means the user's persisted document. */
  preset?: string;
  /** Screen selector: id, exact title, or zero-based index. Default: first. */
  screen?: string;
  /** Screen-dimension overrides for this render only (breakpoints re-evaluate). */
  width?: number;
  height?: number;
  /** Forced color scheme; absent keeps the document's own scheme. */
  theme?: RenderTheme;
}

export type RenderParamsResult =
  | { mode: 'editor' }
  | { mode: 'render'; request: RenderRequest }
  | { mode: 'render-error'; error: string };

/** `render=1` (or `true`) activates render mode; anything else is the editor. */
function isRenderFlag(value: string | null): boolean {
  return value === '1' || value === 'true';
}

function parseDimension(name: string, raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`Invalid ${name} "${raw}": must be a positive integer.`);
  }
  const value = Number(raw);
  if (value < MIN_RENDER_DIMENSION || value > MAX_RENDER_DIMENSION) {
    throw new Error(
      `Invalid ${name} ${value}: must be between ${MIN_RENDER_DIMENSION} and ${MAX_RENDER_DIMENSION}.`,
    );
  }
  return value;
}

function parseTheme(raw: string): RenderTheme {
  if (raw === 'light' || raw === 'dark') return raw;
  throw new Error(`Invalid theme "${raw}": must be "light" or "dark".`);
}

/** Preset ids are file basenames under public/presets — keep them boring. */
const PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Parse `location.search`. Returns `{ mode: 'editor' }` when the render flag
 * is absent; a validation failure of any render parameter yields
 * `render-error` (the render root shows the message) rather than falling back
 * to the editor, so automation never screenshots the wrong thing.
 */
export function parseRenderParams(search: string): RenderParamsResult {
  const params = new URLSearchParams(search);
  if (!isRenderFlag(params.get('render'))) return { mode: 'editor' };

  try {
    const request: RenderRequest = {};
    const preset = params.get('preset');
    if (preset !== null) {
      if (!PRESET_ID_PATTERN.test(preset)) {
        throw new Error(`Invalid preset "${preset}": expected a lowercase preset id like "files".`);
      }
      request.preset = preset;
    }
    const screen = params.get('screen');
    if (screen !== null) {
      if (!screen.trim()) throw new Error('Invalid screen "": must be a screen id, title, or index.');
      request.screen = screen;
    }
    const width = params.get('width');
    if (width !== null) request.width = parseDimension('width', width);
    const height = params.get('height');
    if (height !== null) request.height = parseDimension('height', height);
    const theme = params.get('theme');
    if (theme !== null) request.theme = parseTheme(theme);
    return { mode: 'render', request };
  } catch (error) {
    return { mode: 'render-error', error: (error as Error).message };
  }
}

/**
 * Resolve a screen selector against a document: by id first, then exact
 * title, then zero-based index. Returns null when nothing matches.
 */
export function resolveScreen(doc: MockupDocument, selector: string | undefined): Screen | null {
  if (!doc.screens.length) return null;
  if (selector === undefined) return doc.screens[0];
  const byId = doc.screens.find((screen) => screen.id === selector);
  if (byId) return byId;
  const byTitle = doc.screens.find((screen) => screen.title === selector);
  if (byTitle) return byTitle;
  if (/^\d+$/.test(selector)) return doc.screens[Number(selector)] ?? null;
  return null;
}

export interface ScreenshotOptions {
  /** Screen id or exact title. Default: the selected screen, else the first. */
  screenId?: string;
  width?: number;
  height?: number;
  theme?: RenderTheme;
  /** Rasterisation scale (html2canvas). Default 1: PNG pixels == CSS pixels. */
  scale?: number;
}

export interface ScreenshotTarget {
  screen: Screen;
  width: number;
  height: number;
  theme?: RenderTheme;
  scale: number;
}

function checkDimension(name: string, value: number): number {
  if (!Number.isInteger(value) || value < MIN_RENDER_DIMENSION || value > MAX_RENDER_DIMENSION) {
    throw new Error(
      `renderScreenshot: ${name} must be an integer between ${MIN_RENDER_DIMENSION} and ${MAX_RENDER_DIMENSION}, got ${value}.`,
    );
  }
  return value;
}

/**
 * Validate `renderScreenshot` options against the live document (pure part,
 * unit-tested separately from the DOM capture).
 */
export function resolveScreenshotTarget(
  doc: MockupDocument,
  options: ScreenshotOptions,
  selectedScreenId?: string | null,
): ScreenshotTarget {
  if (!doc.screens.length) throw new Error('renderScreenshot: the document has no screens.');
  let screen: Screen | undefined;
  if (options.screenId !== undefined) {
    screen = resolveScreen(doc, options.screenId) ?? undefined;
    if (!screen) {
      const known = doc.screens.map((candidate) => `${candidate.id} ("${candidate.title}")`).join(', ');
      throw new Error(`renderScreenshot: unknown screen "${options.screenId}". Screens: ${known}`);
    }
  } else {
    screen = doc.screens.find((candidate) => candidate.id === selectedScreenId) ?? doc.screens[0];
  }
  if (options.theme !== undefined && options.theme !== 'light' && options.theme !== 'dark') {
    throw new Error(`renderScreenshot: theme must be "light" or "dark", got "${options.theme}".`);
  }
  const scale = options.scale ?? 1;
  if (!(scale > 0 && scale <= 4)) {
    throw new Error(`renderScreenshot: scale must be in (0, 4], got ${scale}.`);
  }
  return {
    screen,
    width: options.width !== undefined ? checkDimension('width', options.width) : screen.width,
    height: options.height !== undefined ? checkDimension('height', options.height) : screen.height,
    theme: options.theme,
    scale,
  };
}
