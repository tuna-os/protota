/**
 * GNOME HIG widget type system.
 * Based on gnome-gui-spec: 42-component library, 34 audited apps.
 * Types model the Adwaita widget hierarchy as actually used in GNOME apps.
 */

export type AdwNodeType =
  // Windows & top-level surfaces
  | 'window'           // AdwApplicationWindow — standard app window
  | 'preferences-dialog' // AdwPreferencesDialog — settings Ctrl+, 
  | 'dialog'           // AdwDialog — modal sub-window
  | 'alert-dialog'     // AdwAlertDialog — confirmation/error
  | 'about-dialog'     // AdwAboutDialog — app metadata

  // Window chrome
  | 'toolbar-view'     // AdwToolbarView — [top] header + content + [bottom]
  | 'header-bar'       // AdwHeaderBar — title + start/end slots
  | 'window-title'     // AdwWindowTitle — title + optional subtitle

  // Navigation
  | 'view-stack'       // AdwViewStack — stack of pages with ViewSwitcher
  | 'view-switcher'    // AdwViewSwitcher — flat tab switcher (3-5 tabs)
  | 'navigation-view'  // AdwNavigationView — push/pop navigation
  | 'tab-view'         // AdwTabView + TabBar — multi-document tabs
  | 'overlay-split'    // AdwOverlaySplitView — sidebar + content

  // Layout
  | 'clamp'            // AdwClamp — max-width container
  | 'bin'              // AdwBin — single-child container
  | 'custom-widget'    // source-declared custom GTK/GObject widget boundary
  | 'box'              // GtkBox — directional container
  | 'grid'             // GtkGrid — rows/columns (Calculator and keypads)
  | 'center-box'       // GtkCenterBox — start/center/end layout
  | 'stack'            // GtkStack — visible page container
  | 'stack-page'       // GtkStackPage — named stack child
  | 'scrolled-window'  // GtkScrolledWindow — viewport with overflow

  // Preferences rows (boxed-list children)
  | 'action-row'       // AdwActionRow — title + subtitle + prefix/suffix
  | 'switch-row'       // AdwSwitchRow — toggle switch row
  | 'combo-row'        // AdwComboRow — dropdown row
  | 'spin-row'         // AdwSpinRow — numeric spinner row
  | 'button-row'       // AdwButtonRow — clickable row (incl. destructive)
  | 'expander-row'     // AdwExpanderRow — expandable row
  | 'entry-row'        // AdwEntryRow — text input row
  | 'password-row'     // AdwPasswordEntryRow — password row

  // Preferences structure
  | 'preferences-page' // AdwPreferencesPage — tab inside dialog
  | 'preferences-group' // AdwPreferencesGroup — titled section

  // Controls
  | 'progress-bar'     // GtkProgressBar — determinate progress
  | 'scale'            // GtkScale — slider
  | 'level-bar'        // GtkLevelBar — capacity/level meter
  | 'drop-down'        // GtkDropDown — standalone selector
  | 'avatar'           // AdwAvatar — user/contact image
  | 'wrap-box'         // AdwWrapBox — reflowing horizontal box
  | 'popover'          // GtkPopover — surface attached to a widget
  | 'list-box-row'     // GtkListBoxRow — plain (non-preferences) list row
  | 'button'           // GtkButton — all styles (flat, suggested, destructive…)
  | 'split-button'     // AdwSplitButton — button + dropdown
  | 'menu-button'      // GtkMenuButton — icon button with popover
  | 'search-entry'     // GtkSearchEntry — search bar
  | 'toggle'           // AdwToggle — pill toggle button
  | 'toggle-group'     // AdwToggleGroup — group of toggles
  | 'entry'            // GtkEntry — text input
  | 'switch-widget'    // GtkSwitch — binary toggle
  | 'check-button'     // GtkCheckButton — checkbox in radio groups

  // Feedback
  | 'status-page'      // AdwStatusPage — empty/error/loading state
  | 'toast-overlay'    // AdwToastOverlay — toast container
  | 'banner'           // AdwBanner — persistent info bar
  | 'spinner'          // AdwSpinner — loading indicator

  // Lists
  | 'list-box'         // GtkListBox — boxed-list container
  | 'flow-box'         // GtkFlowBox — wrapping grid

  // Text
  | 'label'            // GtkLabel — text
  | 'inscription';     // GtkInscription — text with ellipsis overflow

