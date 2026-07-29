import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { blueprintBundleToDocument, blueprintTemplateReferences, blueprintToDocument, blueprintToNode, mockupToBlueprint } from '../utils/blueprint';
import { importDocumentFile } from '../utils/exportImport';
import type { MockupDocument } from '../types/mockup';

const document: MockupDocument = {
  id: 'round-trip',
  title: 'Round trip',
  colorScheme: 'dark',
  edges: [],
  screens: [{
    id: 'main', title: 'Main', type: 'standard', width: 800, height: 600,
    rootNode: {
      id: 'window', type: 'window', children: [{
        id: 'toolbar', type: 'toolbar-view', children: [
          { id: 'header', type: 'header-bar', slot: 'top', title: 'Round trip', children: [] },
          { id: 'content', type: 'box', slot: 'content', orientation: 'vertical', spacing: 12, children: [
            { id: 'save', type: 'button', title: 'Save "draft"', suggested: true },
            { id: 'name', type: 'label', title: 'Name' },
          ] },
        ],
      }],
    },
  }],
};

describe('Blueprint import', () => {
  const toolbarGridFixture = readFileSync(new URL('../../tests/fixtures/gnome-ui/toolbar-grid.blp', import.meta.url), 'utf8');

  it('preserves hierarchy and supported properties through a mockup → Blueprint → mockup round trip', () => {
    const imported = blueprintToNode(mockupToBlueprint(document));
    const toolbar = imported.children?.[0];
    const content = toolbar?.children?.[1];
    const save = content?.children?.[0];

    expect(imported).toMatchObject({ id: 'window', type: 'window' });
    expect(toolbar).toMatchObject({ id: 'toolbar', type: 'toolbar-view' });
    expect(toolbar?.children?.[0]).toMatchObject({ id: 'header', slot: 'top' });
    expect(content).toMatchObject({ id: 'content', type: 'box', slot: 'content', orientation: 'vertical', spacing: 12 });
    expect(save).toMatchObject({ id: 'save', type: 'button', title: 'Save "draft"', suggested: true });
  });

  it('imports nested GtkBuilder objects instead of flattening them', () => {
    const imported = blueprintToDocument(`
      <interface>
        <object class="AdwApplicationWindow" id="window">
          <property name="title">Files</property>
          <child><object class="GtkBox" id="content">
            <property name="orientation">vertical</property>
            <child><object class="GtkButton" id="open"><property name="label">Open</property></object></child>
          </object></child>
        </object>
      </interface>
    `, 'Files');

    expect(imported.screens).toHaveLength(1);
    expect(imported.screens[0].rootNode).toMatchObject({ id: 'window', type: 'window', title: 'Files' });
    expect(imported.screens[0].rootNode.children?.[0]).toMatchObject({ id: 'content', type: 'box', orientation: 'vertical' });
    expect(imported.screens[0].rootNode.children?.[0].children?.[0]).toMatchObject({ id: 'open', type: 'button', title: 'Open' });
  });

  it('rejects unmapped visual widgets instead of rendering them as a fake box', () => {
    expect(() => blueprintToNode('Gtk.ImaginaryWidget content {}')).toThrow('Unsupported GTK/Libadwaita widget: Gtk.ImaginaryWidget');
  });

  it('imports the upstream-style toolbar, content slot, and grid fixture with its layout semantics intact', () => {
    const root = blueprintToNode(toolbarGridFixture);
    const toolbar = root.children?.[0];
    const content = toolbar?.children?.[1];
    const grid = content?.children?.[0];

    expect(root).toMatchObject({ type: 'window', title: 'Conformance Fixture' });
    expect(toolbar).toMatchObject({ type: 'toolbar-view' });
    expect(toolbar?.children?.[0]).toMatchObject({ type: 'header-bar', slot: 'top' });
    expect(content).toMatchObject({ type: 'box', slot: 'content', orientation: 'vertical', spacing: 12 });
    expect(grid).toMatchObject({ type: 'grid', columnSpacing: 6, rowSpacing: 6 });
    expect(grid?.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'button', title: '1' }),
      expect.objectContaining({ type: 'button', title: '+' }),
    ]));
  });

  it('imports a Blueprint source file directly as an editable document', async () => {
    const file = new File([toolbarGridFixture], 'toolbar-grid.blp', { type: 'text/plain' });
    const imported = await importDocumentFile(file);

    expect(imported.title).toBe('toolbar grid');
    expect(imported.screens[0].rootNode).toMatchObject({ type: 'window' });
    expect(imported.screens[0].rootNode.children?.[0]).toMatchObject({ type: 'toolbar-view' });
    expect(mockupToBlueprint(imported)).toContain('Adw.ToolbarView');
  });

  it('imports the real Blueprint template syntax used by GNOME Calculator button panels', () => {
    const imported = blueprintToNode(`
      template $BasicButtonPanel: Adw.Bin {
        Grid basic {
          Button clear { label: "C"; layout { column: 0; row: 0; } }
          ToggleButton superscript { label: "↑n"; layout { column: 1; row: 0; } }
        }
      }
    `);

    expect(imported).toMatchObject({ type: 'bin' });
    expect(imported.children?.[0]).toMatchObject({ type: 'grid' });
    expect(imported.children?.[0].children).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'button', title: 'C', column: 0, row: 0 }),
      expect.objectContaining({ type: 'toggle', title: '↑n', column: 1, row: 0 }),
    ]));
  });

  it('reports source-bundle dependencies instead of silently dropping custom templates', () => {
    const source = 'Adw.Bin { $HistoryView history {} }';
    expect(blueprintTemplateReferences(source)).toEqual(['HistoryView']);
    expect(() => blueprintToNode(source)).toThrow('Unresolved Blueprint template reference: $HistoryView');
  });

  it('resolves linked Blueprint templates from an official-style source bundle', () => {
    const imported = blueprintBundleToDocument([
      { path: 'window.blp', content: 'Adw.ApplicationWindow { $Panel panel {} }' },
      { path: 'panel.blp', content: 'template $Panel: Gtk.Box { Gtk.Button open { label: "Open"; } }' },
    ], 'window.blp', 'Source bundle');

    expect(imported.screens[0].rootNode.children?.[0]).toMatchObject({ id: 'panel', type: 'box' });
    expect(imported.screens[0].rootNode.children?.[0].children?.[0]).toMatchObject({ id: 'open', type: 'button', title: 'Open' });
  });

  it('keeps an unresolved code-only widget as an explicit layout boundary', () => {
    const imported = blueprintBundleToDocument([
      { path: 'window.blp', content: 'Adw.ApplicationWindow { $CodeOnlyWidget body { height-request: 120; } }' },
    ], 'window.blp');

    expect(imported.screens[0].rootNode.children?.[0]).toMatchObject({
      id: 'body', type: 'custom-widget', title: 'CodeOnlyWidget', heightRequest: 120,
    });
  });

  it.skipIf(!process.env.OFFICIAL_SOURCE_ROOT)('imports the official Calculator Blueprint bundle without a hand-authored preset', () => {
    const sourceRoot = process.env.OFFICIAL_SOURCE_ROOT!;
    const files = readdirSync(sourceRoot)
      .filter(path => path.endsWith('.blp'))
      .map(path => ({ path, content: readFileSync(join(sourceRoot, path), 'utf8') }));

    const imported = blueprintBundleToDocument(files, 'math-window.blp', 'GNOME Calculator');
    expect(imported.screens[0].rootNode).toMatchObject({ type: 'window' });
    const nodes = (node: MockupDocument['screens'][number]['rootNode']): typeof node[] => [node, ...(node.children || []).flatMap(nodes)];
    expect(nodes(imported.screens[0].rootNode)).toEqual(expect.arrayContaining([
      // GtkSourceView is defined in Calculator's code, rather than this
      // Blueprint bundle; it must remain measurable, not become a fake box.
      expect.objectContaining({ id: 'source_view', type: 'custom-widget', title: 'GtkSourceView' }),
    ]));
  });
});
