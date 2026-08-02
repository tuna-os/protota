import type { MockupDocument, AdwNode, AdwNodeType, BreakpointSetter, ImportDiagnostic, Screen, ScreenTemplateType } from '../types/mockup';
import { extractValaFacts, type ValaClassFacts } from './vala';
import { extractCFacts, type CClassFacts } from './clang';
import { extractPythonFacts } from './python';
import { GTK_PROPERTY_DATA } from '../data/gtkProperties';

export type { ImportDiagnostic } from '../types/mockup';

const CLASS_TO_WIDGET_MAP: Record<string, AdwNodeType> = {
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
function isBreakpointClass(rawClass: string): boolean {
  return rawClass === 'Breakpoint' || canonicalClassName(rawClass) === 'Adw.Breakpoint';
}

/**
 * Exported classes that accept Adw.Breakpoint children — the hosts
 * blueprint-compiler recognises. A breakpoint under any other parent is
 * dropped at export (emitting it would not compile).
 */
const BREAKPOINT_HOST_CLASSES = new Set([
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

function indent(n: number): string { return '  '.repeat(n); }

function escapeBlueprintString(value: string): string {
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
const OBJECT_REFERENCE_PROPERTIES = new Set([
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
const EXPORTED_FALSE_PROPERTIES = new Set(['autohide']);

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
const INTERNAL_PROPERTIES = new Set([
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
function propertiesOf(rawClassName: string): Set<string> | null {
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

function exportPropertyName(key: string): string {
  return EXPORT_PROPERTY_NAMES[key] ?? key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function formatPropertyValue(name: string, value: unknown): string {
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
const ANNOTATION_SLOTS = new Set([
  'top', 'bottom', 'start', 'end', 'title', 'prefix', 'suffix',
  // GtkOverlay's extra children and GtkListBox's placeholder are child types,
  // not properties: `overlay: Widget { }` is rejected outright.
  'overlay', 'placeholder', 'action',
  // GtkActionBar's centre child is `[center]`, not a `center:` property.
  'center',
]);

interface ExportContext {
  /** Object ids present in this document, so references can be validated. */
  knownIds: Set<string>;
  /** Ids already written, so a flattened template cannot duplicate one. */
  usedIds: Set<string>;
  /**
   * Original id → exported id. Renaming a duplicate is only half the job: a
   * property naming the original would otherwise resolve to whichever copy
   * kept the name, which is a different widget.
   */
  idMap: Map<AdwNode, string>;
  /** Original id → the single exported id references should point at. */
  renames: Map<string, string>;
  /**
   * Ids that actually appear in the emitted source. A subset of knownIds:
   * children of a source-referenced boundary exist in the document but are
   * not written (the boundary exports as its reference alone), and a
   * breakpoint setter naming one would stop the file compiling.
   */
  emittedIds?: Set<string>;
  /**
   * Export has two purposes and they disagree on one point. Patching back
   * into an app's own source must preserve a boundary's instance bindings,
   * where `template.` still resolves. A standalone file has no template
   * context, so the same binding stops it compiling.
   */
  standalone: boolean;
}

export interface BlueprintExportOptions {
  /** Emit a file that compiles on its own, rather than a patch for app source. */
  standalone?: boolean;
}

/**
 * Re-emit a preserved Adw.Breakpoint in real Blueprint syntax. Setters whose
 * target id is not in the exported document (or whose value is an unset) are
 * dropped — blueprint-compiler validates setter targets, and an unresolvable
 * reference would stop the whole file compiling. A condition-only breakpoint
 * is valid Blueprint and still worth keeping.
 */
function breakpointToBlueprint(node: AdwNode, depth: number, context?: ExportContext): string {
  const exportedIds = context?.emittedIds ?? context?.knownIds;
  const setters = (node.breakpointSetters ?? []).filter((setter) =>
    setter.value !== null && (!exportedIds || exportedIds.has(setter.target)));
  // The breakpoint keeps its id: an anonymous re-import would mint a fresh
  // `imported-N` that can collide with a literal id elsewhere in the file.
  const exportedId = context?.idMap.get(node) ?? node.id;
  let source = `${indent(depth)}Adw.Breakpoint${exportedId ? ` ${exportedId}` : ''} {\n` +
    `${indent(depth + 1)}condition ("${escapeBlueprintString(String(node.breakpointCondition))}")\n`;
  if (setters.length) {
    source += `${indent(depth + 1)}setters {\n`;
    for (const setter of setters) {
      const target = context?.renames.get(setter.target) ?? setter.target;
      source += `${indent(depth + 2)}${target}.${setter.property}: ${formatPropertyValue(setter.property, setter.value)};\n`;
    }
    source += `${indent(depth + 1)}}\n`;
  }
  return `${source}${indent(depth)}}\n`;
}

function nodeToBlueprint(node: AdwNode, depth: number = 0, context?: ExportContext): string {
  // A preserved Adw.Breakpoint has its own syntax; the generic property and
  // child emission below would mangle it.
  if (typeof node.breakpointCondition === 'string') {
    return breakpointToBlueprint(node, depth, context);
  }
  // An unresolved boundary exports as its real source reference. Replacing
  // `$MathButtons` with a Protota-invented class would corrupt the app source.
  // Export the class the source declared when we know it; fall back to the
  // renderer type's canonical class for widgets created in the editor.
  // Only claim a class the toolkit actually has. An app-defined composite
  // that was resolved from a template exports as the widget it resolved to,
  // because `ClocksHeaderBar` means nothing outside that app's source.
  const declaredClass = typeof node.sourceClass === 'string' ? node.sourceClass : '';
  const isKnownLibraryClass = !!declaredClass && !!CLASS_TO_WIDGET_MAP[declaredClass];
  // A `$` reference names a GType, which has no dots: an unresolved
  // `Gtk.SourceBuffer` boundary is `$GtkSourceBuffer`.
  const className = node.type === 'custom-widget' && declaredClass
    ? `$${declaredClass.replace(/\./g, '')}`
    : isKnownLibraryClass
      ? declaredClass
      : WIDGET_CLASS_MAP[node.type] || node.type;
  const props: string[] = [];
  const layout: string[] = [];
  const classProperties = className.startsWith('$') ? null : propertiesOf(className);

  // A source-referenced boundary exports as its reference alone. Its children
  // and expand flags are Protota's projection of code the app owns; writing
  // them back would flatten the app's source.
  const isSourceReference = node.type === 'custom-widget' && !!node.sourceClass;

  const styleClasses = typeof node.styleClasses === 'string'
    ? node.styleClasses.trim().split(/\s+/).filter(Boolean)
    : [];

  for (const [key, value] of Object.entries(node)) {
    if (INTERNAL_PROPERTIES.has(key) || value === undefined ||
        (value === false && !EXPORTED_FALSE_PROPERTIES.has(key)) || value === '') continue;
    // Signal handlers imported as properties (`notify::x`) are not properties.
    if (key.includes('::') || key.startsWith('notify')) continue;
    if (STYLE_CLASS_PROPERTIES[key]) {
      if (value === true) styleClasses.push(STYLE_CLASS_PROPERTIES[key]);
      continue;
    }
    if (isSourceReference && (key === 'vexpand' || key === 'hexpand')) continue;
    if (key === 'title' && node.type === 'custom-widget' && value === node.sourceClass) continue;

    if (key === 'title' && (node.type === 'button' || node.type === 'label' ||
        node.type === 'toggle' || node.type === 'inscription' ||
        node.type === 'menu-button' || node.type === 'split-button')) {
      if (!classProperties || classProperties.has('label')) {
        props.push(`label: ${formatPropertyValue('label', value)};`);
      }
      continue;
    }
    const name = exportPropertyName(key);
    // Drop a property the exported class does not have. An unknown class (an
    // app-defined boundary) is not filtered, since we have no data for it.
    if (classProperties && !classProperties.has(name) && !LAYOUT_PROPERTIES.has(name)) continue;
    if (OBJECT_REFERENCE_PROPERTIES.has(name) &&
        (/^[A-Z]/.test(String(value)) || (context && !context.knownIds.has(String(value))))) {
      // Menus and adjustments live outside the exported widget tree; a
      // reference to one would not resolve.
      continue;
    }
    if (OBJECT_REFERENCE_PROPERTIES.has(name) && context) {
      const renamed = context.renames.get(String(value));
      if (renamed) {
        props.push(`${name}: ${renamed};`);
        continue;
      }
    }
    const declaration = `${name}: ${formatPropertyValue(name, value)};`;
    (LAYOUT_PROPERTIES.has(name) ? layout : props).push(declaration);
  }
  const emittedNames = new Set(props.map((entry) => entry.split(':')[0].trim()));
  for (const [key, expression] of Object.entries(node.bindings ?? {})) {
    // `expression` is the placeholder for a binding the parser could not
    // model; emitting it would produce source that does not compile.
    if (!expression || expression === 'expression') continue;
    // A source-referenced boundary is written back into the app's own source,
    // where `template.` still resolves, so its instance bindings are kept. A
    // flattened widget has no template context, and emitting one there
    // produces Blueprint that does not compile.
    const flattened = expression.startsWith('$') || expression.startsWith('template.');
    if (flattened && (!isSourceReference || context?.standalone)) continue;
    const boundName = exportPropertyName(key);
    if (classProperties && !classProperties.has(boundName)) continue;
    // The resolved literal already carries this property's value.
    if (emittedNames.has(boundName)) continue;
    // A binding whose source object is not in this document cannot resolve.
    // GtkBuilder bindings name an object id, which a flattened export may not
    // carry.
    const bindingSource = expression.split('.')[0].replace(/^\$/, '');
    if (context?.standalone && bindingSource && !context.knownIds.has(bindingSource)) continue;
    props.push(`${boundName}: bind ${expression};`);
  }
  if (styleClasses.length) {
    props.push(`styles [ ${[...new Set(styleClasses)].map((name) => `"${name}"`).join(', ')} ]`);
  }

  const childSource = (isSourceReference ? [] : node.children || [])
    // Buffers, adjustments and other non-visual objects imported before the
    // non-visual filter learned their class must not survive into export:
    // `buffer: $GtkSourceBuffer { }` is source we cannot honestly emit.
    .filter((child) => !(typeof child.sourceClass === 'string' && isNonVisualClass(child.sourceClass)))
    // A breakpoint compiles only under a breakpoint-capable host. Under any
    // other parent (a user moved it, or import attached it oddly) it is
    // dropped rather than emitted as source that does not compile.
    .filter((child) => typeof child.breakpointCondition !== 'string' || BREAKPOINT_HOST_CLASSES.has(className))
    .map((child) => {
    const body = nodeToBlueprint(child, depth + 1, context);
    if (!child.slot) return body;
    if (ANNOTATION_SLOTS.has(child.slot)) {
      // `[top]` annotates the child that follows it.
      return `${indent(depth + 1)}[${child.slot}]\n${body}`;
    }
    // Everything else is an object-valued property: `content: Widget { … };`.
    // The name has to be one this class has — Adw.Bin takes `child` where
    // Adw.ToolbarView takes `content`.
    let slotName = child.slot;
    if (classProperties && !classProperties.has(slotName)) {
      const fallback = ['child', 'content'].find((candidate) => classProperties.has(candidate));
      if (!fallback) return body;
      slotName = fallback;
    }
    const trimmed = body.replace(/^\s+/, '').replace(/\n$/, '');
    return `${indent(depth + 1)}${slotName}: ${trimmed};\n`;
  });

  const exportedId = context?.idMap.get(node) ?? node.id;
  const idStr = exportedId ? ` ${exportedId}` : '';
  if (childSource.length === 0 && props.length === 0 && layout.length === 0) {
    return `${indent(depth)}${className}${idStr} {\n${indent(depth)}}\n`;
  }
  const layoutBlock = layout.length
    ? `${indent(depth + 1)}layout {\n` +
      layout.map((entry) => `${indent(depth + 2)}${entry}\n`).join('') +
      `${indent(depth + 1)}}\n`
    : '';

  return `${indent(depth)}${className}${idStr} {\n` +
    props.map((entry) => `${indent(depth + 1)}${entry}\n`).join('') +
    layoutBlock +
    childSource.join('') +
    `${indent(depth)}}\n`;
}

/**
 * A screen's width/height re-emitted as the faithful GTK property, so the
 * geometry survives the Blueprint round trip localStorage persistence rides
 * on (previously every reload reset screens to 1024×720). Windows carry
 * `default-width`/`default-height`; the Adw.Dialog family sizes through
 * `content-width`/`content-height`.
 */
function withScreenGeometry(screen: Screen): AdwNode {
  const root = screen.rootNode;
  if (!(screen.width > 0) || !(screen.height > 0)) return root;
  if (root.type === 'window') {
    return { ...root, defaultWidth: screen.width, defaultHeight: screen.height };
  }
  if (root.type === 'dialog' || root.type === 'preferences-dialog' ||
      root.type === 'alert-dialog' || root.type === 'about-dialog') {
    return { ...root, contentWidth: screen.width, contentHeight: screen.height };
  }
  return root;
}

export function mockupToBlueprint(doc: MockupDocument, options?: BlueprintExportOptions): string {
  const roots = doc.screens.map(withScreenGeometry);
  const knownIds = new Set<string>();
  const collect = (node: AdwNode) => {
    if (node.id) knownIds.add(node.id);
    node.children?.forEach(collect);
  };
  roots.forEach(collect);
  // Assign exported ids up front, so a reference emitted before its target is
  // written still resolves to the right widget.
  const idMap = new Map<AdwNode, string>();
  const renames = new Map<string, string>();
  const usedIds = new Set<string>();
  const assign = (node: AdwNode) => {
    if (node.id) {
      let candidate = node.id;
      let suffix = 2;
      while (usedIds.has(candidate)) candidate = `${node.id}_${suffix++}`;
      usedIds.add(candidate);
      idMap.set(node, candidate);
      // The first widget to claim an id is the one references mean.
      if (!renames.has(node.id)) renames.set(node.id, candidate);
    }
    node.children?.forEach(assign);
  };
  roots.forEach(assign);

  // Mirror the emitter's descent so breakpoint setters can be validated
  // against ids the file will really contain: a source-referenced boundary
  // exports as its reference alone, so its children never get ids on disk.
  const emittedIds = new Set<string>();
  const collectEmitted = (node: AdwNode) => {
    if (node.id) emittedIds.add(node.id);
    if (node.type === 'custom-widget' && node.sourceClass) return;
    for (const child of node.children ?? []) {
      if (typeof child.sourceClass === 'string' && isNonVisualClass(child.sourceClass)) continue;
      collectEmitted(child);
    }
  };
  roots.forEach(collectEmitted);

  const context: ExportContext = {
    knownIds, usedIds, idMap, renames, emittedIds, standalone: options?.standalone ?? false,
  };
  const body = roots.map(root => nodeToBlueprint(root, 0, context)).join('\n');
  // A re-emitted GtkSource class (the importer canonicalizes `GtkSourceView`
  // to `GtkSource.View`) compiles only with its namespace imported.
  const gtkSourceImport = /\bGtkSource\.[A-Z]/.test(body) ? 'using GtkSource 5;\n' : '';
  return `using Gtk 4.0;\nusing Adw 1;\n${gtkSourceImport}\n${body}`;
}

/**
 * Parse Blueprint UI code or GtkBuilder XML without losing its widget tree.
 *
 * Blueprint has constructs that Protota does not model (templates, bindings,
 * object references). We retain the widgets, scalar properties, and named
 * child slots that determine Libadwaita layout.
 */
type BlueprintValue = string | number | boolean;

interface Token {
  value: string;
  kind: 'word' | 'string' | 'number' | 'punct';
}

function tokenizeBlueprint(code: string): Token[] {
  // Comments must be stripped with string awareness: real GNOME sources
  // contain `//` inside string literals (for example markup link targets like
  // "r:///"), and a regex-based comment pass destroys the rest of the line,
  // unbalancing every following brace.
  const tokens: Token[] = [];
  const wordPattern = /\$?[A-Za-z_][A-Za-z0-9_.-]*/y;
  const numberPattern = /-?\d+(?:\.\d+)?/y;
  let index = 0;
  while (index < code.length) {
    const character = code[index];
    if (character === '/' && code[index + 1] === '/') {
      const lineEnd = code.indexOf('\n', index);
      index = lineEnd === -1 ? code.length : lineEnd + 1;
      continue;
    }
    if (character === '/' && code[index + 1] === '*') {
      const commentEnd = code.indexOf('*/', index + 2);
      index = commentEnd === -1 ? code.length : commentEnd + 2;
      continue;
    }
    if (character === '"') {
      let end = index + 1;
      while (end < code.length && code[end] !== '"') {
        if (code[end] === '\\') end++;
        end++;
      }
      tokens.push({ value: code.slice(index, end + 1), kind: 'string' });
      index = end + 1;
      continue;
    }
    numberPattern.lastIndex = index;
    const number = numberPattern.exec(code);
    if (number) {
      tokens.push({ value: number[0], kind: 'number' });
      index = numberPattern.lastIndex;
      continue;
    }
    wordPattern.lastIndex = index;
    const word = wordPattern.exec(code);
    if (word) {
      tokens.push({ value: word[0], kind: 'word' });
      index = wordPattern.lastIndex;
      continue;
    }
    if ('{}[]:;,'.includes(character)) tokens.push({ value: character, kind: 'punct' });
    index++;
  }
  return tokens;
}

function parseValue(token: Token | undefined): BlueprintValue | undefined {
  if (!token) return undefined;
  if (token.kind === 'string') {
    try { return JSON.parse(token.value); } catch { return token.value.slice(1, -1); }
  }
  if (token.kind === 'number') return Number(token.value);
  if (token.value === 'true') return true;
  if (token.value === 'false') return false;
  return token.value;
}

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
function canonicalClassName(rawClass: string): string {
  // GtkSource must be tried before Gtk: `GtkSourceBuffer` is GtkSource.Buffer,
  // not a Gtk class called SourceBuffer.
  const gobject = /^(Adw|GtkSource|Gtk|Gio)([A-Z][A-Za-z0-9]*)$/.exec(rawClass);
  return gobject ? `${gobject[1]}.${gobject[2]}` : rawClass;
}

function isNonVisualClass(rawClass: string): boolean {
  return NON_VISUAL_CLASS_PATTERN.test(rawClass) || NON_VISUAL_CLASS_PATTERN.test(canonicalClassName(rawClass));
}

function makeNode(
  rawClass: string,
  id: string,
  properties: Record<string, BlueprintValue>,
  bindings: Record<string, string>,
  children: AdwNode[],
  diagnostics: ImportDiagnostic[],
): AdwNode {
  const isTemplateReference = rawClass.startsWith('$');
  const sourceClass = isTemplateReference ? rawClass.slice(1) : rawClass;
  // Blueprint's `$` marks a type outside the imported namespaces, which
  // includes real library widgets (GtkSourceView, WebKit views) as well as
  // app-defined ones. A `$Name` whose class the registry knows is that
  // widget, not an unresolved boundary.
  let type = CLASS_TO_WIDGET_MAP[sourceClass] ?? CLASS_TO_WIDGET_MAP[canonicalClassName(sourceClass)];
  // An Adw.Leaflet declaring `can-unfold: false` never shows its pages side
  // by side — it is a navigation stack (the pattern GNOME Software's shell
  // uses). Rendering it as a split view would paint pages GTK never shows
  // together. Property-driven refinement, not an app-specific branch.
  if (type === 'overlay-split' && canonicalClassName(sourceClass) === 'Adw.Leaflet'
      && properties['can-unfold'] === false) {
    type = 'view-stack';
  }
  const node: AdwNode = { id, type: type ?? 'custom-widget', children };
  // A silent fallback or a dropped sibling makes an imported GNOME UI look
  // plausible while being structurally wrong. An unmapped class survives as
  // an explicit, labelled custom-widget boundary with a structured reason —
  // never as a fake generic box, and never as a parse error that hides the
  // rest of the source tree.
  if (!type) {
    node.sourceClass = sourceClass;
    node.title = sourceClass;
    diagnostics.push(isTemplateReference
      ? {
          code: 'template-not-in-bundle',
          sourceClass,
          sourceId: id,
          message: `$${sourceClass} has no template definition in the imported source; retained as an explicit custom-widget boundary.`,
        }
      : {
          code: 'renderer-does-not-support-class',
          sourceClass,
          sourceId: id,
          message: `${sourceClass} is not in the generic widget registry; retained as an explicit custom-widget boundary.`,
        });
  }
  for (const [key, value] of Object.entries(properties)) {
    node[propertyNameForNode(key, node.type)] = value;
  }
  // Mnemonic underscores (`_Add`) are keyboard accelerators, not label text.
  if (node.useUnderline && typeof node.title === 'string') node.title = node.title.replace('_', '');
  // GTK's default GtkBox orientation is horizontal; the renderer's editing
  // default is vertical. Imported boxes must carry GTK's semantics.
  if (node.type === 'box' && node.orientation === undefined) node.orientation = 'horizontal';
  // Every imported node keeps the class the source declared. A widget mapped
  // onto a generic renderer type still has to export as itself: a
  // Gtk.Revealer rendered as a bin must not export as Adw.Bin, whose
  // properties it does not have. Rendering stays keyed on `type`; identity is
  // separate from appearance.
  if (!isTemplateReference) node.sourceClass = canonicalClassName(sourceClass);
  // A child in the `popover` slot is a popup surface: real, but allocated
  // above the window, never inside the parent's layout.
  if (node.children?.length) node.children = node.children.filter(child => child.slot !== 'popover');
  // Adw.ButtonContent supplies its parent button's icon and label.
  if (node.type === 'button' || node.type === 'menu-button' || node.type === 'split-button' || node.type === 'toggle') {
    const content = node.children?.find(child => child.sourceClass === 'Adw.ButtonContent');
    if (content) {
      if (node.title === undefined && content.title !== undefined) node.title = content.title;
      if (node.iconName === undefined && content.iconName !== undefined) node.iconName = content.iconName;
      node.children = node.children!.filter(child => child !== content);
    }
  }
  if (Object.keys(bindings).length) node.bindings = bindings;
  return node;
}

/** Custom Blueprint templates must be supplied by the source bundle. */
export function blueprintTemplateReferences(code: string): string[] {
  const tokens = tokenizeBlueprint(code);
  const references = new Set<string>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token.value.startsWith('$')) continue;
    // `template $Name: Class` declares a template; `$Name instance {}` uses it.
    if (tokens[index + 1]?.value !== ':') references.add(token.value.slice(1));
  }
  return [...references];
}

function parseBlueprintRoots(code: string, diagnostics: ImportDiagnostic[]): AdwNode[] {
  const tokens = tokenizeBlueprint(code);
  let cursor = 0;
  let generatedId = 0;
  const nextId = () => `imported-${++generatedId}`;

  // Blueprint classes are capitalized (`Grid`, `Adw.Bin`) or template
  // references (`$MathButtons`); slot and property names are lowercase.
  // Recognition is syntactic — an unknown class is still an object node, so
  // it can survive as an explicit boundary instead of vanishing.
  const isClassWord = (token: Token | undefined): boolean =>
    token?.kind === 'word' &&
    (token.value.startsWith('$') || token.value.includes('.') || /^[A-Z]/.test(token.value));
  const isObjectStart = (index: number): boolean =>
    isClassWord(tokens[index]) &&
    (tokens[index + 1]?.value === '{' ||
      (tokens[index + 1]?.kind === 'word' && tokens[index + 2]?.value === '{'));

  const parseObject = (): AdwNode | null => {
    const rawClass = tokens[cursor++].value;
    const id = tokens[cursor]?.value === '{' ? nextId() : tokens[cursor++].value;
    cursor++; // opening '{'
    const properties: Record<string, BlueprintValue> = {};
    const bindings: Record<string, string> = {};
    const children: AdwNode[] = [];
    let pendingSlot: string | undefined;
    // Adw.Breakpoint bodies use dedicated syntax: `condition ("…")` and a
    // `setters { id.prop: value; }` block. Without explicit handling the
    // generic property/slot branches desynchronise the braces (the setters'
    // `}` closes the breakpoint, whose own `}` then closes the PARENT early,
    // silently dropping every following sibling).
    const breakpoint = isBreakpointClass(rawClass);
    let breakpointCondition: string | undefined;
    const breakpointSetters: BreakpointSetter[] = [];

    while (cursor < tokens.length && tokens[cursor].value !== '}') {
      const key = tokens[cursor];

      if (breakpoint && key?.value === 'condition' && tokens[cursor + 1]?.kind === 'string') {
        const parsed = parseValue(tokens[cursor + 1]);
        if (typeof parsed === 'string') breakpointCondition = parsed;
        cursor += 2;
        continue;
      }

      if (breakpoint && key?.value === 'setters' && tokens[cursor + 1]?.value === '{') {
        cursor += 2;
        while (cursor < tokens.length && tokens[cursor].value !== '}') {
          const entry = tokens[cursor];
          if (entry.kind === 'word' && tokens[cursor + 1]?.value === ':') {
            cursor += 2;
            let value: BlueprintValue | null | undefined;
            if (tokens[cursor]?.value === 'null') { value = null; cursor++; }
            else value = parseValue(tokens[cursor++]);
            while (cursor < tokens.length && tokens[cursor].value !== ';' && tokens[cursor].value !== '}') cursor++;
            if (tokens[cursor]?.value === ';') cursor++;
            const dot = entry.value.lastIndexOf('.');
            if (dot > 0 && value !== undefined) {
              breakpointSetters.push({
                target: entry.value.slice(0, dot),
                property: entry.value.slice(dot + 1).replace(/_/g, '-'),
                value,
              });
            }
          } else cursor++;
        }
        if (tokens[cursor]?.value === '}') cursor++;
        continue;
      }

      if (tokens[cursor + 1]?.value === ':') {
        cursor += 2;
        // Object-valued property (`child: Gtk.Label { ... };`) — the value is
        // a real widget in the named slot, and must not corrupt nesting.
        if (isObjectStart(cursor)) {
          const child = parseObject();
          if (child) children.push({ ...child, slot: key.value });
          if (tokens[cursor]?.value === ';') cursor++;
          continue;
        }
        // Translated strings: `_("x")` and `C_("ctx", "x")` mark the last
        // string literal as the display text. Parentheses are not tokens, so
        // the wrapper word is followed directly by its string arguments.
        if (tokens[cursor]?.kind === 'word' && /^(N?C?_|N_)$/.test(tokens[cursor].value) && tokens[cursor + 1]?.kind === 'string') {
          cursor++;
          let text: BlueprintValue | undefined;
          while (cursor < tokens.length && tokens[cursor].value !== ';' && tokens[cursor].value !== '}') {
            if (tokens[cursor].kind === 'string') text = parseValue(tokens[cursor]);
            cursor++;
          }
          if (tokens[cursor]?.value === ';') cursor++;
          if (text !== undefined) properties[key.value] = text;
          continue;
        }
        // Bindings and expressions are opaque source facts, preserved for
        // export rather than mistaken for one-token scalars.
        if (tokens[cursor]?.value === 'bind' || tokens[cursor]?.value === 'bind-property') {
          cursor++;
          const parts: string[] = [];
          while (cursor < tokens.length && tokens[cursor].value !== ';' && tokens[cursor].value !== '}') {
            parts.push(tokens[cursor++].value);
          }
          if (tokens[cursor]?.value === ';') cursor++;
          bindings[key.value] = parts.join(' ');
          continue;
        }
        const value = parseValue(tokens[cursor++]);
        if (value !== undefined) properties[key.value] = value;
        // A multi-token expression tail we do not model may not swallow the
        // following sibling; consume it up to the statement terminator.
        while (cursor < tokens.length && !['{', ';', ',', '}'].includes(tokens[cursor].value)) cursor++;
        if (tokens[cursor]?.value === ';' || tokens[cursor]?.value === ',') cursor++;
        continue;
      }

      // Child-type annotation: `[top]` places the object that follows it.
      // Ignoring these loses the placement of every header-bar button.
      if (key?.value === '[' && tokens[cursor + 1]?.kind === 'word' && tokens[cursor + 2]?.value === ']') {
        pendingSlot = tokens[cursor + 1].value;
        cursor += 3;
        continue;
      }

      if (key?.kind === 'word' && tokens[cursor + 1]?.value === '[') {
        // Blueprint arrays. Style classes with widget-property equivalents
        // (suggested-action, flat, …) project onto the node; the rest is
        // metadata, consumed so it cannot swallow following source widgets.
        const arrayValues: string[] = [];
        cursor += 2;
        while (cursor < tokens.length && tokens[cursor]?.value !== ']') {
          if (tokens[cursor].kind === 'string') {
            const parsed = parseValue(tokens[cursor]);
            if (typeof parsed === 'string') arrayValues.push(parsed);
          }
          cursor++;
        }
        if (tokens[cursor]?.value === ']') cursor++;
        if (tokens[cursor]?.value === ';' || tokens[cursor]?.value === ',') cursor++;
        if (key.value === 'styles') {
          for (const styleClass of arrayValues) {
            if (styleClass === 'suggested-action') properties.suggested = true;
            if (styleClass === 'destructive-action') properties.destructive = true;
            if (styleClass === 'flat') properties.flat = true;
            if (styleClass === 'circular') properties.circular = true;
          }
          // Remaining GTK style classes are retained verbatim: the renderer
          // styles the ones Adwaita defines (card, boxed-list, toolbar,
          // dim-label, title-N…) and app-specific ones stay as provenance.
          if (arrayValues.length) properties.styleClasses = arrayValues.join(' ');
        }
        continue;
      }

      if (key?.value === 'layout' && tokens[cursor + 1]?.value === '{') {
        cursor += 2;
        while (cursor < tokens.length && tokens[cursor]?.value !== '}') {
          const layoutKey = tokens[cursor];
          if (tokens[cursor + 1]?.value === ':') {
            cursor += 2;
            let value = parseValue(tokens[cursor++]);
            // GtkBuilder layout values are strings ("0"); grid placement math
            // needs real numbers.
            if (typeof value === 'string' && /^-?\d+$/.test(value)) value = Number(value);
            if (value !== undefined) properties[layoutKey.value] = value;
            if (tokens[cursor]?.value === ';' || tokens[cursor]?.value === ',') cursor++;
          } else cursor++;
        }
        if (tokens[cursor]?.value === '}') cursor++;
        continue;
      }

      if (isObjectStart(cursor)) {
        const child = parseObject();
        if (child) children.push(pendingSlot ? { ...child, slot: pendingSlot } : child);
        pendingSlot = undefined;
        continue;
      }

      // Slot blocks such as `content { Gtk.Box { ... } }` retain both their
      // widgets and their parent-defined structural role.
      if (key?.kind === 'word' && tokens[cursor + 1]?.value === '{') {
        const slot = key.value;
        cursor += 2;
        children.push(...parseBlock().map(child => ({ ...child, slot })));
        if (tokens[cursor]?.value === '}') cursor++;
        continue;
      }

      cursor++;
    }
    if (tokens[cursor]?.value === '}') cursor++;
    if (isNonVisualClass(rawClass)) return null;
    // A breakpoint with no readable condition can never activate; dropping it
    // is the pre-existing behavior and keeps it from rendering as a stray bin.
    if (breakpoint && breakpointCondition === undefined) return null;
    const node = makeNode(rawClass, id, properties, bindings, children, diagnostics);
    if (breakpoint && breakpointCondition !== undefined) {
      node.breakpointCondition = breakpointCondition;
      if (breakpointSetters.length) node.breakpointSetters = breakpointSetters;
    }
    return node;
  };

  const parseBlock = (): AdwNode[] => {
    const nodes: AdwNode[] = [];
    while (cursor < tokens.length && tokens[cursor].value !== '}') {
      if (isObjectStart(cursor)) {
        const node = parseObject();
        if (node) nodes.push(node);
        continue;
      }
      if (tokens[cursor]?.kind === 'word' && tokens[cursor + 1]?.value === '{') {
        const slot = tokens[cursor].value;
        cursor += 2;
        nodes.push(...parseBlock().map(child => ({ ...child, slot })));
        if (tokens[cursor]?.value === '}') cursor++;
        continue;
      }
      cursor++;
    }
    return nodes;
  };

  return parseBlock();
}

// ---------------------------------------------------------------------------
// GtkBuilder XML import
// ---------------------------------------------------------------------------

interface XmlElement {
  tag: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  text: string;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Minimal structural XML parser — elements, attributes, text, comments. */
function parseXmlElements(code: string): XmlElement[] {
  const roots: XmlElement[] = [];
  const stack: XmlElement[] = [];
  const tagPattern = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/?[A-Za-z_][\w.:-]*(?:\s+[^<>]*?)?\/?>|[^<]+/g;
  const attrPattern = /([\w.:-]+)\s*=\s*"([^"]*)"|([\w.:-]+)\s*=\s*'([^']*)'/g;
  for (const match of code.matchAll(tagPattern)) {
    const chunk = match[0];
    if (chunk.startsWith('<!--') || chunk.startsWith('<?') || chunk.startsWith('<!DOCTYPE')) continue;
    if (chunk.startsWith('<![CDATA[')) {
      const parent = stack[stack.length - 1];
      if (parent) parent.text += chunk.slice(9, -3);
      continue;
    }
    if (!chunk.startsWith('<')) {
      const parent = stack[stack.length - 1];
      if (parent) parent.text += decodeXmlEntities(chunk);
      continue;
    }
    if (chunk.startsWith('</')) { stack.pop(); continue; }
    const tag = /^<([A-Za-z_][\w.:-]*)/.exec(chunk)![1];
    const attributes: Record<string, string> = {};
    for (const attr of chunk.matchAll(attrPattern)) {
      attributes[attr[1] ?? attr[3]] = decodeXmlEntities(attr[2] ?? attr[4] ?? '');
    }
    const element: XmlElement = { tag, attributes, children: [], text: '' };
    (stack[stack.length - 1]?.children ?? roots).push(element);
    if (!chunk.endsWith('/>')) stack.push(element);
  }
  return roots;
}

function builderScalar(raw: string): BlueprintValue {
  const text = raw.trim();
  if (text === 'true' || text === 'True') return true;
  if (text === 'false' || text === 'False') return false;
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
}

/**
 * Project a GtkBuilder <object>/<template> element to a renderer node.
 * Structure-preserving: child roles become slots, object-valued properties
 * become slotted children, style classes and layout properties project onto
 * the node, and unknown classes survive as explicit boundaries.
 */
function builderElementToNode(
  element: XmlElement,
  diagnostics: ImportDiagnostic[],
  nextId: () => string,
): AdwNode | null {
  const rawClass = element.tag === 'template'
    ? element.attributes.parent ?? element.attributes.class ?? 'GtkWidget'
    : element.attributes.class ?? 'GtkWidget';
  if (isNonVisualClass(rawClass)) return null;
  const id = element.attributes.id ?? nextId();
  const properties: Record<string, BlueprintValue> = {};
  const bindings: Record<string, string> = {};
  const children: AdwNode[] = [];
  const breakpoint = isBreakpointClass(rawClass);
  let breakpointCondition: string | undefined;
  const breakpointSetters: BreakpointSetter[] = [];

  for (const child of element.children) {
    if (breakpoint && child.tag === 'condition') {
      breakpointCondition = child.text.trim();
      continue;
    }
    if (breakpoint && child.tag === 'setter') {
      const target = child.attributes.object;
      const property = child.attributes.property;
      if (target && property) {
        const text = child.text.trim();
        // An empty <setter/> unsets the property when the breakpoint applies.
        breakpointSetters.push({
          target,
          property: property.replace(/_/g, '-'),
          value: text === '' ? null : builderScalar(text),
        });
      }
      continue;
    }
    if (child.tag === 'property') {
      const name = child.attributes.name;
      if (!name) continue;
      const objectValue = child.children.find(inner => inner.tag === 'object');
      if (objectValue) {
        const node = builderElementToNode(objectValue, diagnostics, nextId);
        if (node) children.push({ ...node, slot: name });
      } else if (child.attributes['bind-source']) {
        bindings[name] = `${child.attributes['bind-source']}.${child.attributes['bind-property'] ?? name}`;
      } else {
        properties[name] = builderScalar(child.text);
      }
      continue;
    }
    if (child.tag === 'binding') {
      const name = child.attributes.name;
      if (name) bindings[name] = child.text.trim() || 'expression';
      continue;
    }
    if (child.tag === 'child') {
      const slot = child.attributes.type;
      for (const inner of child.children) {
        if (inner.tag !== 'object' && inner.tag !== 'placeholder') continue;
        if (inner.tag === 'placeholder') continue;
        const node = builderElementToNode(inner, diagnostics, nextId);
        if (node) children.push(slot ? { ...node, slot } : node);
      }
      continue;
    }
    if (child.tag === 'style') {
      const styleNames: string[] = [];
      for (const styleClass of child.children) {
        const name = styleClass.attributes.name;
        if (name) styleNames.push(name);
        if (name === 'suggested-action') properties.suggested = true;
        if (name === 'destructive-action') properties.destructive = true;
        if (name === 'flat') properties.flat = true;
        if (name === 'circular') properties.circular = true;
      }
      if (styleNames.length) properties.styleClasses = styleNames.join(' ');
      continue;
    }
    if (child.tag === 'layout') {
      for (const layoutProperty of child.children) {
        const name = layoutProperty.attributes.name;
        if (!name) continue;
        properties[name] = builderScalar(layoutProperty.text);
      }
      continue;
    }
    // <signal>, <accessibility>, <attributes>, <items>… are non-structural.
  }
  if (breakpoint && breakpointCondition === undefined) return null;
  const node = makeNode(rawClass, id, properties, bindings, children, diagnostics);
  // A GtkBuilder template's concrete GType is its `class`, even though its
  // renderer shape comes from `parent`. Preserve both facts: `type` remains
  // the supported parent widget while sourceClass lets runtime matching join
  // a presented composite dialog (ClocksAlarmSetupDialog) instead of
  // incorrectly seeding it at the application's first toplevel window.
  if (element.tag === 'template' && element.attributes.class) {
    node.sourceClass = element.attributes.class;
  }
  if (breakpoint && breakpointCondition !== undefined) {
    node.breakpointCondition = breakpointCondition;
    if (breakpointSetters.length) node.breakpointSetters = breakpointSetters;
  }
  return node;
}

function parseGtkBuilderRoots(code: string, diagnostics: ImportDiagnostic[]): AdwNode[] {
  let generatedId = 0;
  const nextId = () => `imported-${++generatedId}`;
  const roots: AdwNode[] = [];
  const visit = (elements: XmlElement[]) => {
    for (const element of elements) {
      if (element.tag === 'interface') { visit(element.children); continue; }
      if (element.tag === 'object' || element.tag === 'template') {
        const node = builderElementToNode(element, diagnostics, nextId);
        if (node) roots.push(node);
      }
      // <menu>, <requires>… are non-visual at the interface level.
    }
  };
  visit(parseXmlElements(code));
  return roots;
}

/**
 * GtkBuilder composite templates: an <object class="EditorPage"> instance
 * resolves against a <template class="EditorPage" parent="…"> defined in
 * another .ui file of the same bundle — the XML equivalent of Blueprint's
 * `$Class` template linking.
 */
function collectBuilderTemplates(files: BlueprintSourceFile[], diagnostics: ImportDiagnostic[]): Map<string, AdwNode> {
  const templates = new Map<string, AdwNode>();
  let generatedId = 0;
  const nextId = () => `template-imported-${++generatedId}`;
  for (const file of files) {
    if (!/<template[\s>]/.test(file.content)) continue;
    const visit = (elements: XmlElement[]) => {
      for (const element of elements) {
        if (element.tag === 'interface') { visit(element.children); continue; }
        if (element.tag !== 'template') continue;
        const className = element.attributes.class;
        if (!className) continue;
        const node = builderElementToNode(element, diagnostics, nextId);
        if (node) templates.set(className, node);
      }
    };
    visit(parseXmlElements(file.content));
  }
  return templates;
}

function resolveBuilderTemplates(node: AdwNode, templates: Map<string, AdwNode>, seen: ReadonlySet<string>, resolved: Set<string>): void {
  node.children?.forEach(child => resolveBuilderTemplates(child, templates, seen, resolved));
  if (node.type !== 'custom-widget' || !node.sourceClass || node.children?.length) return;
  const template = templates.get(node.sourceClass);
  if (!template || seen.has(node.sourceClass)) return;
  resolved.add(`${node.sourceClass}:${node.id}`);
  const projected = structuredClone(template);
  // GtkBuilder composite templates commonly bind an inner widget to a
  // property supplied by the concrete instance, e.g. ClocksHeaderBar's
  // `AdwViewSwitcher.stack <- ClocksHeaderBar.stack` while the instance sets
  // `stack=stack`. Once the template is flattened there is no GObject owner
  // left to perform that binding, so carry any source-known instance literal
  // onto the projected child. Dynamic properties remain as bindings.
  const resolveInstanceBindings = (projectedNode: AdwNode): void => {
    for (const [targetProperty, expression] of Object.entries(projectedNode.bindings ?? {})) {
      const reference = /^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9_-]+)$/.exec(expression);
      if (!reference || reference[1] !== node.sourceClass) continue;
      const sourceKey = editorPropertyName(reference[2], node.type);
      const value = node[sourceKey];
      if (value === undefined) continue;
      projectedNode[editorPropertyName(targetProperty, projectedNode.type)] = value;
      delete projectedNode.bindings![targetProperty];
    }
    if (projectedNode.bindings && Object.keys(projectedNode.bindings).length === 0) delete projectedNode.bindings;
    projectedNode.children?.forEach(resolveInstanceBindings);
  };
  resolveInstanceBindings(projected);
  node.type = projected.type;
  node.children = projected.children ?? [];
  if (node.title === node.sourceClass) delete node.title;
  for (const [key, value] of Object.entries(projected)) {
    if (key === 'id' || key === 'slot' || key === 'children' || node[key] !== undefined) continue;
    node[key] = value;
  }
  const nested = new Set(seen);
  nested.add(node.sourceClass!);
  node.children?.forEach(child => resolveBuilderTemplates(child, templates, nested, resolved));
}

export interface BlueprintImportResult {
  roots: AdwNode[];
  diagnostics: ImportDiagnostic[];
}

/**
 * Parse a Blueprint or GtkBuilder document into its top-level widget trees,
 * with an import report. Unsupported classes and unresolved template
 * references survive as explicit `custom-widget` boundaries; each one is
 * recorded as a diagnostic rather than dropped or faked.
 */
export function blueprintImport(code: string): BlueprintImportResult {
  const diagnostics: ImportDiagnostic[] = [];
  const roots = /<(interface|object|template)[\s>]/.test(code)
    ? parseGtkBuilderRoots(code, diagnostics)
    : parseBlueprintRoots(code, diagnostics);
  if (!roots.length) throw new Error('No GTK or Libadwaita widgets found in the supplied code.');
  return { roots, diagnostics };
}

/** Parse a Blueprint or GtkBuilder document into its top-level widget trees. */
export function blueprintToNodes(code: string): AdwNode[] {
  return blueprintImport(code).roots;
}

/** Backwards-compatible single-root import API. */
export function blueprintToNode(code: string): AdwNode {
  return blueprintToNodes(code)[0];
}

/** Import all top-level widgets as editable screens in a Protota document. */
/**
 * Adw.MultiLayoutView shows one Adw.Layout at a time; every Adw.LayoutSlot in
 * that layout renders the sibling child whose slot name (or builder ID)
 * matches. Project the first declared layout — libadwaita's default — and
 * substitute its slots with the named children.
 */
function resolveMultiLayoutViews(node: AdwNode): void {
  node.children?.forEach(resolveMultiLayoutViews);
  if (node.sourceClass !== 'Adw.MultiLayoutView' || !node.children?.length) return;
  const layouts = node.children.filter(child => child.sourceClass === 'Adw.Layout');
  if (!layouts.length) return;
  const fillers = node.children.filter(child => child.sourceClass !== 'Adw.Layout');
  const active = structuredClone(layouts[0]);
  const substitute = (host: AdwNode): void => {
    if (!host.children) return;
    host.children = host.children.map(child => {
      if (child.sourceClass === 'Adw.LayoutSlot') {
        const slotName = String(child.id ?? '');
        const filler = fillers.find(candidate => candidate.slot === slotName || candidate.id === slotName);
        if (filler) return { ...filler, slot: child.slot };
        return child;
      }
      substitute(child);
      return child;
    });
  };
  substitute(active);
  node.children = active.children ?? [];
  delete node.sourceClass;
}

/**
 * Resolve `visible: bind <widget-id>.visible [inverted]` against the referenced
 * widget's declared visibility. GTK widgets are visible unless the source says
 * otherwise, so a pair of mutually exclusive buttons (one bound to the
 * inverse of the other) renders as the one the app shows first — real static
 * evidence, not a guess about runtime state.
 */
function resolveWidgetVisibilityBindings(root: AdwNode): void {
  const byId = new Map<string, AdwNode>();
  const index = (node: AdwNode) => { byId.set(node.id, node); node.children?.forEach(index); };
  index(root);

  const apply = (node: AdwNode) => {
    const expression = node.bindings?.visible;
    const reference = expression ? /^([A-Za-z_][A-Za-z0-9_]*)\.visible(\s+inverted)?$/.exec(expression) : null;
    const target = reference ? byId.get(reference[1]) : null;
    if (reference && target && node.visible === undefined) {
      const targetVisible = target.visible !== false;
      node.visible = reference[2] ? !targetVisible : targetVisible;
    }
    node.children?.forEach(apply);
  };
  apply(root);
}

export function blueprintToDocument(code: string, title = 'Imported GNOME App'): MockupDocument {
  const { roots: allRoots, diagnostics } = blueprintImport(code);
  // Real UI files declare popovers, panels, and helper widgets as siblings of
  // the window; when a window-like root exists, it is the document's screen.
  const windowRoots = allRoots.filter(root =>
    root.type === 'window' || root.type === 'dialog' || root.type === 'preferences-dialog' || root.type === 'about-dialog');
  const roots = windowRoots.length ? windowRoots : allRoots;
  roots.forEach(resolveMultiLayoutViews);
  roots.forEach(resolveWidgetVisibilityBindings);
  const inferType = (root: AdwNode): ScreenTemplateType => root.type === 'preferences-dialog' ? 'preferences' : root.type === 'dialog' ? 'dialog' : 'standard';
  // Screen geometry comes from the source's own declaration when it has one
  // (default-width on windows, content-width on the Adw.Dialog family) —
  // this is also what carries an edited screen size across the Blueprint
  // persistence round trip.
  const dimension = (value: unknown): number | undefined =>
    typeof value === 'number' && value > 0 ? value : undefined;
  const screens: Screen[] = roots.map((root, index) => {
    const width = dimension(root.defaultWidth) ?? dimension(root.contentWidth) ?? 1024;
    const height = dimension(root.defaultHeight) ?? dimension(root.contentHeight) ?? 720;
    // The size properties are transport for Screen.width/height: once
    // consumed they leave the node, so the document diff (write-back #80)
    // never mistakes the exporter's re-injection for a user edit.
    delete root.defaultWidth;
    delete root.defaultHeight;
    delete root.contentWidth;
    delete root.contentHeight;
    return {
      id: `imported-screen-${index + 1}`,
      title: String(root.title || `${title} ${index + 1}`),
      type: inferType(root),
      width,
      height,
      rootNode: root,
    };
  });
  // A breakpoint setter that names an id the import did not keep can never
  // apply; surface that as a diagnostic instead of silently ignoring it.
  const keptIds = new Set<string>();
  const indexIds = (node: AdwNode) => { keptIds.add(node.id); node.children?.forEach(indexIds); };
  roots.forEach(indexIds);
  const reportMissing = (node: AdwNode) => {
    for (const setter of node.breakpointSetters ?? []) {
      if (!keptIds.has(setter.target)) {
        diagnostics.push({
          code: 'breakpoint-setter-target-missing',
          sourceClass: 'Adw.Breakpoint',
          sourceId: node.id,
          message: `Adw.Breakpoint (${node.breakpointCondition}) sets ${setter.target}.${setter.property}, but no imported widget has id "${setter.target}"; the setter cannot apply.`,
        });
      }
    }
    node.children?.forEach(reportMissing);
  };
  roots.forEach(reportMissing);
  return { id: 'imported-document', title, colorScheme: 'auto', edges: [], screens, importDiagnostics: diagnostics };
}

export interface BlueprintSourceFile {
  path: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Host-side write-back helpers (scripts/protota-writeback.mjs)
//
// The write-back CLI patches property values and splices subtrees into an
// app's own Blueprint files. It reuses the exporter's single source of truth
// for property spelling, value formatting, and slot emission, so a patched
// file and a fully exported file can never disagree about syntax.
// ---------------------------------------------------------------------------

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

/**
 * Emit one node (and its subtree) as Blueprint source at the given indent
 * depth, including its slot decoration — `[top]` annotation or
 * `slot: Class { … };` object-valued property — exactly as the full exporter
 * would place a child of `parentClassName`.
 */
export function blueprintChildSource(node: AdwNode, depth: number, parentClassName?: string): string {
  const knownIds = new Set<string>();
  const idMap = new Map<AdwNode, string>();
  const usedIds = new Set<string>();
  const collect = (candidate: AdwNode) => {
    if (candidate.id) { knownIds.add(candidate.id); usedIds.add(candidate.id); idMap.set(candidate, candidate.id); }
    candidate.children?.forEach(collect);
  };
  collect(node);
  const context: ExportContext = { knownIds, usedIds, idMap, renames: new Map(), standalone: false };
  const body = nodeToBlueprint(node, depth, context);
  if (!node.slot) return body;
  if (ANNOTATION_SLOTS.has(node.slot)) return `${indent(depth)}[${node.slot}]\n${body}`;
  const parentProperties = parentClassName && !parentClassName.startsWith('$') ? propertiesOf(parentClassName) : null;
  let slotName = node.slot;
  if (parentProperties && !parentProperties.has(slotName)) {
    const fallback = ['child', 'content'].find((candidate) => parentProperties.has(candidate));
    if (!fallback) return body;
    slotName = fallback;
  }
  const trimmed = body.replace(/^\s+/, '').replace(/\n$/, '');
  return `${indent(depth)}${slotName}: ${trimmed};\n`;
}

interface BlueprintTemplate {
  className: string;
  body: string;
}

function closingBrace(source: string, openingIndex: number): number {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = openingIndex; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (!escaped && character === '"') quoted = false;
      escaped = !escaped && character === '\\';
      continue;
    }
    if (character === '"') { quoted = true; continue; }
    if (character === '{') depth++;
    if (character === '}' && --depth === 0) return index;
  }
  throw new Error('Unclosed Blueprint template body');
}

function collectTemplates(files: BlueprintSourceFile[]): Map<string, BlueprintTemplate> {
  const templates = new Map<string, BlueprintTemplate>();
  const declaration = /template\s+\$([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*([A-Za-z_.][A-Za-z0-9_.-]*)\s*\{/g;
  for (const file of files) {
    for (const match of file.content.matchAll(declaration)) {
      const openingIndex = (match.index || 0) + match[0].lastIndexOf('{');
      const end = closingBrace(file.content, openingIndex);
      templates.set(match[1], { className: match[2], body: file.content.slice(openingIndex + 1, end) });
    }
  }
  return templates;
}

function expandBundleTemplates(source: string, templates: Map<string, BlueprintTemplate>, stack: string[] = []): string {
  const reference = /\$([A-Za-z_][A-Za-z0-9_-]*)\s+([A-Za-z_][A-Za-z0-9_-]*)\s*\{/g;
  return source.replace(reference, (match, name: string, id: string) => {
    const template = templates.get(name);
    if (!template) {
      // Leave the reference in source form; the parser retains it as an
      // explicit custom-widget boundary with its real class and instance ID.
      return match;
    }
    if (stack.includes(name)) throw new Error(`Recursive Blueprint template reference: $${[...stack, name].join(' → $')}`);
    // Inside an inlined body, `template.` refers to this template's class.
    // Qualify it so bindings keep their owner through expansion; inner
    // templates already qualified theirs during their own expansion.
    const body = expandBundleTemplates(template.body, templates, [...stack, name])
      .replace(/\b(bind(?:-property)?)\s+template\./g, `$1 $${name}.`);
    return `${template.className} ${id} {${body}`;
  });
}

/**
 * Vala spellings that make the argument the receiver's sole child slot.
 * `set_parent` is C's spelling of the same fact for a plain GtkWidget
 * subclass: the widget parented directly onto the composite is its content.
 */
const VALA_SELF_CHILD_METHODS = new Set(['set_child', 'set_content', 'child', 'content', 'set_parent']);

function formatBlueprintValue(value: string | number | boolean): string {
  return typeof value === 'string' ? `"${escapeBlueprintString(value)}"` : String(value);
}

/** `styles ["a", "b"]` for a fact target, or the empty string. */
function factStyleClasses(facts: ValaClassFacts, target: string): string {
  const names = (facts.styleClasses ?? [])
    .filter(styleClass => styleClass.target === target)
    .map(styleClass => `"${escapeBlueprintString(styleClass.name)}"`);
  return names.length ? `styles [ ${names.join(', ')} ]` : '';
}

/**
 * Project a code-defined composite as Blueprint source, using only the
 * construction facts a language adapter discovered: the widget installed as
 * the class's own child, the children deterministically inserted into it, and
 * their literal properties. Classes whose declarative template exists in the
 * bundle are emitted as `$Template` references so normal template expansion
 * resolves their contents; everything else stays a boundary.
 */
function valaCompositeSnippet(
  facts: ValaClassFacts,
  templates: Map<string, BlueprintTemplate>,
): { snippet: string; projectedBaseClass?: string } | null {
  const emitVariable = (variable: string): string | null => {
    const constructedClass = facts.constructions[variable];
    if (!constructedClass) return null;
    // A popover parented in code is a popup surface allocated above the
    // window, invisible until opened — the same reason the declarative
    // parser filters `popover`-slot children out of the layout tree.
    if (/Popover/.test(constructedClass)) return null;
    const short = constructedClass.split('.').pop() ?? constructedClass;
    if (templates.has(short)) return `$${short} ${variable} {}`;
    const properties = facts.propertyAssignments
      .filter(assignment => assignment.target === variable)
      .map(assignment => `${assignment.property.replace(/_/g, '-')}: ${formatBlueprintValue(assignment.value)};`)
      .join(' ');
    const styles = factStyleClasses(facts, variable);
    const children = facts.insertions
      .filter(insertion => insertion.parent === variable)
      .map(insertion => emitVariable(insertion.child))
      .filter(Boolean)
      .join(' ');
    if (CLASS_TO_WIDGET_MAP[constructedClass] || CLASS_TO_WIDGET_MAP[short]) {
      return `${constructedClass} ${variable} { ${properties} ${styles} ${children} }`;
    }
    // A nested code-defined class stays a boundary here; the enrichment walk
    // revisits it with its own facts.
    return `$${short} ${variable} {}`;
  };

  // A single self-installed child is the composite's whole content (the
  // FullscreenBox/DragOverlay wrapper shape). With *several* self-installed
  // children and a renderable declared base, the base projection below keeps
  // all of them — an Overlay composite's set_child main child plus its
  // add_overlay layers — where the sole-child shortcut would drop siblings.
  const selfInsertions = facts.insertions.filter(insertion => insertion.parent === 'this');
  // The same gate the base projection itself applies: a plain Gtk.Widget base
  // names a custom-drawn widget and proves nothing renderable.
  const canonicalDeclaredBase = facts.baseClass ? canonicalClassName(facts.baseClass) : null;
  const baseIsRenderable = Boolean(
    !facts.overridesSnapshot
    && canonicalDeclaredBase && canonicalDeclaredBase !== 'Gtk.Widget' && canonicalDeclaredBase !== 'Widget'
    && CLASS_TO_WIDGET_MAP[canonicalDeclaredBase],
  );
  if (!(selfInsertions.length > 1 && baseIsRenderable)) {
    for (const insertion of selfInsertions) {
      if (!VALA_SELF_CHILD_METHODS.has(insertion.method)) continue;
      const snippet = emitVariable(insertion.child);
      if (snippet) return { snippet };
    }
  }

  // No sole-child root, but the composite may *be* its declared base widget:
  // `struct _EditorPreferencesSwitch { AdwActionRow row; … }` adds a switch
  // suffix to itself in init. Projecting the base class with the code-added
  // children is a construction fact, not a guess — gated on the base being a
  // real renderable library class. A plain Gtk.Widget base names a
  // custom-drawn widget and proves nothing renderable, so it is excluded.
  const base = facts.baseClass;
  if (!base) return null;
  // A snapshot-overriding class paints itself: its base-class chrome is not
  // its appearance, so it stays an honest boundary (GcalWeekHourBar draws
  // hour lines over the labels its GtkBox base carries).
  if (facts.overridesSnapshot) return null;
  const canonicalBase = canonicalClassName(base);
  if (canonicalBase === 'Gtk.Widget' || canonicalBase === 'Widget' || !CLASS_TO_WIDGET_MAP[canonicalBase]) return null;
  const selfChildren = facts.insertions
    .filter(insertion => insertion.parent === 'this')
    .map(insertion => {
      const body = emitVariable(insertion.child);
      if (!body) return null;
      // adw_action_row_add_suffix places its child in the `[suffix]` slot.
      const slot = insertion.method.replace(/^(add|set)_/, '');
      return ANNOTATION_SLOTS.has(slot) ? `[${slot}] ${body}` : body;
    })
    .filter(Boolean)
    .join(' ');
  // A chromeless container base with no discovered children would project as
  // an empty box that renders nothing — a boundary silently erased, when the
  // subclass almost certainly populates itself at runtime. A base that draws
  // its own chrome (a row, an entry) is that widget even when empty.
  const CHROMELESS_CONTAINER_TYPES = new Set([
    'bin', 'box', 'grid', 'center-box', 'clamp', 'stack', 'scrolled-window', 'overlay',
    'list-box', 'wrap-box', 'overlay-split', 'toolbar-view',
  ]);
  if (!selfChildren && CHROMELESS_CONTAINER_TYPES.has(CLASS_TO_WIDGET_MAP[canonicalBase])) return null;
  const selfProperties = facts.propertyAssignments
    .filter(assignment => assignment.target === 'this')
    .map(assignment => `${assignment.property.replace(/_/g, '-')}: ${formatBlueprintValue(assignment.value)};`)
    .join(' ');
  return {
    snippet: `${canonicalBase} { ${selfProperties} ${factStyleClasses(facts, 'this')} ${selfChildren} }`,
    projectedBaseClass: canonicalBase,
  };
}

/**
 * C insertion calls carry their full symbol (`adw_action_row_add_suffix`);
 * the enrichment engine reasons in Vala's short spellings (`add_suffix`).
 */
const C_METHOD_SUFFIXES = [
  'set_parent', 'set_child', 'set_content', 'add_suffix', 'add_prefix',
  'add_overlay', 'add_top_bar', 'add_bottom_bar', 'add_named', 'add_titled',
  'add_child', 'append', 'prepend', 'attach', 'set_start_widget',
  'set_end_widget', 'set_title_widget', 'set_extra_child',
];
function shortCMethod(method: string): string {
  return C_METHOD_SUFFIXES.find(suffix => method === suffix || method.endsWith(`_${suffix}`)) ?? method;
}

/**
 * C and Vala describe construction differently but yield the same *facts*, so
 * both feed one enrichment engine rather than two parallel implementations.
 * Only the extraction is language-specific.
 */
function valaShapeOfCFacts(facts: CClassFacts): ValaClassFacts {
  return {
    className: facts.className,
    baseClass: facts.baseClass,
    templateResource: facts.templateResource,
    // C has no declared-default syntax; the template is the source of truth.
    propertyDefaults: {},
    constructions: facts.constructions,
    insertions: facts.insertions.map(insertion => ({ ...insertion, method: shortCMethod(insertion.method) })),
    propertyAssignments: facts.propertyAssignments,
    styleClasses: facts.styleClasses,
    overridesSnapshot: facts.overridesSnapshot,
  };
}

/**
 * Phase 4 static enrichment: give code-defined boundaries their statically
 * discoverable contents. Structural only — facts come from language syntax,
 * never from application names or invented widgets.
 */
function enrichWithValaFacts(doc: MockupDocument, valaFiles: BlueprintSourceFile[], templates: Map<string, BlueprintTemplate>, cFiles: BlueprintSourceFile[] = [], pythonFiles: BlueprintSourceFile[] = []): void {
  const factsByClass = new Map<string, ValaClassFacts>();
  for (const file of valaFiles) {
    for (const facts of extractValaFacts(file.content)) factsByClass.set(facts.className, facts);
  }
  for (const file of cFiles) {
    for (const facts of extractCFacts(file.content)) {
      // A Vala definition wins if an app somehow has both.
      if (!factsByClass.has(facts.className)) {
        factsByClass.set(facts.className, valaShapeOfCFacts(facts));
      }
    }
  }
  for (const file of pythonFiles) {
    for (const facts of extractPythonFacts(file.content)) {
      if (!factsByClass.has(facts.className)) factsByClass.set(facts.className, facts);
    }
  }
  if (!factsByClass.size) return;

  /**
   * A subclass of another *app-defined* class inherits that ancestor's
   * construction facts: the ancestor's init runs for every instance, so its
   * constructions/insertions are source evidence for the subclass too
   * (EartagTagEditableLabel extends EartagEditableLabel, which builds an
   * entry+label overlay). The chain resolves until a library base class.
   */
  const resolveBaseChain = (facts: ValaClassFacts, guard: ReadonlySet<string>): ValaClassFacts => {
    const base = facts.baseClass;
    if (!base || guard.has(facts.className)) return facts;
    const ancestor = factsByClass.get(base) ?? factsByClass.get(base.split('.').pop() ?? base);
    if (!ancestor || ancestor === facts) return facts;
    const resolved = resolveBaseChain(ancestor, new Set([...guard, facts.className]));
    return {
      ...facts,
      baseClass: resolved.baseClass,
      overridesSnapshot: facts.overridesSnapshot || resolved.overridesSnapshot,
      templateResource: facts.templateResource ?? resolved.templateResource,
      propertyDefaults: { ...resolved.propertyDefaults, ...facts.propertyDefaults },
      constructions: { ...resolved.constructions, ...facts.constructions },
      insertions: [...resolved.insertions, ...facts.insertions],
      propertyAssignments: [...resolved.propertyAssignments, ...facts.propertyAssignments],
      styleClasses: [...(resolved.styleClasses ?? []), ...(facts.styleClasses ?? [])],
    };
  };
  const diagnostics = doc.importDiagnostics ?? (doc.importDiagnostics = []);

  const expandNode = (node: AdwNode, seen: ReadonlySet<string>): void => {
    node.children?.forEach(child => expandNode(child, seen));
    if (node.type !== 'custom-widget' || !node.sourceClass || node.children?.length) return;
    const declaredFacts = factsByClass.get(node.sourceClass);
    if (!declaredFacts || seen.has(node.sourceClass)) return;
    const facts = resolveBaseChain(declaredFacts, new Set());
    // Expand flags set in code are geometry evidence for the boundary itself.
    for (const assignment of facts.propertyAssignments) {
      if (assignment.target !== 'this' || assignment.value !== true) continue;
      const projectFromCode = (property: 'vexpand' | 'hexpand') => {
        node[property] = true;
        // Record that code, not the declarative source, produced this fact so
        // the boundary's geometry audit trail (#55) names the right layer.
        (node.geometryOrigin ??= {})[property] = 'code';
      };
      if (assignment.property === 'vexpand' || assignment.property === 'vexpand_set') projectFromCode('vexpand');
      if (assignment.property === 'hexpand' || assignment.property === 'hexpand_set') projectFromCode('hexpand');
    }
    const projection = valaCompositeSnippet(facts, templates);
    if (!projection) return;
    const childDiagnostics: ImportDiagnostic[] = [];
    const roots = parseBlueprintRoots(expandBundleTemplates(projection.snippet, templates), childDiagnostics);
    if (!roots.length) return;
    if (projection.projectedBaseClass) {
      // The composite *is* its declared base widget. The node becomes that
      // widget — declared source properties (title, subtitle, visibility)
      // win over code facts — and stops being an unresolved boundary. Child
      // ids are namespaced per instance: eleven preference rows must not
      // share a `toggle`.
      const projected = roots[0];
      const namespaceIds = (child: AdwNode): void => {
        // Browser persistence immediately exports enriched documents back to
        // Blueprint. Keep generated ids inside Blueprint's identifier grammar;
        // a hyphen tokenizes as subtraction and made the app disappear on reload.
        child.id = `${node.id}_${child.id}`.replace(/[^A-Za-z0-9_]/g, '_');
        if (/^[0-9]/.test(child.id)) child.id = `node_${child.id}`;
        child.children?.forEach(namespaceIds);
      };
      projected.children?.forEach(namespaceIds);
      node.type = projected.type;
      node.children = projected.children ?? [];
      if (node.title === node.sourceClass) delete node.title;
      for (const [key, value] of Object.entries(projected)) {
        if (key === 'id' || key === 'slot' || key === 'children' || key === 'type' || node[key] !== undefined) continue;
        node[key] = value;
      }
    } else {
      node.children = roots;
    }
    diagnostics.push(...childDiagnostics, {
      code: 'static-source-expansion',
      sourceClass: node.sourceClass,
      sourceId: node.id,
      message: projection.projectedBaseClass
        ? `${node.sourceClass} is a code-defined subclass of ${projection.projectedBaseClass}; resolved to its base widget with its code-constructed children.`
        : `${node.sourceClass} composite discovered from Vala construction facts; contents projected from declarative templates in the source bundle.`,
    });
    const nested = new Set(seen);
    nested.add(node.sourceClass);
    (node.children ?? []).forEach(child => expandNode(child, nested));
  };

  // A binding to a template property with a declared literal default has a
  // statically known initial value. Projecting it (e.g. `visible: bind
  // $Class.box-visible` with `default = false`) is source evidence, not a
  // guess; runtime state changes stay out of reach until a runtime profile.
  const resolveBindingDefaults = (node: AdwNode): void => {
    for (const [property, expression] of Object.entries(node.bindings ?? {})) {
      const reference = /^\$([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9_-]+)(\s+inverted)?$/.exec(expression);
      if (!reference) continue;
      const owner = factsByClass.get(reference[1]);
      const declaredDefault = owner?.propertyDefaults[reference[2].replace(/-/g, '_')];
      if (typeof declaredDefault !== 'boolean') continue;
      const value = reference[3] ? !declaredDefault : declaredDefault;
      if (property === 'visible' && node.visible === undefined) node.visible = value;
    }
    node.children?.forEach(resolveBindingDefaults);
  };

  doc.screens.forEach(screen => expandNode(screen.rootNode, new Set()));
  doc.screens.forEach(screen => resolveBindingDefaults(screen.rootNode));
  // An expanded composite is no longer an unresolved boundary.
  const expandedKeys = new Set(
    diagnostics.filter(d => d.code === 'static-source-expansion').map(d => `${d.sourceClass}:${d.sourceId}`),
  );
  doc.importDiagnostics = diagnostics.filter(d => !(
    (d.code === 'template-not-in-bundle' || d.code === 'renderer-does-not-support-class') &&
    expandedKeys.has(`${d.sourceClass}:${d.sourceId}`)
  ));
}

/**
 * Import an official app's declarative UI bundle. The entry source is expanded
 * only through templates declared in the supplied files. Optional Vala sources
 * enrich code-defined boundaries with statically discoverable structure;
 * everything else remains an explicit boundary rather than an invented visual
 * stand-in.
 */
export function blueprintBundleToDocument(files: BlueprintSourceFile[], entryPath: string, title?: string): MockupDocument {
  const declarativeFiles = files.filter(file => /\.(blp|ui)$/i.test(file.path));
  const valaFiles = files.filter(file => /\.vala$/i.test(file.path));
  const cFiles = files.filter(file => /\.c$/i.test(file.path));
  const pythonFiles = files.filter(file => /\.py$/i.test(file.path));
  const entry = declarativeFiles.find(file => file.path === entryPath || file.path.endsWith(`/${entryPath}`));
  if (!entry) throw new Error(`Blueprint entry file not found in source bundle: ${entryPath}`);
  const templates = collectTemplates(declarativeFiles);
  const documentTitle = title || entry.path.replace(/^.*\//, '').replace(/\.(blp|ui)$/i, '');
  let doc: MockupDocument;
  let builderTemplates: Map<string, AdwNode> | null = null;
  // A resolved composite instance is no longer an unresolved boundary,
  // whichever boundary code the parse assigned it.
  const resolveBuilderPass = () => {
    if (!builderTemplates?.size) return;
    const diagnostics = doc.importDiagnostics ?? (doc.importDiagnostics = []);
    const resolvedKeys = new Set<string>();
    doc.screens.forEach(screen => resolveBuilderTemplates(screen.rootNode, builderTemplates!, new Set(), resolvedKeys));
    doc.importDiagnostics = diagnostics.filter(d => d.code === 'static-source-expansion' || !resolvedKeys.has(`${d.sourceClass}:${d.sourceId}`));
  };
  if (/\.ui$/i.test(entry.path)) {
    // GtkBuilder bundle: parse the entry, then resolve composite-template
    // instances against <template> definitions from the other .ui files.
    doc = blueprintToDocument(entry.content, documentTitle);
    builderTemplates = collectBuilderTemplates(declarativeFiles.filter(file => file !== entry), doc.importDiagnostics ?? (doc.importDiagnostics = []));
    resolveBuilderPass();
  } else {
    doc = blueprintToDocument(expandBundleTemplates(entry.content, templates), documentTitle);
  }
  if (valaFiles.length || cFiles.length || pythonFiles.length) {
    enrichWithValaFacts(doc, valaFiles, templates, cFiles, pythonFiles);
    // Enrichment can introduce boundaries whose classes are .ui templates.
    resolveBuilderPass();
  }
  // Template resolution and enrichment can introduce MultiLayoutView bodies.
  doc.screens.forEach(screen => resolveMultiLayoutViews(screen.rootNode));
  return doc;
}
