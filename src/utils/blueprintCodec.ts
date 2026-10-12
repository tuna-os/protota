/**
 * Shared Blueprint codec layer: type mappings, property normalization, value formatting.
 *
 * Common encoding/decoding infrastructure for both import and export paths.
 * Moved verbatim from blueprint.ts so there is a single source of truth;
 * blueprint.ts re-exports the public surface for backward compatibility.
 */

import type { AdwNodeType } from '../types/mockup';
import { GTK_PROPERTY_DATA } from '../data/gtkProperties';

export const CLASS_TO_WIDGET_MAP: Record<string, AdwNodeType> = {
  'Adw.ApplicationWindow': 'window',
  'Adw.Window': 'window',
  'Adw.PreferencesDialog': 'preferences-dialog',
  'Adw.PreferencesWindow': 'window',
  'Adw.Dialog': 'dialog',
  'Adw.AlertDialog': 'alert-dialog',
  'Adw.AboutDialog': 'about-dialog',
  'Adw.ToolbarView': 'toolbar-view',
  'Adw.HeaderBar': 'header-bar',
  'Adw.WindowTitle': 'window-title',
  'Adw.ViewStack': 'view-stack',
  'Adw.ViewSwitcher': 'view-switcher',
  'Adw.NavigationView': 'navigation-view',
  // NavigationSplitView shares OverlaySplitView's sidebar/content structure.
  'Adw.NavigationSplitView': 'overlay-split',
  // Leaflet is the deprecated predecessor of NavigationSplitView: an adaptive
  // container showing its children side by side when there is room. Mapping
  // it is faithful structure, not invention — and leaving it unmapped put the
  // whole of Software inside one opaque boundary.
  'Adw.Leaflet': 'overlay-split',
  'Adw.LeafletPage': 'stack-page',
  AdwNavigationSplitView: 'overlay-split',
  NavigationSplitView: 'overlay-split',
  'Adw.NavigationPage': 'bin',
  AdwNavigationPage: 'bin',
  NavigationPage: 'bin',
  // MultiLayoutView shows exactly one Layout at a time; Layout bodies are
  // plain containers and LayoutSlots are placeholders for named children.
  // Their identity survives via sourceClass so import can resolve slots.
  'Adw.MultiLayoutView': 'bin',
  'Adw.Layout': 'bin',
  'Adw.LayoutSlot': 'bin',
  'Adw.ViewStackPage': 'stack-page',
  ViewStackPage: 'stack-page',
  'Adw.InlineViewSwitcher': 'view-switcher',
  'Adw.ButtonContent': 'label',
  'Adw.Carousel': 'box',
  'Adw.CarouselIndicatorDots': 'bin',
  'Adw.ViewSwitcherTitle': 'view-switcher',
  'Adw.ViewSwitcherBar': 'view-switcher',
  'Adw.TabView': 'tab-view',
  'Adw.TabBar': 'tab-bar',
  // Adw.TabPage is a page record like ViewStackPage: title + child widget.
  'Adw.TabPage': 'stack-page',
  AdwTabPage: 'stack-page',
  'Adw.OverlaySplitView': 'overlay-split',
  'Adw.Clamp': 'clamp',
  'Adw.Bin': 'bin',
  'Adw.BreakpointBin': 'bin',
  'Adw.Breakpoint': 'bin',
  BreakpointBin: 'bin',
  Breakpoint: 'bin',
  'Protota.CustomWidget': 'custom-widget',
  'Adw.ActionRow': 'action-row',
  'Adw.SwitchRow': 'switch-row',
  'Adw.ComboRow': 'combo-row',
  'Adw.SpinRow': 'spin-row',
  'Adw.ButtonRow': 'button-row',
  'Adw.ExpanderRow': 'expander-row',
  'Adw.EntryRow': 'entry-row',
  'Adw.PasswordEntryRow': 'password-row',
  'Adw.PreferencesPage': 'preferences-page',
  'Adw.PreferencesGroup': 'preferences-group',
  'Gtk.Button': 'button',
  'Adw.SplitButton': 'split-button',
  'Gtk.MenuButton': 'menu-button',
  'Adw.Toggle': 'toggle',
  'Adw.ToggleGroup': 'toggle-group',
  'Gtk.Entry': 'entry',
  'Gtk.PasswordEntry': 'entry',
  'Gtk.Text': 'entry',
  'Adw.StatusPage': 'status-page',
  'Adw.ToastOverlay': 'toast-overlay',
  'Adw.Banner': 'banner',
  'Adw.Spinner': 'spinner',
  'Gtk.FlowBox': 'flow-box',
  'Gtk.FlowBoxChild': 'bin',
  'Gtk.Box': 'box',
  'Gtk.Grid': 'grid',
  'Gtk.CenterBox': 'center-box',
  'Gtk.Stack': 'stack',
  'Gtk.StackPage': 'stack-page',
  'Gtk.ScrolledWindow': 'scrolled-window',
  'Gtk.SearchEntry': 'search-entry',
  'Gtk.Switch': 'switch-widget',
  'Gtk.CheckButton': 'check-button',
  'Gtk.ListBox': 'list-box',
  'Gtk.Label': 'label',
  'Gtk.Inscription': 'inscription',
  'Gtk.Picture': 'bin',
  // Blueprint's short widget names are common in real application templates.
  Bin: 'bin',
  Box: 'box',
  Grid: 'grid',
  Stack: 'stack',
  StackPage: 'stack-page',
  ScrolledWindow: 'scrolled-window',
  Button: 'button',
  // A GtkToggleButton looks and lays out like a button (Adw.Toggle is the
  // pill-style toggle inside a ToggleGroup, a different widget).
  ToggleButton: 'button',
  GtkToggleButton: 'button',
  'Gtk.ToggleButton': 'button',
  MenuButton: 'menu-button',
  Entry: 'entry',
  // GtkBuilder uses GObject names while Blueprint uses namespace-qualified names.
  AdwApplicationWindow: 'window',
  AdwWindow: 'window',
  AdwPreferencesDialog: 'preferences-dialog',
  AdwDialog: 'dialog',
  AdwToolbarView: 'toolbar-view',
  AdwHeaderBar: 'header-bar',
  AdwViewStack: 'view-stack',
  AdwViewSwitcher: 'view-switcher',
  AdwTabView: 'tab-view',
  AdwTabBar: 'tab-bar',
  AdwOverlaySplitView: 'overlay-split',
  AdwPreferencesPage: 'preferences-page',
  AdwPreferencesGroup: 'preferences-group',
  GtkButton: 'button',
  GtkEntry: 'entry',
  GtkPasswordEntry: 'entry',
  PasswordEntry: 'entry',
  GtkText: 'entry',
  Text: 'entry',
  GtkBox: 'box',
  GtkGrid: 'grid',
  GtkStack: 'stack',
  GtkStackPage: 'stack-page',
  GtkScrolledWindow: 'scrolled-window',
  GtkLabel: 'label',
  GtkListBox: 'list-box',
  GtkFlowBoxChild: 'bin',
  FlowBoxChild: 'bin',
  ListBox: 'list-box',
  Viewport: 'bin',
  GtkViewport: 'bin',
  'Gtk.Viewport': 'bin',
  DropDown: 'combo-row',
  GtkDropDown: 'combo-row',
  'Gtk.DropDown': 'combo-row',
  TextView: 'entry',
  GtkTextView: 'entry',
  'Gtk.TextView': 'entry',
  GtkSourceView: 'entry',
  'GtkSource.View': 'entry',
  GtkSourceMap: 'entry',
  'GtkSource.Map': 'entry',
  Label: 'label',
  Image: 'bin',
  GtkImage: 'bin',
  'Gtk.Image': 'bin',
  // Library widgets the generic renderer genuinely covers. Widgets it does
  // not draw yet stay explicit boundaries rather than rendering as an empty
  // box that claims support.
  ProgressBar: 'progress-bar',
  GtkProgressBar: 'progress-bar',
  'Gtk.ProgressBar': 'progress-bar',
  Scale: 'scale',
  GtkScale: 'scale',
  'Gtk.Scale': 'scale',
  LevelBar: 'level-bar',
  GtkLevelBar: 'level-bar',
  'Gtk.LevelBar': 'level-bar',
  'Adw.Avatar': 'avatar',
  AdwAvatar: 'avatar',
  Avatar: 'avatar',
  'Adw.WrapBox': 'wrap-box',
  AdwWrapBox: 'wrap-box',
  WrapBox: 'wrap-box',
  Popover: 'popover',
  GtkPopover: 'popover',
  'Gtk.Popover': 'popover',
  PopoverMenu: 'popover',
  GtkPopoverMenu: 'popover',
  'Gtk.PopoverMenu': 'popover',
  ListBoxRow: 'list-box-row',
  GtkListBoxRow: 'list-box-row',
  'Gtk.ListBoxRow': 'list-box-row',
  CenterBox: 'center-box',
  GtkCenterBox: 'center-box',
  'Adw.MessageDialog': 'alert-dialog',
  AdwMessageDialog: 'alert-dialog',
  'Adw.ClampScrollable': 'clamp',
  AdwClampScrollable: 'clamp',
  ListView: 'list-box',
  GtkListView: 'list-box',
  'Gtk.ListView': 'list-box',
  ColumnView: 'list-box',
  GtkColumnView: 'list-box',
  'Gtk.ColumnView': 'list-box',
  ActionBar: 'box',
  GtkActionBar: 'box',
  'Gtk.ActionBar': 'box',
  Frame: 'bin',
  GtkFrame: 'bin',
  'Gtk.Frame': 'bin',
  'Adw.PreferencesRow': 'action-row',
  AdwPreferencesRow: 'action-row',
  SearchEntry: 'search-entry',
  GtkSearchEntry: 'search-entry',
  SearchBar: 'bin',
  GtkSearchBar: 'bin',
  'Gtk.SearchBar': 'bin',
  Switch: 'switch-widget',
  GtkSwitch: 'switch-widget',
  CheckButton: 'check-button',
  GtkCheckButton: 'check-button',
  SpinButton: 'entry',
  GtkSpinButton: 'entry',
  'Gtk.SpinButton': 'entry',
  Spinner: 'spinner',
  GtkSpinner: 'spinner',
  'Gtk.Spinner': 'spinner',
  Overlay: 'overlay',
  GtkOverlay: 'overlay',
  'Gtk.Overlay': 'overlay',
  Revealer: 'bin',
  'Gtk.Revealer': 'bin',
  WindowHandle: 'bin',
  'Gtk.WindowHandle': 'bin',
  Separator: 'bin',
  GtkSeparator: 'bin',
  'Gtk.Separator': 'bin',
  // A plain Gtk.Widget declaration is an empty sizing/styling node.
  Widget: 'bin',
  GtkWidget: 'bin',
  'Gtk.Widget': 'bin',
  // GtkInfoBar is a message area plus an action area. Keeping its declared
  // children in a horizontal layout is closer to GTK than an opaque boundary
  // and, unlike Adw.Banner, does not discard the child content.
  InfoBar: 'box',
  GtkInfoBar: 'box',
  'Gtk.InfoBar': 'box',
  'Adw.ShortcutsDialog': 'preferences-dialog',
  AdwShortcutsDialog: 'preferences-dialog',
  'Adw.ShortcutsSection': 'preferences-group',
  AdwShortcutsSection: 'preferences-group',
  'Adw.ShortcutsItem': 'action-row',
  AdwShortcutsItem: 'action-row',
};

