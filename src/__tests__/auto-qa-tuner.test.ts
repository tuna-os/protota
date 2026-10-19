import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error -- the tuner is plain ESM JavaScript without declarations.
import { observationsFromReport, tuneRetries } from '../../scripts/auto-qa-tuner.mjs';

const tunerPath = fileURLToPath(new URL('../../scripts/auto-qa-tuner.mjs', import.meta.url));
const temporaryDirectories: string[] = [];

interface TunerPolicy {
  sampleWindow: number;
  minimumSamples: number;
  targetFlakeRate: number;
  retries: { minimum: number; maximum: number; current: number };
}

const basePolicy: TunerPolicy = {
  sampleWindow: 10,
  minimumSamples: 3,
  targetFlakeRate: 0.1,
  retries: { minimum: 1, maximum: 2, current: 2 },
};

function policy(overrides: {
  sampleWindow?: number;
  minimumSamples?: number;
  targetFlakeRate?: number;
  retries?: Partial<TunerPolicy['retries']>;
} = {}): TunerPolicy {
  return {
    ...basePolicy,
    ...overrides,
    retries: { ...basePolicy.retries, ...overrides.retries },
  };
}

function runTuner(statuses: string[][], current = 2, minimumSamples = 3) {
  const directory = mkdtempSync(join(tmpdir(), 'protota-auto-qa-'));
  temporaryDirectories.push(directory);
  const configPath = join(directory, 'policy.json');
  const reportPath = join(directory, 'report.json');
  writeFileSync(configPath, `${JSON.stringify({
    schemaVersion: 1,
    playwright: { ...basePolicy, minimumSamples, retries: { ...basePolicy.retries, current } },
  }, null, 2)}\n`);
  writeFileSync(reportPath, JSON.stringify({
    suites: [{
      specs: [{
        tests: statuses.map((results) => ({
          results: results.map((status) => ({ status })),
        })),
      }],
    }],
  }));

  const summary = JSON.parse(execFileSync(
    process.execPath,
    [tunerPath, '--config', configPath, reportPath],
    { encoding: 'utf8' },
  ));
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  return { summary, config };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Auto-QA tuner CLI', () => {
  it('reduces retries by one after a stable observation window', () => {
    const { summary, config } = runTuner([['passed'], ['passed'], ['passed']]);

    expect(summary).toMatchObject({ reason: 'stable-window', previousRetries: 2, retries: 1 });
    expect(config.playwright.retries.current).toBe(1);
  });

  it('raises retries when retry evidence exceeds the target', () => {
    const { summary, config } = runTuner([
      ['failed', 'passed'],
      ['passed'],
      ['passed'],
    ], 1);

    expect(summary).toMatchObject({ reason: 'flake-rate-high', flaky: 1, retries: 2 });
    expect(config.playwright.retries.current).toBe(2);
  });

  it('does not tune from an undersized sample', () => {
    const { summary, config } = runTuner([['passed']], 2, 2);

    expect(summary).toMatchObject({ reason: 'insufficient-samples', retries: 2 });
    expect(config.playwright.retries.current).toBe(2);
  });

  it('does not rewrite the policy when the retry count is unchanged', () => {
    const directory = mkdtempSync(join(tmpdir(), 'protota-auto-qa-'));
    temporaryDirectories.push(directory);
    const configPath = join(directory, 'policy.json');
    const reportPath = join(directory, 'report.json');
    const configText = `${JSON.stringify({
      schemaVersion: 1,
      playwright: policy({ retries: { current: 2 } }),
    }, null, 2)}\n`;
    writeFileSync(configPath, configText);
    writeFileSync(reportPath, JSON.stringify({
      suites: [{ specs: [{ tests: [{ results: [{ status: 'failed' }, { status: 'passed' }] }] }] }],
    }));

    execFileSync(process.execPath, [tunerPath, '--config', configPath, reportPath], {
      encoding: 'utf8',
    });

    // Already at maximum: the suggested value equals the committed one.
    expect(readFileSync(configPath, 'utf8')).toBe(configText);
  });

  it('writes the observation summary to --summary instead of the policy', () => {
    const directory = mkdtempSync(join(tmpdir(), 'protota-auto-qa-'));
    temporaryDirectories.push(directory);
    const configPath = join(directory, 'policy.json');
    const reportPath = join(directory, 'report.json');
    const summaryPath = join(directory, 'summary.json');
    writeFileSync(configPath, JSON.stringify({
      schemaVersion: 1,
      playwright: policy(),
    }));
    writeFileSync(reportPath, JSON.stringify({
      suites: [{ specs: [{ tests: [{ results: [{ status: 'passed' }] }] }] }],
    }));

    execFileSync(
      process.execPath,
      [tunerPath, '--config', configPath, '--summary', summaryPath, reportPath],
      { encoding: 'utf8' },
    );

    const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(summary.reason).toBe('insufficient-samples');
    expect(config.playwright).not.toHaveProperty('lastObservation');
  });
});

