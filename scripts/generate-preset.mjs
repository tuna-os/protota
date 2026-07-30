/**
 * Hybrid preset generator: import an app's official declarative source
 * (with Vala static enrichment), then apply that app's hand-finishing file.
 *
 * The import supplies the true widget tree; the finishing file records the
 * small set of human decisions the source cannot settle statically —
 * runtime-driven visibility, default mode labels, window size. Finishing
 * files live in presets-src/<app>.finishing.json so every hand decision is
 * reviewable and re-runnable when GNOME updates.
 *
 * Usage:
 *   npx tsx scripts/generate-preset.mjs <appId> <sourceRoot> <entry>
 * Example:
 *   npx tsx scripts/generate-preset.mjs calculator ~/src/gnome-calculator/src math-window.blp
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { blueprintBundleToDocument } from '../src/utils/blueprint.ts';

const [appId, sourceRoot, entry] = process.argv.slice(2);
if (!appId || !sourceRoot || !entry) {
  console.error('Usage: npx tsx scripts/generate-preset.mjs <appId> <sourceRoot> <entry>');
  process.exit(1);
}

const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter((dirent) => dirent.isFile() && /\.(blp|ui|vala)$/i.test(dirent.name))
  .map((dirent) => {
    const absolute = join(dirent.parentPath, dirent.name);
    return { path: relative(sourceRoot, absolute), content: readFileSync(absolute, 'utf8') };
  });

const document = blueprintBundleToDocument(files, entry, appId);

const finishingPath = new URL(`../presets-src/${appId}.finishing.json`, import.meta.url);
if (existsSync(finishingPath)) {
  const finishing = JSON.parse(readFileSync(finishingPath, 'utf8'));
  if (finishing.title) document.title = finishing.title;
  const screen = document.screens[0];
  Object.assign(screen, finishing.screen ?? {});
  const overridesById = new Map((finishing.overrides ?? []).map((override) => [override.id, override.set]));
  const applied = new Set();
  const visit = (node) => {
    const set = overridesById.get(node.id);
    if (set) {
      Object.assign(node, set);
      applied.add(node.id);
    }
    node.children?.forEach(visit);
  };
  document.screens.forEach((s) => visit(s.rootNode));
  const missing = [...overridesById.keys()].filter((id) => !applied.has(id));
  if (missing.length) {
    // A finishing override that no longer matches the source is stale — fail
    // loudly instead of silently shipping a drifted preset.
    console.error(`Finishing overrides reference missing node ids: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.error(`Applied ${applied.size} finishing overrides from presets-src/${appId}.finishing.json`);
} else {
  console.error(`No finishing file at presets-src/${appId}.finishing.json — writing raw import.`);
}

const outputPath = new URL(`../public/presets/${appId}.mockup.json`, import.meta.url);
writeFileSync(outputPath, JSON.stringify({
  version: 1,
  exportedAt: new Date().toISOString(),
  generatedBy: 'scripts/generate-preset.mjs',
  document,
  assets: {},
}, null, 2) + '\n');
console.error(`Wrote public/presets/${appId}.mockup.json (${document.importDiagnostics?.length ?? 0} import diagnostics)`);