/**
 * Source objects that occupy no layout allocation: gestures, controllers,
 * shortcuts, models, paintables (`Adw.SpinnerPaintable` is an image source
 * assigned to a widget's `paintable` property, not a widget), and popup
 * surfaces. They belong to the source, but they must not receive renderer
 * boxes or count as unresolved visual coverage.
 */
const NON_VISUAL_CLASS_PATTERN =
  /^(Gtk\.|Gio\.|Adw\.|GtkSource\.)?(EventController[A-Za-z]*|Gesture[A-Za-z]*|ShortcutController|Shortcut|DropTarget|DragSource|Adjustment|TextBuffer|SourceBuffer|Buffer|EntryBuffer|Tooltip|StringList|ListStore|SizeGroup|FileFilter|FileDialog|ColumnViewColumn|EnumList|Toast|[A-Za-z]*Model|SingleSelection|MultiSelection|NoSelection|SignalListItemFactory|BuilderListItemFactory|[A-Za-z]*Paintable)$/;

/**
 * An Adw.Breakpoint takes no layout allocation, but unlike the non-visual
 * classes above it carries structure the renderer needs: its condition and
 * setters drive the adaptive behavior a live resize is supposed to show. It
 * survives import as a childless node the renderer skips.
 */
export function isBreakpointClass(rawClass: string): boolean {
  return rawClass === 'Breakpoint' || canonicalClassName(rawClass) === 'Adw.Breakpoint';
}

