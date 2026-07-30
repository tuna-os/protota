/**
 * Widget coverage report: what GNOME Core apps actually use versus what
 * Protota can render, offer in the palette, and expose properties for.
 *
 *   npx tsx scripts/widget-coverage.mjs            # core apps in the catalog
 *   npx tsx scripts/widget-coverage.mjs --all      # every cached checkout
 *
 * Counts every GTK/Adw class referenced by the cached app sources, then
 * reports the gaps that matter for building GUIs in this tool:
 *   - unmapped: no renderer support at all (imports become boundaries)
 *   - no-palette: renderable but a user cannot insert one
 *   - no-schema: insertable but the inspector offers no properties
 *
 * The point is a worklist ordered by real-world usage rather than taste.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const cacheRoot = join(repoRoot, '.gnome-source-cache');
const catalog = JSON.parse(readFileSync(join(repoRoot, 'tests/fixtures/gnome-app-catalog.json'), 'utf8'));

const wantAll = process.argv.includes('--all');
const coreApps = new Set(Object.entries(catalog)
  .filter(([, app]) => app.suite === 'core')
  .map(([id]) => id));

if (!existsSync(cacheRoot)) {
  console.error('No .gnome-source-cache — run scripts/import-gnome-app.mjs first.');
  process.exit(1);
}

const checkouts = readdirSync(cacheRoot, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .filter((dirent) => wantAll || coreApps.has(dirent.name.split('@')[0]));

/** Every class name referenced by declarative sources, with its app count. */
const usage = new Map();
const record = (className, app) => {
  if (!usage.has(className)) usage.set(className, new Set());
  usage.get(className).add(app);
};

for (const checkout of checkouts) {
  const app = checkout.name.split('@')[0];
  const root = join(cacheRoot, checkout.name);
  for (const dirent of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!dirent.isFile() || !/\.(blp|ui)$/i.test(dirent.name)) continue;
    const content = readFileSync(join(dirent.parentPath, dirent.name), 'utf8');
    if (dirent.name.endsWith('.ui')) {
      for (const match of content.matchAll(/<(?:object|template)[^>]*\sclass="([^"]+)"/g)) record(match[1], app);
    } else {
      // Blueprint objects: `Gtk.Button id {`, `Button id {`, `$Custom id {`.
      for (const match of content.matchAll(/(?:^|\n)\s*(\$?[A-Z][A-Za-z0-9_.]*)\s+[A-Za-z_][\w-]*\s*\{/g)) record(match[1], app);
      for (const match of content.matchAll(/(?:^|\n)\s*(\$?[A-Z][A-Za-z0-9_.]*)\s*\{/g)) record(match[1], app);
    }
  }
}

const blueprintSource = readFileSync(join(repoRoot, 'src/utils/blueprint.ts'), 'utf8');
const mapSection = blueprintSource.slice(0, blueprintSource.indexOf('const WIDGET_CLASS_MAP'));
const mapped = new Set([...mapSection.matchAll(/^\s*'?([A-Za-z][\w.]*)'?\s*:\s*'([a-z-]+)'/gm)].map((m) => m[1]));
const rendererTypeOf = new Map([...mapSection.matchAll(/^\s*'?([A-Za-z][\w.]*)'?\s*:\s*'([a-z-]+)'/gm)].map((m) => [m[1], m[2]]));

const paletteSource = readFileSync(join(repoRoot, 'src/components/CommandPalette.tsx'), 'utf8');
const palette = new Set([...paletteSource.matchAll(/type:\s*"([a-z-]+)"/g)].map((m) => m[1]));

const schemaSource = readFileSync(join(repoRoot, 'src/schemas/widgetSchemas.ts'), 'utf8');
const schemas = new Set([...schemaSource.matchAll(/^\s*'?"?([a-z-]+)"?'?\s*:\s*\[/gm)].map((m) => m[1]));

const NON_VISUAL = /^(Gtk|Gio|Adw)?\.?(EventController|Gesture|Shortcut|DropTarget|DragSource|Adjustment|TextBuffer|EntryBuffer|SizeGroup|ListStore|StringList|FileFilter|.*Selection|.*ListModel|SignalListItemFactory|BuilderListItemFactory|Breakpoint|.*Menu$)/;

const rows = [...usage.entries()]
  .map(([className, apps]) => ({ className, apps: apps.size }))
  .filter((row) => !row.className.startsWith('$'))
  .filter((row) => !NON_VISUAL.test(row.className))
  .sort((a, b) => b.apps - a.apps || a.className.localeCompare(b.className));

const canonical = (name) => {
  const gobject = /^(Adw|Gtk|GtkSource|Gio)([A-Z][A-Za-z0-9]*)$/.exec(name);
  return gobject ? `${gobject[1]}.${gobject[2]}` : name;
};

const unmapped = rows.filter((row) => !mapped.has(row.className) && !mapped.has(canonical(row.className)));
const rendererTypes = new Set(rows
  .map((row) => rendererTypeOf.get(row.className) ?? rendererTypeOf.get(canonical(row.className)))
  .filter(Boolean));
const noPalette = [...rendererTypes].filter((type) => !palette.has(type)).sort();
const noSchema = [...rendererTypes].filter((type) => !schemas.has(type)).sort();

console.log(`Scanned ${checkouts.length} checkout(s): ${checkouts.map((c) => c.name).join(', ')}\n`);
console.log(`## Unmapped classes (${unmapped.length}) — imports become boundaries`);
console.log('| Class | Apps using it |');
console.log('| --- | ---: |');
for (const row of unmapped.slice(0, 40)) console.log(`| ${row.className} | ${row.apps} |`);

console.log(`\n## Renderable but not in the palette (${noPalette.length}) — users cannot insert one`);
console.log(noPalette.join(', ') || '—');

console.log(`\n## Insertable but no inspector schema (${noSchema.length}) — no editable properties`);
console.log(noSchema.join(', ') || '—');
