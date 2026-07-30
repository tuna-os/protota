import type { MockupDocument, AdwNode, AdwNodeType, ImportDiagnostic, Screen, ScreenTemplateType } from '../types/mockup';
import { extractValaFacts, type ValaClassFacts } from './vala';

export type { ImportDiagnostic } from '../types/mockup';

const CLASS_TO_WIDGET_MAP: Record<string, AdwNodeType> = {
  'Adw.ApplicationWindow': 'window',
  'Adw.Window': 'window',
  'Adw.PreferencesDialog': 'preferences-dialog',
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
  'Adw.StatusPage': 'status-page',
  'Adw.ToastOverlay': 'toast-overlay',
  'Adw.Banner': 'banner',
  'Adw.Spinner': 'spinner',
  'Gtk.FlowBox': 'flow-box',
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
  AdwOverlaySplitView: 'overlay-split',
  AdwPreferencesPage: 'preferences-page',
  AdwPreferencesGroup: 'preferences-group',
  GtkButton: 'button',
  GtkEntry: 'entry',
  GtkBox: 'box',
  GtkGrid: 'grid',
  GtkStack: 'stack',
  GtkStackPage: 'stack-page',
  GtkScrolledWindow: 'scrolled-window',
  GtkLabel: 'label',
  GtkListBox: 'list-box',
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
  Label: 'label',
  Image: 'bin',
  GtkImage: 'bin',
  'Gtk.Image': 'bin',
  // Library widgets the generic renderer genuinely covers. Widgets it does
  // not (AdwTabBar's tab strip, GtkLevelBar's meter) stay explicit
  // boundaries rather than rendering as an empty box that claims support.
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
  Overlay: 'bin',
  GtkOverlay: 'bin',
  'Gtk.Overlay': 'bin',
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
};

/**
 * Source objects that occupy no layout allocation: gestures, controllers,
 * shortcuts, models, and popup surfaces. They belong to the source, but they
 * must not receive renderer boxes or count as unresolved visual coverage.
 */
const NON_VISUAL_CLASS_PATTERN =
  /^(Gtk\.|Gio\.|Adw\.)?(EventController[A-Za-z]*|Gesture[A-Za-z]*|ShortcutController|Shortcut|DropTarget|DragSource|Adjustment|TextBuffer|EntryBuffer|Tooltip|StringList|ListStore|SizeGroup|FileFilter|SortListModel|FilterListModel|SingleSelection|MultiSelection|NoSelection|SignalListItemFactory|BuilderListItemFactory|Breakpoint)$/;

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

function indent(n: number): string { return '  '.repeat(n); }

function escapeBlueprintString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function nodeToBlueprint(node: AdwNode, depth: number = 0): string {
  // An unresolved boundary exports as its real source reference. Replacing
  // `$MathButtons` with a Protota-invented class would corrupt the app source.
  const className = node.type === 'custom-widget' && node.sourceClass
    ? `$${node.sourceClass}`
    : WIDGET_CLASS_MAP[node.type] || node.type;
  const props: string[] = [];

  // A source-referenced boundary exports as its reference alone. Its children
  // and expand flags are Protota's projection of code the app owns; writing
  // them back would flatten the app's source.
  const isSourceReference = node.type === 'custom-widget' && !!node.sourceClass;

  for (const [k, v] of Object.entries(node)) {
    if (k === 'id' || k === 'type' || k === 'slot' || k === 'children' || k === 'sourceClass' || k === 'bindings' || v === undefined || v === false || v === '') continue;
    if (isSourceReference && (k === 'vexpand' || k === 'hexpand')) continue;
    if (k === 'title' && node.type === 'custom-widget' && v === node.sourceClass) continue;
    if (k === 'title' && (node.type === 'button' || node.type === 'label')) {
      props.push(`label: "${escapeBlueprintString(String(v))}";`);
    } else if (typeof v === 'boolean') {
      props.push(`${k}: ${v};`);
    } else if (typeof v === 'number') {
      props.push(`${k}: ${v};`);
    } else {
      props.push(`${k}: "${escapeBlueprintString(String(v))}";`);
    }
  }
  for (const [k, expression] of Object.entries(node.bindings ?? {})) {
    props.push(`${k}: bind ${expression};`);
  }

  const children = (isSourceReference ? [] : node.children || []).map(child => {
    if (!child.slot) return nodeToBlueprint(child, depth + 1);
    return `${indent(depth + 1)}${child.slot} {\n` +
      nodeToBlueprint(child, depth + 2) +
      `${indent(depth + 1)}}\n`;
  });
  const idStr = node.id ? ` ${node.id}` : '';

  if (children.length === 0 && props.length === 0) {
    return `${indent(depth)}${className}${idStr} {}\n`;
  }

  return `${indent(depth)}${className}${idStr} {\n` +
    props.map(p => `${indent(depth + 1)}${p}\n`).join('') +
    children.join('') +
    `${indent(depth)}}\n`;
}