/**
 * Exported classes that accept Adw.Breakpoint children — the hosts
 * blueprint-compiler recognises. A breakpoint under any other parent is
 * dropped at export (emitting it would not compile).
 */
export const BREAKPOINT_HOST_CLASSES = new Set([
  'Adw.Window', 'Adw.ApplicationWindow', 'Adw.Dialog', 'Adw.PreferencesDialog',
  'Adw.AlertDialog', 'Adw.AboutDialog', 'Adw.BreakpointBin',
]);

const WIDGET_CLASS_MAP: Record<string, string> = {
  window: 'Adw.ApplicationWindow',
  'preferences-dialog': 'Adw.PreferencesDialog',
  dialog: 'Adw.Dialog',
  'alert-dialog': 'Adw.AlertDialog',
  'about-dialog': 'Adw.AboutDialog',
  'toolbar-view': 'Adw.ToolbarView',
  'header-bar': 'Adw.HeaderBar',
  'window-title': 'Adw.WindowTitle',
  'view-stack': 'Adw.ViewStack',
  'view-switcher': 'Adw.ViewSwitcher',
  'navigation-view': 'Adw.NavigationView',
  'tab-view': 'Adw.TabView',
  'tab-bar': 'Adw.TabBar',
  'overlay-split': 'Adw.OverlaySplitView',
  clamp: 'Adw.Clamp',
  bin: 'Adw.Bin',
  'custom-widget': 'Protota.CustomWidget',
  'action-row': 'Adw.ActionRow',
  'switch-row': 'Adw.SwitchRow',
  'combo-row': 'Adw.ComboRow',
  'spin-row': 'Adw.SpinRow',
  'button-row': 'Adw.ButtonRow',
  'expander-row': 'Adw.ExpanderRow',
  'entry-row': 'Adw.EntryRow',
  'password-row': 'Adw.PasswordEntryRow',
  'preferences-page': 'Adw.PreferencesPage',
  'preferences-group': 'Adw.PreferencesGroup',
  button: 'Gtk.Button',
  'split-button': 'Adw.SplitButton',
  'menu-button': 'Gtk.MenuButton',
  toggle: 'Adw.Toggle',
  'toggle-group': 'Adw.ToggleGroup',
  entry: 'Gtk.Entry',
  'status-page': 'Adw.StatusPage',
  'toast-overlay': 'Adw.ToastOverlay',
  banner: 'Adw.Banner',
  spinner: 'Adw.Spinner',
  'flow-box': 'Gtk.FlowBox',
  box: 'Gtk.Box',
  grid: 'Gtk.Grid',
  'center-box': 'Gtk.CenterBox',
  stack: 'Gtk.Stack',
  'stack-page': 'Gtk.StackPage',
  'scrolled-window': 'Gtk.ScrolledWindow',
  overlay: 'Gtk.Overlay',
  'search-entry': 'Gtk.SearchEntry',
  'progress-bar': 'Gtk.ProgressBar',
  scale: 'Gtk.Scale',
  'level-bar': 'Gtk.LevelBar',
  'drop-down': 'Gtk.DropDown',
  avatar: 'Adw.Avatar',
  'wrap-box': 'Adw.WrapBox',
  popover: 'Gtk.Popover',
  'list-box-row': 'Gtk.ListBoxRow',
  'switch-widget': 'Gtk.Switch',
  'check-button': 'Gtk.CheckButton',
  'list-box': 'Gtk.ListBox',
  label: 'Gtk.Label',
  inscription: 'Gtk.Inscription',
};

