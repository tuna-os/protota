#!/usr/bin/env node
/**
 * Tune Playwright retry policy from JSON reporter output.
 *
 * Usage:
 *   npx playwright test --reporter=json > artifacts/playwright.json
 *   node scripts/auto-qa-tuner.mjs artifacts/playwright.json [...older reports]
 *
 * Reports are evaluated in argument order. Only the newest configured sample
 * window is used. The policy moves by one step per run, within fixed safety
 * bounds, so one unusual run cannot disable retries or hide a regression.
 *
 * Observations are printed, not committed: the retry count in
 * .github/auto-qa-tuning.json only moves one step per run, so a run that
 * suggests the same value leaves the file untouched and produces no diff.
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const defaultConfigPath = join(repoRoot, '.github', 'auto-qa-tuning.json');
const terminalSuccesses = new Set(['passed', 'skipped']);
const retryableFailures = new Set(['failed', 'timedOut', 'interrupted']);

/**
 * Playwright's `test.status` uses `expected`/`unexpected`/`flaky`/`skipped`,
 * not test-result statuses. An empty `results` array means no attempt was
 * recorded, which is not evidence of failure — map it onto the spec-level
 * status rather than counting every such test as a hard failure.
 */
function terminalStatusOf(test) {
  const lastStatus = test.results?.at(-1)?.status;
  if (lastStatus !== undefined) return lastStatus;
  switch (test.status) {
    case 'expected':
    case 'flaky':
      return 'passed';
    case 'unexpected':
      return 'failed';
    case 'skipped':
      return 'skipped';
    default:
      return 'unknown';
  }
}

function collectTests(suite, tests) {
  for (const spec of suite.specs ?? []) {
    tests.push(...(spec.tests ?? []));
  }
  for (const child of suite.suites ?? []) {
    collectTests(child, tests);
  }
}

export function observationsFromReport(report) {
  const tests = [];
  for (const suite of report.suites ?? []) {
    collectTests(suite, tests);
  }

  return tests.map((test) => {
    const results = test.results ?? [];
    const terminalStatus = terminalStatusOf(test);
    // `flaky` at spec level means an earlier attempt failed. With no results
    // to inspect, trust that flag instead of the reconstructed status.
    const earlierFailure = results.length > 0
      ? results.slice(0, -1).some((result) => retryableFailures.has(result.status))
      : test.status === 'flaky';
    return {
      failed: !terminalSuccesses.has(terminalStatus),
      flaky: terminalStatus === 'passed' && earlierFailure,
    };
  });
}

/** `slice(-0)` returns the whole array, so a zero window must be rejected. */
function sampleWindowOf(policy) {
  const window = policy?.sampleWindow;
  if (!Number.isInteger(window) || window < 1) {
    throw new Error(
      `sampleWindow must be a positive integer, got ${JSON.stringify(window)}`,
    );
  }
  return window;
}

export function tuneRetries(policy, observations) {
  const sample = observations.slice(-sampleWindowOf(policy));
  const failed = sample.filter((observation) => observation.failed).length;
  const flaky = sample.filter((observation) => observation.flaky).length;
  const observedFlakeRate = sample.length === 0 ? 0 : flaky / sample.length;
  let retries = policy.retries.current;
  let reason = 'insufficient-samples';

  if (sample.length >= policy.minimumSamples) {
    if (observedFlakeRate > policy.targetFlakeRate) {
      retries = Math.min(retries + 1, policy.retries.maximum);
      reason = retries === policy.retries.current ? 'at-maximum' : 'flake-rate-high';
    } else if (failed === 0 && observedFlakeRate <= policy.targetFlakeRate / 2) {
      retries = Math.max(retries - 1, policy.retries.minimum);
      reason = retries === policy.retries.current ? 'at-minimum' : 'stable-window';
    } else {
      reason = failed > 0 ? 'terminal-failures-present' : 'within-target-band';
    }
  }

  return {
    retries,
    summary: {
      samples: sample.length,
      flaky,
      failed,
      observedFlakeRate,
      previousRetries: policy.retries.current,
      retries,
      reason,
    },
  };
}

function takeOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return { value: null, rest: args };
  const value = args[index + 1];
  if (!value) throw new Error(`${name} requires a path`);
  return {
    value,
    rest: args.filter((_, position) => position !== index && position !== index + 1),
  };
}

function main() {
  const summary = takeOption(process.argv.slice(2), '--summary');
  const config = takeOption(summary.rest, '--config');
  const configPath = config.value ?? defaultConfigPath;
  const reportPaths = config.rest;
  if (reportPaths.length === 0) {
    throw new Error('Pass at least one Playwright JSON report');
  }

  const policy = JSON.parse(readFileSync(configPath, 'utf8'));
  if (policy.schemaVersion !== 1 || !policy.playwright?.retries) {
    throw new Error(`Unsupported Auto-QA policy in ${configPath}`);
  }

  const observations = reportPaths.flatMap((reportPath) =>
    observationsFromReport(JSON.parse(readFileSync(reportPath, 'utf8'))));
  const result = tuneRetries(policy.playwright, observations);
  policy.playwright.retries.current = result.retries;

  // Write only when the retry count changes, so running the tuner on an
  // unchanged tree leaves the committed policy byte-identical.
  const serialised = `${JSON.stringify(policy, null, 2)}\n`;
  if (serialised !== readFileSync(configPath, 'utf8')) {
    const temporaryPath = `${configPath}.tmp`;
    writeFileSync(temporaryPath, serialised);
    renameSync(temporaryPath, configPath);
  }
  if (summary.value) {
    writeFileSync(summary.value, `${JSON.stringify(result.summary, null, 2)}\n`);
  }
  console.log(JSON.stringify(result.summary));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
