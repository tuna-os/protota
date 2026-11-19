/**
 * What a hostile checkout or archive can make the import spend (#576).
 *
 * The ingest ceilings (appIngest.ts) bound the files. These cases bound what
 * the files cost after that: references that multiply per nesting level, and
 * scans that used to search the rest of a file again from every unclosed tag.
 */
import { describe, expect, it } from 'vitest';
import { appBundleManifest, discoverAppSources } from '../utils/appDiscovery';
import { parseXmlElements } from '../utils/blueprintBuilder';
import {
  blueprintBundleToDocument,
  blueprintToDocument,
  collectTemplates,
  MAX_EXPANDED_NODES,
  type BlueprintSourceFile,
} from '../utils/blueprintImport';
import type { MockupDocument, AdwNode } from '../types/mockup';

const FAN = 10;
const times = (build: (index: number) => string): string => Array.from({ length: FAN }, (_, index) => build(index)).join(' ');

const nodeCount = (doc: MockupDocument): number => {
  let total = 0;
  const visit = (node: AdwNode) => { total++; node.children?.forEach(visit); };
  doc.screens.forEach((screen) => visit(screen.rootNode));
  return total;
};

/** `depth` Blueprint templates, each holding ten of the next. */
function blueprintTemplates(depth: number): BlueprintSourceFile[] {
  let library = 'using Gtk 4.0;\n';
  for (let level = 0; level < depth; level++) {
    const body = level + 1 < depth ? times((index) => `$T${level + 1} c${index} {}`) : 'Gtk.Label { label: "x"; }';
    library += `template $T${level} : Gtk.Box { ${body} }\n`;
  }
  return [
    { path: 'lib.blp', content: library },
    { path: 'main.blp', content: 'using Gtk 4.0;\nGtk.Window w { $T0 root {} }\n' },
  ];
}

/** The same shape as GtkBuilder composite templates, one per file. */
function builderTemplates(depth: number): BlueprintSourceFile[] {
  const files: BlueprintSourceFile[] = [];
  for (let level = 0; level < depth; level++) {
    const body = level + 1 < depth
      ? times((index) => `<child><object class="T${level + 1}" id="c${level}_${index}"/></child>`)
      : '<child><object class="GtkLabel"/></child>';
    files.push({ path: `t${level}.ui`, content: `<interface><template class="T${level}" parent="GtkBox">${body}</template></interface>` });
  }
  files.push({ path: 'main.ui', content: '<interface><object class="GtkWindow" id="w"><child><object class="T0" id="root"/></child></object></interface>' });
  return files;
}

/** Vala classes that each construct ten of the next. */
function valaClasses(depth: number): BlueprintSourceFile[] {
  let code = '';
  for (let level = 0; level < depth; level++) {
    const built = level + 1 < depth ? `new C${level + 1} ()` : 'new Gtk.Label ("x")';
    code += `public class C${level} : Gtk.Box {\n construct {\n${times((index) => `  var v${index} = ${built};\n  append (v${index});\n`)} }\n}\n`;
  }
  return [
    { path: 'main.blp', content: 'using Gtk 4.0;\nGtk.Window w { $C0 root {} }\n' },
    { path: 'a.vala', content: code },
  ];
}

/** One Vala class whose boxes are each appended ten times to the one before. */
function valaRepeatedInsertions(depth: number): BlueprintSourceFile[] {
  let code = 'public class C0 : Gtk.Box {\n construct {\n';
  for (let level = 0; level <= depth; level++) code += `  var v${level} = new Gtk.Box ();\n`;
  for (let level = 0; level < depth; level++) code += times(() => `  v${level}.append (v${level + 1});\n`);
  code += '  append (v0);\n }\n}\n';
  return [
    { path: 'main.blp', content: 'using Gtk 4.0;\nGtk.Window w { $C0 root {} }\n' },
    { path: 'a.vala', content: code },
  ];
}

