import type { MockupDocument, AdwNode, AdwNodeType, Screen, ScreenTemplateType } from '../types/mockup';

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
  'Adw.TabView': 'tab-view',
  'Adw.OverlaySplitView': 'overlay-split',
  'Adw.Clamp': 'clamp',
  'Adw.Bin': 'bin',
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
  Button: 'button',
  ToggleButton: 'toggle',
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
  GtkLabel: 'label',
  GtkListBox: 'list-box',
};

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
  'search-entry': 'Gtk.SearchEntry',
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
  const className = WIDGET_CLASS_MAP[node.type] || node.type;
  const props: string[] = [];

  for (const [k, v] of Object.entries(node)) {
    if (k === 'id' || k === 'type' || k === 'slot' || k === 'children' || v === undefined || v === false || v === '') continue;
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

  const children = (node.children || []).map(child => {
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
  const withoutComments = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const tokens: Token[] = [];
  const pattern = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_.-]*|[{}:;,]/g;
  for (const match of withoutComments.matchAll(pattern)) {
    const value = match[0];
    tokens.push({
      value,
      kind: value.startsWith('"') ? 'string' : /^-?\d/.test(value) ? 'number' : /^[{}:;,]$/.test(value) ? 'punct' : 'word',
    });
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

function propertyNameForNode(rawName: string, nodeType: AdwNodeType): string {
  if ((rawName === 'label' || rawName === 'text') && (nodeType === 'button' || nodeType === 'toggle' || nodeType === 'label' || nodeType === 'inscription')) return 'title';
  if (rawName === 'icon-name') return 'iconName';
  if (rawName === 'show-title-buttons') return 'showTitleButtons';
  if (rawName === 'selected') return 'selectedIndex';
  return rawName.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function makeNode(rawClass: string, id: string, properties: Record<string, BlueprintValue>, children: AdwNode[]): AdwNode {
  const type = CLASS_TO_WIDGET_MAP[rawClass];
  // A silent fallback makes an imported GNOME UI look plausible while being
  // structurally wrong. Treat a missing visual widget mapping as a compiler
  // error so renderer support is added deliberately and generically.
  if (!type) {
    throw new Error(`Unsupported GTK/Libadwaita widget: ${rawClass}`);
  }
  const node: AdwNode = { id, type, children };
  for (const [key, value] of Object.entries(properties)) {
    node[propertyNameForNode(key, type)] = value;
  }
  return node;
}

function parseBlueprintRoots(code: string): AdwNode[] {
  const tokens = tokenizeBlueprint(code);
  let cursor = 0;
  let generatedId = 0;
  const nextId = () => `imported-${++generatedId}`;

  const parseBlock = (): AdwNode[] => {
    const nodes: AdwNode[] = [];
    while (cursor < tokens.length && tokens[cursor].value !== '}') {
      const first = tokens[cursor];
      const second = tokens[cursor + 1];
      const third = tokens[cursor + 2];

      // Gtk/Adw object: `Gtk.Button save_button { ... }`.
      if (first?.kind === 'word' && (first.value.includes('.') || CLASS_TO_WIDGET_MAP[first.value]) && (second?.value === '{' || third?.value === '{')) {
        const rawClass = first.value;
        cursor++;
        const id = tokens[cursor]?.value === '{' ? nextId() : tokens[cursor++]?.value || nextId();
        if (tokens[cursor]?.value !== '{') continue;
        cursor++;
        const properties: Record<string, BlueprintValue> = {};
        const children: AdwNode[] = [];
        while (cursor < tokens.length && tokens[cursor].value !== '}') {
          const key = tokens[cursor];
          if (tokens[cursor + 1]?.value === ':') {
            cursor += 2;
            const value = parseValue(tokens[cursor++]);
            if (value !== undefined) properties[key.value] = value;
            if (tokens[cursor]?.value === ';' || tokens[cursor]?.value === ',') cursor++;
          } else if (key?.value === 'layout' && tokens[cursor + 1]?.value === '{') {
            cursor += 2;
            while (cursor < tokens.length && tokens[cursor]?.value !== '}') {
              const layoutKey = tokens[cursor];
              if (tokens[cursor + 1]?.value === ':') {
                cursor += 2;
                const value = parseValue(tokens[cursor++]);
                if (value !== undefined) properties[layoutKey.value] = value;
                if (tokens[cursor]?.value === ';' || tokens[cursor]?.value === ',') cursor++;
              } else cursor++;
            }
            if (tokens[cursor]?.value === '}') cursor++;
          } else {
            // Delegate the rest of this object body to the regular parser so
            // direct children with an id (`Gtk.Box content {}`) are not
            // mistaken for a named Blueprint slot.
            children.push(...parseBlock());
          }
        }
        if (tokens[cursor]?.value === '}') cursor++;
        nodes.push(makeNode(rawClass, id, properties, children));
        continue;
      }
      nodes.push(...parseBlockItem());
    }
    return nodes;
  };

  const parseBlockItem = (): AdwNode[] => {
    // Slot blocks such as `content { Gtk.Box { ... } }` retain both their
    // widgets and their parent-defined structural role.
    if (tokens[cursor]?.kind === 'word' && tokens[cursor + 1]?.value === '{') {
      const slot = tokens[cursor].value;
      cursor += 2;
      const children = parseBlock();
      if (tokens[cursor]?.value === '}') cursor++;
      return children.map(child => ({ ...child, slot }));
    }
    cursor++;
    return [];
  };

  return parseBlock();
}

function parseGtkBuilderRoots(code: string): AdwNode[] {
  const roots: AdwNode[] = [];
  const stack: AdwNode[] = [];
  let generatedId = 0;
  const addNode = (node: AdwNode) => {
    if (stack.length) (stack[stack.length - 1].children ||= []).push(node);
    else roots.push(node);
    stack.push(node);
  };
  const tagPattern = /<object\s+([^>]+)>|<\/object>|<property\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/property>/g;
  for (const match of code.matchAll(tagPattern)) {
    if (match[0] === '</object>') { stack.pop(); continue; }
    if (match[1]) {
      const className = /class=["']([^"']+)["']/.exec(match[1])?.[1];
      if (!className) continue;
      const id = /id=["']([^"']+)["']/.exec(match[1])?.[1] || `imported-${++generatedId}`;
      addNode(makeNode(className, id, {}, []));
      continue;
    }
    const current = stack[stack.length - 1];
    if (current && match[2]) {
      const raw = match[3].trim();
      const value: BlueprintValue = raw === 'true' ? true : raw === 'false' ? false : /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
      current[propertyNameForNode(match[2], current.type)] = value;
    }
  }
  return roots;
}

/** Parse a Blueprint or GtkBuilder document into its top-level widget trees. */
export function blueprintToNodes(code: string): AdwNode[] {
  const roots = /<object\s/.test(code) ? parseGtkBuilderRoots(code) : parseBlueprintRoots(code);
  if (!roots.length) throw new Error('No GTK or Libadwaita widgets found in the supplied code.');
  return roots;
}

/** Backwards-compatible single-root import API. */
export function blueprintToNode(code: string): AdwNode {
  return blueprintToNodes(code)[0];
}

/** Import all top-level widgets as editable screens in a Protota document. */
export function blueprintToDocument(code: string, title = 'Imported GNOME App'): MockupDocument {
  const roots = blueprintToNodes(code);
  const inferType = (root: AdwNode): ScreenTemplateType => root.type === 'preferences-dialog' ? 'preferences' : root.type === 'dialog' ? 'dialog' : 'standard';
  const screens: Screen[] = roots.map((root, index) => ({
    id: `imported-screen-${index + 1}`,
    title: String(root.title || `${title} ${index + 1}`),
    type: inferType(root),
    width: 1024,
    height: 720,
    rootNode: root,
  }));
  return { id: 'imported-document', title, colorScheme: 'auto', edges: [], screens };
}