/** The GTK/libadwaita class a renderer type exports as. */
export function widgetClassForType(type: string): string | null {
  return WIDGET_CLASS_MAP[type] ?? null;
}

/** Resolve a GTK/Adwaita runtime class to the renderer's generic node type. */
export function widgetTypeForClass(rawClass: string): AdwNodeType | null {
  return CLASS_TO_WIDGET_MAP[rawClass]
    ?? CLASS_TO_WIDGET_MAP[canonicalClassName(rawClass)]
    ?? null;
}

export function escapeBlueprintString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Editor property names are camelCase; Blueprint uses the GObject property
 * spelling. This is the inverse of propertyNameForNode, and getting it wrong
 * produces output that does not compile.
 */
const EXPORT_PROPERTY_NAMES: Record<string, string> = {
  iconName: 'icon-name',
  showTitleButtons: 'show-title-buttons',
  selectedIndex: 'selected',
  widthRequest: 'width-request',
  heightRequest: 'height-request',
  minWidth: 'width-request',
  minHeight: 'height-request',
  columnSpan: 'column-span',
  rowSpan: 'row-span',
  rowSpacing: 'row-spacing',
  columnSpacing: 'column-spacing',
  visibleChildName: 'visible-child-name',
};

/**
 * Editor conveniences that are Adwaita *style classes*, not GObject
 * properties. Emitting `suggested: true` produces source the compiler
 * rejects; GTK expresses these as `styles [ "suggested-action" ]`.
 */
