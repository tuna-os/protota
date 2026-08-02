/**
 * Node geometry as pure logic (#55, Phase 2 of
 * docs/source-widget-architecture.md).
 *
 * These functions translate GTK layout semantics — size requests as minimums,
 * expand flags, alignment, margins, container-driven allocation — into CSS,
 * independent of React so each rule is unit-testable. The renderer applies
 * the result; an unresolved custom-widget boundary additionally publishes the
 * evidence behind its geometry (`boundaryGeometryFacts`) so the Broadway
 * comparison artifact can audit where every applied fact came from.
 */
import type { CSSProperties } from 'react';
import type { AdwNode } from '../types/mockup';

/** How a parent arranges children, which decides what alignment means. */
export type ParentFlow = 'row' | 'column' | 'grid';

export function parentFlowOf(node: AdwNode): ParentFlow {
  if (node.type === 'grid') return 'grid';
  if (node.type === 'box' || node.type === 'center-box' || node.type === 'wrap-box') {
    return node.orientation === 'horizontal' ? 'row' : 'column';
  }
  if (node.type === 'header-bar' || node.type === 'overlay-split' || node.type === 'list-box-row') return 'row';
  return 'column';
}

/**
 * GTK halign/valign in CSS. On the cross axis alignment is `align-self`; on
 * the main axis of a flex container it is auto margins, which is the only
 * thing that positions a single child there. Grids use `justify-self` and
 * `align-self` directly.
 */
export function alignmentStyle(node: AdwNode, flow: ParentFlow): CSSProperties {
  const style: CSSProperties = {};
  const toSelf = (value: string) =>
    value === 'fill' ? 'stretch' : value === 'center' ? 'center' : value === 'end' ? 'flex-end' : 'flex-start';
  const mainAxisMargins = (value: string, axis: 'inline' | 'block') => {
    const startKey = axis === 'inline' ? 'marginInlineStart' : 'marginBlockStart';
    const endKey = axis === 'inline' ? 'marginInlineEnd' : 'marginBlockEnd';
    if (value === 'center') { style[startKey] = 'auto'; style[endKey] = 'auto'; }
    else if (value === 'end') style[startKey] = 'auto';
    else if (value === 'start') style[endKey] = 'auto';
  };

  const halign = typeof node.halign === 'string' ? node.halign : undefined;
  const valign = typeof node.valign === 'string' ? node.valign : undefined;

  if (flow === 'grid') {
    if (halign) style.justifySelf = halign === 'fill' ? 'stretch' : halign === 'end' ? 'end' : halign;
    if (valign) style.alignSelf = toSelf(valign);
    return style;
  }
  if (flow === 'row') {
    if (valign) style.alignSelf = toSelf(valign);
    if (halign && halign !== 'fill') mainAxisMargins(halign, 'inline');
    if (halign === 'fill') style.flexGrow = 1;
  } else {
    if (halign) style.alignSelf = toSelf(halign);
    if (valign && valign !== 'fill') mainAxisMargins(valign, 'block');
    if (valign === 'fill') style.flexGrow = 1;
  }
  return style;
}

/**
 * GTK margins. Declared margins are added around the widget on each side;
 * an alignment that already claimed a side with an `auto` margin (the flex
 * main-axis positioning mechanism) keeps the auto — the widget still hugs
 * its aligned edge, as GTK does.
 */
function marginStyle(node: AdwNode, base: CSSProperties): CSSProperties {
  const style: CSSProperties = {};
  const set = (key: 'marginInlineStart' | 'marginInlineEnd' | 'marginBlockStart' | 'marginBlockEnd', value: unknown) => {
    if (typeof value === 'number' && base[key] !== 'auto') style[key] = value;
  };
  set('marginInlineStart', node.marginStart);
  set('marginInlineEnd', node.marginEnd);
  set('marginBlockStart', node.marginTop);
  set('marginBlockEnd', node.marginBottom);
  return style;
}

