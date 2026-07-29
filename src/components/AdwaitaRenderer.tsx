import React, { useRef, useEffect } from 'react';
import type { AdwNode } from '../types/mockup';
import { LEGAL_CHILDREN } from '../types/mockup';
import { useMockupStore } from '../store/mockupStore';

interface Props {
  node: AdwNode;
  screenId: string;
  screenWidth?: number;
  screenHeight?: number;
  inheritedSlot?: string;
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
  'view-stack':          'adw-view-stack',
  'view-switcher':       'adw-view-switcher',
  'navigation-view':     'adw-navigation-view',
  'tab-view':            'adw-tab-view',
  'overlay-split':       'adw-overlay-split-view',
  clamp:                 'adw-clamp',
  bin:                   null,
  'custom-widget':       null,
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
  'search-entry':        null,
  'switch-widget':       null,
  'check-button':        null,
  'list-box':            null,
  label:                 null,
  inscription:           null,
};

/** Div-only types: render a semantic container with Adwaita-styled layout. */
const DIV_TYPES = new Set([
  'bin', 'custom-widget', 'box', 'grid', 'center-box', 'stack', 'stack-page', 'scrolled-window', 'search-entry', 'switch-widget',
  'check-button', 'list-box', 'label', 'inscription',
]);

function nodeProps(node: AdwNode, inheritedSlot?: string): Record<string, string> {
  const p: Record<string, string> = {};
  const t = node.type;
  void inheritedSlot;

  // Layout attributes are part of the GTK widget model, rather than styling
  // hints.  In particular, GtkBox orientation must survive the model → DOM
  // boundary for every imported Blueprint and preset.
  if (t === 'box' && node.orientation) p.orientation = node.orientation;
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
  if (t === 'menu-button') {
    if (icon) p['icon-name'] = icon;
    if (node.title) p['menu-title'] = node.title;
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

function nodeLayout(node: AdwNode): React.CSSProperties | undefined {
  const placement: React.CSSProperties = {};
  if (node.minWidth !== undefined) placement.minWidth = node.minWidth;
  if (node.minHeight !== undefined) placement.minHeight = node.minHeight;
  if (node.widthRequest !== undefined) placement.width = node.widthRequest;
  if (node.heightRequest !== undefined) placement.height = node.heightRequest;
  if (node.column !== undefined) placement.gridColumn = `${node.column + 1} / span ${node.columnSpan ?? 1}`;
  if (node.row !== undefined) placement.gridRow = `${node.row + 1} / span ${node.rowSpan ?? 1}`;
  if (node.type === 'box') {
    return { gap: node.spacing ?? 12, ...placement };
  }
  if (node.type === 'grid') {
    return {
      gridTemplateColumns: `repeat(${node.columns ?? 1}, minmax(0, 1fr))`,
      rowGap: node.rowSpacing ?? node.spacing ?? 6,
      columnGap: node.columnSpacing ?? node.spacing ?? 6,
      ...placement,
    };
  }
  if (node.type === 'scrolled-window') return { overflow: 'auto', ...placement };
  return Object.keys(placement).length ? placement : undefined;
}

export const AdwaitaRenderer: React.FC<Props> = ({
  node, screenId, screenWidth, screenHeight,
  inheritedSlot,
}) => {
  const { selectedNodeId, selectNode, addChildNode, doc } = useMockupStore();
  const isSelected = selectedNodeId === node.id;

  const legalAdds = LEGAL_CHILDREN[node.type] || [];
  const elRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if ((node.type === 'window' || node.type === 'dialog') && elRef.current && screenWidth) {
      elRef.current.style.width = `${screenWidth}px`;
      if (screenHeight) elRef.current.style.height = `${screenHeight}px`;
    }
  }, [node.type, screenWidth, screenHeight]);

  const tag = TAG_MAP[node.type] || 'div';
  const attrs = nodeProps(node, inheritedSlot);

  // Apply theme class to window/dialog roots based on doc colorScheme
  const isRoot = node.type === 'window' || node.type === 'dialog' ||
    node.type === 'preferences-dialog';
  const themeClass = isRoot && doc.colorScheme !== 'auto'
    ? `theme-${doc.colorScheme}` : '';
  if (themeClass) attrs['class'] = themeClass;

  const children = node.children?.map((child, index) => (
    <AdwaitaRenderer
      key={child.id}
      node={child}
      screenId={screenId}
      inheritedSlot={childSlot(node, child, index)}
    />
  ));
  const iconPrefix = node.type === 'action-row' && node.iconName ? (
    <span
      aria-hidden="true"
      slot="prefix"
      className={`adw-icon adw-icon--${node.iconName.replace(/-symbolic$/, '')}`}
    />
  ) : null;

  // Div-only types get Adwaita-styled classes for layout/structure
  const divClass = DIV_TYPES.has(node.type) ? `protota-div-${node.type}` : '';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id, screenId);
  };

  return (
    <div
      onClick={handleClick}
      slot={node.slot ?? inheritedSlot}
      className={`adw-node-wrapper${isSelected ? ' selected-outline' : ''} ${divClass}`}
      style={{
        ...(isSelected ? { position: 'relative' } : {}),
        ...nodeLayout(node),
      }}
    >
      {isSelected && (
        <div className="protota-type-badge">{node.type}</div>
      )}

      {React.createElement(tag, {
        ref: elRef,
        ...attrs,
        'data-protota-type': node.type,
        ...(node.type === 'window' && screenWidth ? { 'data-protota-render-surface': 'true' } : {}),
        style: nodeLayout(node),
        className: divClass || undefined,
      },
        iconPrefix,
        ...(children ?? []),
        // For label/inscription — render text content
        ...(node.type === 'label' || node.type === 'inscription' || node.type === 'custom-widget'
          ? [node.title || '']
          : []),
      )}

      {isSelected && legalAdds.length > 0 && (
        <div style={{ position: 'absolute', bottom: '-28px', left: '0', display: 'flex', gap: '4px', flexWrap: 'wrap', zIndex: 10 }}>
          {legalAdds.map((type) => (
            <button
              key={type}
              className="protota-add-btn"
              onClick={(e) => { e.stopPropagation(); addChildNode(node.id, type); }}
            >
              + {type.replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
