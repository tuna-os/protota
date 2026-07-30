/**
 * Fidelity report: measure every catalogued app against its native window and
 * write one table, so accuracy is tracked over time instead of spot-checked.
 *
 *   npx tsx scripts/fidelity-report.mjs --broadway http://127.0.0.1:8085 calculator
 *   npx tsx scripts/fidelity-report.mjs --all            # every app with a runner
 *
 * For each app it runs the Broadway comparison spec (which captures the real
 * GTK window, renders the matching preset at the same size, and diffs them),
 * then records difference ratio, source-resolved similarity, foreground IoU
 * and unresolved-boundary coverage into artifacts/fidelity.json plus a
 * Markdown table on stdout.
 *
 * The native runner must already be serving Broadway for the app being
 * measured — this tool measures, it does not launch containers, so it works
 * the same against a local podman container or a tunnelled remote host (see
 * docs/preset-workflow.md).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(repoRoot, 'tests/fixtures/gnome-app-catalog.json'), 'utf8'));
const args = process.argv.slice(2);
const broadwayUrl = args.includes('--broadway') ? args[args.indexOf('--broadway') + 1] : 'http://127.0.0.1:8085';
const screenId = args.includes('--screen') ? args[args.indexOf('--screen') + 1] : undefined;
const apps = args.includes('--all')
  ? Object.keys(catalog).filter((id) => catalog[id].status === 'preset')
  : args.filter((argument, index) => !argument.startsWith('--') && args[index - 1] !== '--broadway' && args[index - 1] !== '--screen');

if (!apps.length) {
  console.error('Usage: npx tsx scripts/fidelity-report.mjs [--broadway URL] [--screen ID] <appId>... | --all');
  process.exit(1);
}

const outDir = join(repoRoot, 'artifacts');
mkdirSync(outDir, { recursive: true });
const reportPath = join(outDir, 'fidelity.json');
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {};

function findComparison(appId) {
  const root = join(repoRoot, 'test-results');
  if (!existsSync(root)) return null;
  for (const dirent of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (dirent.isFile() && dirent.name === `comparison-${appId}.json`) {
      return JSON.parse(readFileSync(join(dirent.parentPath, dirent.name), 'utf8'));
    }
  }
  return null;
}

for (const appId of apps) {
  const app = catalog[appId];
  if (!app) {
    console.error(`${appId}: not in the catalog`);
    continue;
  }
  try {
    execFileSync('npx', ['playwright', 'test', 'tests/broadway-reference.spec.ts', '--reporter=line'], {
      cwd: repoRoot,
      stdio: 'pipe',
      env: {
        ...process.env,
        BROADWAY_URL: broadwayUrl,
        BROADWAY_APP_ID: appId,
        BROADWAY_PRESET_ID: app.presetId ?? appId,
        ...(screenId ? { BROADWAY_SCREEN_ID: screenId } : {}),
        ...(app.viewport ? { BROADWAY_VIEWPORT_WIDTH: String(app.viewport.width), BROADWAY_VIEWPORT_HEIGHT: String(app.viewport.height) } : {}),
      },
    });
  } catch {
    console.error(`${appId}: comparison run failed — is the native app serving Broadway at ${broadwayUrl}?`);
    continue;
  }
  const comparison = findComparison(appId);
  if (!comparison) {
    console.error(`${appId}: no comparison artifact produced`);
    continue;
  }
  report[appId] = {
    screen: screenId ?? 'first',
    differenceRatio: Number(comparison.differenceRatio.toFixed(4)),
    sourceResolvedSimilarity: Number(comparison.sourceResolvedSimilarity.toFixed(4)),
    foregroundIoU: Number(comparison.foregroundIoU.toFixed(4)),
    unresolvedWidgetCoverage: Number(comparison.unresolvedWidgetCoverage.toFixed(4)),
    inputKind: comparison.inputKind,
  };
  console.error(`${appId}: ${(report[appId].differenceRatio * 100).toFixed(2)}% difference`);
}

writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

const rows = Object.entries(report).sort((a, b) => a[1].differenceRatio - b[1].differenceRatio);
console.log('| App | Screen | Difference | Source-resolved | Foreground IoU | Unresolved |');
console.log('| --- | --- | ---: | ---: | ---: | ---: |');
for (const [appId, metrics] of rows) {
  console.log(`| ${appId} | ${metrics.screen} | ${(metrics.differenceRatio * 100).toFixed(2)}% | ` +
    `${(metrics.sourceResolvedSimilarity * 100).toFixed(1)}% | ${(metrics.foregroundIoU * 100).toFixed(1)}% | ` +
    `${(metrics.unresolvedWidgetCoverage * 100).toFixed(1)}% |`);
}
console.error(`\nWrote ${reportPath}`);
