import React, { useRef, useEffect } from 'react';
import type { AdwNode } from '../types/mockup';
import { LEGAL_CHILDREN } from '../types/mockup';
import { useMockupStore } from '../store/mockupStore';
import { ensureAdwIcon } from '../utils/adwIcons';
import { filterDiagnostics, getDiagnosticsForNode, worstTier } from '../diagnostics/engine';
import {
  boundaryGeometryConfidence, boundaryGeometryFacts, containerLayout,
  parentFlowOf, placementLayout, type ParentFlow,
} from '../utils/nodeGeometry';
import { headerBarControls, headerBarFallbackTitle } from '../utils/headerBarChrome';
import { tabBarModel } from '../utils/tabBar';
import { usePreview, type PreviewInteraction } from '../preview/PreviewContext';
import { AddChildChip } from './AddChildChip';

interface Props {
  node: AdwNode;
  screenId: string;
  screenWidth?: number;
  screenHeight?: number;
  inheritedSlot?: string;
  /** How this node's parent arranges its children, so alignment can apply. */
  parentFlow?: ParentFlow;
  /** The parent node, so container-driven boundary geometry can be audited. */
  parentNode?: AdwNode;
  /**
   * Id of the header bar that carries the window controls. GTK draws them
   * once per window, on the content-side header — not on every header bar a
   * split view happens to contain. Computed per screen at the root.
   */
  primaryHeaderBarId?: string;
  /**
   * True when any ancestor node is an Adw dialog. A header bar inside a
   * dialog never shows minimize/maximize — at most a close button.
   */
  dialogAncestor?: boolean;
  /** Nearest ancestor window/dialog title, for AdwHeaderBar's title fallback. */
  surfaceTitle?: string;
  /**
   * Render-time property overrides from the active Adw.Breakpoints
   * (utils/breakpoints.ts), keyed by node id. Derived state — the document
   * is never mutated; resizing the screen recomputes them.
   */
  overrides?: Record<string, Partial<AdwNode>>;
  /**
   * Render-time color-scheme override (URL render mode's `theme` param and
   * `protota.renderScreenshot({ theme })`): wins over the document's
   * colorScheme without touching it. See the .theme-light/.theme-dark
   * variable scopes in index.css.
   */
  forcedColorScheme?: 'light' | 'dark';
}

/** Adw.Dialog and its subclasses — their header bars carry dialog chrome. */
const DIALOG_TYPES = new Set<string>([
  'dialog', 'preferences-dialog', 'alert-dialog', 'about-dialog',
]);

/**
 * The header bar that carries the window controls: the first visible one
 * outside a split-view sidebar. Sidebar headers sit left of the content and
 * do not own the controls; header bars inside hidden pages are not shown at
 * all, so they must not claim them either.
 */
function findPrimaryHeaderBarId(node: AdwNode): string | undefined {
  const search = (candidate: AdwNode, inSidebar: boolean): string | undefined => {
    if (candidate.visible === false) return undefined;
    if (candidate.type === 'header-bar' && !inSidebar) return candidate.id;
    // Only the visible child of a one-at-a-time container is on screen.
    const shown = (candidate.type === 'stack' || candidate.type === 'view-stack' || candidate.type === 'navigation-view')
      ? candidate.children?.slice(0, 1) ?? []
      : candidate.children ?? [];
    for (const child of shown) {
      const found = search(child, inSidebar || child.slot === 'sidebar');
      if (found) return found;
    }
    return undefined;
  };
  return search(node, false) ?? (() => {
    // A window whose only header bars are in sidebars still shows controls.
    let fallback: string | undefined;
    const visit = (candidate: AdwNode) => {
      if (!fallback && candidate.type === 'header-bar') fallback = candidate.id;
      candidate.children?.forEach(visit);
    };
    visit(node);
    return fallback;
  })();
}

/**
 * Maps our HIG widget type names to @gjsify/adwaita-web custom element tags.
 * Types without a direct custom element are rendered as semantic divs.
 */
