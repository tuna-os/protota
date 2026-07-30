import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { LEGAL_CHILDREN } from '../types/mockup';

/**
 * docs/components.md is generated from LEGAL_CHILDREN, LEGAL_SLOTS,
 * WIDGET_SCHEMAS and the GIR tables. A stale reference is worse than none:
 * users and agents would build against components that no longer match.
 */
describe('component reference', () => {
  const path = new URL('../../docs/components.md', import.meta.url).pathname;

  it('documents every component the editor offers', () => {
    expect(existsSync(path)).toBe(true);
    const reference = readFileSync(path, 'utf8');
    const missing = Object.keys(LEGAL_CHILDREN)
      .filter((type) => !reference.includes(`## \`${type}\``))
      .sort();
    expect(
      missing,
      'Regenerate with: npx tsx scripts/generate-component-reference.mjs',
    ).toEqual([]);
  });
});