describe('tuneRetries', () => {
  const stable = [{ failed: false, flaky: false }];

  it('stops raising retries at the configured maximum', () => {
    const { retries, summary } = tuneRetries(
      policy({ retries: { current: 2 } }),
      [{ failed: false, flaky: true }, ...stable, ...stable],
    );

    expect(retries).toBe(2);
    expect(summary.reason).toBe('at-maximum');
  });

  it('stops lowering retries at the configured minimum', () => {
    const { retries, summary } = tuneRetries(
      policy({ retries: { current: 1 } }),
      [...stable, ...stable, ...stable],
    );

    expect(retries).toBe(1);
    expect(summary.reason).toBe('at-minimum');
  });

  it('holds retries when terminal failures are present inside the flake target', () => {
    const { retries, summary } = tuneRetries(policy(), [
      { failed: true, flaky: false },
      ...stable,
      ...stable,
    ]);

    expect(retries).toBe(2);
    expect(summary).toMatchObject({ reason: 'terminal-failures-present', failed: 1 });
  });

  it('holds retries when the flake rate sits inside the target band', () => {
    const { retries, summary } = tuneRetries(policy({ targetFlakeRate: 0.6 }), [
      { failed: false, flaky: true },
      ...stable,
      ...stable,
    ]);

    expect(retries).toBe(2);
    expect(summary.reason).toBe('within-target-band');
  });

  it('aggregates observations from every supplied report newest-last', () => {
    const first = observationsFromReport({
      suites: [{ specs: [{ tests: [{ results: [{ status: 'failed' }, { status: 'passed' }] }] }] }],
    });
    const second = observationsFromReport({
      suites: [{ specs: [{ tests: [{ results: [{ status: 'passed' }] }] }] }],
    });
    const { summary } = tuneRetries(policy({ minimumSamples: 2 }), [...first, ...second]);

    expect(summary).toMatchObject({ samples: 2, flaky: 1, failed: 0 });
  });

  it('rejects a non-positive sample window instead of slicing from the end', () => {
    expect(() => tuneRetries(policy({ sampleWindow: 0 }), [])).toThrow(/sampleWindow/);
  });
});

describe('observationsFromReport', () => {
  it('classifies only the terminal attempt of a flaky test as flaky', () => {
    expect(observationsFromReport({
      suites: [{ specs: [{ tests: [{ results: [{ status: 'passed' }] }] }] }],
    })).toEqual([{ failed: false, flaky: false }]);

    expect(observationsFromReport({
      suites: [{
        suites: [{
          specs: [{
            tests: [
              { results: [{ status: 'timedOut' }, { status: 'passed' }] },
              { results: [{ status: 'skipped' }] },
            ],
          }],
        }],
      }],
    })).toEqual([
      { failed: false, flaky: true },
      { failed: false, flaky: false },
    ]);
  });

  it('maps spec-level status when no attempt results were recorded', () => {
    const tests = ['expected', 'flaky', 'unexpected', 'skipped'].map((status) => ({
      status,
      results: [],
    }));

    expect(observationsFromReport({ suites: [{ specs: [{ tests }] }] })).toEqual([
      { failed: false, flaky: false },
      { failed: false, flaky: true },
      { failed: true, flaky: false },
      { failed: false, flaky: false },
    ]);
  });
});