const TAG_MAP: Record<string, string | null> = {
  window:                'adw-window',
  'preferences-dialog':  'adw-preferences-dialog',
  dialog:                'adw-dialog',
  'alert-dialog':        'adw-alert-dialog',
  'about-dialog':        'adw-about-dialog',
  'toolbar-view':        'adw-toolbar-view',
  'header-bar':          'adw-header-bar',
  'window-title':        'adw-window-title',
  // adw-view-stack keeps only adw-view-stack-page children: connectedCallback
  // snapshots those and calls replaceChildren, destroying everything else. Our
  // pages are stack-page nodes, and the model already selects the visible one,
  // so render the stack ourselves (as with stack and navigation-view).
  'view-stack':          null,
  'view-switcher':       'adw-view-switcher',
  'navigation-view':     'adw-navigation-view',
  'tab-view':            'adw-tab-view',
  // No adw-tab-bar custom element exists; the strip is drawn as a styled div
  // whose tabs derive from the linked tab-view's pages (see utils/tabBar.ts).
  'tab-bar':             null,
  'overlay-split':       'adw-overlay-split-view',
  clamp:                 'adw-clamp',
  bin:                   null,
  'custom-widget':       null,
  avatar:                'adw-avatar',
  'wrap-box':            'adw-wrap-box',
  'drop-down':           'adw-drop-down',
  'progress-bar':        null,
  scale:                 null,
  'level-bar':           null,
  popover:               null,
  'list-box-row':        null,
  'action-row':          'adw-action-row',
  'switch-row':          'adw-switch-row',
  'combo-row':           'adw-combo-row',
  'spin-row':            'adw-spin-row',
  'button-row':          'adw-button-row',
  'expander-row':        'adw-expander-row',
  'entry-row':           'adw-entry-row',
  'password-row':        'adw-password-entry-row',
  'preferences-page':    'adw-preferences-page',
  'preferences-group':   'adw-preferences-group',
  button:                'adw-button',
  'split-button':        'adw-split-button',
  'menu-button':         'adw-menu-button',
  toggle:                'adw-toggle',
  'toggle-group':        'adw-toggle-group',
  entry:                 'adw-entry',
  'status-page':         'adw-status-page',
  'toast-overlay':       'adw-toast-overlay',
  banner:                'adw-banner',
  spinner:               'adw-spinner',
  'flow-box':            'adw-wrap-box',
  // These lack custom elements — rendered as styled divs
  box:                   null,
  grid:                  null,
  'center-box':          null,
  stack:                 null,
  'stack-page':          null,
  'scrolled-window':     null,
  overlay:               null,
  'search-entry':        null,
  'switch-widget':       null,
  'check-button':        null,
  'list-box':            null,
  label:                 null,
  inscription:           null,
};

/** Div-only types: render a semantic container with Adwaita-styled layout.
 * navigation-view and view-stack are here because their custom elements
 * manage only their own page elements — adw-navigation-page and
 * adw-view-stack-page — and hide or discard everything else; the model
 * already selects the visible page. */
const DIV_TYPES = new Set([
  'bin', 'custom-widget', 'box', 'grid', 'center-box', 'stack', 'stack-page', 'scrolled-window', 'search-entry', 'switch-widget',
  'check-button', 'list-box', 'label', 'inscription', 'navigation-view', 'view-stack', 'overlay',
  'progress-bar', 'scale', 'level-bar', 'popover', 'list-box-row', 'tab-bar',
  // adw-overlay-split-view collects [slot="content"] with an unscoped query,
  // so it hoists the content child of any nested toolbar view into its own
  // pane. Render the panes ourselves, as with navigation-view.
  'overlay-split',
]);

function nodeProps(node: AdwNode, inheritedSlot?: string): Record<string, string> {
  const p: Record<string, string> = {};
  const t = node.type;
  void inheritedSlot;

  // Layout attributes are part of the GTK widget model, rather than styling
  // hints.  In particular, GtkBox orientation must survive the model → DOM
  // boundary for every imported Blueprint and preset.
  if (t === 'box' && node.orientation) p.orientation = node.orientation;
  // GtkBox homogeneous gives every child an equal share of the main axis;
  // the stylesheet applies the equal split to the box's children.
  if (t === 'box' && node.homogeneous) p.homogeneous = '';
  if (t === 'overlay-split') p['show-sidebar'] = '';
  const icon = node.iconName?.replace(/-symbolic$/, '');

  // Text-bearing widgets
  if (t === 'header-bar' || t === 'window-title') {
    if (node.title) p.title = node.title;
    if (t === 'window-title' && node.subtitle) p.subtitle = node.subtitle;
  }
  if (t === 'action-row' || t === 'switch-row' || t === 'combo-row' ||
      t === 'spin-row' || t === 'entry-row' || t === 'expander-row') {
    if (node.title) p.title = node.title;
    if (node.subtitle) p.subtitle = node.subtitle;
  }
  if (t === 'button-row') { if (node.title) p.title = node.title; if (node.iconName) p.icon = node.iconName; }
  if (t === 'preferences-page') { if (node.title) p.title = node.title; }
  if (t === 'preferences-group') { if (node.title) p.title = node.title; if (node.description) p.description = node.description; }
  if (t === 'status-page') {
    if (node.title) p.title = node.title;
    if (node.description) p.description = node.description;
    if (node.iconName) p.icon = node.iconName;
  }
  if (t === 'button') {
    if (node.title) p.label = node.title;
    if (icon) p.icon = icon;
  }
  // Bar and meter widgets carry their fill as a CSS custom property so the
  // stylesheet can draw the trough and the filled portion.
  if (t === 'progress-bar' || t === 'level-bar' || t === 'scale') {
    const min = typeof node.min === 'number' ? node.min : 0;
    const max = typeof node.max === 'number' ? node.max : 1;
    const raw = typeof node.value === 'number' ? node.value : Number(node.value ?? 0);
    const span = max - min || 1;
    const fraction = Math.min(1, Math.max(0, (raw - min) / span));
    p.style = `--protota-fill: ${(fraction * 100).toFixed(1)}%`;
    if (node.title) p['aria-label'] = node.title;
  }
  if (t === 'avatar') {
    if (node.title) p.text = node.title;
    if (node.value) p.size = String(node.value);
  }

  if (t === 'menu-button') {
    // A labelled MenuButton (mode selector, open button) renders its text
    // with a dropdown indicator; adw-menu-button itself is icon-only.
    if (node.title) {
      p.label = `${node.title} ▾`;
      if (icon) p.icon = icon;
    } else if (icon) {
      p['icon-name'] = icon;
    }
  }
  if (t === 'split-button') {
    if (node.title) p.label = node.title;
    if (icon) p['icon-name'] = icon;
  }
  if (t === 'entry') {
    if (node.value ?? node.title) p.value = String(node.value ?? node.title);
    if (node.placeholder) p.placeholder = node.placeholder;
  }
  if (t === 'entry-row' || t === 'password-row') {
    if (node.value) p.value = node.value;
    if (node.placeholder) p.placeholder = node.placeholder;
  }

  // Boolean attribute flags (set as empty string so hasAttribute() returns true)
  const boolFlags: Record<string, string[]> = {
    button: ['suggested', 'destructive', 'flat', 'circular'],
    'header-bar': ['showTitleButtons'],
    'action-row': ['activatable'],
    'switch-row': ['active'],
    'button-row': ['destructive'],
    'switch-widget': ['active'],
    'check-button': ['active'],
    'spin-row': ['min', 'max', 'step'],
    'combo-row': ['selectedIndex'],
  };
  for (const [key, value] of Object.entries(node)) {
    const flags = boolFlags[t] || [];
    if (flags.includes(key) && value !== undefined && value !== false && value !== 0) {
      p[key] = typeof value === 'boolean' ? '' : String(value);
    }
  }

  return p;
}

