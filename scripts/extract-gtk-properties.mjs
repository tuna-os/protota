/**
 * Extract the property set of every GTK and libadwaita class from GIR data.
 *
 *   npx tsx scripts/extract-gtk-properties.mjs > src/data/gtkProperties.ts
 *
 * Run this where the GObject introspection files are installed — a container
 * with gtk4-devel and libadwaita-devel is enough (see docs/preset-workflow.md).
 * The result is committed so the exporter can drop properties a class does not
 * have without needing the toolkit at runtime, and regenerated when Protota
 * targets a newer GNOME. Emits the committed .ts module directly (not JSON)
 * so there is no separate hand-conversion step for the committed artifact to
 * silently drift from (tunaos/protota#237).
 *
 * GIR is the authority here. Guessing which properties a widget accepts is how
 * we ended up emitting Blueprint that would not compile.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const girDir = process.env.GIR_DIR ?? '/usr/share/gir-1.0';
if (!existsSync(girDir)) {
  console.error(`No GIR files at ${girDir}. Install gtk4-devel and libadwaita-devel, or set GIR_DIR.`);
  process.exit(1);
}

// Namespaces whose widgets Protota imports and exports.
const wanted = ['Gtk-4.0.gir', 'Adw-1.gir', 'GtkSource-5.gir', 'Gio-2.0.gir', 'GObject-2.0.gir'];
const files = readdirSync(girDir).filter((name) => wanted.includes(name));

/** class name → { parent, implements, properties } */
const classes = {};
/** interface name → properties (orientation lives on GtkOrientable, not GtkBox) */
const interfaces = {};

for (const file of files) {
  const xml = readFileSync(`${girDir}/${file}`, 'utf8');
  const namespace = /<namespace[^>]*\sname="([^"]+)"/.exec(xml)?.[1] ?? file.split('-')[0];

  // Index-based scanning: GIR attribute blocks span many lines and regexes
  // over them are easy to get subtly wrong.
  let cursor = 0;
  while (true) {
    const open = xml.indexOf('<class ', cursor);
    if (open === -1) break;
    const headerEnd = xml.indexOf('>', open);
    const close = xml.indexOf('</class>', headerEnd);
    if (headerEnd === -1 || close === -1) break;
    const header = xml.slice(open, headerEnd);
    const body = xml.slice(headerEnd, close);
    cursor = close + 1;

    const name = /\sname="([^"]+)"/.exec(header)?.[1];
    if (!name) continue;
    const parent = /\sparent="([^"]+)"/.exec(header)?.[1];
    const properties = [...body.matchAll(/<property\s+name="([^"]+)"/g)].map((property) => property[1]);
    const implemented = [...body.matchAll(/<implements\s+name="([^"]+)"/g)]
      .map((entry) => (entry[1].includes('.') ? entry[1] : `${namespace}.${entry[1]}`));
    classes[`${namespace}.${name}`] = {
      parent: parent ? (parent.includes('.') ? parent : `${namespace}.${parent}`) : null,
      implements: [...new Set(implemented)].sort(),
      properties: [...new Set(properties)].sort(),
    };
  }

  // Interfaces carry properties too — a GtkBox gets `orientation` from
  // GtkOrientable, not from its parent chain.
  let interfaceCursor = 0;
  while (true) {
    const open = xml.indexOf('<interface ', interfaceCursor);
    if (open === -1) break;
    const headerEnd = xml.indexOf('>', open);
    const close = xml.indexOf('</interface>', headerEnd);
    if (headerEnd === -1 || close === -1) break;
    const name = /\sname="([^"]+)"/.exec(xml.slice(open, headerEnd))?.[1];
    const body = xml.slice(headerEnd, close);
    interfaceCursor = close + 1;
    if (!name) continue;
    interfaces[`${namespace}.${name}`] =
      [...new Set([...body.matchAll(/<property\s+name="([^"]+)"/g)].map((property) => property[1]))].sort();
  }
}

const data = { generatedFrom: files, classes, interfaces };

console.log(`/**
 * GTK and libadwaita property tables, generated from GObject introspection
 * data by scripts/extract-gtk-properties.mjs. Regenerate when Protota targets
 * a newer GNOME; do not hand-edit.
 *
 * A TypeScript module rather than JSON so it loads identically under Vite and
 * the test runner, which disagree about JSON import attributes.
 */
export interface GtkClassInfo {
  parent: string | null;
  implements?: string[];
  properties: string[];
}

export const GTK_PROPERTY_DATA: {
  generatedFrom: string[];
  classes: Record<string, GtkClassInfo>;
  interfaces: Record<string, string[]>;
} = ${JSON.stringify(data, null, 1)};
`);
console.error(`${Object.keys(classes).length} classes and ${Object.keys(interfaces).length} interfaces from ${files.join(', ')}`);
