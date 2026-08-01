import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { blueprintBundleToDocument, blueprintImport, blueprintTemplateReferences, blueprintToDocument, blueprintToNode, mockupToBlueprint } from '../utils/blueprint';
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

  it('retains an unmapped widget class as an explicit boundary with a diagnostic, not a fake box', () => {
    const { roots, diagnostics } = blueprintImport('Gtk.ImaginaryWidget content {}');
    expect(roots[0]).toMatchObject({ id: 'content', type: 'custom-widget', sourceClass: 'Gtk.ImaginaryWidget' });
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: 'renderer-does-not-support-class', sourceClass: 'Gtk.ImaginaryWidget', sourceId: 'content' }),
    ]);
  });

  it('keeps an unsupported short-form class and its following sibling', () => {
    const { roots, diagnostics } = blueprintImport(`
      Gtk.Box shell {
        ImaginaryMeter meter {}
        Gtk.Button after { label: "OK"; }
      }
    `);
    expect(roots[0].children?.[0]).toMatchObject({ id: 'meter', type: 'custom-widget', sourceClass: 'ImaginaryMeter' });
    expect(roots[0].children?.[1]).toMatchObject({ id: 'after', type: 'button', title: 'OK' });
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: 'renderer-does-not-support-class', sourceClass: 'ImaginaryMeter' }),
    ]);
  });

  it('parses an object-valued property without corrupting the following sibling', () => {
    const root = blueprintToNode(`
      Gtk.Box shell {
        orientation: vertical;
        Adw.Bin wrapper { child: Gtk.Label inner { label: "Hi"; }; }
        Gtk.Button after { label: "After"; }
      }
    `);
    expect(root).toMatchObject({ id: 'shell', type: 'box', orientation: 'vertical' });
    expect(root.children?.[0]).toMatchObject({ id: 'wrapper', type: 'bin' });
    expect(root.children?.[0].children?.[0]).toMatchObject({ id: 'inner', type: 'label', title: 'Hi', slot: 'child' });
    expect(root.children?.[1]).toMatchObject({ id: 'after', type: 'button', title: 'After' });
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
      expect.objectContaining({ type: 'button', title: '↑n', column: 1, row: 0 }),
    ]));
  });

  it('retains an unresolved template reference as a boundary and reports the dependency', () => {
    const source = 'Adw.Bin { $HistoryView history {} }';
    expect(blueprintTemplateReferences(source)).toEqual(['HistoryView']);
    const { roots, diagnostics } = blueprintImport(source);
    expect(roots[0].children?.[0]).toMatchObject({ id: 'history', type: 'custom-widget', sourceClass: 'HistoryView' });
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: 'template-not-in-bundle', sourceClass: 'HistoryView', sourceId: 'history' }),
    ]);
  });

  it('resolves linked Blueprint templates from an official-style source bundle', () => {
    const imported = blueprintBundleToDocument([
      { path: 'window.blp', content: 'Adw.ApplicationWindow { $Panel panel {} }' },
      { path: 'panel.blp', content: 'template $Panel: Gtk.Box { Gtk.Button open { label: "Open"; } }' },
    ], 'window.blp', 'Source bundle');

    expect(imported.screens[0].rootNode.children?.[0]).toMatchObject({ id: 'panel', type: 'box' });
    expect(imported.screens[0].rootNode.children?.[0].children?.[0]).toMatchObject({ id: 'open', type: 'button', title: 'Open' });
  });

  it('keeps strings containing comment-like text intact and unwraps gettext markers', () => {
    // Real GNOME sources contain "//" inside string literals (markup link
    // targets); a naive comment strip destroys the line and every following
    // brace. Translated properties use _("x") and C_("ctx", "x").
    const { roots } = blueprintImport(`
      Gtk.Box shell {
        Gtk.Label link { label: _("<a href=\\"r:///\\">Refresh rates</a> now"); }
        Gtk.Button after { label: C_("toolbar", "OK"); }
      }
    `);
    expect(roots[0].children?.[0]).toMatchObject({ id: 'link', type: 'label', title: '<a href="r:///">Refresh rates</a> now' });
    expect(roots[0].children?.[1]).toMatchObject({ id: 'after', type: 'button', title: 'OK' });
  });

  it('parses non-visual source objects without giving them renderer boxes', () => {
    const { roots, diagnostics } = blueprintImport(`
      Gtk.Box shell {
        Gtk.Entry field {
          GestureClick { button: 0; }
          ShortcutController { Shortcut { trigger: "Menu"; } }

        }
        Gtk.Button after { label: "OK"; }
      }
    `);
    expect(roots[0].children?.map(child => child.id)).toEqual(['field', 'after']);
    expect(roots[0].children?.[0].children).toEqual([]);
    expect(diagnostics).toEqual([]);
  });

  it('maps a can-unfold=false leaflet to a stack, not a split view', () => {
    // GNOME Software's shell uses AdwLeaflet with can-unfold=False as pure
    // navigation: exactly one page is ever mapped. Rendering it as a split
    // view would paint pages GTK never shows together.
    const doc = blueprintBundleToDocument([
      { path: 'shell.ui', content: `<interface>
        <object class="AdwLeaflet" id="nav">
          <property name="can-unfold">False</property>
          <child><object class="AdwLeafletPage">
            <property name="name">main</property>
            <property name="child"><object class="GtkLabel" id="main_page"/></property>
          </object></child>
          <child><object class="AdwLeafletPage">
            <property name="name">details</property>
            <property name="child"><object class="GtkLabel" id="details_page"/></property>
          </object></child>
        </object></interface>` },
    ], 'shell.ui');
    const nav = doc.screens[0].rootNode;
    expect(nav).toMatchObject({ id: 'nav', type: 'view-stack', sourceClass: 'Adw.Leaflet' });
    expect(nav.children?.map(child => child.type)).toEqual(['stack-page', 'stack-page']);
  });

  it('keeps an unfoldable leaflet as a split view', () => {
    const doc = blueprintBundleToDocument([
      { path: 'shell.ui', content: `<interface>
        <object class="AdwLeaflet" id="split">
          <child><object class="AdwLeafletPage">
            <property name="name">sidebar</property>
            <property name="child"><object class="GtkLabel" id="side"/></property>
          </object></child>
        </object></interface>` },
    ], 'shell.ui');
    expect(doc.screens[0].rootNode).toMatchObject({ id: 'split', type: 'overlay-split' });
  });

  it('drops paintable property objects instead of boxing them as boundaries', () => {
    // `Adw.SpinnerPaintable` is a GdkPaintable assigned to a widget's
    // `paintable` property — an image source, not a widget. Emitting it as a
    // custom-widget node invents an allocation GTK never gives it.
    const doc = blueprintBundleToDocument([
      { path: 'page.ui', content: `<interface>
        <object class="GtkBox" id="shell">
          <child><object class="AdwStatusPage" id="status">
            <property name="paintable">
              <object class="AdwSpinnerPaintable"><property name="widget">shell</property></object>
            </property>
            <property name="title">Loading</property>
          </object></child>
        </object></interface>` },
    ], 'page.ui');
    const status = doc.screens[0].rootNode.children?.[0];
    expect(status).toMatchObject({ id: 'status', title: 'Loading' });
    expect(status?.children).toEqual([]);
    expect(doc.importDiagnostics?.filter(d => d.code === 'renderer-does-not-support-class')).toEqual([]);
  });

  it('retains a code-defined template reference with its bindings, siblings, and expand semantics', () => {
    const imported = blueprintBundleToDocument([
      { path: 'window.blp', content: `
        Adw.ApplicationWindow {
          Gtk.Box {
            orientation: vertical;
            $MathDisplay _display { vexpand: true; }
            $MathButtons _buttons { equation: bind template.equation; converter: "_converter"; vexpand: true; }
          }
        }
      ` },
      { path: 'display.blp', content: 'template $MathDisplay: Adw.Bin { Gtk.Entry display_entry {} }' },
    ], 'window.blp');

    const box = imported.screens[0].rootNode.children?.[0];
    expect(box).toMatchObject({ type: 'box', orientation: 'vertical' });
    expect(box?.children?.[0]).toMatchObject({ id: '_display', type: 'bin', vexpand: true });
    expect(box?.children?.[1]).toMatchObject({
      id: '_buttons', type: 'custom-widget', sourceClass: 'MathButtons', converter: '_converter', vexpand: true,
    });
    expect(box?.children?.[1].bindings).toMatchObject({ equation: 'template.equation' });
    expect(imported.importDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'template-not-in-bundle', sourceClass: 'MathButtons', sourceId: '_buttons' }),
    ]));

    // Export must re-emit the real source reference, never a Protota class.
    const exported = mockupToBlueprint(imported);
    expect(exported).toContain('$MathButtons _buttons');
    expect(exported).toContain('equation: bind template.equation;');
    expect(exported).not.toContain('Protota.CustomWidget');
  });

  it('keeps an unresolved code-only widget as an explicit layout boundary', () => {
    const imported = blueprintBundleToDocument([
      { path: 'window.blp', content: 'Adw.ApplicationWindow { $CodeOnlyWidget body { height-request: 120; } }' },
    ], 'window.blp');

    expect(imported.screens[0].rootNode.children?.[0]).toMatchObject({
      id: 'body', type: 'custom-widget', title: 'CodeOnlyWidget', heightRequest: 120,
    });
  });

  it('imports GtkBuilder child roles, styles, layout, and cross-file composite templates', () => {
    const doc = blueprintBundleToDocument([
      { path: 'window.ui', content: `<interface>
        <object class="AdwApplicationWindow" id="window">
          <child><object class="AdwToolbarView" id="toolbar">
            <child type="top"><object class="AdwHeaderBar" id="header"/></child>
            <property name="content"><object class="EditorPage" id="page"/></property>
          </object></child>
        </object></interface>` },
      { path: 'page.ui', content: `<interface><template class="EditorPage" parent="GtkBox">
        <property name="orientation">vertical</property>
        <child><object class="GtkButton" id="go"><property name="label">Go &amp; Run</property>
          <style><class name="suggested-action"/></style>
          <layout><property name="column">2</property></layout>
        </object></child></template></interface>` },
    ], 'window.ui');

    const toolbar = doc.screens[0].rootNode.children?.[0];
    expect(toolbar).toMatchObject({ id: 'toolbar', type: 'toolbar-view' });
    expect(toolbar?.children?.[0]).toMatchObject({ id: 'header', type: 'header-bar', slot: 'top' });
    const page = toolbar?.children?.[1];
    expect(page).toMatchObject({ id: 'page', slot: 'content', type: 'box', sourceClass: 'EditorPage', orientation: 'vertical' });
    expect(page?.children?.[0]).toMatchObject({ id: 'go', type: 'button', title: 'Go & Run', suggested: true, column: 2 });
    expect(doc.importDiagnostics).toEqual([]);
  });

  it.skipIf(!process.env.OFFICIAL_SOURCE_ROOT)('imports the official Calculator Blueprint bundle without a hand-authored preset', () => {
    const sourceRoot = process.env.OFFICIAL_SOURCE_ROOT!;
    const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile() && /\.(blp|ui|vala)$/i.test(entry.name))
      .map(entry => ({ path: join(entry.parentPath, entry.name).slice(sourceRoot.length + 1), content: readFileSync(join(entry.parentPath, entry.name), 'utf8') }));

    const imported = blueprintBundleToDocument(files, 'math-window.blp', 'GNOME Calculator');
    expect(imported.screens[0].rootNode).toMatchObject({ type: 'window' });
    const nodes = (node: MockupDocument['screens'][number]['rootNode']): typeof node[] => [node, ...(node.children || []).flatMap(nodes)];
    expect(nodes(imported.screens[0].rootNode)).toEqual(expect.arrayContaining([
      // GtkSourceView is defined in Calculator's code, rather than this
      // Blueprint bundle; it must remain measurable, not become a fake box.
      expect.objectContaining({ id: 'source_view', type: 'custom-widget', title: 'GtkSourceView' }),
      // MathButtons is implemented in Vala; the $MathButtons _buttons
      // reference in math-window.blp must survive template expansion as an
      // allocated boundary rather than silently disappearing.
      expect.objectContaining({ id: '_buttons', type: 'custom-widget', sourceClass: 'MathButtons' }),
    ]));

    // Phase 4: when the bundle includes the Vala sources, the keypad renders
    // from its official declarative button templates — discovered through
    // construction facts, with no Calculator-specific branch.
    const hasValaSources = files.some(file => file.path.endsWith('.vala'));
    if (hasValaSources) {
      const allNodes = nodes(imported.screens[0].rootNode);
      const buttons = allNodes.find(node => node.id === '_buttons');
      expect(buttons?.vexpand).toBe(true);
      const stack = buttons?.children?.[0];
      expect(stack).toMatchObject({ id: 'panel_stack', type: 'stack' });
      const basic = stack?.children?.[0];
      expect(basic?.id).toBe('bas_panel');
      const basicNodes = nodes(basic!);
      expect(basicNodes).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'button', title: 'C' }),
        expect.objectContaining({ type: 'button', title: '7' }),
        expect.objectContaining({ type: 'button', title: '=' }),
      ]));
    }
  });
});