/** Multi-layout views nested in each other's slot content, ten slots each. */
function layoutSlots(depth: number): string {
  let inner = 'Gtk.Label { label: "x"; }';
  for (let level = 0; level < depth; level++) {
    inner = `Adw.MultiLayoutView { Adw.Layout { content: Gtk.Box { ${times(() => 'Adw.LayoutSlot { id: "s"; }')} }; } [s] Gtk.Box { ${inner} } }`;
  }
  return `using Gtk 4.0;\nusing Adw 1;\nAdw.Window w { ${inner} }`;
}

describe('import expansion budget', () => {
  // Each level multiplies by ten: the small case is a few hundred nodes, and
  // the large one is over 100,000 from a source of about a kilobyte.
  const shapes: Array<[string, (depth: number) => MockupDocument, number, number]> = [
    ['Blueprint templates', (depth) => blueprintBundleToDocument(blueprintTemplates(depth), 'main.blp'), 3, 6],
    ['GtkBuilder templates', (depth) => blueprintBundleToDocument(builderTemplates(depth), 'main.ui'), 3, 6],
    ['code-built classes', (depth) => blueprintBundleToDocument(valaClasses(depth), 'main.blp'), 3, 5],
    ['repeated insertions in one class', (depth) => blueprintBundleToDocument(valaRepeatedInsertions(depth), 'main.blp'), 3, 5],
    ['layout slots', (depth) => blueprintToDocument(layoutSlots(depth), 'Slots'), 2, 5],
  ];

  it.each(shapes)('%s: a bundle within the budget still imports whole', (_, importAt, small) => {
    const nodes = nodeCount(importAt(small));
    expect(nodes).toBeGreaterThan(FAN ** (small - 1));
    expect(nodes).toBeLessThan(MAX_EXPANDED_NODES);
  });

  it.each(shapes)('%s: nesting that multiplies past the budget is refused', (_, importAt, __, large) => {
    expect(() => importAt(large)).toThrow(/import safety limit/);
  });
});

describe('import scan time', () => {
  // On these inputs the old scans took 5 s or more and grew with the square
  // of the size; the linear ones take a few milliseconds. The bound sits
  // hundreds of times above that, so a slow runner does not trip it.
  const BOUND_MS = 2000;
  const elapsed = (run: () => unknown): number => {
    const start = performance.now();
    run();
    return performance.now() - start;
  };

  it.each<[string, () => unknown]>([
    ['a tag that never closes', () => parseXmlElements(`<interface><a${' '.repeat(150_000)}`)],
    ['a tag holding one long word', () => parseXmlElements(`<a ${'x'.repeat(80_000)}>`)],
    ['comments that never close', () => parseXmlElements('<!--'.repeat(100_000))],
    ['instructions that never close', () => parseXmlElements('<?'.repeat(150_000))],
    ['gresource <file tags that never close', () => discoverAppSources({ 'data/app.gresource.xml': '<file'.repeat(60_000) })],
    ['<template tags that never close', () => appBundleManifest([{ path: 'a.ui', content: '<template '.repeat(40_000) }])],
    ['template declarations nested in each other', () => collectTemplates([{ path: 'a.blp', content: 'template $T : Gtk.Box {'.repeat(12_000) + '}'.repeat(12_000) }])],
  ])('%s', (_, run) => {
    expect(elapsed(run)).toBeLessThan(BOUND_MS);
  });

  it('reads markup as before', () => {
    expect(parseXmlElements('<?xml version="1.0"?><!-- c --><a b="1" c=\'2\'>t<![CDATA[x<y]]><b/>&lt;</a>')).toEqual([
      { tag: 'a', attributes: { b: '1', c: '2' }, text: 'tx<y<', children: [{ tag: 'b', attributes: {}, text: '', children: [] }] },
    ]);
    // A `<` that opens nothing is dropped and the rest is text.
    expect(parseXmlElements('<a>1 < 2 <!-- open</a>')[0].text).toBe('1  2 !-- open');
  });
});