/**
 * Pre-slot mockups used direct ToolbarView children. Preserve that valid GTK
 * structure while documents imported from Blueprint keep their explicit slot.
 */
function childSlot(parent: AdwNode, child: AdwNode, index: number): string | undefined {
  // GtkBuilder names AdwHeaderBar's title-widget child `title`; adwaita-web
  // exposes the equivalent light-DOM slot as `center`.
  if (parent.type === 'header-bar' && child.slot === 'title') return 'center';
  if (child.slot) return child.slot;
  if (parent.type === 'toolbar-view') {
    return child.type === 'header-bar' ? 'top' : 'content';
  }
  if (parent.type === 'overlay-split') {
    return index === 0 ? 'sidebar' : 'content';
  }
  if (parent.type === 'header-bar') {
    const children = parent.children ?? [];
    const centerIndex = children.findIndex((candidate) =>
      ['window-title', 'view-switcher', 'search-entry', 'entry', 'combo-row', 'toggle-group']
        .includes(candidate.type),
    );
    if (index === centerIndex) return 'center';
    if (centerIndex !== -1) return index < centerIndex ? 'start' : 'end';
    return child.type === 'menu-button' ? 'end' : 'start';
  }
  return undefined;
}

/** GTK label markup (Pango) is not renderable text; show the plain string. */
function plainText(text: string): string {
  return text.replace(/<[^>]+>/g, '');
}

// --- Interactive preview (prototype mode) -------------------------------
//
// Widget types whose tap is an ACTIVATION: in preview it follows the
// current screen's outgoing flow edge (screen-level edges — see doc.edges).
const PREVIEW_ACTIVATION_TYPES = new Set<string>([
  'button', 'button-row', 'split-button', 'list-box-row',
]);
// Widget types whose adw-* custom element (or inner native input) already
// behaves interactively on its own — switch rows toggle their checkbox,
// expander rows disclose, toggle groups re-select, entries take focus and
// text. The preview handler only stops the click from bubbling into an
// ancestor activation; the element's own ephemeral behavior does the rest.
// (menu-button is here deliberately: it has no modeled menu, so it does
// nothing — but its tap must not leak into a parent activator either.)
const PREVIEW_LOCAL_TYPES = new Set<string>([
  'switch-row', 'expander-row', 'toggle-group', 'toggle',
  'entry', 'entry-row', 'password-row', 'search-entry',
  'spin-row', 'combo-row', 'drop-down', 'menu-button', 'scale',
]);

/** First one-visible-child stack in the screen — what a ViewSwitcher drives. */
function findFirstStack(node: AdwNode): AdwNode | null {
  if (node.type === 'view-stack' || node.type === 'stack') return node;
  for (const child of node.children ?? []) {
    const found = findFirstStack(child);
    if (found) return found;
  }
  return null;
}