/**
 * Placement layout: how this node sits inside ITS PARENT's flex/grid context.
 * Applied to the wrapper div, which is the parent's direct child.
 */
export function placementLayout(node: AdwNode, flow: ParentFlow = 'column'): CSSProperties | undefined {
  const placement: CSSProperties = { ...alignmentStyle(node, flow) };
  Object.assign(placement, marginStyle(node, placement));
  // GTK expand semantics: an expanding child (including an unresolved
  // custom-widget boundary such as Calculator's MathButtons) consumes the
  // parent's spare allocation instead of collapsing to a fallback minimum.
  // Expansion is per-axis: on the parent's main axis it is flex growth, on
  // the cross axis it is a stretch (unless an explicit alignment said
  // otherwise). hexpand in a vertical box must not grow the child taller.
  if (flow === 'grid') {
    if (node.hexpand && !node.halign) placement.justifySelf = 'stretch';
    if (node.vexpand && !node.valign) placement.alignSelf = 'stretch';
  } else {
    const mainExpand = flow === 'row' ? node.hexpand : node.vexpand;
    const crossExpand = flow === 'row' ? node.vexpand : node.hexpand;
    const crossAlign = flow === 'row' ? node.valign : node.halign;
    if (mainExpand) {
      placement.flexGrow = 1;
      if (flow === 'row') placement.minWidth = 0; else placement.minHeight = 0;
    }
    if ((mainExpand || crossExpand) && !crossAlign) placement.alignSelf = 'stretch';
    if (crossExpand) {
      if (flow === 'row') placement.minHeight = 0; else placement.minWidth = 0;
    }
  }
  // GTK size requests are MINIMUMS, not fixed sizes: a widget grows past its
  // request to fit content (a button's label must not wrap because the
  // source asked for a 146px minimum).
  if (node.minWidth !== undefined) placement.minWidth = node.minWidth;
  if (node.minHeight !== undefined) placement.minHeight = node.minHeight;
  if (node.widthRequest !== undefined) {
    placement.minWidth = Math.max(node.widthRequest, Number(placement.minWidth ?? 0));
  }
  if (node.heightRequest !== undefined) {
    placement.minHeight = Math.max(node.heightRequest, Number(placement.minHeight ?? 0));
  }
  // Native runtime evidence (#58): the probe measured the allocation GTK
  // gave this widget on the very surface the comparison renders. Unlike a
  // size request, the measured bounds are GTK's finished answer — expansion,
  // homogeneous shares and sibling pressure are already baked in — so the
  // boundary takes exactly that region: no flex growth past it, no squeeze
  // below it. A declared size request larger than the measurement still wins
  // via min-*, which CSS ranks above width/height.
  if (node.runtimeEvidence?.bounds) {
    placement.width = node.runtimeEvidence.bounds.width;
    placement.height = node.runtimeEvidence.bounds.height;
    placement.flexGrow = 0;
    placement.flexShrink = 0;
  }
  if (node.runtimeEvidence?.relativeBounds) {
    placement.position = 'absolute';
    placement.left = node.runtimeEvidence.relativeBounds.x;
    placement.top = node.runtimeEvidence.relativeBounds.y;
  }
  if (node.column !== undefined) placement.gridColumn = `${node.column + 1} / span ${node.columnSpan ?? 1}`;
  if (node.row !== undefined) placement.gridRow = `${node.row + 1} / span ${node.rowSpan ?? 1}`;
  return Object.keys(placement).length ? placement : undefined;
}

/**
 * Container layout: how this node arranges ITS OWN children. Applied to the
 * rendered element only — putting it on the wrapper as well would nest two
 * copies of the same layout and squeeze the element into its own grid cell.
 */