/**
 * A structural fact recorded during Blueprint/GtkBuilder import. Boundaries
 * are honest results, never errors: an application-defined widget that
 * Protota cannot render is retained with its source identity and reason.
 */
export type ImportDiagnosticCode =
  | 'template-not-in-bundle'           // $Class reference with no template definition in the imported source
  | 'renderer-does-not-support-class'  // known-syntax GTK/Adw class outside the generic widget registry
  | 'static-source-expansion';         // code-defined composite projected from language construction facts

export interface ImportDiagnostic {
  code: ImportDiagnosticCode;
  sourceClass: string;
  sourceId?: string;
  message: string;
}

export interface AdwNode {
  id: string;
  type: AdwNodeType;
  /**
   * Named GTK/Libadwaita child slot, such as ToolbarView's `top`/`content`
   * or OverlaySplitView's `sidebar`/`content`.  This is structural data,
   * not an app-specific rendering hint.
   */
  slot?: string;
  // Common properties
  title?: string;
  subtitle?: string;
  description?: string;
  iconName?: string;
  imageId?: string;
  placeholder?: string;
  value?: string;
  // Buttons
  suggested?: boolean;
  destructive?: boolean;
  flat?: boolean;
  circular?: boolean;
  // Rows
  activatable?: boolean;
  // Switch row
  active?: boolean;
  // Spin row
  min?: number;
  max?: number;
  step?: number;
  // Combo row
  options?: string[];
  selectedIndex?: number;
  // Header bar
  showTitleButtons?: boolean;
  // Layout
  orientation?: 'horizontal' | 'vertical';
  spacing?: number;
  columns?: number;
  rowSpacing?: number;
  columnSpacing?: number;
  /** GtkGrid child placement. Zero-based model coordinates. */
  column?: number;
  row?: number;
  columnSpan?: number;
  rowSpan?: number;
  minWidth?: number;
  minHeight?: number;
  widthRequest?: number;
  heightRequest?: number;
  /** GTK expand semantics — the node claims its parent's spare allocation. */
  hexpand?: boolean;
  vexpand?: boolean;
  /** GTK visibility. `false` renders nothing, exactly like a hidden widget. */
  visible?: boolean;
  /**
   * Source-declared class of a `custom-widget` boundary (e.g. "MathButtons").
   * Never overloaded into a display label; export must re-emit `$MathButtons`,
   * not a Protota-invented class.
   */
  sourceClass?: string;
  /** Blueprint `property: bind …` values preserved as opaque source text. */
  bindings?: Record<string, string>;
  // Breakpoint
  breakpointCondition?: string;
  // View stack pages
  pages?: AdwNode[];
  // Generic slot for extra data
  children?: AdwNode[];
  [key: string]: unknown;
}

export interface Screen {
  id: string;
  title: string;
  type: ScreenTemplateType;
  width: number;
  height: number;
  rootNode: AdwNode;
}

export type ScreenTemplateType =
  | 'standard'          // Standard app window (ToolbarView + HeaderBar + content)
  | 'view-switcher'     // ViewSwitcher in header + ViewStack
  | 'preferences'       // PreferencesDialog with search
  | 'sidebar'           // OverlaySplitView sidebar + content
  | 'dialog'            // Modal dialog
  | 'alert-dialog'       // Confirmation/error dialog
  | 'about'             // About dialog
  | 'status-page'       // Empty/error/loading state
  | 'empty';            // Blank canvas

export interface MockupDocument {
  id: string;
  title: string;
  screens: Screen[];
  edges: Array<{ id: string; sourceId: string; targetId: string }>;
  colorScheme: 'auto' | 'light' | 'dark';
  /** Import report for documents created from Blueprint/GtkBuilder source. */
  importDiagnostics?: ImportDiagnostic[];
}

/**
 * D2: Context-sensitive legal children — GNOME HIG enforced.
 *
 * These rules encode the actual widget hierarchy from 34 audited GNOME apps.
 * A container only accepts the children that make structural sense in a
 * real Adwaita app. No illegal nesting — mockups always depict buildable UIs.
 */
