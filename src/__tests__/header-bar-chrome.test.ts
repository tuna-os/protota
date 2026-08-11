import { describe, expect, it } from 'vitest';
import { headerBarControls, headerBarFallbackTitle, DEFAULT_WINDOW_BUTTONS } from '../utils/headerBarChrome';
import type { AdwNode } from '../types/mockup';

const headerBar = (extra: Partial<AdwNode> = {}): AdwNode => ({
  id: 'header', type: 'header-bar', children: [], ...extra,
});

describe('headerBarControls', () => {
  it('window context shows full controls by default', () => {
    expect(headerBarControls(headerBar(), { inDialog: false, isPrimary: true }))
      .toBe('window');
  });

  it('show-title-buttons false hides all controls', () => {
    expect(headerBarControls(headerBar({ showTitleButtons: false }),
      { inDialog: false, isPrimary: true })).toBe('none');
  });

  it('show-end-title-buttons false hides the end controls', () => {
    expect(headerBarControls(headerBar({ showEndTitleButtons: false }),
      { inDialog: false, isPrimary: true })).toBe('none');
  });

  it('show-start-title-buttons false alone keeps the end-side controls', () => {
    // GNOME's default decoration layout draws every control at the end.
    expect(headerBarControls(headerBar({ showStartTitleButtons: false }),
      { inDialog: false, isPrimary: true })).toBe('window');
  });

  it('dialog context never shows minimize/maximize — close only', () => {
    expect(headerBarControls(headerBar(), { inDialog: true, isPrimary: true }))
      .toBe('close');
  });

  it('dialog with end title buttons disabled shows no controls at all', () => {
    // The Files compress dialog: both sides disabled.
    expect(headerBarControls(
      headerBar({ showStartTitleButtons: false, showEndTitleButtons: false }),
      { inDialog: true, isPrimary: true })).toBe('none');
  });

  it('non-primary header bars never carry controls', () => {
    expect(headerBarControls(headerBar(), { inDialog: false, isPrimary: false }))
      .toBe('none');
  });

  it('non header-bar nodes never carry controls', () => {
    expect(headerBarControls({ id: 'b', type: 'box', children: [] },
      { inDialog: false, isPrimary: true })).toBe('none');
  });

  it('close-only preference drops minimize/maximize on a window', () => {
    expect(headerBarControls(headerBar(), { inDialog: false, isPrimary: true },
      { ...DEFAULT_WINDOW_BUTTONS, buttons: 'close' })).toBe('close');
  });

  it('the side preference does not affect which controls are drawn', () => {
    expect(headerBarControls(headerBar(), { inDialog: false, isPrimary: true },
      { ...DEFAULT_WINDOW_BUTTONS, side: 'start' })).toBe('window');
    expect(headerBarControls(headerBar(), { inDialog: false, isPrimary: true },
      { ...DEFAULT_WINDOW_BUTTONS, buttons: 'close', side: 'start' })).toBe('close');
  });

  it('close-only preference still respects the title-button properties', () => {
    expect(headerBarControls(headerBar({ showTitleButtons: false }),
      { inDialog: false, isPrimary: true },
      { ...DEFAULT_WINDOW_BUTTONS, buttons: 'close' })).toBe('none');
  });

  it('dialog context stays close-only regardless of the preference', () => {
    expect(headerBarControls(headerBar(), { inDialog: true, isPrimary: true },
      { ...DEFAULT_WINDOW_BUTTONS, buttons: 'window' })).toBe('close');
  });
});

describe('headerBarFallbackTitle', () => {
  it('falls back to the enclosing dialog/window title', () => {
    expect(headerBarFallbackTitle(headerBar(), 'Compress Files and Folders'))
      .toBe('Compress Files and Folders');
  });

  it('own title wins over the surface title', () => {
    expect(headerBarFallbackTitle(headerBar({ title: 'Own' }), 'Surface'))
      .toBeUndefined();
  });

  it('show-title false suppresses the surface-title fallback', () => {
    expect(headerBarFallbackTitle(headerBar({ showTitle: false }), 'Properties'))
      .toBeUndefined();
  });

  it('a window-title child wins over the surface title', () => {
    const node = headerBar({
      children: [{ id: 'wt', type: 'window-title', title: 'Widget', children: [] }],
    });
    expect(headerBarFallbackTitle(node, 'Surface')).toBeUndefined();
  });

  it('a hidden window-title child does not block the fallback', () => {
    const node = headerBar({
      children: [{ id: 'wt', type: 'window-title', visible: false, children: [] }],
    });
    expect(headerBarFallbackTitle(node, 'Surface')).toBe('Surface');
  });

  it('never invents a title when no surface title exists', () => {
    expect(headerBarFallbackTitle(headerBar(), undefined)).toBeUndefined();
  });
});
