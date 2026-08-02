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
 * Probe-generated entries (#58, ADR 0001 consumer 2): an override derived
 * from a native runtime probe dump carries a `probeEvidence` field —
 * `{ "probeVersion": 1, "buildableId": "_converter", "expect": { "mapped": false } }`
 * — recording the dump record it came from and what that record must still
 * say. The dump itself is committed as `presets-src/<app>.probe.json` so the
 * evidence is auditable. When the entry goes stale (dump missing, widget id
 * gone, or the dump no longer says what `expect` claims), generation fails
 * loudly, exactly like a manual override whose node id no longer matches.
 *
 * Usage:
 *   npx tsx scripts/generate-preset.mjs <appId> <sourceRoot> <entry>
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { blueprintBundleToDocument } from '../src/utils/blueprint.ts';
import { applyRuntimeEvidence, matchRuntimeProfile, validateProbeEvidence } from '../src/utils/runtimeProfile.ts';

const [appId, sourceRoot, defaultEntry] = process.argv.slice(2);
if (!appId || !sourceRoot || !defaultEntry) {
  console.error('Usage: npx tsx scripts/generate-preset.mjs <appId> <sourceRoot> <entry>');
  process.exit(1);
}

const sourceEntries = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter((dirent) => dirent.isFile());

const files = sourceEntries
  .filter((dirent) => /\.(blp|ui|vala|c|py)$/i.test(dirent.name))
  .map((dirent) => {
    const absolute = join(dirent.parentPath, dirent.name);
    return { path: relative(sourceRoot, absolute), content: readFileSync(absolute, 'utf8') };
  });

/**
 * Icons an app ships in its own source tree, keyed by icon name. These are
 * the application's real artwork — embedding them is source-grounded, unlike
 * substituting a similar-looking symbolic icon. Symbolic variants win because
 * they follow the current theme; scalable app icons are the fallback.
 */
const sourceIcons = new Map();
for (const dirent of sourceEntries) {
  if (!dirent.name.endsWith('.svg')) continue;
  const absolute = join(dirent.parentPath, dirent.name);
  if (!/icons?\//i.test(relative(sourceRoot, absolute))) continue;
  const iconName = dirent.name.replace(/-symbolic\.svg$/, '').replace(/\.svg$/, '');
  const isSymbolic = dirent.name.endsWith('-symbolic.svg');
  // Application icons (reverse-DNS ids) are shown as full-colour artwork by
  // GTK; every other icon slot is themed symbolic art.
  const prefersColour = iconName.includes('.');
  const existing = sourceIcons.get(iconName);
  if (existing && (prefersColour ? existing.symbolic === false : existing.symbolic === true)) continue;
  sourceIcons.set(iconName, { path: relative(sourceRoot, absolute), symbolic: isSymbolic, absolute });
}

const finishingPath = new URL(`../presets-src/${appId}.finishing.json`, import.meta.url);
const finishing = existsSync(finishingPath) ? JSON.parse(readFileSync(finishingPath, 'utf8')) : null;

// Native probe dump for this app (#58): the committed runtime evidence that
// probe-generated finishing entries are validated against on every run.
const probePath = new URL(`../presets-src/${appId}.probe.json`, import.meta.url);
const probeDump = existsSync(probePath) ? JSON.parse(readFileSync(probePath, 'utf8')) : null;

function validateProbeEvidenceEntries(overrides, label) {
  const errors = [];
  let evidenced = 0;
  for (const override of overrides ?? []) {
    if (!override.probeEvidence) continue;
    evidenced++;
    for (const error of validateProbeEvidence(override.probeEvidence, probeDump)) {
      errors.push(`${label} / ${override.id}: ${error}`);
    }
  }
  if (errors.length) {
    // A probe-derived entry the dump no longer supports is stale — fail
    // loudly instead of silently shipping a drifted preset.
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  return evidenced;
}

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
let evidencedTotal = 0;
let diagnosticsTotal = 0;
let projectedRuntimeTotal = 0;
for (const spec of screenSpecs) {
  const entry = spec.entry ?? defaultEntry;
  const generated = blueprintBundleToDocument(files, entry, finishing?.title ?? appId);
  const screen = generated.screens[0];
  screen.id = spec.id ?? entry.replace(/\.(blp|ui)$/i, '');
  if (spec.title) screen.title = spec.title;
  if (spec.width) screen.width = spec.width;
  if (spec.height) screen.height = spec.height;
  evidencedTotal += validateProbeEvidenceEntries(spec.overrides, screen.id);
  appliedTotal += applyOverrides(screen, spec.overrides, screen.id);
  // Runtime-generated stock widgets (for example Settings' category rows)
  // do not exist in the declarative bundle. An explicitly opted-in screen
  // consumes the committed semantic probe: source widgets are matched first,
  // then only unmatched mapped branches are projected into that source tree.
  if ((spec.runtimeProbe ?? finishing?.runtimeProbe) === true) {
    if (!probeDump) {
      console.error(`${screen.id}: runtimeProbe is enabled but presets-src/${appId}.probe.json is missing`);
      process.exit(1);
    }
    const runtimeReport = matchRuntimeProfile(probeDump, screen.rootNode);
    const applied = applyRuntimeEvidence(screen.rootNode, runtimeReport, probeDump);
    projectedRuntimeTotal += applied.projected.length;
    if (runtimeReport.matchRate < 0.5) {
      console.error(`${screen.id}: runtime probe matched only ${(runtimeReport.matchRate * 100).toFixed(1)}% of source widgets; refusing an unreliable projection`);
      process.exit(1);
    }
  }
  diagnosticsTotal += generated.importDiagnostics?.length ?? 0;
  screens.push(screen);
}

// Collect the app-shipped artwork actually referenced by the built screens.
const sourceIconAssets = {};
const collectIcons = (node) => {
  const iconName = typeof node.iconName === 'string' ? node.iconName.replace(/-symbolic$/, '') : null;
  const icon = iconName ? sourceIcons.get(iconName) : null;
  if (icon && !sourceIconAssets[iconName]) {
    sourceIconAssets[iconName] = readFileSync(icon.absolute, 'utf8');
  }
  node.children?.forEach(collectIcons);
};
screens.forEach((screen) => collectIcons(screen.rootNode));
const embeddedIconNames = Object.keys(sourceIconAssets);
if (embeddedIconNames.length) {
  console.error(`Embedded ${embeddedIconNames.length} app-shipped icon(s): ${embeddedIconNames.join(', ')}`);
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
  // Artwork the application ships in its own source tree, keyed by icon name.
  // Source-grounded: never a similar-looking substitute for missing art.
  sourceIcons: sourceIconAssets,
}, null, 2) + '\n');
console.error(`Wrote public/presets/${appId}.mockup.json — ${screens.length} screen(s), ${document.edges.length} edge(s), ${appliedTotal} finishing overrides (${evidencedTotal} probe-evidenced), ${projectedRuntimeTotal} runtime widgets, ${diagnosticsTotal} import diagnostics`);
