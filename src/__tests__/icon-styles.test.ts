/**
 * Mask-icon style helper (src/utils/iconStyles.ts). Previously 0% coverage.
 */
import { describe, expect, it } from 'vitest';
import { iconStyle } from '../utils/iconStyles';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>';

describe('iconStyle', () => {
  it('produces a fixed 16px masked tile', () => {
    const style = iconStyle(SVG);
    expect(style.display).toBe('inline-block');
    expect(style.width).toBe('16px');
    expect(style.height).toBe('16px');
    expect(style.flexShrink).toBe(0);
    expect(style.maskRepeat).toBe('no-repeat');
    expect(style.WebkitMaskRepeat).toBe('no-repeat');
    expect(style.maskPosition).toBe('center');
    expect(style.backgroundColor).toBe('currentColor');
  });

  it('encodes the SVG as a data-URI mask', () => {
    const style = iconStyle(SVG);
    expect(style.maskImage).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(style.WebkitMaskImage).toBe(style.maskImage);
    // The raw SVG content must survive encoding inside the URI.
    expect(style.maskImage).toContain('viewBox');
  });

  it('escapes double quotes in the SVG for CSS-safety', () => {
    const withQuotes = '<svg xmlns="http://www.w3.org/2000/svg" width="16"></svg>';
    const style = iconStyle(withQuotes);
    // toDataUri swaps " for ' so the URI does not contain raw double quotes.
    expect(style.maskImage).not.toContain('"viewBox');
  });
});