function findViewSwitcherStack(node: AdwNode, id: string): AdwNode | null {
  const candidates: AdwNode[] = [];
  const visit = (candidate: AdwNode): void => {
    if (candidate.id === id) candidates.push(candidate);
    candidate.children?.forEach(visit);
  };
  visit(node);
  // GtkBuilder ids are template-scoped, so an expanded composite can legally
  // contain another `stack`. A ViewSwitcher binds to an AdwViewStack; prefer
  // that typed candidate instead of whichever duplicate id traversal meets.
  return candidates.find((candidate) => candidate.type === 'view-stack') ?? candidates[0] ?? null;
}

/** The stack child a visibleChildName selects (renderer matching rules). */
function visibleStackChild(stack: AdwNode, visibleChildName: unknown): AdwNode | undefined {
  const children = stack.children ?? [];
  return children.find((child) => typeof visibleChildName === 'string' &&
    (child.id === visibleChildName || child.title === visibleChildName ||
      (child as { name?: unknown }).name === visibleChildName)) ?? children[0];
}

export const AdwaitaRenderer: React.FC<Props> = ({
  node, screenId, screenWidth, screenHeight,
  inheritedSlot, primaryHeaderBarId, parentFlow = 'column', parentNode,
  dialogAncestor = false, surfaceTitle, overrides, forcedColorScheme,
}) => {
  // Active-breakpoint setters apply as a derived patch over the document
  // node — the same non-mutating family as the runtime-evidence geometry
  // overrides. A node is (or is not) a breakpoint independently of the
  // patch, so hook order below stays stable.
  const patch = overrides?.[node.id];
  if (patch) node = { ...node, ...patch };
  // The screen root resolves which header bar owns the window controls.
  const primaryHeaderBar = primaryHeaderBarId ?? (screenWidth ? findPrimaryHeaderBarId(node) : undefined);
  const {
    selectedNodeId, selectedNodeIds, selectNode, toggleNodeSelection, doc,
    diagnosticsEnabled, diagnostics, tierFilters, ignoredRules, ignoredInstances,
  } = useMockupStore();
  // Interactive preview (prototype mode): non-null inside the full-screen
  // preview overlay. All editing chrome is suppressed and clicks act on the
  // mockup instead of selecting.
  const preview = usePreview();
  const isSelected = !preview && selectedNodeId === node.id;
  // Multi-selection member that is not the primary: distinct dashed outline,
  // no badge/add-buttons — those belong to the primary only (#79).
  const isMultiSelected = !isSelected && !preview && selectedNodeIds.includes(node.id);

  // Diagnostics outlines (#95, design §5.4): visible (filtered, non-ignored)
  // diagnostics tint this node by their worst tier. Editor chrome only —
  // excluded from PNG capture alongside the selection outline.
  const nodeDiagnostics = diagnosticsEnabled && !preview
    ? getDiagnosticsForNode(
        filterDiagnostics(diagnostics, tierFilters, ignoredRules, ignoredInstances),
        screenId, node.id)
    : [];
  const diagnosticTier = worstTier(nodeDiagnostics);

  const legalAdds = LEGAL_CHILDREN[node.type] || [];
  const elRef = useRef<HTMLElement>(null);

  // Adw.TabBar derives its tabs from the linked tab-view's declared pages;
  // its autohide semantics can hide the whole strip (checked after hooks).
  const tabBar = node.type === 'tab-bar'
    ? tabBarModel(node, doc.screens.find((screen) => screen.id === screenId)?.rootNode)
    : null;

  // A dialog used as a canvas screen renders as a window-like surface; the
  // real dialog elements are modals, hidden until runtime opens them.
  const isDialogRoot = Boolean(screenWidth) &&
    (node.type === 'dialog' || node.type === 'preferences-dialog' || node.type === 'about-dialog' || node.type === 'alert-dialog');

  // Root window/dialog sizing is part of the element's style prop (merged
  // into the createElement style below) rather than an imperative effect:
  // the keyed host remount (see hostKey) replaces the element without
  // changing this component's deps, so an effect-applied size would be lost
  // on the fresh element while React-managed style always re-applies.
  const rootSizeStyle: React.CSSProperties | undefined =
    (node.type === 'window' || node.type === 'dialog' || isDialogRoot) && screenWidth
      ? { width: `${screenWidth}px`, ...(screenHeight ? { height: `${screenHeight}px` } : {}) }
      : undefined;

  useEffect(() => {
    ensureAdwIcon(node.iconName);
  }, [node.iconName]);

  const tabIconNames = tabBar?.tabs.map((tab) => tab.iconName).filter(Boolean).join(' ') ?? '';
  useEffect(() => {
    for (const iconName of tabIconNames.split(' ')) if (iconName) ensureAdwIcon(iconName);
  }, [tabIconNames]);

  // Selection must use a native listener: the adw-* custom elements build
  // and reparent internal DOM, and clicks originating there never reach
  // React's delegated events. Plain DOM bubbling always does. stopPropagation
  // keeps the innermost node's handler authoritative and suppresses the
  // canvas's deselect.
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Latest node/preview for the stable native listener below (node identity
  // changes when a breakpoint patch applies; the listener must not re-attach).
  const nodeRef = useRef(node);
  nodeRef.current = node;
  const previewRef = useRef<PreviewInteraction | null>(preview);
  previewRef.current = preview;
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const handleNativeClick = (event: MouseEvent) => {
      const current = nodeRef.current;
      const previewInteraction = previewRef.current;
      if (previewInteraction) {
        // Prototype mode: the click acts on the mockup. Handled types stop
        // here; anything else bubbles up to the nearest interactive ancestor
        // (e.g. a label inside a button). Unmodeled widgets do nothing.
        const type = current.type;
        if (type === 'view-switcher') {
          event.stopPropagation();
          const tab = (event.target as Element).closest?.('[data-preview-page]') as HTMLElement | null;
          if (tab?.dataset.previewPage && tab.dataset.previewStack) {
            previewInteraction.setNodeState(tab.dataset.previewStack, {
              visibleChildName: tab.dataset.previewPage,
            });
          }
          return;
        }
        if (type === 'switch-widget' || type === 'check-button') {
          // Div-rendered toggles have no custom element behind them: flip
          // the attribute the stylesheet draws from. DOM-only state — reset
          // by the remount on navigation/exit, never stored.
          event.stopPropagation();
          elRef.current?.toggleAttribute('active');
          return;
        }
        if (PREVIEW_ACTIVATION_TYPES.has(type) ||
            (type === 'action-row' && current.activatable)) {
          event.stopPropagation();
          previewInteraction.activate(current);
          return;
        }
        if (PREVIEW_LOCAL_TYPES.has(type)) {
          // The custom element's own (ephemeral) behavior handles it.
          event.stopPropagation();
          return;
        }
        return;
      }
      // Clicks inside the quick-add affordance (the "+" chip and its
      // popover) belong to its React handlers. stopPropagation here would
      // keep the event from ever reaching React's root-delegated listener,
      // so let these through untouched — the affordance stops synthetic
      // propagation itself, which keeps the canvas deselect suppressed.
      if ((event.target as Element).closest?.('.protota-add-affordance')) return;
      event.stopPropagation();
      // Ctrl/Cmd-click toggles multi-selection membership (#79, study §3).
      if (event.ctrlKey || event.metaKey) toggleNodeSelection(node.id, screenId);
      else selectNode(node.id, screenId);
    };
    wrapper.addEventListener('click', handleNativeClick);
    return () => wrapper.removeEventListener('click', handleNativeClick);
  }, [node.id, screenId, selectNode, toggleNodeSelection]);

  // GTK visibility: a hidden widget takes no space and draws nothing — but it
  // must keep a stable DOM placeholder rather than render null. Several adw-*
  // custom elements adopt their light-DOM children into internal wrappers on
  // connect (see the hostKey note below); if a child later flipped to null,
  // React would removeChild() through the adopting host and crash (#137). A
  // display:none shell draws nothing, takes no space, and is reconciled in
  // place (div → div), so React never performs a structural op on the host.
  // These checks come after every hook so React's hook order stays stable.
  const hiddenShell = (
    <div
      ref={wrapperRef}
      slot={inheritedSlot ?? node.slot}
      className="adw-node-wrapper"
      style={{ display: 'none' }}
      data-hidden-node-id={node.id}
    />
  );
  if (node.visible === false) return hiddenShell;
  // An Adw.Breakpoint is structure, not a widget: GTK never draws it. Its
  // condition/setters are evaluated by utils/breakpoints.ts instead.
  if (node.breakpointCondition !== undefined || node.sourceClass === 'Adw.Breakpoint') return hiddenShell;
  // Adw.TabBar autohide: with fewer than two tabs the bar takes no space,
  // exactly like a hidden widget (unless a finishing file pinned a runtime
  // allocation via heightRequest — see utils/tabBar.ts).
  if (tabBar?.hidden) return hiddenShell;

  // In preview a ViewSwitcher becomes live chrome: one tab per page of the
  // first stack in its screen; tapping a tab flips that stack's visible
  // child through an ephemeral override (never the document). The
  // adw-view-switcher element is pageless in our model (pages live on the
  // stack), so preview draws its own tab strip in a plain div.
  const screenRoot = doc.screens.find((screen) => screen.id === screenId)?.rootNode;
  const boundStackId = typeof node.stack === 'string' ? node.stack : null;
  const switcherStack = node.type === 'view-switcher'
    ? boundStackId && screenRoot
      ? findViewSwitcherStack(screenRoot, boundStackId)
      : preview ? findFirstStack(screenRoot ?? node) : null
    : null;
  const headerSwitcherNode = node.type === 'header-bar'
    ? node.children?.find((child) => child.type === 'view-switcher')
    : undefined;
  const headerSwitcherStackId = typeof headerSwitcherNode?.stack === 'string' ? headerSwitcherNode.stack : null;
  const headerSwitcherStack = headerSwitcherStackId && screenRoot
    ? findViewSwitcherStack(screenRoot, headerSwitcherStackId)
    : null;
  // The generated page elements are consumed immediately by the custom
  // element, so register their source icons before that first connection.
  headerSwitcherStack?.children?.forEach((page) => ensureAdwIcon(page.iconName));
  const headerSwitcherPages = (headerSwitcherStack?.children ?? []).filter((page) => page.visible !== false);
  const headerSwitcherActive = Math.max(0, headerSwitcherPages.findIndex((page) =>
    typeof headerSwitcherStack?.visibleChildName === 'string' &&
    (page.id === headerSwitcherStack.visibleChildName ||
      (page as { name?: string }).name === headerSwitcherStack.visibleChildName)));
  const directHeaderSwitcher = headerSwitcherNode && headerSwitcherStack ? React.createElement(
    'adw-view-switcher',
    {
      key: 'header-view-switcher',
      slot: 'center',
      policy: headerSwitcherNode.policy ?? 'wide',
      active: headerSwitcherActive,
      ...(headerSwitcherNode.runtimeEvidence?.relativeBounds
        ? { style: {
            position: 'absolute',
            left: headerSwitcherNode.runtimeEvidence.relativeBounds.x,
            top: headerSwitcherNode.runtimeEvidence.relativeBounds.y,
            width: headerSwitcherNode.runtimeEvidence.relativeBounds.width,
            height: headerSwitcherNode.runtimeEvidence.relativeBounds.height,
          } }
        : {}),
    },
    ...headerSwitcherPages.map((page, index) =>
      React.createElement('adw-view-switcher-page', {
        key: page.id,
        name: (page as { name?: string }).name ?? page.id,
        title: plainText(String(page.title || `Page ${index + 1}`)),
        'icon-name': page.iconName,
      })),
  ) : null;

  // adw-menu-button is icon-only; a labelled MenuButton renders as a button.
  const tag = isDialogRoot
    ? 'adw-window'
    : node.type === 'navigation-view' || node.type === 'overlay-split'
      ? 'div'
      : node.type === 'menu-button' && node.title
        ? 'adw-button'
        : TAG_MAP[node.type] || 'div';
  const attrs = nodeProps(node, inheritedSlot);
  // AdwHeaderBar with no title-widget shows the enclosing window's/dialog's
  // title centered (the compress dialog's heading comes from this fallback).
  // adw-header-bar only draws the title attribute when its center slot is
  // empty, so a window-title/view-switcher child still wins.
  const fallbackTitle = headerBarFallbackTitle(node, surfaceTitle);
  if (fallbackTitle) attrs.title = fallbackTitle;

  // Apply theme class to window/dialog roots based on doc colorScheme; a
  // render-time forcedColorScheme (render mode / renderScreenshot) wins
  // without mutating the document.
  const isRoot = node.type === 'window' || node.type === 'dialog' ||
    node.type === 'preferences-dialog';
  const effectiveScheme = forcedColorScheme ?? doc.colorScheme;
  const themeClass = isRoot && effectiveScheme !== 'auto'
    ? `theme-${effectiveScheme}` : '';
  if (themeClass) attrs['class'] = themeClass;

  // GtkStack, AdwViewStack, and AdwNavigationView show exactly one child.
  // The visible child is the named one when declared (matched by page name,
  // builder id, or title), otherwise the first — GTK's default (a
  // NavigationView starts on its root page).
  const showsOneChild = node.type === 'stack' || node.type === 'view-stack' || node.type === 'navigation-view';
  const visibleChildren = showsOneChild && node.children?.length
    ? [node.children.find((child) => typeof node.visibleChildName === 'string' &&
        (child.id === node.visibleChildName || child.title === node.visibleChildName || (child as { name?: unknown }).name === node.visibleChildName)) ?? node.children[0]]
    : node.children;

  const childDialogAncestor = dialogAncestor || DIALOG_TYPES.has(node.type);
  const childSurfaceTitle =
    (node.type === 'window' || DIALOG_TYPES.has(node.type)) && node.title
      ? node.title
      : surfaceTitle;
  // Slots resolve against the ORIGINAL child order (childSlot is index-based
  // for slotless children), then a collapsed split view drops its sidebar:
  // Adw.OverlaySplitView with collapsed=true moves the sidebar into an
  // overlay that stays hidden until runtime shows it, so statically the
  // content pane takes the whole allocation. Breakpoint setters flipping
  // `collapsed` are how the imported corpus adapts to narrow widths.
  const slottedChildren = (visibleChildren ?? []).map((child, index) => ({
    child, slot: childSlot(node, child, index),
  }));
  const collapsedSplit = node.type === 'overlay-split' && node.collapsed === true;
  const renderedSlotted = slottedChildren
    .filter(({ child, slot }) => !(collapsedSplit && slot === 'sidebar') && child !== headerSwitcherNode);
  const children = renderedSlotted
    .map(({ child, slot }, index) => (
    <AdwaitaRenderer
      // GtkBuilder IDs are scoped to a template, so expanding several
      // templates can legitimately put repeated IDs under one projected
      // parent. Keep the source ID for editing, but include structural
      // position in React identity so siblings are never omitted/duplicated.
      key={`${child.id}:${index}`}
      node={child}
      screenId={screenId}
      inheritedSlot={slot}
      primaryHeaderBarId={primaryHeaderBar}
      parentFlow={parentFlowOf(node)}
      parentNode={node}
      dialogAncestor={childDialogAncestor}
      surfaceTitle={childSurfaceTitle}
      overrides={overrides}
      forcedColorScheme={forcedColorScheme}
    />
  ));
  // GTK draws window controls in the header bar unless the title-button
  // properties disable them (Adw.HeaderBar defaults to true). Inside a
  // dialog, libadwaita draws at most a close button — never minimize or
  // maximize — and none at all when end title buttons are disabled, exactly
  // like the Files compress dialog. See utils/headerBarChrome.ts.
  const controlsKind = headerBarControls(node, {
    inDialog: dialogAncestor,
    isPrimary: node.id === primaryHeaderBar,
  });
  const windowControls = controlsKind !== 'none' ? (
    <div key="window-controls" slot="end" className="protota-window-controls" aria-hidden="true">
      {controlsKind === 'window' && <span className="protota-window-control minimize" />}
      {controlsKind === 'window' && <span className="protota-window-control maximize" />}
      <span className="protota-window-control close" />
    </div>
  ) : null;

  // The tab strip's tabs are renderer-derived chrome (like window controls):
  // one chip per statically declared page of the linked view, first selected
  // (GTK's default). A close affordance is drawn per tab, as native does; a
  // lone tab draws no chip background (libadwaita keeps it flat).
  const tabBarTabs = tabBar && tabBar.tabs.length ? (
    <div key="tab-box" className="protota-tab-box" aria-hidden="true">
      {tabBar.tabs.map((tab, index) => (
        <div key={tab.id} className={`protota-tab${index === 0 ? ' protota-tab-active' : ''}`}>
          {tab.iconName ? (
            <span className={`adw-icon adw-icon--${tab.iconName.replace(/-symbolic$/, '')}`} />
          ) : null}
          <span className="protota-tab-title">{plainText(tab.title)}</span>
          <span className="protota-tab-close" />
        </div>
      ))}
    </div>
  ) : null;
  if (tabBar && tabBar.tabs.length === 1 && tabBar.viewResolved) {
    attrs['data-protota-single-tab'] = 'true';
  }

  // Preview-mode ViewSwitcher tab strip (see previewSwitcherStack above).
  const previewSwitcherTabs = switcherStack ? (() => {
    const visibleName =
      overrides?.[switcherStack.id]?.visibleChildName ?? switcherStack.visibleChildName;
    const active = visibleStackChild(switcherStack, visibleName);
    const pages = (switcherStack.children ?? []).filter((page) => page.visible !== false);
    return pages.length ? pages.map((page, index) => React.createElement('adw-view-switcher-page', {
      key: page.id,
      name: (page as { name?: string }).name ?? page.id,
      title: plainText(String(page.title || `Page ${index + 1}`)),
      'icon-name': page.iconName,
      'data-preview-page': page.id,
      'data-preview-stack': switcherStack.id,
      ...(page === active ? { active: '' } : {}),
    })) : null;
  })() : null;

  const iconPrefix = node.type === 'action-row' && node.iconName ? (
    <span
      aria-hidden="true"
      slot="prefix"
      className={`adw-icon adw-icon--${node.iconName.replace(/-symbolic$/, '')}`}
    />
  ) : null;

  // A Gtk.Image imports as a bin carrying its declared icon-name; drawing
  // that icon is source-grounded (the go-next chevron on a font row).
  const binIcon = node.type === 'bin' && node.iconName ? (
    <span
      aria-hidden="true"
      className={`adw-icon adw-icon--${node.iconName.replace(/-symbolic$/, '')}`}
    />
  ) : null;

  // Div-only types get Adwaita-styled classes for layout/structure.
  // A custom-widget with projected children is a resolved composite: render it
  // as a plain container, not a striped unresolved boundary.
  const isExpandedBoundary = node.type === 'custom-widget' && (node.children?.length ?? 0) > 0;
  const divClass = DIV_TYPES.has(node.type)
    ? isExpandedBoundary ? 'protota-div-custom-widget-expanded' : `protota-div-${node.type}`
    : '';
  // GTK style classes the source declared. Adwaita defines several that
  // change a widget's appearance materially (card, boxed-list, toolbar,
  // dim-label); rendering them is what makes an imported card look like a
  // card rather than plain background.
  const styleClasses = typeof node.styleClasses === 'string'
    ? node.styleClasses.split(/\s+/).filter(Boolean).map((name) => `protota-style-${name}`).join(' ')
    : '';
  // Selection outline wins visually over the diagnostic tint (design §5.4).
  const diagnosticClass = diagnosticTier && !isSelected
    ? `protota-diag-outline-${diagnosticTier}`
    : '';
  const elementClass = [divClass, styleClasses, diagnosticClass].filter(Boolean).join(' ');

  // Several adw-* custom elements ADOPT their light-DOM children on connect:
  // adw-toolbar-view, adw-header-bar, and adw-toast-overlay snapshot the
  // children React rendered into them and move (or discard) them via
  // this.replaceChildren(...) into internal wrapper divs. From then on
  // React's picture of the host's child list disagrees with the real DOM,
  // and the next structural operation on the host — removeChild for a
  // deleted node, insertBefore for an added one — throws NotFoundError and
  // blanks the whole app (#137). Keying the host element on its rendered
  // child list makes any structural change remount the host itself: React
  // only ever removes the old host from the wrapper div it owns (never a
  // reparented child), and the fresh host re-adopts its children on connect.
  const hostKey = tag.startsWith('adw-')
    ? renderedSlotted.map(({ child, slot }) => `${child.id}@${slot ?? ''}`)
        .concat(controlsKind, iconPrefix ? 'icon-prefix' : '')
        .join('|')
    : undefined;

  return (
    <div
      ref={wrapperRef}
      slot={node.slot ?? inheritedSlot}
      className={`adw-node-wrapper${isSelected ? ' selected-outline' : ''}${isMultiSelected ? ' multi-selected-outline' : ''}`}
      style={{
        // Normal wrappers are layout-transparent, but a handful of
        // single-child container rules materialise them as flex conduits.
        // Applying native absolute placement here as well as on the widget
        // doubles every offset in those containers (a -1671px Week scroll
        // position became -3342px). Placement belongs to the rendered
        // widget; only selection chrome needs its own positioned anchor.
        ...(isSelected || isMultiSelected ? { position: 'relative' } : {}),
      }}
    >
      {isSelected && (
        <div className="protota-type-badge">{node.type}</div>
      )}

      {React.createElement(tag, {
        key: hostKey,
        ref: elRef,
        ...attrs,
        'data-protota-type': node.type,
        // Hit-testing anchor for drag-and-drop (#79): the rendered element is
        // the node's real box (the wrapper is display: contents), so drop
        // resolution and the insertion indicator both key off this attribute.
        'data-node-id': node.id,
        ...(nodeDiagnostics.length > 1 && !isSelected
          ? { 'data-protota-diag-count': String(nodeDiagnostics.length) }
          : {}),
        ...(isExpandedBoundary ? { 'data-protota-expanded': 'true' } : {}),
        // An unresolved boundary publishes the evidence behind its geometry
        // (#55): each fact's origin and confidence, so the Broadway
        // comparison artifact can audit where the allocated region came from
        // instead of trusting an arbitrary placeholder minimum.
        ...(node.type === 'custom-widget' && !isExpandedBoundary
          ? (() => {
              const facts = boundaryGeometryFacts(node, parentNode);
              return {
                'data-protota-geometry': JSON.stringify(facts),
                'data-protota-geometry-confidence': boundaryGeometryConfidence(facts),
                ...(node.sourceClass ? { 'data-protota-source-class': node.sourceClass } : {}),
              };
            })()
          : {}),
        ...((node.type === 'window' || isDialogRoot) && screenWidth ? { 'data-protota-render-surface': 'true' } : {}),
        // Placement lives on the rendered element because the wrapper is
        // layout-transparent (display: contents): the element itself is the
        // flex/grid item its parent lays out, so GTK expand and attach
        // semantics propagate instead of stopping at each wrapper.
        style: { ...containerLayout(node), ...placementLayout(node, parentFlow), ...rootSizeStyle },
        className: elementClass || undefined,
      },
        iconPrefix,
        binIcon,
        tabBarTabs,
        previewSwitcherTabs,
        directHeaderSwitcher,
        ...(children ?? []),
        windowControls,
        // For label/inscription — render text content
        ...(node.type === 'label' || node.type === 'inscription' || (node.type === 'custom-widget' && (!node.children || node.children.length === 0))
          ? [plainText(String(node.title || ''))]
          : []),
      )}

      {isSelected && legalAdds.length > 0 && (
        // Compact quick-add: one "+" chip opening a searchable popover over
        // the same LEGAL_CHILDREN data the old per-type pill row used. An
        // empty container centers the chip over its (near-zero) box so the
        // affordance stays discoverable; a populated one keeps the chip at
        // the old pill-row position below the node.
        <AddChildChip
          nodeId={node.id}
          nodeType={node.type}
          legalAdds={legalAdds}
          centered={!node.children || node.children.length === 0}
        />
      )}
    </div>
  );
};