export function mockupToBlueprint(doc: MockupDocument): string {
  return 'using Gtk 4.0;\nusing Adw 1;\n\n' +
    doc.screens.map(s => nodeToBlueprint(s.rootNode)).join('\n');
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

function propertyNameForNode(name: string, nodeType: AdwNodeType): string {
  // GtkBuilder accepts underscore and dash spellings interchangeably.
  const rawName = name.replace(/_/g, '-');
  if ((rawName === 'label' || rawName === 'text') && (nodeType === 'button' || nodeType === 'toggle' || nodeType === 'label' || nodeType === 'inscription' || nodeType === 'menu-button' || nodeType === 'split-button')) return 'title';
  if (rawName === 'icon-name') return 'iconName';
  if (rawName === 'show-title-buttons') return 'showTitleButtons';
  if (rawName === 'selected') return 'selectedIndex';
  return rawName.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** GtkBuilder spells classes as GObject names (`AdwActionRow`); Blueprint as
 * namespaced names (`Adw.ActionRow`). Both resolve to one canonical entry. */
function canonicalClassName(rawClass: string): string {
  const gobject = /^(Adw|Gtk|GtkSource|Gio)([A-Z][A-Za-z0-9]*)$/.exec(rawClass);
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
  const type = CLASS_TO_WIDGET_MAP[sourceClass] ?? CLASS_TO_WIDGET_MAP[canonicalClassName(sourceClass)];
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
  // MultiLayoutView machinery keeps its identity for slot resolution.
  const canonical = canonicalClassName(sourceClass);
  if (canonical === 'Adw.MultiLayoutView' || canonical === 'Adw.Layout' || canonical === 'Adw.LayoutSlot' || canonical === 'Adw.ButtonContent') {
    node.sourceClass = canonical;
  }
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

    while (cursor < tokens.length && tokens[cursor].value !== '}') {
      const key = tokens[cursor];

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
        if (child) children.push(child);
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
    return makeNode(rawClass, id, properties, bindings, children, diagnostics);
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

  for (const child of element.children) {
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
      for (const styleClass of child.children) {
        const name = styleClass.attributes.name;
        if (name === 'suggested-action') properties.suggested = true;
        if (name === 'destructive-action') properties.destructive = true;
        if (name === 'flat') properties.flat = true;
        if (name === 'circular') properties.circular = true;
      }
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
  return makeNode(rawClass, id, properties, bindings, children, diagnostics);
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
  const screens: Screen[] = roots.map((root, index) => ({
    id: `imported-screen-${index + 1}`,
    title: String(root.title || `${title} ${index + 1}`),
    type: inferType(root),
    width: 1024,
    height: 720,
    rootNode: root,
  }));
  return { id: 'imported-document', title, colorScheme: 'auto', edges: [], screens, importDiagnostics: diagnostics };
}

export interface BlueprintSourceFile {
  path: string;
  content: string;
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

/** Vala spellings that make the argument the receiver's sole child slot. */
const VALA_SELF_CHILD_METHODS = new Set(['set_child', 'set_content', 'child', 'content']);

function formatBlueprintValue(value: string | number | boolean): string {
  return typeof value === 'string' ? `"${escapeBlueprintString(value)}"` : String(value);
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
): string | null {
  const rootInsertion = facts.insertions.find(insertion => insertion.parent === 'this' && VALA_SELF_CHILD_METHODS.has(insertion.method));
  if (!rootInsertion) return null;
  const emitVariable = (variable: string): string | null => {
    const constructedClass = facts.constructions[variable];
    if (!constructedClass) return null;
    const short = constructedClass.split('.').pop() ?? constructedClass;
    if (templates.has(short)) return `$${short} ${variable} {}`;
    const properties = facts.propertyAssignments
      .filter(assignment => assignment.target === variable)
      .map(assignment => `${assignment.property.replace(/_/g, '-')}: ${formatBlueprintValue(assignment.value)};`)
      .join(' ');
    const children = facts.insertions
      .filter(insertion => insertion.parent === variable)
      .map(insertion => emitVariable(insertion.child))
      .filter(Boolean)
      .join(' ');
    if (CLASS_TO_WIDGET_MAP[constructedClass] || CLASS_TO_WIDGET_MAP[short]) {
      return `${constructedClass} ${variable} { ${properties} ${children} }`;
    }
    // A nested code-defined class stays a boundary here; the enrichment walk
    // revisits it with its own facts.
    return `$${short} ${variable} {}`;
  };
  return emitVariable(rootInsertion.child);
}

/**
 * Phase 4 static enrichment: give code-defined boundaries their statically
 * discoverable contents. Structural only — facts come from language syntax,
 * never from application names or invented widgets.
 */
function enrichWithValaFacts(doc: MockupDocument, valaFiles: BlueprintSourceFile[], templates: Map<string, BlueprintTemplate>): void {
  const factsByClass = new Map<string, ValaClassFacts>();
  for (const file of valaFiles) {
    for (const facts of extractValaFacts(file.content)) factsByClass.set(facts.className, facts);
  }
  if (!factsByClass.size) return;
  const diagnostics = doc.importDiagnostics ?? (doc.importDiagnostics = []);

  const expandNode = (node: AdwNode, seen: ReadonlySet<string>): void => {
    node.children?.forEach(child => expandNode(child, seen));
    if (node.type !== 'custom-widget' || !node.sourceClass || node.children?.length) return;
    const facts = factsByClass.get(node.sourceClass);
    if (!facts || seen.has(node.sourceClass)) return;
    // Expand flags set in code are geometry evidence for the boundary itself.
    for (const assignment of facts.propertyAssignments) {
      if (assignment.target !== 'this' || assignment.value !== true) continue;
      if (assignment.property === 'vexpand' || assignment.property === 'vexpand_set') node.vexpand = true;
      if (assignment.property === 'hexpand' || assignment.property === 'hexpand_set') node.hexpand = true;
    }
    const snippet = valaCompositeSnippet(facts, templates);
    if (!snippet) return;
    const childDiagnostics: ImportDiagnostic[] = [];
    const roots = parseBlueprintRoots(expandBundleTemplates(snippet, templates), childDiagnostics);
    if (!roots.length) return;
    node.children = roots;
    diagnostics.push(...childDiagnostics, {
      code: 'static-source-expansion',
      sourceClass: node.sourceClass,
      sourceId: node.id,
      message: `${node.sourceClass} composite discovered from Vala construction facts; contents projected from declarative templates in the source bundle.`,
    });
    const nested = new Set(seen);
    nested.add(node.sourceClass);
    roots.forEach(child => expandNode(child, nested));
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
  doc.importDiagnostics = diagnostics.filter(d => !(d.code === 'template-not-in-bundle' && expandedKeys.has(`${d.sourceClass}:${d.sourceId}`)));
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
  if (valaFiles.length) {
    enrichWithValaFacts(doc, valaFiles, templates);
    // Enrichment can introduce boundaries whose classes are .ui templates.
    resolveBuilderPass();
  }
  // Template resolution and enrichment can introduce MultiLayoutView bodies.
  doc.screens.forEach(screen => resolveMultiLayoutViews(screen.rootNode));
  return doc;
}