// The long tail of #77: each case here is a real compile failure observed in
// an exported preset screen, reduced to the property that caused it.
// blueprint-compiler is the authority; these tests pin the shape it accepts.
describe('Blueprint export long tail', () => {
  const screen = (rootNode: MockupDocument['screens'][0]['rootNode']): MockupDocument => ({
    id: 'doc', title: 'Doc', colorScheme: 'light', edges: [],
    screens: [{ id: 's', title: 'S', type: 'standard', width: 800, height: 600, rootNode }],
  });

  it('emits a numeric value property unquoted', () => {
    const exported = mockupToBlueprint(screen({
      id: 'w', type: 'window', children: [{ id: 'r', type: 'spin-row', value: '9' }],
    }));
    expect(exported).toContain('value: 9;');
  });

  it('filters unknown properties for short Blueprint class names', () => {
    // ActionBar imports as a box, and boxes default to an orientation — but
    // Gtk.ActionBar has no such property, and the short name must still
    // resolve to the introspection table entry that says so.
    const exported = mockupToBlueprint(screen({
      id: 'w', type: 'window', children: [{ id: 'bar', type: 'box', sourceClass: 'ActionBar', orientation: 'horizontal' }],
    }));
    expect(exported).toContain('ActionBar bar');
    expect(exported).not.toContain('orientation');
  });

  it('converts C enum constants to Blueprint member idents', () => {
    const exported = mockupToBlueprint(screen({
      id: 'w', type: 'window', children: [{ id: 'l', type: 'label', title: 'x', wrapMode: 'PANGO_WRAP_WORD_CHAR' }],
    }));
    expect(exported).toContain('wrap-mode: word_char;');
  });

  it('quotes start/end icon names rather than emitting object references', () => {
    const exported = mockupToBlueprint(screen({
      id: 'w', type: 'window', children: [{ id: 'row', type: 'button-row', title: 'Docs', endIconName: 'external-link-symbolic' }],
    }));
    expect(exported).toContain('end-icon-name: "external-link-symbolic";');
  });

  it('drops a widget reference that cannot resolve in the export', () => {
    const exported = mockupToBlueprint(screen({
      id: 'w', type: 'window', children: [{ id: 'sb', type: 'bin', sourceClass: 'Gtk.SearchBar', keyCaptureWidget: 'GsShell' }],
    }));
    expect(exported).not.toContain('key-capture-widget');
  });

  it('drops non-visual buffer children instead of inventing a $ class', () => {
    const exported = mockupToBlueprint(screen({
      id: 'w', type: 'window', children: [{
        id: 'view', type: 'entry', children: [
          { id: 'buffer', type: 'custom-widget', slot: 'buffer', sourceClass: 'Gtk.SourceBuffer', title: 'GtkSourceBuffer' },
        ],
      }],
    }));
    expect(exported).not.toContain('SourceBuffer');
    expect(exported).not.toContain('buffer:');
  });
});
