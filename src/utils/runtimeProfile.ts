/**
 * Runtime probe matching (#58, Phase 5 of docs/source-widget-architecture.md,
 * ADR 0001 Part 1).
 *
 * The native probe (containers/broadway/probe.c) serializes the live GTK
 * widget tree of the unmodified packaged app. This module joins those
 * runtime records to the imported source graph:
 *
 *   1. **Buildable ID first** — a widget whose `gtk_buildable_get_buildable_id`
 *      equals a source-declared object id IS that source node; template
 *      children carry their XML ids through GtkBuilder.
 *   2. **Structural fallback** — within an already-matched parent, children
 *      are aligned by gtype ordinal (the k-th source child of a class matches
 *      the k-th runtime child of that class). GTK interposes internal
 *      widgets, so alignment is per-class, order-preserving, and tolerant of
 *      runtime-only siblings.
 *   3. **Never pixels.** Bounds are output evidence, never a matching key.
 *
 * Matched nodes gain `origin: "native:<field>"` facts at the top `native`
 * confidence tier — GTK's own answer — which the Broadway comparison
 * artifact merges into each unresolved boundary's geometry audit trail.
 */
import type { AdwNode } from '../types/mockup';
import type { GeometryFact } from './nodeGeometry';
import { widgetClassForType } from './blueprint';

export interface ProbeBounds { x: number; y: number; width: number; height: number }

/** One widget record from the probe dump (schema: docs/runtime-probe.md). */
export interface ProbeWidget {
  gtype: string;
  buildableId: string | null;
  indexPath: number[];
  mapped: boolean;
  visible: boolean;
  bounds: ProbeBounds | null;
  halign?: string;
  valign?: string;
  hexpand?: boolean;
  vexpand?: boolean;
  hexpandSet?: boolean;
  vexpandSet?: boolean;
  marginStart?: number;
  marginEnd?: number;
  marginTop?: number;
  marginBottom?: number;
  widthRequest?: number;
  heightRequest?: number;
  cssClasses?: string[];
  visibleChildName?: string | null;
}

export interface ProbeDocument {
  probeVersion: number;
  app?: string | null;
  settleTicks?: number;
  widgets: ProbeWidget[];
}

export interface RuntimeMatch {
  nodeId: string;
  sourceClass: string | null;
  matchedBy: 'buildable-id' | 'structure';
  buildableId: string | null;
  gtype: string;
  indexPath: number[];
  bounds: ProbeBounds | null;
  facts: GeometryFact[];
}

export interface RuntimeProfileReport {
  probeVersion: number;
  app: string | null;
  probeWidgets: number;
  sourceNodes: number;
  matchedNodes: number;
  /** matchedNodes / sourceNodes — a weak join is visible, never silent. */
  matchRate: number;
  byBuildableId: number;
  byStructure: number;
  matches: RuntimeMatch[];
}

/** `GtkBox` -> `Gtk.Box`, `AdwViewStack` -> `Adw.ViewStack`; app classes stay. */
function canonicalGType(gtype: string): string {
  const known = /^(Adw|GtkSource|Gtk|Gio)([A-Z][A-Za-z0-9]*)$/.exec(gtype);
  return known ? `${known[1]}.${known[2]}` : gtype;
}

/** Ids invented during import are not source identities and never match. */
function declaredSourceId(node: AdwNode): string | null {
  return /^(template-)?imported-\d+$/.test(node.id) ? null : node.id;
}

/** The GTK class this source node is expected to be at runtime, canonical. */
function expectedClass(node: AdwNode): string | null {
  if (typeof node.sourceClass === 'string') return canonicalGType(node.sourceClass);
  return widgetClassForType(node.type);
}

/**
 * Children as GTK sees them: GtkStackPage/AdwViewStackPage are not widgets,
 * so a page's child sits directly under the stack in the runtime tree.
 */
function runtimeVisibleChildren(node: AdwNode): AdwNode[] {
  const raw = [...(node.children ?? []), ...(node.pages ?? [])];
  return raw.flatMap((child) => (child.type === 'stack-page' ? runtimeVisibleChildren(child) : [child]));
}

function walkSource(node: AdwNode, into: AdwNode[]): void {
  into.push(node);
  for (const child of [...(node.children ?? []), ...(node.pages ?? [])]) walkSource(child, into);
}

/** Native evidence facts for a matched widget, `origin: "native:<field>"`. */
export function nativeFactsFor(widget: ProbeWidget): GeometryFact[] {
  const facts: GeometryFact[] = [];
  if (widget.bounds) {
    const { x, y, width, height } = widget.bounds;
    facts.push({
      property: 'bounds',
      value: `${x},${y} ${width}x${height}`,
      origin: 'native:bounds',
      confidence: 'native',
    });
  }
  facts.push({ property: 'mapped', value: widget.mapped, origin: 'native:mapped', confidence: 'native' });
  facts.push({ property: 'visible', value: widget.visible, origin: 'native:visible', confidence: 'native' });
  if (widget.visibleChildName != null) {
    facts.push({
      property: 'visible-child-name',
      value: widget.visibleChildName,
      origin: 'native:visible-child-name',
      confidence: 'native',
    });
  }
  return facts;
}

class ProbeTree {
  readonly widgets: ProbeWidget[];
  private readonly children = new Map<string, ProbeWidget[]>();
  readonly byBuildableId = new Map<string, ProbeWidget>();

