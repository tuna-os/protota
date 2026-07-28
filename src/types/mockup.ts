export type AdwNodeType =
  | 'adw-window'
  | 'adw-header-bar'
  | 'adw-preferences-page'
  | 'adw-preferences-group'
  | 'adw-action-row'
  | 'adw-combo-row'
  | 'adw-status-page'
  | 'adw-button'
  | 'adw-entry';

export interface AdwNode {
  id: string;
  type: AdwNodeType;
  title?: string;
  subtitle?: string;
  description?: string;
  iconName?: string;
  imageId?: string;
  placeholder?: string;
  showTitleButtons?: boolean;
  activatable?: boolean;
  selectedIndex?: number;
  suggested?: boolean;
  destructive?: boolean;
  children?: AdwNode[];
  [key: string]: unknown;
}

export interface Screen {
  id: string;
  title: string;
  type: 'window' | 'dialog' | 'preferences' | 'status-page';
  width: number;
  height: number;
  rootNode: AdwNode;
}

export interface MockupDocument {
  id: string;
  title: string;
  screens: Screen[];
  edges: Array<{ id: string; sourceId: string; targetId: string }>;
}

/** D2: Context-sensitive legal children definitions */
export const LEGAL_CHILDREN: Record<AdwNodeType, AdwNodeType[]> = {
  'adw-window': ['adw-header-bar', 'adw-preferences-page', 'adw-status-page'],
  'adw-header-bar': ['adw-button'],
  'adw-preferences-page': ['adw-preferences-group'],
  'adw-preferences-group': ['adw-action-row', 'adw-combo-row'],
  'adw-action-row': ['adw-button', 'adw-entry'],
  'adw-combo-row': [],
  'adw-status-page': ['adw-button'],
  'adw-button': [],
  'adw-entry': [],
};