/**
 * Named child slots a container offers. GNOME layout is slot-driven — a
 * button means something different in a header bar's `start` than in its
 * `end` — so both the palette and the agent API need these to be data
 * rather than lore.
 */
export const LEGAL_SLOTS: Partial<Record<AdwNodeType, string[]>> = {
  'header-bar': ['start', 'title', 'end'],
  'toolbar-view': ['top', 'content', 'bottom'],
  'overlay-split': ['sidebar', 'content'],
  'navigation-view': ['content'],
  'status-page': ['child'],
  'action-row': ['prefix', 'suffix'],
  'switch-row': ['prefix', 'suffix'],
  'combo-row': ['prefix', 'suffix'],
  'spin-row': ['prefix', 'suffix'],
  'entry-row': ['prefix', 'suffix'],
  'password-row': ['prefix', 'suffix'],
  'expander-row': ['prefix', 'suffix'],
  'list-box-row': ['child'],
  bin: ['child'],
  clamp: ['child'],
  'scrolled-window': ['child'],
  'toast-overlay': ['child'],
  'menu-button': ['popover', 'child'],
  'split-button': ['popover'],
  window: ['content'],
  dialog: ['content'],
};

/**
 * Widgets a generic GTK container accepts. GtkBox, GtkGrid, AdwBin and the
 * rest impose no type restriction, and the presets imported from real GNOME
 * apps use that freedom throughout — so refusing these combinations would
 * mean rendering structures the editor will not let a user rebuild. HIG
 * guidance belongs in the linter, not in a hard structural block.
 */
const CONTAINER_CHILDREN: AdwNodeType[] = [
  'toolbar-view', 'header-bar', 'window-title',
  'view-stack', 'view-switcher', 'navigation-view', 'tab-view', 'overlay-split',
  'clamp', 'bin', 'custom-widget', 'box', 'grid', 'center-box', 'stack', 'stack-page',
  'scrolled-window', 'wrap-box', 'popover',
  'action-row', 'switch-row', 'combo-row', 'spin-row', 'button-row', 'expander-row',
  'entry-row', 'password-row', 'list-box-row',
  'preferences-page', 'preferences-group',
  'button', 'split-button', 'menu-button', 'search-entry', 'toggle', 'toggle-group',
  'entry', 'switch-widget', 'check-button', 'progress-bar', 'scale', 'level-bar',
  'drop-down', 'avatar',
  'status-page', 'toast-overlay', 'banner', 'spinner',
  'list-box', 'flow-box', 'label', 'inscription',
];