const STYLE_CLASS_PROPERTIES: Record<string, string> = {
  suggested: 'suggested-action',
  destructive: 'destructive-action',
  flat: 'flat',
  circular: 'circular',
};

/** Properties whose value names another object, written as a bare id. */
export const OBJECT_REFERENCE_PROPERTIES = new Set([
  'menu-model', 'focus-widget', 'default-widget', 'buffer', 'model', 'popover',
  'adjustment', 'group', 'extra-child', 'stack', 'sort-model', 'filter',
  // Gtk.SearchBar names the widget whose key events it captures; emitting the
  // class name as a string is rejected ("Cannot convert string to Gtk.Widget").
  'key-capture-widget',
  // Adw.TabBar (and TabButton/TabOverview) name the Adw.TabView they present.
  'view',
]);

/**
 * Properties whose `false` is a meaningful deviation from a `true` GTK
 * default, so export must emit it rather than treat false as "unset".
 * Adw.TabBar autohide defaults to true; `autohide: false` is what keeps a
 * single-tab bar visible.
 */
export const EXPORTED_FALSE_PROPERTIES = new Set(['autohide']);

/**
 * Properties that genuinely hold text. Everything else whose value looks like
 * a bare identifier is an enum member: GTK has far too many enum properties to
 * enumerate, and quoting one produces source the compiler rejects
 * ("Cannot convert string to Gtk.SelectionMode").
 */
const STRING_PROPERTIES = new Set([
  'title', 'label', 'subtitle', 'description', 'text', 'tooltip-text', 'name',
  'icon-name', 'action-name', 'action-target', 'placeholder-text',
  'category', 'comments', 'website', 'license', 'version', 'developer-name',
  'application-name', 'translator-credits', 'css-name',
  'menu-title', 'heading', 'body', 'default-response', 'close-response',
  'visible-child-name', 'default-widget-name', 'group-name', 'stack-name',
  'transition-name', 'tag',
]);

/** Editor-only bookkeeping that must never reach exported source. */
export const INTERNAL_PROPERTIES = new Set([
  'id', 'type', 'slot', 'children', 'sourceClass', 'bindings', 'styleClasses',
  'pages', 'imageId', 'options', 'breakpointCondition', 'breakpointSetters', 'geometryOrigin',
]);

