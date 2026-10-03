/**
 * Shared Blueprint codec layer: type mappings, property normalization, value formatting.
 * 
 * This module provides the common encoding/decoding infrastructure for both
 * import and export operations. It is consumed by both the parser/import layer
 * and the serializer/export layer, as well as write-back helpers.
 */

import type { AdwNodeType } from '../types/mockup';

// ============================================================================
// Widget Type Mapping
// ============================================================================

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
  'Adw.NavigationSplitView': 'overlay-split',
  'Adw.Leaflet': 'overlay-split',
  'Adw.LeafletPage': 'stack-page',
  AdwNavigationSplitView: 'overlay-split',
  NavigationSplitView: 'overlay-split',
  'Adw.NavigationPage': 'bin',
  AdwNavigationPage: 'bin',
  NavigationPage: 'bin',
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
  Bin: 'bin',
  Box: 'box',
  Grid: 'grid',
  Stack: 'stack',
  StackPage: 'stack-page',
  ScrolledWindow: 'scrolled-window',
  Button: 'button',
  ToggleButton: 'button',
  GtkToggleButton: 'button',
  'Gtk.ToggleButton': 'button',
  MenuButton: 'menu-button',
  Entry: 'entry',
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
  Widget: 'bin',
  GtkWidget: 'bin',
  'Gtk.Widget': 'bin',
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
  return CLASS_TO_WIDGET_MAP[rawClass] ?? CLASS_TO_WIDGET_MAP[canonicalClassName(rawClass)] ?? null;
}

// ============================================================================
// Class Canonicalization
// ============================================================================

/** Canonicalize a GTK runtime class name to namespace-qualified form. */
export function canonicalClassName(rawClass: string): string {
  if (!rawClass || rawClass.includes('.')) return rawClass;
  if (rawClass.startsWith('Gtk')) return `Gtk.${rawClass.slice(3)}`;
  if (rawClass.startsWith('Adw')) return `Adw.${rawClass.slice(3)}`;
  if (rawClass.startsWith('GtkSource')) return `GtkSource.${rawClass.slice(9)}`;
  return rawClass;
}

// ============================================================================
// Property Encoding/Decoding
// ============================================================================

export const EXPORT_PROPERTY_NAMES: Record<string, string> = {
  text: 'label',
  title: 'label',
  'aria-label': 'label',
  'accessible-name': 'label',
  value: 'string',
  markup: 'markup',
  halign: 'halign',
  valign: 'valign',
  hexpand: 'hexpand',
  vexpand: 'vexpand',
  'margin-top': 'margin-top',
  'margin-start': 'margin-start',
  'margin-bottom': 'margin-bottom',
  'margin-end': 'margin-end',
  tooltip: 'tooltip-text',
};

const STYLE_CLASS_PROPERTIES: Record<string, string> = {
  'flat': 'flat',
  'raised': 'raised',
  'suggested-action': 'accent',
  'destructive-action': 'destructive',
  'pill-button': 'pill',
  'circular': 'circular',
  'large-buttons': 'large-buttons',
};

export const ANNOTATION_SLOTS = new Set([
  'use-markup', 'translatable', 'comments', 'context',
]);

export const EXPORTED_FALSE_PROPERTIES = new Set(['autohide']);

const LAYOUT_PROPERTIES = new Set(['column', 'row', 'column-span', 'row-span']);

/** Export property name: normalize editor key to Blueprint source spelling. */
export function exportPropertyName(key: string): string {
  return EXPORT_PROPERTY_NAMES[key] ?? key;
}

/** Check if a property belongs to layout manager (column, row, etc.). */
export function isBlueprintLayoutProperty(name: string): boolean {
  return LAYOUT_PROPERTIES.has(name);
}

/** Renderer key for a GTK property, specific to node type. */
export function editorPropertyName(name: string, nodeType: AdwNodeType): string {
  if ((name === 'label' || name === 'text' || name === 'title') && (nodeType === 'button' || nodeType === 'label')) {
    return 'title';
  }
  return name;
}

// ============================================================================
// Value Formatting
// ============================================================================

export function formatPropertyValue(_name: string, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    return escapeBlueprintString(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => formatPropertyValue(_name, v)).join(' ');
  }
  return String(value);
}

export function escapeBlueprintString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

// ============================================================================
// Style Class Support
// ============================================================================

export function blueprintStyleClassFor(key: string): string | null {
  return STYLE_CLASS_PROPERTIES[key] ?? null;
}
