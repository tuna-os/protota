import type { AdwNodeType } from '../types/mockup';

export type PropType = 'string' | 'boolean' | 'number' | 'icon' | 'options' | 'select';

export interface PropSchema {
  key: string;
  label: string;
  type: PropType;
  options?: string[];
  defaultValue?: unknown;
}

/**
 * Declarative property schemas for every GNOME HIG widget type.
 * Maps to actual @gjsify/adwaita-web custom element attributes and
 * Gtk/Adw constructor properties.
 */
export const WIDGET_SCHEMAS: Record<AdwNodeType, PropSchema[]> = {
  // === Windows ===
  window: [],

  'preferences-dialog': [
    { key: 'title', label: 'Dialog Title', type: 'string', defaultValue: 'Preferences' },
  ],
  dialog: [
    { key: 'title', label: 'Dialog Title', type: 'string', defaultValue: 'Dialog' },
  ],
  'alert-dialog': [
    { key: 'title', label: 'Heading', type: 'string', defaultValue: 'Are you sure?' },
    { key: 'description', label: 'Body', type: 'string', defaultValue: 'This action cannot be undone.' },
  ],
  'about-dialog': [
    { key: 'title', label: 'App Name', type: 'string', defaultValue: 'My App' },
    { key: 'description', label: 'Comment', type: 'string', defaultValue: 'A GNOME application' },
    { key: 'iconName', label: 'App Icon', type: 'icon', defaultValue: 'application-x-executable' },
  ],

  // === Chrome ===
  'toolbar-view': [],
  'header-bar': [
    { key: 'title', label: 'Title', type: 'string', defaultValue: 'My App' },
    { key: 'showTitleButtons', label: 'Window Controls', type: 'boolean', defaultValue: true },
  ],
  'window-title': [
    { key: 'title', label: 'Title', type: 'string', defaultValue: 'My App' },
    { key: 'subtitle', label: 'Subtitle', type: 'string', defaultValue: '' },
  ],

  // === Navigation ===
  'view-stack': [],
  'view-switcher': [],
  'navigation-view': [],
  'tab-view': [],
  'overlay-split': [],

  // === Layout ===
  clamp: [
    { key: 'title', label: 'Content', type: 'string', defaultValue: '' },
  ],
  box: [
    {
      key: 'orientation',
      label: 'Direction',
      type: 'select',
      options: ['vertical', 'horizontal'],
      defaultValue: 'vertical',
    },
    { key: 'spacing', label: 'Spacing', type: 'number', defaultValue: 12 },
  ],
  grid: [
    { key: 'columns', label: 'Columns', type: 'number', defaultValue: 2 },
    { key: 'rowSpacing', label: 'Row spacing', type: 'number', defaultValue: 6 },
    { key: 'columnSpacing', label: 'Column spacing', type: 'number', defaultValue: 6 },
  ],
  'center-box': [],

  // === Preferences rows ===
  'action-row': [
    { key: 'title', label: 'Title', type: 'string', defaultValue: 'Setting' },
    { key: 'subtitle', label: 'Subtitle', type: 'string', defaultValue: '' },
    { key: 'iconName', label: 'Prefix Icon', type: 'icon', defaultValue: '' },
    { key: 'activatable', label: 'Clickable', type: 'boolean', defaultValue: false },
  ],
  'switch-row': [
    { key: 'title', label: 'Title', type: 'string', defaultValue: 'Enable Feature' },
    { key: 'subtitle', label: 'Subtitle', type: 'string', defaultValue: '' },
    { key: 'active', label: 'Active', type: 'boolean', defaultValue: true },
  ],
  'combo-row': [
    { key: 'title', label: 'Title', type: 'string', defaultValue: 'Select Option' },
    { key: 'subtitle', label: 'Subtitle', type: 'string', defaultValue: '' },
    { key: 'selectedIndex', label: 'Selected', type: 'number', defaultValue: 0 },
  ],
  'spin-row': [
    { key: 'title', label: 'Title', type: 'string', defaultValue: 'Value' },
    { key: 'subtitle', label: 'Subtitle', type: 'string', defaultValue: '' },
    { key: 'min', label: 'Minimum', type: 'number', defaultValue: 0 },
    { key: 'max', label: 'Maximum', type: 'number', defaultValue: 100 },
    { key: 'step', label: 'Step', type: 'number', defaultValue: 1 },
  ],
  'button-row': [
    { key: 'title', label: 'Label', type: 'string', defaultValue: 'Action' },
    { key: 'iconName', label: 'Icon', type: 'icon', defaultValue: '' },
    { key: 'destructive', label: 'Destructive', type: 'boolean', defaultValue: false },
  ],
  'expander-row': [
    { key: 'title', label: 'Title', type: 'string', defaultValue: 'Advanced' },
    { key: 'subtitle', label: 'Subtitle', type: 'string', defaultValue: '' },
  ],
  'entry-row': [
    { key: 'title', label: 'Title', type: 'string', defaultValue: 'Name' },
    { key: 'value', label: 'Value', type: 'string', defaultValue: '' },
    { key: 'placeholder', label: 'Placeholder', type: 'string', defaultValue: '' },
  ],
  'password-row': [
    { key: 'title', label: 'Title', type: 'string', defaultValue: 'Password' },
    { key: 'value', label: 'Value', type: 'string', defaultValue: '' },
  ],

  // === Preferences structure ===
  'preferences-page': [
    { key: 'title', label: 'Page Title', type: 'string', defaultValue: 'General' },
    { key: 'iconName', label: 'Tab Icon', type: 'icon', defaultValue: 'preferences-system-symbolic' },
  ],
  'preferences-group': [
    { key: 'title', label: 'Group Title', type: 'string', defaultValue: 'Section' },
    { key: 'description', label: 'Description', type: 'string', defaultValue: '' },
  ],

  // === Controls ===
  button: [
    { key: 'title', label: 'Label', type: 'string', defaultValue: 'Button' },
    { key: 'iconName', label: 'Icon', type: 'icon', defaultValue: '' },
    { key: 'suggested', label: 'Suggested (blue)', type: 'boolean', defaultValue: false },
    { key: 'destructive', label: 'Destructive (red)', type: 'boolean', defaultValue: false },
    { key: 'flat', label: 'Flat style', type: 'boolean', defaultValue: false },
    { key: 'circular', label: 'Circular', type: 'boolean', defaultValue: false },
  ],
  'split-button': [
    { key: 'title', label: 'Label', type: 'string', defaultValue: 'Action' },
    { key: 'iconName', label: 'Icon', type: 'icon', defaultValue: '' },
  ],
  'menu-button': [
    { key: 'iconName', label: 'Icon', type: 'icon', defaultValue: 'open-menu-symbolic' },
    { key: 'title', label: 'Tooltip', type: 'string', defaultValue: 'Menu' },
  ],
  'search-entry': [
    { key: 'placeholder', label: 'Placeholder', type: 'string', defaultValue: 'Search…' },
  ],
  toggle: [
    { key: 'title', label: 'Label', type: 'string', defaultValue: 'Option' },
    { key: 'iconName', label: 'Icon', type: 'icon', defaultValue: '' },
  ],
  'toggle-group': [],
  entry: [
    { key: 'value', label: 'Text', type: 'string', defaultValue: '' },
    { key: 'placeholder', label: 'Placeholder', type: 'string', defaultValue: '' },
    { key: 'title', label: 'Value (alt)', type: 'string', defaultValue: '' },
  ],
  'switch-widget': [
    { key: 'active', label: 'Active', type: 'boolean', defaultValue: false },
  ],
  'check-button': [
    { key: 'title', label: 'Label', type: 'string', defaultValue: 'Option' },
    { key: 'active', label: 'Checked', type: 'boolean', defaultValue: false },
  ],

  // === Feedback ===
  'status-page': [
    { key: 'title', label: 'Title', type: 'string', defaultValue: 'Nothing Here' },
    { key: 'description', label: 'Description', type: 'string', defaultValue: 'Try adding content to get started.' },
    { key: 'iconName', label: 'Icon', type: 'icon', defaultValue: 'system-search-symbolic' },
  ],
  'toast-overlay': [],
  banner: [
    { key: 'title', label: 'Message', type: 'string', defaultValue: 'An update is available.' },
  ],
  spinner: [],

  // === Lists ===
  'list-box': [],
  'flow-box': [],

  // === Text ===
  label: [
    { key: 'title', label: 'Text', type: 'string', defaultValue: 'Label' },
    {
      key: 'subtitle',
      label: 'Style',
      type: 'select',
      options: ['body', 'heading', 'title-1', 'title-2', 'caption', 'monospace'],
      defaultValue: 'body',
    },
  ],
  inscription: [
    { key: 'title', label: 'Text', type: 'string', defaultValue: 'Text that may overflow…' },
  ],
};
