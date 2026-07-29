import type { MockupDocument } from '../types/mockup';

export function generatePythonBindings(doc: MockupDocument): string {
  const title = doc.title.replace(/[^a-zA-Z0-9]/g, '');

  return `import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')
from gi.repository import Gtk, Adw

@Gtk.Template(resource_path='/${doc.title.toLowerCase().replace(/\s+/g, '-')}/window.ui')
class ${title}Window(Adw.ApplicationWindow):
    __gtype_name__ = '${title}Window'

    # Template widgets
    header_bar = Gtk.Template.Child()

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    @Gtk.Template.Callback()
    def on_button_clicked(self, button):
        print(f"Button clicked: {button}")
`;
}

/**
 * Generates gtk4-rs (Rust) CompositeTemplate derive bindings.
 */
export function generateRustBindings(doc: MockupDocument): string {
  const title = doc.title.replace(/[^a-zA-Z0-9]/g, '');

  return `use gtk::prelude::*;
use gtk::subclass::prelude::*;
use gtk::{glib, CompositeTemplate};
use libadwaita as adw;

mod imp {
    use super::*;

    #[derive(Debug, Default, CompositeTemplate)]
    #[template(resource = "/${doc.title.toLowerCase().replace(/\s+/g, '-')}/window.ui")]
    pub struct ${title}Window {
        #[template_child]
        pub header_bar: TemplateChild<adw::HeaderBar>,
    }

    #[glib::object_subclass]
    impl ObjectSubclass for ${title}Window {
        const NAME: &'static str = "${title}Window";
        type Type = super::${title}Window;
        type ParentType = adw::ApplicationWindow;

        fn class_init(klass: &mut Self::Class) {
            klass.bind_template();
        }

        fn instance_init(obj: &glib::subclass::InitializingObject<Self>) {
            obj.init_template();
        }
    }

    impl ObjectImpl for ${title}Window {}
    impl WidgetImpl for ${title}Window {}
    impl WindowImpl for ${title}Window {}
    impl ApplicationWindowImpl for ${title}Window {}
    impl AdwApplicationWindowImpl for ${title}Window {}
}

glib::wrapper! {
    pub struct ${title}Window(ObjectSubclass<imp::${title}Window>)
        @extends gtk::Widget, gtk::Window, gtk::ApplicationWindow, adw::ApplicationWindow;
}
`;
}

/**
 * Generates Vala [GtkTemplate] binding declarations.
 */
export function generateValaBindings(doc: MockupDocument): string {
  const title = doc.title.replace(/[^a-zA-Z0-9]/g, '');

  return `[GtkTemplate (ui = "/${doc.title.toLowerCase().replace(/\s+/g, '-')}/window.ui")]
public class ${title}Window : Adw.ApplicationWindow {
    [GtkChild]
    private unowned Adw.HeaderBar header_bar;

    public ${title}Window (Gtk.Application app) {
        Object (application: app);
    }

    [GtkCallback]
    private void on_button_clicked (Gtk.Button button) {
        message ("Button clicked");
    }
}
`;
}
