import { describe, expect, it } from 'vitest';
import { extractCFacts } from '../utils/clang';
import { blueprintBundleToDocument, mockupToBlueprint } from '../utils/blueprint';
import type { AdwNode } from '../types/mockup';

/**
 * #59 Wave 1: C-defined composites that *are* their declared base widget
 * (EditorPreferencesSwitch is an AdwActionRow adding a switch suffix in
 * init) resolve to the base class with their code-constructed children.
 * Fixtures use invented class names on purpose: the adapters must work from
 * C idioms alone, never from knowing what Text Editor happens to be called.
 */

describe('extractCFacts instance normalisation', () => {
  it('records the instance parameter as `this`, whatever it is named', () => {
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxBar, quux_bar, GTK_TYPE_WIDGET);
      static void quux_bar_init (QuuxBar *bar) {
        bar->swin = gtk_scrolled_window_new ();
        gtk_widget_set_parent (bar->swin, GTK_WIDGET (bar));
      }
    `);
    expect(facts[0].insertions).toEqual([
      { parent: 'this', child: 'swin', method: 'gtk_widget_set_parent' },
    ]);
  });

  it('treats a bare `self` cast in constructed() as the instance', () => {
    // constructed() receives GObject *object and casts it to a local self —
    // the GObject convention for the instance.
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxRow, quux_row, ADW_TYPE_ACTION_ROW);
      static void quux_row_constructed (GObject *object) {
        QuuxRow *self = (QuuxRow *)object;
        gtk_widget_add_css_class (GTK_WIDGET (self), "spin");
        gtk_list_box_row_set_activatable (GTK_LIST_BOX_ROW (object), TRUE);
      }
    `);
    expect(facts[0].styleClasses).toEqual([{ target: 'this', name: 'spin' }]);
    expect(facts[0].propertyAssignments).toEqual([
      { target: 'this', property: 'activatable', value: true },
    ]);
  });

  it('synthesises a construction for an inline constructor child argument', () => {
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxRow, quux_row, ADW_TYPE_ACTION_ROW);
      static void quux_row_init (QuuxRow *self) {
        adw_action_row_add_suffix (ADW_ACTION_ROW (self),
                                   gtk_image_new_from_icon_name ("go-next-symbolic"));
      }
    `);
    const [insertion] = facts[0].insertions;
    expect(insertion.parent).toBe('this');
    expect(facts[0].constructions[insertion.child]).toBe('Gtk.Image');
    expect(facts[0].propertyAssignments).toEqual([
      { target: insertion.child, property: 'icon-name', value: 'go-next-symbolic' },
    ]);
  });
});

describe('base-class projection', () => {
  const rowC = `
    G_DEFINE_TYPE (QuuxToggleRow, quux_toggle_row, ADW_TYPE_ACTION_ROW);
    static void quux_toggle_row_init (QuuxToggleRow *self) {
      self->toggle = g_object_new (GTK_TYPE_SWITCH, "can-focus", FALSE, NULL);
      adw_action_row_add_suffix (ADW_ACTION_ROW (self), GTK_WIDGET (self->toggle));
    }
  `;
  const dialogUi = `<interface>
    <object class="AdwPreferencesGroup" id="group">
      <child><object class="QuuxToggleRow" id="wrap">
        <property name="title">Wrap Lines</property>
      </object></child>
      <child><object class="QuuxToggleRow" id="indent">
        <property name="title">Auto Indent</property>
      </object></child>
    </object></interface>`;

  it('resolves a subclass of a renderable widget to its base with code children', () => {
    const doc = blueprintBundleToDocument([
      { path: 'dialog.ui', content: dialogUi },
      { path: 'quux-toggle-row.c', content: rowC },
    ], 'dialog.ui');
    const nodes = (node: AdwNode): AdwNode[] => [node, ...(node.children || []).flatMap(nodes)];
    const all = nodes(doc.screens[0].rootNode);
    const wrap = all.find((node) => node.id === 'wrap');
    // The declared source properties stay; the node is no longer a boundary.
    expect(wrap).toMatchObject({ type: 'action-row', title: 'Wrap Lines', sourceClass: 'QuuxToggleRow' });
    expect(wrap?.children?.[0]).toMatchObject({ type: 'switch-widget', slot: 'suffix' });
    // Child ids are namespaced per instance: two rows must not share `toggle`.
    const indent = all.find((node) => node.id === 'indent');
    expect(wrap?.children?.[0].id).not.toBe(indent?.children?.[0].id);
    // The resolution clears the boundary diagnostic and records the expansion.
    expect(doc.importDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'static-source-expansion', sourceClass: 'QuuxToggleRow' }),
    ]));
    expect(doc.importDiagnostics?.filter((d) => d.code === 'renderer-does-not-support-class')).toEqual([]);
    // Export emits the toolkit base class, which compiles anywhere.
    const exported = mockupToBlueprint(doc);
    expect(exported).toContain('Adw.ActionRow');
    expect(exported).not.toContain('Protota.CustomWidget');
  });

  it('leaves a plain Gtk.Widget subclass as an honest boundary', () => {
    // A GtkWidget base names a custom-drawn widget; projecting Adw.Bin for it
    // would be a plausible fake.
    const doc = blueprintBundleToDocument([
      { path: 'window.ui', content: '<interface><object class="GtkBox" id="shell"><child><object class="QuuxCanvas" id="canvas"/></child></object></interface>' },
      { path: 'quux-canvas.c', content: `
        G_DEFINE_TYPE (QuuxCanvas, quux_canvas, GTK_TYPE_WIDGET);
        static void quux_canvas_init (QuuxCanvas *self) {
          gtk_widget_add_css_class (GTK_WIDGET (self), "canvas");
        }
      ` },
    ], 'window.ui');
    expect(doc.screens[0].rootNode.children?.[0]).toMatchObject({
      id: 'canvas', type: 'custom-widget', sourceClass: 'QuuxCanvas',
    });
  });

  it('projects a set_parent chain into a boundary without dissolving it', () => {
    // The sidebar shape: a GtkWidget subclass whose init parents a scrolled
    // list onto itself. The chrome is a construction fact; the node itself
    // stays a boundary because its rows are runtime data.
    const doc = blueprintBundleToDocument([
      { path: 'window.ui', content: '<interface><object class="GtkBox" id="shell"><child><object class="QuuxSidebar" id="sidebar"/></child></object></interface>' },
      { path: 'quux-sidebar.c', content: `
        G_DEFINE_TYPE (QuuxSidebar, quux_sidebar, GTK_TYPE_WIDGET);
        static void quux_sidebar_init (QuuxSidebar *sidebar) {
          sidebar->swin = gtk_scrolled_window_new ();
          gtk_widget_set_parent (sidebar->swin, GTK_WIDGET (sidebar));
          sidebar->list_box = gtk_list_box_new ();
          gtk_widget_add_css_class (sidebar->list_box, "navigation-sidebar");
          gtk_scrolled_window_set_child (GTK_SCROLLED_WINDOW (sidebar->swin), sidebar->list_box);
        }
      ` },
    ], 'window.ui');
    const sidebar = doc.screens[0].rootNode.children?.[0];
    expect(sidebar).toMatchObject({ id: 'sidebar', type: 'custom-widget', sourceClass: 'QuuxSidebar' });
    expect(sidebar?.children?.[0]).toMatchObject({ type: 'scrolled-window' });
    expect(sidebar?.children?.[0].children?.[0]).toMatchObject({
      type: 'list-box', styleClasses: 'navigation-sidebar',
    });
  });

  it('never projects a popover as a layout child', () => {
    const doc = blueprintBundleToDocument([
      { path: 'window.ui', content: '<interface><object class="GtkBox" id="shell"><child><object class="QuuxStrip" id="strip"/></child></object></interface>' },
      { path: 'quux-strip.c', content: `
        G_DEFINE_TYPE (QuuxStrip, quux_strip, GTK_TYPE_BOX);
        static void quux_strip_init (QuuxStrip *self) {
          self->menu = gtk_popover_menu_new_from_model (NULL);
          gtk_widget_set_parent (self->menu, GTK_WIDGET (self));
          self->label = gtk_label_new ("Strip");
          gtk_box_append (GTK_BOX (self), self->label);
        }
      ` },
    ], 'window.ui');
    const strip = doc.screens[0].rootNode.children?.[0];
    expect(strip).toMatchObject({ id: 'strip', type: 'box', sourceClass: 'QuuxStrip' });
    expect(strip?.children?.map((child) => child.type)).toEqual(['label']);
  });
});
