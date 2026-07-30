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
 * A finishing file may declare multiple screens (main window, preferences
 * dialog, mode variants) plus flow edges between them, mirroring the app's
 * real navigation:
 *
 *   {
 *     "title": "GNOME Calculator",
 *     "screens": [
 *       { "id": "main", "entry": "math-window.blp", "title": "Basic", "width": 360, "height": 460,
 *         "overrides": [{ "id": "_converter", "set": { "visible": false }, "why": "…" }] },
 *       { "id": "preferences", "entry": "math-preferences.blp", "title": "Preferences", "width": 460, "height": 520 }
 *     ],
 *     "edges": [{ "from": "main", "to": "preferences", "why": "Main menu → Preferences" }]
 *   }
 *
 * Without a `screens` array, the CLI entry produces a single screen and the
 * legacy top-level `screen`/`overrides` keys apply to it.
 *
 * Usage:
 *   npx tsx scripts/generate-preset.mjs <appId> <sourceRoot> <entry>
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { blueprintBundleToDocument } from '../src/utils/blueprint.ts';

const [appId, sourceRoot, defaultEntry] = process.argv.slice(2);
if (!appId || !sourceRoot || !defaultEntry) {
  console.error('Usage: npx tsx scripts/generate-preset.mjs <appId> <sourceRoot> <entry>');
  process.exit(1);
}

const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter((dirent) => dirent.isFile() && /\.(blp|ui|vala)$/i.test(dirent.name))
  .map((dirent) => {
    const absolute = join(dirent.parentPath, dirent.name);
    return { path: relative(sourceRoot, absolute), content: readFileSync(absolute, 'utf8') };
  });

const finishingPath = new URL(`../presets-src/${appId}.finishing.json`, import.meta.url);
const finishing = existsSync(finishingPath) ? JSON.parse(readFileSync(finishingPath, 'utf8')) : null;

function applyOverrides(screen, overrides, label) {
  const overridesById = new Map((overrides ?? []).map((override) => [override.id, override.set]));
  const applied = new Set();
  const visit = (node) => {
    const set = overridesById.get(node.id);
    if (set) {
      Object.assign(node, set);
      applied.add(node.id);
    }
    node.children?.forEach(visit);
  };
  visit(screen.rootNode);
  const missing = [...overridesById.keys()].filter((id) => !applied.has(id));
  if (missing.length) {
    // A finishing override that no longer matches the source is stale — fail
    // loudly instead of silently shipping a drifted preset.
    console.error(`Finishing overrides for ${label} reference missing node ids: ${missing.join(', ')}`);
    process.exit(1);
  }
  return applied.size;
}

const screenSpecs = finishing?.screens?.length
  ? finishing.screens
  : [{ id: `${appId}-main`, entry: defaultEntry, ...(finishing?.screen ?? {}), overrides: finishing?.overrides }];

const screens = [];
let appliedTotal = 0;
let diagnosticsTotal = 0;
for (const spec of screenSpecs) {
  const entry = spec.entry ?? defaultEntry;
  const generated = blueprintBundleToDocument(files, entry, finishing?.title ?? appId);
  const screen = generated.screens[0];
  screen.id = spec.id ?? entry.replace(/\.(blp|ui)$/i, '');
  if (spec.title) screen.title = spec.title;
  if (spec.width) screen.width = spec.width;
  if (spec.height) screen.height = spec.height;
  appliedTotal += applyOverrides(screen, spec.overrides, screen.id);
  diagnosticsTotal += generated.importDiagnostics?.length ?? 0;
  screens.push(screen);
}

const document = {
  id: `${appId}-preset`,
  title: finishing?.title ?? appId,
  colorScheme: 'auto',
  screens,
  edges: (finishing?.edges ?? []).map((edge, index) => ({
    id: `edge-${index + 1}`,
    sourceId: edge.from,
    targetId: edge.to,
  })),
};

const outputPath = new URL(`../public/presets/${appId}.mockup.json`, import.meta.url);
writeFileSync(outputPath, JSON.stringify({
  version: 1,
  exportedAt: new Date().toISOString(),
  generatedBy: 'scripts/generate-preset.mjs',
  document,
  assets: {},
}, null, 2) + '\n');
console.error(`Wrote public/presets/${appId}.mockup.json — ${screens.length} screen(s), ${document.edges.length} edge(s), ${appliedTotal} finishing overrides, ${diagnosticsTotal} import diagnostics`);
