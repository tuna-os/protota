import type { AdwNodeType } from '../types/mockup';

export type PropType = 'string' | 'boolean' | 'number' | 'icon' | 'options';

export interface PropSchema {
  key: string;
  label: string;
  type: PropType;
  options?: string[];
  defaultValue?: unknown;
}

export const WIDGET_SCHEMAS: Record<AdwNodeType, PropSchema[]> = {
  'adw-window': [
    { key: 'title', label: 'Window Title', type: 'string', defaultValue: 'Main Window' },
  ],
  'adw-header-bar': [
    { key: 'title', label: 'Title', type: 'string', defaultValue: 'Header Title' },
    {
      key: 'showTitleButtons',
      label: 'Show Window Controls',
      type: 'boolean',
      defaultValue: true,
    },
  ],
  'adw-preferences-page': [
    { key: 'title', label: 'Page Title', type: 'string', defaultValue: 'General' },
    {
      key: 'iconName',
      label: 'Tab Icon',
      type: 'icon',
      defaultValue: 'emblem-system-symbolic',
    },
  ],
  'adw-preferences-group': [
    { key: 'title', label: 'Group Title', type: 'string', defaultValue: 'Section' },
    { key: 'description', label: 'Group Description', type: 'string', defaultValue: '' },
  ],
  'adw-action-row': [
    { key: 'title', label: 'Row Title', type: 'string', defaultValue: 'Setting Name' },
    { key: 'subtitle', label: 'Subtitle', type: 'string', defaultValue: 'Detailed description' },
    {
      key: 'iconName',
      label: 'Prefix Icon',
      type: 'icon',
      defaultValue: 'preferences-system-symbolic',
    },
    { key: 'activatable', label: 'Clickable Row', type: 'boolean', defaultValue: true },
  ],
  'adw-combo-row': [
    { key: 'title', label: 'Row Title', type: 'string', defaultValue: 'Select Option' },
    { key: 'subtitle', label: 'Subtitle', type: 'string', defaultValue: '' },
    { key: 'selectedIndex', label: 'Selected Index', type: 'number', defaultValue: 0 },
  ],
  'adw-status-page': [
    { key: 'title', label: 'Title', type: 'string', defaultValue: 'No Results Found' },
    {
      key: 'description',
      label: 'Description',
      type: 'string',
      defaultValue: 'Try searching for something else.',
    },
    {
      key: 'iconName',
      label: 'Status Icon',
      type: 'icon',
      defaultValue: 'system-search-symbolic',
    },
  ],
  'adw-button': [
    { key: 'title', label: 'Label', type: 'string', defaultValue: 'Click Me' },
    { key: 'iconName', label: 'Icon', type: 'icon', defaultValue: '' },
    { key: 'suggested', label: 'Suggested Accent', type: 'boolean', defaultValue: false },
    { key: 'destructive', label: 'Destructive Red', type: 'boolean', defaultValue: false },
  ],
  'adw-entry': [
    { key: 'title', label: 'Text Value', type: 'string', defaultValue: '' },
    { key: 'placeholder', label: 'Placeholder', type: 'string', defaultValue: 'Type here...' },
  ],
};
