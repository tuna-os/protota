import { describe, expect, it } from 'vitest';
import { extractValaFacts } from '../utils/vala';
import { blueprintBundleToDocument } from '../utils/blueprint';
import type { AdwNode } from '../types/mockup';

// Deliberately invented class names: the adapter must work from language
// structure alone, never from knowledge of a specific application.
const HOST_CLASS = `
public class PanelHost : Adw.Bin
{
    private Gtk.Stack panel_stack = new Gtk.Stack ();
    private Gtk.Widget alpha_panel;
    private Gtk.Widget beta_panel;

    construct
    {
        vexpand_set = true;
        panel_stack.hhomogeneous = false;
        set_child (panel_stack);
    }

    private Gtk.Widget load_mode (int mode)
    {
        if (mode == 0)
        {
            if (alpha_panel == null)
            {
                alpha_panel = new AlphaPanel (this);
                panel_stack.add_child (alpha_panel);
            }
            return alpha_panel;
        }
        if (beta_panel == null)
        {
            beta_panel = new BetaPanel (this);
            panel_stack.add_child (beta_panel);
        }
        return beta_panel;
    }
}
`;

describe('Vala construction facts', () => {
  it('discovers class, base, constructions, insertions, and literal assignments', () => {
    const [facts] = extractValaFacts(HOST_CLASS);
    expect(facts.className).toBe('PanelHost');
    expect(facts.baseClass).toBe('Adw.Bin');
    expect(facts.constructions).toMatchObject({
      panel_stack: 'Gtk.Stack',
      alpha_panel: 'AlphaPanel',
      beta_panel: 'BetaPanel',
    });
    expect(facts.insertions).toEqual([
      { parent: 'this', child: 'panel_stack', method: 'set_child' },
      { parent: 'panel_stack', child: 'alpha_panel', method: 'add_child' },
      { parent: 'panel_stack', child: 'beta_panel', method: 'add_child' },
    ]);
    expect(facts.propertyAssignments).toEqual(expect.arrayContaining([
      { target: 'this', property: 'vexpand_set', value: true },
      { target: 'panel_stack', property: 'hhomogeneous', value: false },
    ]));
  });

  it('records composite-template attributes and child-property insertions', () => {
    const [facts] = extractValaFacts(`
      [GtkTemplate (ui = "/org/example/panel.ui")]
      public class AlphaPanel : Adw.Bin
      {
          construct
          {
              var grid = new Gtk.Grid ();
              child = grid;
          }
      }
    `);
    expect(facts.className).toBe('AlphaPanel');
    expect(facts.templateResource).toBe('/org/example/panel.ui');
    expect(facts.insertions).toEqual([{ parent: 'this', child: 'grid', method: 'child' }]);
  });

  it('leaves runtime-dependent construction undiscovered instead of guessing', () => {
    const [facts] = extractValaFacts(`
      public class DynamicHost : Adw.Bin
      {
          construct
          {
              set_child (build_for (get_mode ()));
          }
      }
    `);
    // The argument is a call, not a statically identifiable widget.
    expect(facts.insertions).toEqual([]);
  });
});

describe('Vala static enrichment of source bundles', () => {
  const bundle = [
    { path: 'ui/window.blp', content: 'Adw.ApplicationWindow { Gtk.Box { orientation: vertical; $PanelHost _panels {} } }' },
    { path: 'ui/panel-alpha.blp', content: 'template $AlphaPanel: Adw.Bin { Grid alpha_grid { Button one { label: "1"; layout { column: 0; row: 0; } } } }' },
    { path: 'panel-host.vala', content: HOST_CLASS },
  ];

  it('projects a code-defined composite from construction facts and bundle templates', () => {
    const doc = blueprintBundleToDocument(bundle, 'window.blp', 'Enrichment');
    const host = doc.screens[0].rootNode.children?.[0].children?.[0];
    expect(host).toMatchObject({ id: '_panels', type: 'custom-widget', sourceClass: 'PanelHost', vexpand: true });

    const stack = host?.children?.[0];
    expect(stack).toMatchObject({ id: 'panel_stack', type: 'stack' });
    // AlphaPanel resolves through its declarative template; BetaPanel has no
    // template or facts and stays an honest boundary.
    expect(stack?.children?.[0]).toMatchObject({ id: 'alpha_panel', type: 'bin' });
    expect(stack?.children?.[0].children?.[0]).toMatchObject({ id: 'alpha_grid', type: 'grid' });
    expect(stack?.children?.[0].children?.[0].children?.[0]).toMatchObject({ type: 'button', title: '1', column: 0, row: 0 });
    expect(stack?.children?.[1]).toMatchObject({ id: 'beta_panel', type: 'custom-widget', sourceClass: 'BetaPanel' });

    expect(doc.importDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'static-source-expansion', sourceClass: 'PanelHost', sourceId: '_panels' }),
      expect.objectContaining({ code: 'template-not-in-bundle', sourceClass: 'BetaPanel' }),
    ]));
    // The expanded composite is no longer reported as unresolved.
    expect(doc.importDiagnostics?.filter(d => d.sourceClass === 'PanelHost' && d.code === 'template-not-in-bundle')).toEqual([]);
  });

  it('still exports the composite as its original source reference', async () => {
    const { mockupToBlueprint } = await import('../utils/blueprint');
    const doc = blueprintBundleToDocument(bundle, 'window.blp', 'Enrichment');
    const exported = mockupToBlueprint(doc);
    expect(exported).toContain('$PanelHost _panels');
    expect(exported).not.toContain('panel_stack');
    expect(exported).not.toContain('AlphaPanel');
  });

  it('projects declared property defaults onto visibility bindings', () => {
    const doc = blueprintBundleToDocument([
      { path: 'ui/window.blp', content: 'Adw.ApplicationWindow { $StatusHost host {} }' },
      { path: 'ui/status-host.blp', content: `
        template $StatusHost: Adw.Bin {
          Gtk.Box loaded_box { visible: bind template.data-loaded; }
          Gtk.Box empty_box { visible: bind template.data-loaded inverted; }
        }
      ` },
      { path: 'status-host.vala', content: `
        public class StatusHost : Adw.Bin
        {
            public bool data_loaded { set; get; default = false; }
        }
      ` },
    ], 'window.blp');
    const host = doc.screens[0].rootNode.children?.[0];
    expect(host?.children?.[0]).toMatchObject({ id: 'loaded_box', visible: false });
    expect(host?.children?.[1]).toMatchObject({ id: 'empty_box', visible: true });
    // The binding itself survives for export.
    expect(host?.children?.[0].bindings).toMatchObject({ visible: '$StatusHost.data-loaded' });
  });

  it('does not recurse forever on mutually constructing classes', () => {
    const doc = blueprintBundleToDocument([
      { path: 'window.blp', content: 'Adw.ApplicationWindow { $Ping ping {} }' },
      { path: 'ping.vala', content: `
        public class Ping : Adw.Bin { construct { var child_widget = new Pong (); set_child (child_widget); } }
        public class Pong : Adw.Bin { construct { var child_widget = new Ping (); set_child (child_widget); } }
      ` },
    ], 'window.blp');
    const count = (node: AdwNode | undefined): number => node ? 1 + (node.children ?? []).reduce((sum, child) => sum + count(child), 0) : 0;
    expect(count(doc.screens[0].rootNode)).toBeLessThan(10);
  });
});