export function containerLayout(node: AdwNode): CSSProperties | undefined {
  const projectionHost = node.runtimeProjectionHost ? { position: 'relative' as const } : {};
  if (node.type === 'box') {
    return { gap: node.spacing ?? 12, ...projectionHost };
  }
  if (node.type === 'grid') {
    // GtkGrid has no declared column count; derive it from the children's
    // explicit attach positions and spans, as GTK does.
    const derivedColumns = Math.max(1, ...(node.children ?? []).map((child) =>
      (typeof child.column === 'number' ? child.column : 0) + (typeof child.columnSpan === 'number' ? child.columnSpan : 1)));
    return {
      gridTemplateColumns: `repeat(${node.columns ?? derivedColumns}, minmax(0, 1fr))`,
      rowGap: node.rowSpacing ?? node.spacing ?? 6,
      columnGap: node.columnSpacing ?? node.spacing ?? 6,
      // GtkGrid row-homogeneous divides the grid's allocation into equal
      // rows; without it a keypad collapses to its buttons' minimum height
      // instead of filling the region GTK gives it.
      ...(node.rowHomogeneous ? { gridAutoRows: 'minmax(0, 1fr)', height: '100%' } : {}),
      ...projectionHost,
    };
  }
  if (node.type === 'scrolled-window') return { overflow: 'auto', ...projectionHost };
  if (node.type === 'clamp' && typeof node.maximumSize === 'number') {
    // Adw.Clamp constrains its child to maximum-size, centered. Published as
    // a CSS variable the clamp child rule consumes; tightening-threshold
    // only shapes the transition curve, which a static render cannot show.
    return { '--protota-clamp-max': `${node.maximumSize}px`, ...projectionHost } as unknown as CSSProperties;
  }
  return Object.keys(projectionHost).length ? projectionHost : undefined;
}

/**
 * Evidence behind an unresolved boundary's geometry (#55). Every fact names
 * the source property (or container rule) that produced it and a confidence:
 *   - `native`   — measured from the live GTK widget tree by the runtime
 *                  probe (#58, Phase 5); GTK's own answer, the top tier;
 *   - `declared` — an explicit property on the boundary in declarative source;
 *   - `code`     — projected from a statically extracted code assignment;
 *   - `derived`  — implied by the parent container's GTK allocation model;
 *   - `fallback` — no evidence; the labelled renderer minimum applies.
 * Origins are `<layer>:<property>` so the Broadway comparison artifact can
 * audit exactly which source fact granted the boundary its region.
 */
export type GeometryConfidence = 'native' | 'declared' | 'code' | 'derived' | 'fallback';

export interface GeometryFact {
  property: string;
  value: string | number | boolean;
  origin: string;
  confidence: GeometryConfidence;
}

const GEOMETRY_SOURCE_NAMES: Record<string, string> = {
  widthRequest: 'width-request',
  heightRequest: 'height-request',
  hexpand: 'hexpand',
  vexpand: 'vexpand',
  halign: 'halign',
  valign: 'valign',
  marginStart: 'margin-start',
  marginEnd: 'margin-end',
  marginTop: 'margin-top',
  marginBottom: 'margin-bottom',
  visible: 'visible',
  column: 'layout.column',
  row: 'layout.row',
  columnSpan: 'layout.column-span',
  rowSpan: 'layout.row-span',
};

