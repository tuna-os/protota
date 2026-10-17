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
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const defaultConfigPath = join(repoRoot, '.github', 'auto-qa-tuning.json');
const terminalSuccesses = new Set(['passed', 'skipped']);
const retryableFailures = new Set(['failed', 'timedOut', 'interrupted']);

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
    const terminalStatus = results.at(-1)?.status ?? test.status ?? 'unknown';
    return {
      failed: !terminalSuccesses.has(terminalStatus),
      flaky: terminalStatus === 'passed' && results
        .slice(0, -1)
        .some((result) => retryableFailures.has(result.status)),
    };
  });
}

export function tuneRetries(policy, observations) {
  const sample = observations.slice(-policy.sampleWindow);
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

function parseArguments(args) {
  const configIndex = args.indexOf('--config');
  if (configIndex === -1) {
    return { configPath: defaultConfigPath, reportPaths: args };
  }
  const configPath = args[configIndex + 1];
  if (!configPath) throw new Error('--config requires a path');
  return {
    configPath,
    reportPaths: args.filter((_, index) => index !== configIndex && index !== configIndex + 1),
  };
}

function main() {
  const { configPath, reportPaths } = parseArguments(process.argv.slice(2));
  if (reportPaths.length === 0) {
    throw new Error('Pass at least one Playwright JSON report');
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (config.schemaVersion !== 1 || !config.playwright?.retries) {
    throw new Error(`Unsupported Auto-QA policy in ${configPath}`);
  }

  const observations = reportPaths.flatMap((reportPath) =>
    observationsFromReport(JSON.parse(readFileSync(reportPath, 'utf8'))));
  const result = tuneRetries(config.playwright, observations);
  config.playwright.retries.current = result.retries;
  config.playwright.lastObservation = result.summary;

  const temporaryPath = `${configPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`);
  renameSync(temporaryPath, configPath);
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
