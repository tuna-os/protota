import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * playwright.config.ts reads this file at load time and throws when the policy
 * is malformed, which stops every Playwright run rather than just the tuning.
 * test:unit runs before Playwright in CI, so these assertions name a bad merge
 * in seconds instead of leaving it to be discovered by a failing suite.
 */
const policyPath = fileURLToPath(new URL('../../.github/auto-qa-tuning.json', import.meta.url));

interface Policy {
  schemaVersion: number;
  playwright: {
    sampleWindow: number;
    minimumSamples: number;
    targetFlakeRate: number;
    retries: { minimum: number; maximum: number; current: number };
    [key: string]: unknown;
  };
}

const policy = JSON.parse(readFileSync(policyPath, 'utf8')) as Policy;
const { playwright } = policy;

describe('committed Auto-QA policy', () => {
  it('parses and declares the schema version the tuner understands', () => {
    expect(policy.schemaVersion).toBe(1);
    expect(playwright).toBeTypeOf('object');
  });

  it('keeps the retry bounds ordered and the current value inside them', () => {
    const { minimum, maximum, current } = playwright.retries;

    for (const value of [minimum, maximum, current]) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(minimum).toBeLessThanOrEqual(maximum);
    expect(current).toBeGreaterThanOrEqual(minimum);
    expect(current).toBeLessThanOrEqual(maximum);
  });

  it('uses a sample window the tuner can slice and a sample floor it can reach', () => {
    // slice(-0) returns the whole array, so zero is not a valid window.
    expect(Number.isInteger(playwright.sampleWindow)).toBe(true);
    expect(playwright.sampleWindow).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(playwright.minimumSamples)).toBe(true);
    expect(playwright.minimumSamples).toBeGreaterThanOrEqual(1);
    expect(playwright.minimumSamples).toBeLessThanOrEqual(playwright.sampleWindow);
  });

  it('keeps the flake target inside the range the tuner compares against', () => {
    expect(playwright.targetFlakeRate).toBeGreaterThan(0);
    expect(playwright.targetFlakeRate).toBeLessThanOrEqual(1);
  });

  it('has no unknown keys that would silently disable a setting', () => {
    // A typo such as `sampleWindows` reads as undefined and the tuner throws,
    // but a typo in a retry field would be silently ignored by JSON.parse.
    expect(Object.keys(playwright).sort()).toEqual([
      'comment',
      'minimumSamples',
      'retries',
      'sampleWindow',
      'targetFlakeRate',
    ]);
    expect(Object.keys(playwright.retries).sort()).toEqual(['current', 'maximum', 'minimum']);
  });
});