export const LEGAL_CHILDREN: Record<AdwNodeType, AdwNodeType[]> = {
  // === Windows ===
  window: CONTAINER_CHILDREN,
  'preferences-dialog': ['preferences-page'],
  dialog: CONTAINER_CHILDREN,
  'alert-dialog': ['label', 'button'],
  'about-dialog': [],

  // === Chrome ===
  // header-bar sits in [top]; a banner can sit above the content.
  'toolbar-view': CONTAINER_CHILDREN,
  'header-bar': CONTAINER_CHILDREN,
  'window-title': [],
  'progress-bar': [],
  scale: [],
  'level-bar': [],
  'drop-down': [],
  avatar: [],
  'wrap-box': CONTAINER_CHILDREN,
  popover: CONTAINER_CHILDREN,
  'list-box-row': ['box', 'bin', 'label', 'button', 'menu-button', 'switch-widget', 'check-button', 'avatar', 'progress-bar', 'level-bar', 'spinner', 'entry', 'inscription', 'custom-widget'],
  // === Navigation ===
  'view-stack': CONTAINER_CHILDREN,
  'view-switcher': [],
  'navigation-view': CONTAINER_CHILDREN,
  'tab-view': CONTAINER_CHILDREN,
  'overlay-split': CONTAINER_CHILDREN,
  // === Layout ===
  clamp: CONTAINER_CHILDREN,
  bin: CONTAINER_CHILDREN,
  'custom-widget': CONTAINER_CHILDREN,
  box: CONTAINER_CHILDREN,
  grid: CONTAINER_CHILDREN,
  'center-box': CONTAINER_CHILDREN,
  stack: CONTAINER_CHILDREN,
  'stack-page': CONTAINER_CHILDREN,
  'scrolled-window': CONTAINER_CHILDREN,
  // === Preferences rows ===
  'action-row': ['box', 'bin', 'label', 'button', 'menu-button', 'switch-widget', 'check-button', 'avatar', 'progress-bar', 'level-bar', 'spinner', 'entry', 'inscription', 'custom-widget'],
  'switch-row': ['box', 'bin', 'label', 'button', 'menu-button', 'switch-widget', 'check-button', 'avatar', 'progress-bar', 'level-bar', 'spinner', 'entry', 'inscription', 'custom-widget'],
  'combo-row': ['box', 'bin', 'label', 'button', 'menu-button', 'switch-widget', 'check-button', 'avatar', 'progress-bar', 'level-bar', 'spinner', 'entry', 'inscription', 'custom-widget'],
  'spin-row': ['box', 'bin', 'label', 'button', 'menu-button', 'switch-widget', 'check-button', 'avatar', 'progress-bar', 'level-bar', 'spinner', 'entry', 'inscription', 'custom-widget'],
  'button-row': ['box', 'bin', 'label', 'button', 'menu-button', 'switch-widget', 'check-button', 'avatar', 'progress-bar', 'level-bar', 'spinner', 'entry', 'inscription', 'custom-widget'],
  'expander-row': CONTAINER_CHILDREN,
  'entry-row': ['box', 'bin', 'label', 'button', 'menu-button', 'switch-widget', 'check-button', 'avatar', 'progress-bar', 'level-bar', 'spinner', 'entry', 'inscription', 'custom-widget'],
  'password-row': ['box', 'bin', 'label', 'button', 'menu-button', 'switch-widget', 'check-button', 'avatar', 'progress-bar', 'level-bar', 'spinner', 'entry', 'inscription', 'custom-widget'],
  // === Preferences structure ===
  'preferences-page': ['preferences-group'],
  'preferences-group': CONTAINER_CHILDREN,
  // === Controls ===
  button: ['box', 'label', 'avatar', 'stack', 'inscription', 'bin'],
  'split-button': ['box', 'label', 'popover', 'bin'],
  'menu-button': ['box', 'label', 'popover', 'list-box', 'bin', 'inscription'],
  'search-entry': ['bin', 'custom-widget', 'popover'],
  toggle: [],
  'toggle-group': ['toggle'],
  entry: ['bin', 'custom-widget', 'popover'],
  'switch-widget': [],
  'check-button': [],

  // === Feedback ===
  'status-page': ['box', 'button', 'menu-button', 'label', 'clamp', 'list-box', 'bin', 'preferences-group'],
  'toast-overlay': CONTAINER_CHILDREN,
  banner: [],
  spinner: [],

  // === Lists ===
  'list-box': CONTAINER_CHILDREN,
  'flow-box': CONTAINER_CHILDREN,
  // === Text ===
  label: [],
  inscription: [],
};

/**
 * Map HIG screen template to a root widget type.
 */
export const TEMPLATE_ROOT: Record<ScreenTemplateType, AdwNodeType> = {
  standard: 'window',
  'view-switcher': 'window',
  preferences: 'preferences-dialog',
  sidebar: 'window',
  dialog: 'dialog',
  'alert-dialog': 'alert-dialog',
  about: 'about-dialog',
  'status-page': 'status-page',
  empty: 'box',
};

/**
 * HIG sizing defaults (from gnome-gui-spec tokens/sizing.md).
 */
export const SCREEN_DEFAULTS: Record<ScreenTemplateType, { width: number; height: number }> = {
  standard:          { width: 900,  height: 650 },
  'view-switcher':   { width: 900,  height: 650 },
  preferences:       { width: 600,  height: 550 },
  sidebar:           { width: 1050, height: 700 },
  dialog:            { width: 500,  height: 400 },
  'alert-dialog':    { width: 360,  height: 200 },
  about:             { width: 420,  height: 400 },
  'status-page':     { width: 400,  height: 500 },
  empty:             { width: 900,  height: 650 },
};