  constructor(widgets: ProbeWidget[]) {
    this.widgets = widgets.filter((widget) => Array.isArray(widget.indexPath));
    const ordered = [...this.widgets].sort((a, b) => a.indexPath.length - b.indexPath.length
      || (a.indexPath.at(-1) ?? 0) - (b.indexPath.at(-1) ?? 0));
    for (const widget of ordered) {
      const parentKey = widget.indexPath.slice(0, -1).join(',');
      if (widget.indexPath.length > 1) {
        const siblings = this.children.get(parentKey) ?? [];
        siblings.push(widget);
        this.children.set(parentKey, siblings);
      }
      // First occurrence wins: a duplicated id would otherwise be ambiguous.
      if (widget.buildableId && !this.byBuildableId.has(widget.buildableId)) {
        this.byBuildableId.set(widget.buildableId, widget);
      }
    }
  }

  toplevels(): ProbeWidget[] {
    return this.widgets.filter((widget) => widget.indexPath.length === 1);
  }

  childrenOf(widget: ProbeWidget): ProbeWidget[] {
    return this.children.get(widget.indexPath.join(',')) ?? [];
  }
}

export function matchRuntimeProfile(probe: ProbeDocument, root: AdwNode): RuntimeProfileReport {
  const tree = new ProbeTree(probe.widgets ?? []);
  const sourceNodes: AdwNode[] = [];
  walkSource(root, sourceNodes);
  // GtkStackPage wrappers are not runtime widgets; they are not matchable.
  const matchableNodes = sourceNodes.filter((node) => node.type !== 'stack-page');

  const matchedWidgetByNode = new Map<AdwNode, { widget: ProbeWidget; by: 'buildable-id' | 'structure' }>();
  const claimedWidgets = new Set<ProbeWidget>();

  // Pass 1 — buildable id: authoritative, position-independent.
  for (const node of matchableNodes) {
    const id = declaredSourceId(node);
    if (!id) continue;
    const widget = tree.byBuildableId.get(id);
    if (widget && !claimedWidgets.has(widget)) {
      matchedWidgetByNode.set(node, { widget, by: 'buildable-id' });
      claimedWidgets.add(widget);
    }
  }

  // Pass 2 — structure: within an already-matched parent, align children by
  // gtype ordinal. Seeded at the root: the screen's window node is the first
  // mapped toplevel (the comparison depicts exactly that window).
  if (!matchedWidgetByNode.has(root)) {
    const toplevel = tree.toplevels().find((widget) => widget.mapped) ?? tree.toplevels()[0];
    if (toplevel && !claimedWidgets.has(toplevel)) {
      matchedWidgetByNode.set(root, { widget: toplevel, by: 'structure' });
      claimedWidgets.add(toplevel);
    }
  }

  const alignChildren = (sourceNode: AdwNode, parentWidget: ProbeWidget): void => {
    const sourceChildren = runtimeVisibleChildren(sourceNode);
    const probeChildren = tree.childrenOf(parentWidget);
    for (const child of sourceChildren) {
      const existing = matchedWidgetByNode.get(child);
      if (existing) {
        // An id-matched child anchors recursion at ITS runtime widget even if
        // its structural position differs (buildable id preference).
        alignChildren(child, existing.widget);
        continue;
      }
      const cls = expectedClass(child);
      if (!cls) continue;
      // Source children are visited in order and each claim is permanent, so
      // "first unclaimed widget of the class" aligns the k-th source child of
      // a class with the k-th runtime child of it.
      const firstUnclaimed = (pool: ProbeWidget[]): ProbeWidget | undefined =>
        pool.find((candidate) => canonicalGType(candidate.gtype) === cls && !claimedWidgets.has(candidate));
      // GTK interposes internal containers (viewports, window handles); look
      // exactly one level deeper before giving up. Never deeper: an unbounded
      // descent would fabricate joins.
      const matched = firstUnclaimed(probeChildren)
        ?? firstUnclaimed(probeChildren.flatMap((candidate) => tree.childrenOf(candidate)));
      if (matched) {
        matchedWidgetByNode.set(child, { widget: matched, by: 'structure' });
        claimedWidgets.add(matched);
        alignChildren(child, matched);
      }
    }
  };
  // Seed alignment from EVERY id-matched pair, top-down, not just the root:
  // GTK interposes many runtime-only containers between the window and a
  // template child, so a deep buildable-id anchor (Calculator's `_buttons`)
  // must be able to structurally resolve its own subtree even when the
  // structural chain from the root cannot reach it.
  for (const node of matchableNodes) {
    const match = matchedWidgetByNode.get(node);
    if (match) alignChildren(node, match.widget);
  }

  const matches: RuntimeMatch[] = [];
  let byBuildableId = 0;
  let byStructure = 0;
  for (const node of matchableNodes) {
    const match = matchedWidgetByNode.get(node);
    if (!match) continue;
    if (match.by === 'buildable-id') byBuildableId++; else byStructure++;
    matches.push({
      nodeId: node.id,
      sourceClass: typeof node.sourceClass === 'string' ? node.sourceClass : null,
      matchedBy: match.by,
      buildableId: match.widget.buildableId,
      gtype: match.widget.gtype,
      indexPath: match.widget.indexPath,
      bounds: match.widget.bounds,
      facts: nativeFactsFor(match.widget),
    });
  }

  const sourceCount = matchableNodes.length;
  return {
    probeVersion: probe.probeVersion ?? 0,
    app: probe.app ?? null,
    probeWidgets: tree.widgets.length,
    sourceNodes: sourceCount,
    matchedNodes: matches.length,
    matchRate: sourceCount === 0 ? 0 : matches.length / sourceCount,
    byBuildableId,
    byStructure,
    matches,
  };
}
