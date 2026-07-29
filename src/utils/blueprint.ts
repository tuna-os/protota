import type { MockupDocument, AdwNode } from '../types/mockup';

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
  'center-box': 'Gtk.CenterBox',
  'search-entry': 'Gtk.SearchEntry',
  'switch-widget': 'Gtk.Switch',
  'check-button': 'Gtk.CheckButton',
  'list-box': 'Gtk.ListBox',
  label: 'Gtk.Label',
  inscription: 'Gtk.Inscription',
};

function indent(n: number): string { return '  '.repeat(n); }

function nodeToBlueprint(node: AdwNode, depth: number = 0): string {
  const className = WIDGET_CLASS_MAP[node.type] || node.type;
  const props: string[] = [];

  for (const [k, v] of Object.entries(node)) {
    if (k === 'id' || k === 'type' || k === 'children' || v === undefined || v === false || v === '') continue;
    if (k === 'title' && (node.type === 'button' || node.type === 'label')) {
      props.push(`label: "${v}";`);
    } else if (typeof v === 'boolean') {
      props.push(`${k}: ${v};`);
    } else if (typeof v === 'number') {
      props.push(`${k}: ${v};`);
    } else {
      props.push(`${k}: "${v}";`);
    }
  }

  const children = (node.children || []).map(c => nodeToBlueprint(c, depth + 1));
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
