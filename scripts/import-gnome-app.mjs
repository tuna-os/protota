/**
 * Catalog-driven GNOME app import: the one command that takes an app from
 * tests/fixtures/gnome-app-catalog.json to a regenerated preset.
 *
 *   npx tsx scripts/import-gnome-app.mjs <appId> [--refresh]
 *   npx tsx scripts/import-gnome-app.mjs --all
 *
 * Steps, all reproducible from the catalog entry alone:
 *   1. shallow-clone sourceImport.repository at sourceImport.tag (pinned so
 *      the imported source matches the native app version used for visual
 *      verification) into .gnome-source-cache/<app>@<tag>
 *   2. run scripts/generate-preset.mjs with sourceImport.importRoot and
 *      sourceImport.entry, which applies presets-src/<app>.finishing.json
 *
 * Anyone — user, agent, or CI — can rerun this when GNOME releases a new
 * version: bump the tag, regenerate, review the finishing overrides the
 * generator reports as stale, and verify with scripts/capture-preset.mjs
 * and the Broadway comparison (docs/preset-workflow.md).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(repoRoot, 'tests/fixtures/gnome-app-catalog.json'), 'utf8'));

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const targets = args.includes('--all')
  ? Object.entries(catalog).filter(([, app]) => app.sourceImport?.importRoot).map(([id]) => id)
  : args.filter((argument) => !argument.startsWith('--'));

if (!targets.length) {
  console.error('Usage: npx tsx scripts/import-gnome-app.mjs <appId>... [--refresh] | --all');
  process.exit(1);
}

for (const appId of targets) {
  const app = catalog[appId];
  const source = app?.sourceImport;
  if (!source) {
    console.error(`${appId}: no sourceImport entry in the catalog — add repository/tag/importRoot/entry first.`);
    process.exitCode = 1;
    continue;
  }
  const tag = source.tag ?? 'default';
  const cacheDir = join(repoRoot, '.gnome-source-cache', `${appId}@${tag}`);
  if (refresh) rmSync(cacheDir, { recursive: true, force: true });
  if (!existsSync(cacheDir)) {
    console.error(`${appId}: cloning ${source.repository} @ ${tag}…`);
    const cloneArgs = ['clone', '--quiet', '--depth', '1'];
    if (source.tag) cloneArgs.push('--branch', source.tag);
    execFileSync('git', [...cloneArgs, source.repository, cacheDir], { stdio: 'inherit' });
  } else {
    console.error(`${appId}: using cached checkout ${cacheDir}`);
  }
  // Catalog validation (#59): a stale or incomplete entry must fail loudly.
  // A missing importRoot/tag used to skip the importer silently — that is
  // how `software` stayed hand-drawn for the whole project (#93) — and a
  // stale `entry` filename went unnoticed whenever the finishing file's
  // screens named their own entries (Files carried `nautilus-window.blp`
  // long after upstream shipped only `.ui`).
  if (!source.importRoot) {
    console.error(`${appId}: catalog sourceImport has no importRoot — the importer would walk nothing. Add it.`);
    process.exitCode = 1;
    continue;
  }
  if (!source.tag) {
    console.error(`${appId}: warning — sourceImport has no pinned tag; importing the default branch is not version-aligned with any packaged runner.`);
  }
  const importRoot = join(cacheDir, source.importRoot ?? source.uiPath ?? '.');
  const entryExists = readdirSync(importRoot, { recursive: true }).some((file) => String(file).endsWith(source.entry));
  if (!entryExists) {
    console.error(`${appId}: catalog entry file "${source.entry}" does not exist under ${importRoot} — the catalog entry is stale.`);
    process.exitCode = 1;
    continue;
  }
  execFileSync('npx', ['tsx', join(repoRoot, 'scripts/generate-preset.mjs'), appId, importRoot, source.entry], {
    stdio: 'inherit',
    cwd: repoRoot,
  });
}
