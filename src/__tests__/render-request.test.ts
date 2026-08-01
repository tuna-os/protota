import { describe, it, expect } from 'vitest';
import {
  parseRenderParams,
  resolveScreen,
  resolveScreenshotTarget,
  MIN_RENDER_DIMENSION,
  MAX_RENDER_DIMENSION,
} from '../utils/renderRequest';
import type { MockupDocument, Screen } from '../types/mockup';

function screen(id: string, title: string, width = 800, height = 600): Screen {
  return { id, title, type: 'standard', width, height, rootNode: { id: `${id}-root`, type: 'window', children: [] } };
}

function doc(...screens: Screen[]): MockupDocument {
  return { id: 'doc', title: 'Doc', colorScheme: 'auto', edges: [], screens };
}

describe('parseRenderParams', () => {
  it('returns editor mode when the render flag is absent', () => {
    expect(parseRenderParams('')).toEqual({ mode: 'editor' });
    expect(parseRenderParams('?preset=files&width=500')).toEqual({ mode: 'editor' });
  });

  it('returns editor mode for a non-truthy render flag', () => {
    expect(parseRenderParams('?render=0')).toEqual({ mode: 'editor' });
    expect(parseRenderParams('?render=yes')).toEqual({ mode: 'editor' });
  });

  it('accepts render=1 and render=true with no other params', () => {
    expect(parseRenderParams('?render=1')).toEqual({ mode: 'render', request: {} });
    expect(parseRenderParams('?render=true')).toEqual({ mode: 'render', request: {} });
  });

  it('parses the full parameter set', () => {
    expect(parseRenderParams('?render=1&preset=files&screen=main&width=500&height=440&theme=dark')).toEqual({
      mode: 'render',
      request: { preset: 'files', screen: 'main', width: 500, height: 440, theme: 'dark' },
    });
  });

  it('rejects a malformed preset id', () => {
    const result = parseRenderParams('?render=1&preset=../secrets');
    expect(result.mode).toBe('render-error');
    expect((result as { error: string }).error).toContain('preset');
  });

  it('rejects non-integer and out-of-range dimensions', () => {
    for (const search of [
      '?render=1&width=abc',
      '?render=1&width=-50',
      '?render=1&width=12.5',
      `?render=1&width=${MIN_RENDER_DIMENSION - 1}`,
      `?render=1&height=${MAX_RENDER_DIMENSION + 1}`,
    ]) {
      const result = parseRenderParams(search);
      expect(result.mode, search).toBe('render-error');
    }
    expect(parseRenderParams(`?render=1&width=${MIN_RENDER_DIMENSION}&height=${MAX_RENDER_DIMENSION}`).mode).toBe('render');
  });

  it('rejects an unknown theme', () => {
    const result = parseRenderParams('?render=1&theme=blue');
    expect(result.mode).toBe('render-error');
    expect((result as { error: string }).error).toContain('theme');
  });

  it('rejects an empty screen selector but keeps a named one', () => {
    expect(parseRenderParams('?render=1&screen=').mode).toBe('render-error');
    expect(parseRenderParams('?render=1&screen=Main%20Window')).toEqual({
      mode: 'render',
      request: { screen: 'Main Window' },
    });
  });

  it('ignores unrelated query params', () => {
    expect(parseRenderParams('?render=1&utm_source=x')).toEqual({ mode: 'render', request: {} });
  });
});

describe('resolveScreen', () => {
  const document = doc(screen('s1', 'Main Window'), screen('s2', 'Settings'));

  it('defaults to the first screen', () => {
    expect(resolveScreen(document, undefined)?.id).toBe('s1');
  });

  it('matches by id, then title, then zero-based index', () => {
    expect(resolveScreen(document, 's2')?.id).toBe('s2');
    expect(resolveScreen(document, 'Settings')?.id).toBe('s2');
    expect(resolveScreen(document, '1')?.id).toBe('s2');
  });

  it('returns null for unknown selectors and empty documents', () => {
    expect(resolveScreen(document, 'nope')).toBeNull();
    expect(resolveScreen(document, '9')).toBeNull();
    expect(resolveScreen(doc(), undefined)).toBeNull();
  });
});

describe('resolveScreenshotTarget', () => {
  const document = doc(screen('s1', 'Main Window', 900, 650), screen('s2', 'Settings', 800, 600));

  it('defaults to the selected screen, else the first, with its own dimensions', () => {
    expect(resolveScreenshotTarget(document, {}, 's2').screen.id).toBe('s2');
    const target = resolveScreenshotTarget(document, {}, null);
    expect(target.screen.id).toBe('s1');
    expect(target.width).toBe(900);
    expect(target.height).toBe(650);
    expect(target.scale).toBe(1);
    expect(target.theme).toBeUndefined();
  });

  it('resolves an explicit screen by id or title and applies overrides', () => {
    const target = resolveScreenshotTarget(document, { screenId: 'Settings', width: 500, height: 440, theme: 'dark' }, null);
    expect(target.screen.id).toBe('s2');
    expect(target.width).toBe(500);
    expect(target.height).toBe(440);
    expect(target.theme).toBe('dark');
  });

  it('throws on an unknown screen, listing the known ones', () => {
    expect(() => resolveScreenshotTarget(document, { screenId: 'nope' }, null))
      .toThrow(/unknown screen "nope".*s1.*s2/s);
  });

  it('throws on invalid dimensions, theme, and scale', () => {
    expect(() => resolveScreenshotTarget(document, { width: 10 }, null)).toThrow(/width/);
    expect(() => resolveScreenshotTarget(document, { height: 123456 }, null)).toThrow(/height/);
    expect(() => resolveScreenshotTarget(document, { width: 500.5 }, null)).toThrow(/width/);
    expect(() => resolveScreenshotTarget(document, { theme: 'blue' as 'dark' }, null)).toThrow(/theme/);
    expect(() => resolveScreenshotTarget(document, { scale: 0 }, null)).toThrow(/scale/);
    expect(() => resolveScreenshotTarget(document, { scale: 9 }, null)).toThrow(/scale/);
  });

  it('throws on a document with no screens', () => {
    expect(() => resolveScreenshotTarget(doc(), {}, null)).toThrow(/no screens/);
  });
});