/**
 * Properties a class accepts, from GObject introspection data, including
 * everything inherited from its parents. Emitting a property a class does not
 * have is the single largest cause of exported Blueprint failing to compile,
 * and no amount of careful guessing substitutes for the toolkit's own answer.
 */
const propertyCache = new Map<string, Set<string>>();
export function propertiesOf(rawClassName: string): Set<string> | null {
  const cached = propertyCache.get(rawClassName);
  if (cached) return cached;
  const data = GTK_PROPERTY_DATA;
  const table = data.classes;
  // Blueprint's short names (`ActionBar`) and GObject names (`GtkActionBar`)
  // both mean the namespaced class the table is keyed on; failing to resolve
  // them here silently disables property filtering for the whole node.
  const className = table[rawClassName]
    ? rawClassName
    : [canonicalClassName(rawClassName), `Gtk.${rawClassName}`, `Adw.${rawClassName}`]
        .find((candidate) => table[candidate]) ?? rawClassName;
  if (!table[className]) return null;
  const names = new Set<string>();
  let current: string | null = className;
  const seen = new Set<string>();
  while (current && table[current] && !seen.has(current)) {
    seen.add(current);
    for (const property of table[current].properties) names.add(property);
    // Interfaces carry properties as well: GtkBox takes `orientation` from
    // GtkOrientable rather than from its parent chain.
    for (const iface of table[current].implements ?? []) {
      for (const property of data.interfaces[iface] ?? []) names.add(property);
    }
    current = table[current].parent;
  }
  propertyCache.set(className, names);
  propertyCache.set(rawClassName, names);
  return names;
}

/** Grid placement is emitted inside the child's `layout` block, not inline. */
const LAYOUT_PROPERTIES = new Set(['column', 'row', 'column-span', 'row-span']);

