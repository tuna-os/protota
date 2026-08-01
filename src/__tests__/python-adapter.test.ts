import { describe, expect, it } from 'vitest';
import { extractPythonFacts } from '../utils/python';
import { blueprintBundleToDocument } from '../utils/blueprint';
import type { AdwNode } from '../types/mockup';

/**
 * #59 Wave 3: the PyGObject language adapter. Fixtures use invented class
 * names on purpose: the adapter must work from Python/GTK idioms alone,
 * never from knowing what Ear Tag happens to be called.
 */

describe('extractPythonFacts', () => {
  it('records class, first widget base, gtype name and template decorator', () => {
    const facts = extractPythonFacts(`
@Gtk.Template(resource_path=f"{APP_PATH}/ui/quuxrow.ui")
class QuuxRowImpl(Adw.EntryRow, SomeMixin):
    __gtype_name__ = "QuuxRow"
`);
    expect(facts[0]).toMatchObject({
      className: 'QuuxRow',
      baseClass: 'Adw.EntryRow',
      templateResource: '{APP_PATH}/ui/quuxrow.ui',
    });
  });

  it('extracts constructions with literal and enum keyword properties', () => {
    const facts = extractPythonFacts(`
class QuuxLabelBox(Gtk.Overlay):
    def __init__(self):
        super().__init__()
        self.entry = Gtk.Entry(valign=Gtk.Align.CENTER)
        self.label = Gtk.Label(
            can_focus=False,
            wrap=True,
            lines=3,
            ellipsize=Pango.EllipsizeMode.MIDDLE,
        )
        self.set_child(self.entry)
        self.add_overlay(self.label)
        self.add_css_class("editablelabel")
        self.label.add_css_class("dim-label")
`);
    const [box] = facts;
    expect(box.constructions).toEqual({ entry: 'Gtk.Entry', label: 'Gtk.Label' });
    expect(box.propertyAssignments).toEqual(expect.arrayContaining([
      { target: 'entry', property: 'valign', value: 'center' },
      { target: 'label', property: 'can_focus', value: false },
      { target: 'label', property: 'wrap', value: true },
      { target: 'label', property: 'lines', value: 3 },
      { target: 'label', property: 'ellipsize', value: 'middle' },
    ]));
    expect(box.insertions).toEqual([
      { parent: 'this', child: 'entry', method: 'set_child' },
      { parent: 'this', child: 'label', method: 'add_overlay' },
    ]);
    expect(box.styleClasses).toEqual([
      { target: 'this', name: 'editablelabel' },
      { target: 'label', name: 'dim-label' },
    ]);
  });

  it('records @GObject.Property defaults and do_snapshot overrides', () => {
    const facts = extractPythonFacts(`
class QuuxMeter(Gtk.Widget):
    @GObject.Property(type=bool, default=False)
    def compact(self):
        return self._compact

    def do_snapshot(self, snapshot):
        pass
`);
    expect(facts[0].propertyDefaults).toEqual({ compact: false });
    expect(facts[0].overridesSnapshot).toBe(true);
  });

  it('never invents facts from runtime-conditional code', () => {
    const facts = extractPythonFacts(`
class QuuxList(Gtk.ListView):
    def __init__(self):
        super().__init__()
        for item in self.model:
            self.append(make_row(item))
        self.props.title = get_runtime_title()
`);
    // A helper-call child and a runtime-computed property are not facts.
    expect(facts[0].insertions).toEqual([]);
    expect(facts[0].propertyAssignments).toEqual([]);
  });
});

describe('Python base-class projection through the shared enrichment engine', () => {
  const windowUi = `<interface>
    <object class="GtkBox" id="shell">
      <child><object class="QuuxTagRow" id="album">
        <property name="title">Album</property>
      </object></child>
      <child><object class="QuuxEditableLabel" id="headline"/></child>
      <child><object class="QuuxFileList" id="files"/></child>
    </object></interface>`;
  const python = `
class QuuxEditableLabelBase(Gtk.Overlay, Gtk.Editable):
    def __init__(self):
        super().__init__()
        self.entry = Gtk.Entry(valign=Gtk.Align.CENTER)
        self.label = Gtk.Label(wrap=True)
        self.icon = Gtk.Image(icon_name="document-edit-symbolic")
        self.set_child(self.entry)
        self.add_overlay(self.label)
        self.add_overlay(self.icon)


class QuuxEditableLabel(QuuxEditableLabelBase, SomeMixin):
    __gtype_name__ = "QuuxEditableLabel"


class QuuxTagRow(Adw.EntryRow, SomeMixin):
    __gtype_name__ = "QuuxTagRow"


class QuuxFileList(Gtk.ListView):
    __gtype_name__ = "QuuxFileList"
`;
  const nodes = (node: AdwNode): AdwNode[] => [node, ...(node.children || []).flatMap(nodes)];

  it('resolves a subclass of a renderable base, transitively through app-defined ancestors', () => {
    const doc = blueprintBundleToDocument([
      { path: 'window.ui', content: windowUi },
      { path: 'quux.py', content: python },
    ], 'window.ui');
    const all = nodes(doc.screens[0].rootNode);
    // Adw.EntryRow subclass keeps its declared title, stops being a boundary.
    expect(all.find((node) => node.id === 'album')).toMatchObject({
      type: 'entry-row', title: 'Album', sourceClass: 'QuuxTagRow',
    });
    // The overlay composite resolves through its app-defined ancestor: the
    // ancestor's __init__ runs for the subclass, so its constructions are
    // inherited source evidence — all three children survive, not just the
    // set_child main child.
    const headline = all.find((node) => node.id === 'headline');
    expect(headline?.type).not.toBe('custom-widget');
    expect(headline?.children?.map((child) => child.sourceClass)).toEqual(
      ['Gtk.Entry', 'Gtk.Label', 'Gtk.Image'],
    );
    // A chromeless list container with no constructed children stays an
    // honest boundary: its rows are runtime data.
    expect(all.find((node) => node.id === 'files')).toMatchObject({
      type: 'custom-widget', sourceClass: 'QuuxFileList',
    });
  });

  it('keeps a snapshot-overriding subclass as an honest boundary', () => {
    const doc = blueprintBundleToDocument([
      { path: 'window.ui', content: '<interface><object class="GtkBox" id="shell"><child><object class="QuuxHourBar" id="hours"/></child></object></interface>' },
      { path: 'quux.py', content: `
class QuuxHourBar(Gtk.Box):
    __gtype_name__ = "QuuxHourBar"

    def __init__(self):
        super().__init__()
        self.line = Gtk.Label(wrap=True)
        self.append(self.line)

    def do_snapshot(self, snapshot):
        pass
` },
    ], 'window.ui');
    expect(nodes(doc.screens[0].rootNode).find((node) => node.id === 'hours')).toMatchObject({
      type: 'custom-widget', sourceClass: 'QuuxHourBar',
    });
  });
});
