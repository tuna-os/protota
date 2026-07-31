import { describe, it, expect } from 'vitest';
import { extractCFacts } from '../utils/clang';

// Fixtures use invented class names on purpose: the adapter must work from C
// idioms alone, never from knowing what Nautilus happens to be called.

describe('extractCFacts', () => {
  it('reads the class and its base from the GType macro', () => {
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, ADW_TYPE_APPLICATION_WINDOW);
    `);
    expect(facts).toHaveLength(1);
    expect(facts[0].className).toBe('QuuxPanel');
    expect(facts[0].baseClass).toBe('Adw.ApplicationWindow');
  });

  it('accepts the FINAL and WITH_PRIVATE macro variants', () => {
    const facts = extractCFacts(`
      G_DEFINE_FINAL_TYPE (QuuxRow, quux_row, GTK_TYPE_BOX)
      G_DEFINE_TYPE_WITH_PRIVATE (QuuxPane, quux_pane, GTK_TYPE_WIDGET)
    `);
    expect(facts.map((f) => [f.className, f.baseClass])).toEqual([
      ['QuuxRow', 'Gtk.Box'],
      ['QuuxPane', 'Gtk.Widget'],
    ]);
  });

  it('links the composite template to its resource and bound children', () => {
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, GTK_TYPE_WIDGET);
      static void quux_panel_class_init (QuuxPanelClass *klass) {
        gtk_widget_class_set_template_from_resource (wclass,
                                                     "/org/example/quux/quux-panel.ui");
        gtk_widget_class_bind_template_child (wclass, QuuxPanel, toolbar);
        gtk_widget_class_bind_template_child (wclass, QuuxPanel, sidebar);
      }
    `);
    expect(facts[0].templateResource).toBe('/org/example/quux/quux-panel.ui');
    // These names are the ids in the .ui file — the link that resolves a
    // composite back to real widgets.
    expect(facts[0].templateChildren).toEqual(['toolbar', 'sidebar']);
  });

  it('records widget constructions and maps them to toolkit classes', () => {
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, GTK_TYPE_WIDGET);
      static void quux_panel_init (QuuxPanel *self) {
        GtkWidget *heading = gtk_label_new ("Hi");
        GtkWidget *banner = adw_banner_new ("");
      }
    `);
    expect(facts[0].constructions).toMatchObject({
      heading: 'Gtk.Label',
      banner: 'Adw.Banner',
    });
  });

  it('ignores constructions that are not widgets', () => {
    // A real class_init is full of these; treating them as children would
    // invent widgets that do not exist.
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, GTK_TYPE_WIDGET);
      static void quux_panel_init (QuuxPanel *self) {
        GMenu *menu = g_menu_new ();
        GString *text = g_string_new ("");
        GtkGesture *click = gtk_gesture_click_new ();
        GtkEventController *keys = gtk_event_controller_key_new ();
        GtkWidget *real = gtk_button_new ();
      }
    `);
    expect(Object.keys(facts[0].constructions)).toEqual(['real']);
  });

  it('sees a construction through the g_object_ref_sink ownership wrapper', () => {
    // `self->banner = g_object_ref_sink (adw_banner_new (""))` is the GObject
    // idiom for keeping a floating widget; the wrapper is transparent and the
    // assignment is still a construction fact.
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxNotice, quux_notice, ADW_TYPE_BIN);
      static void quux_notice_init (QuuxNotice *self) {
        self->banner = g_object_ref_sink (adw_banner_new (""));
        adw_bin_set_child (ADW_BIN (self), self->banner);
      }
    `);
    expect(facts[0].constructions.banner).toBe('Adw.Banner');
    expect(facts[0].insertions).toEqual([
      { parent: 'this', child: 'banner', method: 'adw_bin_set_child' },
    ]);
  });

  it('resolves g_object_new through its type macro', () => {
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, GTK_TYPE_WIDGET);
      static void quux_panel_init (QuuxPanel *self) {
        GtkWidget *row = g_object_new (QUUX_TYPE_LIST_ROW, NULL);
      }
    `);
    expect(facts[0].constructions.row).toBe('QuuxListRow');
  });

  it('records child insertions', () => {
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, GTK_TYPE_WIDGET);
      static void quux_panel_init (QuuxPanel *self) {
        gtk_box_append (self->body, heading);
        adw_bin_set_child (self->slot, banner);
      }
    `);
    expect(facts[0].insertions).toEqual([
      { parent: 'body', child: 'heading', method: 'gtk_box_append' },
      { parent: 'slot', child: 'banner', method: 'adw_bin_set_child' },
    ]);
  });

  it('sees through the cast macros real GTK code is written with', () => {
    // gtk_box_append (GTK_BOX (self->body), child) is the overwhelmingly
    // common spelling; missing it loses nearly every insertion in the fleet.
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, GTK_TYPE_WIDGET);
      static void quux_panel_init (QuuxPanel *self) {
        gtk_box_append (GTK_BOX (self->body), GTK_WIDGET (heading));
        adw_bin_set_child (ADW_BIN (self->slot), GTK_WIDGET (banner));
        gtk_widget_set_visible (GTK_WIDGET (self->sidebar), FALSE);
      }
    `);
    expect(facts[0].insertions).toEqual([
      { parent: 'body', child: 'heading', method: 'gtk_box_append' },
      { parent: 'slot', child: 'banner', method: 'adw_bin_set_child' },
    ]);
    expect(facts[0].propertyAssignments).toEqual([
      { target: 'sidebar', property: 'visible', value: false },
    ]);
  });

  it('reverses the arguments of gtk_widget_set_parent', () => {
    // set_parent(child, parent) is the opposite order from append(parent,
    // child); reading it positionally would invert the tree.
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, GTK_TYPE_WIDGET);
      static void quux_panel_init (QuuxPanel *self) {
        gtk_widget_set_parent (heading, self->body);
      }
    `);
    expect(facts[0].insertions).toEqual([
      { parent: 'body', child: 'heading', method: 'gtk_widget_set_parent' },
    ]);
  });

  it('reads literal property assignments from setters', () => {
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, GTK_TYPE_WIDGET);
      static void quux_panel_init (QuuxPanel *self) {
        gtk_widget_set_visible (self->sidebar, FALSE);
        gtk_label_set_label (heading, "Files");
        gtk_box_set_spacing (self->body, 12);
      }
    `);
    expect(facts[0].propertyAssignments).toEqual([
      { target: 'sidebar', property: 'visible', value: false },
      { target: 'heading', property: 'label', value: 'Files' },
      { target: 'body', property: 'spacing', value: 12 },
    ]);
  });

  it('converts multi-word setters to dashed property names', () => {
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, GTK_TYPE_WIDGET);
      static void quux_panel_init (QuuxPanel *self) {
        gtk_button_set_icon_name (button, "open-menu-symbolic");
      }
    `);
    expect(facts[0].propertyAssignments[0]).toEqual({
      target: 'button', property: 'icon-name', value: 'open-menu-symbolic',
    });
  });

  it('skips setters whose value is not a literal', () => {
    // A computed value is not a fact about the static UI; guessing one would
    // be exactly the kind of plausible fake this project refuses to emit.
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, GTK_TYPE_WIDGET);
      static void quux_panel_init (QuuxPanel *self) {
        gtk_widget_set_visible (self->sidebar, should_show (self));
        gtk_label_set_label (heading, computed_title);
      }
    `);
    expect(facts[0].propertyAssignments).toEqual([]);
  });

  it('is not fooled by comments or string literals', () => {
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, GTK_TYPE_WIDGET);
      static void quux_panel_init (QuuxPanel *self) {
        /* gtk_box_append (self->body, ghost); */
        // gtk_widget_set_visible (self->phantom, FALSE);
        const char *path = "resource:///org/example/quux/not-a-comment.ui";
        gtk_box_append (self->body, real);
      }
    `);
    expect(facts[0].insertions).toEqual([
      { parent: 'body', child: 'real', method: 'gtk_box_append' },
    ]);
    expect(facts[0].propertyAssignments).toEqual([]);
  });

  it('attributes facts to the class whose function they appear in', () => {
    const facts = extractCFacts(`
      G_DEFINE_TYPE (QuuxPanel, quux_panel, GTK_TYPE_WIDGET);
      G_DEFINE_TYPE (QuuxRow, quux_row, GTK_TYPE_BOX);
      static void quux_panel_init (QuuxPanel *self) {
        gtk_box_append (self->body, panel_child);
      }
      static void quux_row_init (QuuxRow *self) {
        gtk_box_append (self->body, row_child);
      }
    `);
    const panel = facts.find((f) => f.className === 'QuuxPanel');
    const row = facts.find((f) => f.className === 'QuuxRow');
    expect(panel?.insertions.map((i) => i.child)).toEqual(['panel_child']);
    expect(row?.insertions.map((i) => i.child)).toEqual(['row_child']);
  });

  it('returns nothing for a file that defines no GObject class', () => {
    expect(extractCFacts('int main (void) { return 0; }')).toEqual([]);
  });
});