export function exportPropertyName(key: string): string {
  return EXPORT_PROPERTY_NAMES[key] ?? key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function formatPropertyValue(name: string, value: unknown): string {
  // A text property stays quoted even when its value happens to be numeric:
  // a button labelled "0" is a string, not the number zero. Any `*-icon-name`
  // (start-icon-name, end-icon-name, menu-icon-name…) is icon text; emitting
  // it bare makes the compiler read it as an object reference.
  if (STRING_PROPERTIES.has(name) || name.endsWith('icon-name')) {
    return `"${escapeBlueprintString(String(value))}"`;
  }
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  const text = String(value);
  // GtkBuilder accepts C enum constant names ("PANGO_WRAP_WORD_CHAR");
  // Blueprint wants the member ident (word_char). The constant's prefix is the
  // enum type; the property name's words locate where it ends.
  if (/^[A-Z][A-Z0-9_]+$/.test(text)) {
    const segments = text.toLowerCase().split('_');
    const nameWords = name.split('-');
    let cut = 0;
    for (let index = 0; index < segments.length; index++) {
      if (nameWords.includes(segments[index])) cut = index + 1;
    }
    // Without a property-word anchor, the leading segment is the namespace.
    const member = segments.slice(cut > 0 && cut < segments.length ? cut : 1).join('_');
    if (member) return member;
  }
  if (!STRING_PROPERTIES.has(name)) {
    // Flags are written as `a | b | c`, unquoted. GtkBuilder spells them
    // "no_emoji|no_spellcheck", which the compiler rejects as a string.
    if (/^[a-z][a-z0-9_-]*(\s*\|\s*[a-z][a-z0-9_-]*)+$/.test(text)) {
      // GTK flag members use underscores (`no_emoji`); sources and our own
      // property-name normalisation both spell them with dashes.
      return text.split('|').map((flag) => flag.trim().replace(/-/g, '_')).join(' | ');
    }
    // GtkBuilder writes every value as text, so a numeric property arrives as
    // a string; emitting it quoted is rejected ("Cannot convert string to
    // number").
    if (/^-?\d+(\.\d+)?$/.test(text)) return text;
    if (/^[a-z][a-z0-9_]*(-[a-z0-9_]+)*$/.test(text)) return text;
  }
  // An object reference is an identifier, not a string literal.
  if (OBJECT_REFERENCE_PROPERTIES.has(name) && /^[A-Za-z_][\w-]*$/.test(text)) return text;
  return `"${escapeBlueprintString(text)}"`;
}

/**
 * Slots GTK expresses as a child-type annotation (`[top]`) rather than as an
 * object-valued property (`content: Widget { }`).
 */
export const ANNOTATION_SLOTS = new Set([
  'top', 'bottom', 'start', 'end', 'title', 'prefix', 'suffix',
  // GtkOverlay's extra children and GtkListBox's placeholder are child types,
  // not properties: `overlay: Widget { }` is rejected outright.
  'overlay', 'placeholder', 'action',
  // GtkActionBar's centre child is `[center]`, not a `center:` property.
  'center',
]);

/**
 * The editor property key a GTK/Blueprint property spelling maps to for the
 * given node type. Public so breakpoint setters (stored in source spelling)
 * can be applied as render-time overrides with the exact same translation
 * import uses for declared properties.
 */
export function editorPropertyName(name: string, nodeType: AdwNodeType): string {
  return propertyNameForNode(name, nodeType);
}

function propertyNameForNode(name: string, nodeType: AdwNodeType): string {
  // GtkBuilder accepts underscore and dash spellings interchangeably.
  const rawName = name.replace(/_/g, '-');
  if ((rawName === 'label' || rawName === 'text') && (nodeType === 'button' || nodeType === 'toggle' || nodeType === 'label' || nodeType === 'inscription' || nodeType === 'menu-button' || nodeType === 'split-button')) return 'title';
  if (rawName === 'icon-name') return 'iconName';
  if (rawName === 'placeholder-text') return 'placeholder';
  if (rawName === 'show-title-buttons') return 'showTitleButtons';
  if (rawName === 'selected') return 'selectedIndex';
  return rawName.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** GtkBuilder spells classes as GObject names (`AdwActionRow`); Blueprint as
 * namespaced names (`Adw.ActionRow`). Both resolve to one canonical entry. */
export function canonicalClassName(rawClass: string): string {
  // GtkSource must be tried before Gtk: `GtkSourceBuffer` is GtkSource.Buffer,
  // not a Gtk class called SourceBuffer.
  const gobject = /^(Adw|GtkSource|Gtk|Gio)([A-Z][A-Za-z0-9]*)$/.exec(rawClass);
  return gobject ? `${gobject[1]}.${gobject[2]}` : rawClass;
}

export function isNonVisualClass(rawClass: string): boolean {
  return NON_VISUAL_CLASS_PATTERN.test(rawClass) || NON_VISUAL_CLASS_PATTERN.test(canonicalClassName(rawClass));
}

/** Renderer types whose editor `title` is the GTK `label` property. */
const LABELLED_TYPES = new Set(['button', 'label', 'toggle', 'inscription', 'menu-button', 'split-button']);

/**
 * The Blueprint property names an editor key may correspond to in real
 * source, most canonical first. `title` on a button is `label`, but GNOME
 * sources occasionally spell button text as `text`; a patcher must find
 * either before deciding the property is absent.
 */
export function blueprintPropertyCandidates(key: string, nodeType: string): string[] {
  if (key === 'title' && LABELLED_TYPES.has(nodeType)) return ['label', 'text'];
  return [exportPropertyName(key)];
}

/** Format a value exactly as the exporter would for the named property. */
export function blueprintValueSource(name: string, value: unknown): string {
  return formatPropertyValue(name, value);
}

/** The Adwaita style class an editor boolean maps to, or null. */
export function blueprintStyleClassFor(key: string): string | null {
  return STYLE_CLASS_PROPERTIES[key] ?? null;
}

/** True when the property is emitted inside a `layout { }` block. */
export function isBlueprintLayoutProperty(name: string): boolean {
  return LAYOUT_PROPERTIES.has(name);
}
