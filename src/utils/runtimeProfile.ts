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
import { widgetClassForType, widgetTypeForClass } from './blueprint';

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
  /** Read-only semantic GObject properties captured by probe v2+. */
  properties?: Record<string, string | number | boolean | null>;
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
  mapped: boolean;
  visible: boolean;
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
 * Children as GTK sees them — GtkStackPage/AdwViewStackPage are not widgets,
 * so a page's child sits directly under the stack in the runtime tree — with
 * each flattened child keeping the name of the stack page it came through.
 * Page names let the aligner use the parent's own `visible-child-name` record
 * instead of trusting sibling order — AdwLeaflet, for one, keeps its runtime
 * children in reverse page order.
 */
function runtimeChildrenWithPageNames(node: AdwNode): Array<{ child: AdwNode; pageName: string | null }> {
  const raw = [...(node.children ?? []), ...(node.pages ?? [])];
  return raw.flatMap((child) => {
    if (child.type !== 'stack-page') return [{ child, pageName: null }];
    const rawName = (child as { name?: unknown }).name;
    const name = typeof rawName === 'string' ? rawName : null;
    return runtimeChildrenWithPageNames(child).map((inner) => ({ child: inner.child, pageName: inner.pageName ?? name }));
  });
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
      // GtkBuilder ids are template-scoped, so the probe may contain the same
      // id in an application's dormant template instance and its presented
      // dialog. Prefer the mapped occurrence; two equally mapped occurrences
      // remain structurally ambiguous and retain stable first occurrence.
      if (widget.buildableId) {
        const existing = this.byBuildableId.get(widget.buildableId);
        if (!existing || (!existing.mapped && widget.mapped)) {
          this.byBuildableId.set(widget.buildableId, widget);
        }
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
    // A presented AdwDialog lives inside AdwDialogHost rather than in GTK's
    // toplevel list. When the imported template retained its concrete class,
    // prefer that exact mapped GType anywhere in the tree; only ordinary
    // window roots fall back to the first mapped toplevel.
    const rootClass = expectedClass(root);
    const exactRoot = rootClass
      ? tree.widgets.find((widget) => widget.mapped && canonicalGType(widget.gtype) === rootClass)
      : undefined;
    const toplevel = exactRoot ?? tree.toplevels().find((widget) => widget.mapped) ?? tree.toplevels()[0];
    if (toplevel && !claimedWidgets.has(toplevel)) {
      matchedWidgetByNode.set(root, { widget: toplevel, by: 'structure' });
      claimedWidgets.add(toplevel);
    }
  }

  const alignChildren = (sourceNode: AdwNode, parentWidget: ProbeWidget): void => {
    const sourceChildren = runtimeChildrenWithPageNames(sourceNode);
    const probeChildren = tree.childrenOf(parentWidget);
    // The parent's own visible-child-name record is GTK's answer to which
    // page is showing. When source pages are named, it replaces ordinal trust:
    // the visible page's child must be a mapped widget, every other page's
    // child an unmapped one. AdwLeaflet keeps runtime children in reverse
    // page order, so ordinal alignment alone would cross-join the pages.
    const visibleChildName = typeof parentWidget.visibleChildName === 'string' ? parentWidget.visibleChildName : null;
    for (const { child, pageName } of sourceChildren) {
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
      const requireMapped = visibleChildName !== null && pageName !== null
        ? pageName === visibleChildName
        : null;
      const firstUnclaimed = (pool: ProbeWidget[]): ProbeWidget | undefined =>
        pool.find((candidate) => canonicalGType(candidate.gtype) === cls && !claimedWidgets.has(candidate)
          && (requireMapped === null || candidate.mapped === requireMapped));
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
      mapped: match.widget.mapped,
      visible: match.widget.visible,
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

export interface AppliedRuntimeEvidence {
  /** Node ids hidden because the probe saw them unmapped/invisible. */
  suppressed: string[];
  /** Node ids un-hidden: declared invisible in source, but mapped at runtime. */
  revealed: string[];
  /** Unresolved-boundary node ids that took allocation from native bounds. */
  allocated: string[];
  /** Runtime-only semantic branches projected into their matched source parent. */
  projected: string[];
}

/**
 * Consume a runtime join in the render path (#55 exit, ADR 0001 consumer 1).
 * Mutates the document tree the comparison renders:
 *
 *   1. A matched node the probe saw unmapped (or invisible) is suppressed —
 *      `visible: false`, origin `native:visible`. This is what turns
 *      Calculator's `converter_box` from a hand guess into GTK's own answer,
 *      and stops the runtime-invisible sibling squeezing its neighbours.
 *   2. An unresolved boundary (childless `custom-widget`) that matched a
 *      mapped widget takes its allocation from the native bounds:
 *      `runtimeEvidence` feeds `placementLayout` (allocation as minimums)
 *      and `boundaryGeometryFacts` (`native:*` facts, `native` confidence).
 *
 * Resolved nodes keep their statically imported geometry: the probe is
 * evidence for what static import cannot settle, not a pixel overlay.
 */
export function applyRuntimeEvidence(root: AdwNode, report: RuntimeProfileReport, probe?: ProbeDocument): AppliedRuntimeEvidence {
  const nodes: AdwNode[] = [];
  walkSource(root, nodes);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const matchByNodeId = new Map(report.matches.map(match => [match.nodeId, match]));
  const probeWidgetByPath = new Map((probe?.widgets ?? []).map(widget => [widget.indexPath.join(','), widget]));
  const parentByNode = new Map<AdwNode, AdwNode>();
  const indexParents = (node: AdwNode): void => {
    for (const child of [...(node.children ?? []), ...(node.pages ?? [])]) {
      parentByNode.set(child, node);
      indexParents(child);
    }
  };
  indexParents(root);
  const applied: AppliedRuntimeEvidence = { suppressed: [], revealed: [], allocated: [], projected: [] };
  for (const match of report.matches) {
    const node = nodeById.get(match.nodeId);
    if (!node) continue;
    const runtimeProperties = probeWidgetByPath.get(match.indexPath.join(','))?.properties ?? {};
    // A matched stock widget's settled semantic value is as authoritative as
    // its allocation. This covers labels populated by application code
    // (Clocks' 00:00.0 stopwatch), runtime button text, selected toggles and
    // icons without inventing app-specific finishing overrides.
    const runtimeLabel = ['label', 'text'].map(key => runtimeProperties[key])
      .find(value => typeof value === 'string') as string | undefined;
    const displayedRuntimeLabel = runtimeLabel !== undefined && node.useUnderline
      ? runtimeLabel.replace(/__|_./g, (match) => match === '__' ? '_' : match.slice(1))
      : runtimeLabel;
    const runtimeTitle = typeof runtimeProperties.title === 'string' ? runtimeProperties.title : undefined;
    if ((node.type === 'label' || node.type === 'inscription') && displayedRuntimeLabel !== undefined) {
      node.title = displayedRuntimeLabel;
      node.value = displayedRuntimeLabel;
    } else if ((node.type === 'button' || node.type === 'menu-button' || node.type === 'split-button') && displayedRuntimeLabel !== undefined) {
      node.title = displayedRuntimeLabel;
    } else if (runtimeTitle !== undefined) {
      node.title = runtimeTitle;
    }
    if (typeof runtimeProperties.subtitle === 'string') node.subtitle = runtimeProperties.subtitle;
    if (typeof runtimeProperties.description === 'string') node.description = runtimeProperties.description;
    if (typeof runtimeProperties['icon-name'] === 'string') node.iconName = runtimeProperties['icon-name'];
    if (typeof runtimeProperties['placeholder-text'] === 'string') node.placeholder = runtimeProperties['placeholder-text'];
    if (typeof runtimeProperties.active === 'boolean') node.active = runtimeProperties.active;
    if (!match.mapped || !match.visible) {
      node.visible = false;
      node.geometryOrigin = { ...node.geometryOrigin, visible: 'native' };
      applied.suppressed.push(node.id);
      continue;
    }
    // The mirror of suppression: a node the source declares invisible but the
    // probe saw mapped is shown at native origin. GsShell's template declares
    // visible=False because the app presents the window programmatically;
    // GTK's own answer is that it is mapped.
    if (node.visible === false) {
      node.visible = true;
      node.geometryOrigin = { ...node.geometryOrigin, visible: 'native' };
      applied.revealed.push(node.id);
    }
    // Probe-backed preset generation is a semantic runtime snapshot. Preserve
    // GTK's finished allocation for matched source containers too, relative
    // to their nearest matched runtime ancestor. This keeps source identity
    // while placing major panes/header/content at Broadway's coordinates.
    if (probe && match.bounds && node !== root) {
      let ancestorMatch: RuntimeMatch | undefined;
      let sourceAncestor = parentByNode.get(node);
      while (sourceAncestor) {
        const candidate = matchByNodeId.get(sourceAncestor.id);
        const isRuntimeAncestor = candidate && candidate.indexPath.length < match.indexPath.length
          && candidate.indexPath.every((part, index) => match.indexPath[index] === part);
        if (candidate?.bounds && isRuntimeAncestor) {
          ancestorMatch = candidate;
          break;
        }
        sourceAncestor = parentByNode.get(sourceAncestor);
      }
      const ancestorBounds = ancestorMatch?.bounds ?? { x: 0, y: 0, width: 0, height: 0 };
      node.runtimeEvidence = {
        probeVersion: report.probeVersion,
        matchedBy: match.matchedBy,
        buildableId: match.buildableId,
        gtype: match.gtype,
        mapped: match.mapped,
        visible: match.visible,
        bounds: match.bounds,
        relativeBounds: {
          x: match.bounds.x - ancestorBounds.x,
          y: match.bounds.y - ancestorBounds.y,
          width: match.bounds.width,
          height: match.bounds.height,
        },
      };
      if (ancestorMatch) nodeById.get(ancestorMatch.nodeId)!.runtimeProjectionHost = true;
    }
    const isUnresolvedBoundary = node.type === 'custom-widget'
      && (node.children?.length ?? 0) === 0 && (node.pages?.length ?? 0) === 0;
    if (isUnresolvedBoundary && match.bounds) {
      node.runtimeEvidence = {
        probeVersion: report.probeVersion,
        matchedBy: match.matchedBy,
        buildableId: match.buildableId,
        gtype: match.gtype,
        mapped: match.mapped,
        visible: match.visible,
        bounds: match.bounds,
      };
      applied.allocated.push(node.id);
    }
  }
  if (probe) applied.projected = projectRuntimeBranches(root, report, probe);
  return applied;
}

function runtimeNode(widget: ProbeWidget, parentBounds: ProbeBounds | null, probeVersion: number): AdwNode | null {
  const type = widgetTypeForClass(widget.gtype);
  if (!type || type === 'window' || !widget.mapped || !widget.visible) return null;
  const properties = widget.properties ?? {};
  const text = (...keys: string[]) => keys.map(key => properties[key]).find(value => typeof value === 'string' && value.length) as string | undefined;
  const number = (key: string) => typeof properties[key] === 'number' ? properties[key] as number : undefined;
  const boolean = (key: string) => typeof properties[key] === 'boolean' ? properties[key] as boolean : undefined;
  const node: AdwNode = {
    id: `runtime_${widget.indexPath.join('_')}`,
    type,
    sourceClass: widget.gtype,
    children: [],
    title: text('title', 'label', 'text'),
    subtitle: text('subtitle'),
    description: text('description'),
    iconName: text('icon-name'),
    placeholder: text('placeholder-text'),
    active: boolean('active'),
    orientation: properties.orientation === 'vertical' ? 'vertical'
      : properties.orientation === 'horizontal' ? 'horizontal' : undefined,
    spacing: number('spacing'),
    marginStart: widget.marginStart,
    marginEnd: widget.marginEnd,
    marginTop: widget.marginTop,
    marginBottom: widget.marginBottom,
    hexpand: widget.hexpandSet ? widget.hexpand : undefined,
    vexpand: widget.vexpandSet ? widget.vexpand : undefined,
    geometryOrigin: { visible: 'native' },
    runtimeEvidence: {
      probeVersion,
      matchedBy: 'structure',
      buildableId: widget.buildableId,
      gtype: widget.gtype,
      mapped: widget.mapped,
      visible: widget.visible,
      bounds: widget.bounds,
      relativeBounds: widget.bounds && parentBounds ? {
        x: widget.bounds.x - parentBounds.x,
        y: widget.bounds.y - parentBounds.y,
        width: widget.bounds.width,
        height: widget.bounds.height,
      } : widget.bounds,
    },
  };
  if (type === 'label' || type === 'inscription') node.value = node.title;
  return node;
}

/**
 * Merge mapped runtime-only widget branches into the nearest source widget.
 * A matched runtime path is never projected, so declarative children remain
 * authoritative and GTK implementation internals cannot duplicate them.
 */
export function projectRuntimeBranches(root: AdwNode, report: RuntimeProfileReport, probe: ProbeDocument): string[] {
  const sourceNodes: AdwNode[] = [];
  walkSource(root, sourceNodes);
  const sourceById = new Map(sourceNodes.map(node => [node.id, node]));
  const matchByPath = new Map(report.matches.map(match => [match.indexPath.join(','), match]));
  const widgets = [...(probe.widgets ?? [])].sort((a, b) => a.indexPath.length - b.indexPath.length);
  const widgetByPath = new Map(widgets.map(widget => [widget.indexPath.join(','), widget]));
  const children = new Map<string, ProbeWidget[]>();
  for (const widget of widgets) {
    const parent = widget.indexPath.slice(0, -1).join(',');
    const list = children.get(parent) ?? [];
    list.push(widget);
    children.set(parent, list);
  }
  const projected: string[] = [];
  const presentationOwners = new Set([
    'label', 'inscription', 'button', 'menu-button', 'split-button', 'entry', 'search-entry',
    'switch-widget', 'check-button', 'status-page', 'action-row', 'switch-row', 'combo-row',
    'spin-row', 'button-row', 'entry-row', 'password-row', 'avatar', 'progress-bar',
    'scale', 'level-bar', 'spinner', 'banner', 'view-switcher', 'header-bar',
  ]);
  const build = (widget: ProbeWidget, parentBounds: ProbeBounds | null): AdwNode[] => {
    if (!widget.mapped || !widget.visible || matchByPath.has(widget.indexPath.join(','))) return [];
    const node = runtimeNode(widget, parentBounds, report.probeVersion);
    // Flattened GTK implementation internals do not create a rendered
    // positioning context. Their supported descendants must therefore stay
    // relative to the nearest ancestor that *does* render, not to the
    // skipped widget's allocation. Otherwise deep custom views (Calendar's
    // month/week grids) collapse all descendants into the skipped origin.
    const descendantParentBounds = node ? widget.bounds ?? parentBounds : parentBounds;
    const descendants = (children.get(widget.indexPath.join(',')) ?? [])
      .flatMap(child => build(child, descendantParentBounds));
    if (!node) return descendants; // flatten unsupported GTK internals
    node.children = presentationOwners.has(node.type) ? [] : descendants;
    if (node.children.length) node.runtimeProjectionHost = true;
    projected.push(node.id);
    return [node];
  };
  for (const match of report.matches) {
    const parent = sourceById.get(match.nodeId);
    const runtimeParent = widgetByPath.get(match.indexPath.join(','));
    if (!parent || !runtimeParent || !match.mapped) continue;
    if (presentationOwners.has(parent.type)) continue;
    const additions = (children.get(match.indexPath.join(',')) ?? [])
      .flatMap(child => build(child, runtimeParent.bounds));
    if (!additions.length) continue;
    parent.children = [...(parent.children ?? []), ...additions];
    parent.runtimeProjectionHost = true;
  }
  return projected;
}

/**
 * A finishing override's recorded probe justification (ADR 0001 consumer 2).
 * `expect` is what the committed probe dump must still say about
 * `buildableId` for the entry to remain valid; a dump that no longer says it
 * (or a missing widget/dump) makes the entry stale, and stale probe entries
 * fail preset generation loudly, exactly like manual overrides whose node id
 * no longer matches the source.
 */
export interface ProbeEvidenceRef {
  probeVersion: number;
  buildableId: string;
  expect: { mapped?: boolean; visible?: boolean; visibleChildName?: string | null };
}

export function validateProbeEvidence(ref: ProbeEvidenceRef, probe: ProbeDocument | null): string[] {
  const label = `probeEvidence[${ref?.buildableId ?? '?'}]`;
  if (!probe) return [`${label}: no probe dump — a probe-derived entry without its dump is unauditable`];
  if (!ref || typeof ref.buildableId !== 'string' || !ref.expect || typeof ref.expect !== 'object') {
    return [`${label}: malformed — needs probeVersion, buildableId and expect`];
  }
  if (ref.probeVersion !== probe.probeVersion) {
    return [`${label}: probeVersion ${ref.probeVersion} does not match dump version ${probe.probeVersion}`];
  }
  const widget = (probe.widgets ?? []).find((candidate) => candidate.buildableId === ref.buildableId);
  if (!widget) return [`${label}: buildable id not present in the probe dump (stale entry)`];
  const errors: string[] = [];
  for (const [key, expected] of Object.entries(ref.expect)) {
    if (key !== 'mapped' && key !== 'visible' && key !== 'visibleChildName') {
      errors.push(`${label}: '${key}' is not a probe-checkable field`);
      continue;
    }
    const actual = widget[key] ?? null;
    if (actual !== expected) {
      errors.push(`${label}: dump says ${key}=${JSON.stringify(actual)}, entry expects ${JSON.stringify(expected)} (stale entry)`);
    }
  }
  return errors;
}