export function boundaryGeometryFacts(node: AdwNode, parent?: AdwNode): GeometryFact[] {
  const facts: GeometryFact[] = [];
  const origins = (node.geometryOrigin ?? {}) as Record<string, string>;
  const declared = (key: string, value: unknown, appliedAs?: string): void => {
    if (value === undefined) return;
    const layer = origins[key] === 'code' ? 'code' : origins[key] === 'native' ? 'native' : 'source';
    facts.push({
      // `property` names the applied effect; `origin` names the source
      // property that produced it (a size request applies as a minimum).
      property: appliedAs ?? GEOMETRY_SOURCE_NAMES[key] ?? key,
      value: value as string | number | boolean,
      origin: `${layer}:${GEOMETRY_SOURCE_NAMES[key] ?? key}`,
      confidence: layer === 'source' ? 'declared' : layer,
    });
  };

  declared('widthRequest', node.widthRequest, 'min-width');
  declared('heightRequest', node.heightRequest, 'min-height');
  if (node.hexpand) declared('hexpand', true);
  if (node.vexpand) declared('vexpand', true);
  declared('halign', typeof node.halign === 'string' ? node.halign : undefined);
  declared('valign', typeof node.valign === 'string' ? node.valign : undefined);
  declared('marginStart', node.marginStart);
  declared('marginEnd', node.marginEnd);
  declared('marginTop', node.marginTop);
  declared('marginBottom', node.marginBottom);
  if (node.visible === false) declared('visible', false);
  if (parent?.type === 'grid') {
    declared('column', node.column);
    declared('row', node.row);
    declared('columnSpan', node.columnSpan);
    declared('rowSpan', node.rowSpan);
  }

  // Container-driven allocation: the parent's GTK layout model assigns the
  // boundary a region regardless of the boundary's own properties.
  if (parent?.type === 'box' && parent.homogeneous) {
    facts.push({
      property: 'allocation', value: 'homogeneous-share',
      origin: 'container:GtkBox.homogeneous', confidence: 'derived',
    });
  }
  if (parent?.type === 'scrolled-window') {
    facts.push({
      property: 'allocation', value: 'scroller-viewport',
      origin: 'container:GtkScrolledWindow.child', confidence: 'derived',
    });
  }
  if (parent?.type === 'clamp' && typeof parent.maximumSize === 'number') {
    facts.push({
      property: 'max-width', value: parent.maximumSize,
      origin: 'container:Adw.Clamp.maximum-size', confidence: 'derived',
    });
  }
  if (parent?.type === 'stack' || parent?.type === 'view-stack') {
    facts.push({
      property: 'allocation', value: 'stack-page',
      origin: `container:${parent.type === 'stack' ? 'GtkStack' : 'Adw.ViewStack'}.visible-child`, confidence: 'derived',
    });
  }

  // Native runtime evidence (#58): the probe's measured answer for this
  // boundary, GTK's own allocation — the top confidence tier. Inlined here
  // (rather than importing from runtimeProfile) to keep this module free of
  // probe-schema dependencies.
  const native = node.runtimeEvidence;
  if (native) {
    if (native.bounds) {
      const { x, y, width, height } = native.bounds;
      facts.push({
        property: 'bounds', value: `${x},${y} ${width}x${height}`,
        origin: 'native:bounds', confidence: 'native',
      });
    }
    facts.push({ property: 'mapped', value: native.mapped, origin: 'native:mapped', confidence: 'native' });
    facts.push({ property: 'visible', value: native.visible, origin: 'native:visible', confidence: 'native' });
  }

  // No evidence at all: the boundary keeps the labelled renderer minimum.
  // This is honest — never an invented size.
  if (!facts.length) {
    facts.push({
      property: 'min-size', value: '48x48',
      origin: 'fallback:renderer-minimum', confidence: 'fallback',
    });
  }
  return facts;
}

/**
 * The confidence the DOM marker reports: the weakest among the applied static
 * facts — except that native evidence settles it. A probe-measured allocation
 * is GTK's own answer for the whole region, so its presence subsumes the
 * weaker static facts it sits alongside.
 */
export function boundaryGeometryConfidence(facts: GeometryFact[]): GeometryConfidence {
  if (facts.some((fact) => fact.confidence === 'native')) return 'native';
  const rank: GeometryConfidence[] = ['native', 'declared', 'code', 'derived', 'fallback'];
  return facts.reduce<GeometryConfidence>(
    (worst, fact) => (rank.indexOf(fact.confidence) > rank.indexOf(worst) ? fact.confidence : worst),
    'native');
}
