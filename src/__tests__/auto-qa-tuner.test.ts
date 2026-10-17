import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const tunerPath = fileURLToPath(new URL('../../scripts/auto-qa-tuner.mjs', import.meta.url));
const temporaryDirectories: string[] = [];

function runTuner(statuses: string[][], current = 2, minimumSamples = 3) {
  const directory = mkdtempSync(join(tmpdir(), 'protota-auto-qa-'));
  temporaryDirectories.push(directory);
  const configPath = join(directory, 'policy.json');
  const reportPath = join(directory, 'report.json');
  writeFileSync(configPath, JSON.stringify({
    schemaVersion: 1,
    playwright: {
      sampleWindow: 10,
      minimumSamples,
      targetFlakeRate: 0.1,
      retries: { minimum: 1, maximum: 2, current },
    },
  }));
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

describe('Auto-QA tuner', () => {
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
});
