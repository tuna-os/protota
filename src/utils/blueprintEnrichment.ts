import type { MockupDocument, AdwNode, ImportDiagnostic } from '../types/mockup';
import { extractValaFacts, type ValaClassFacts } from './vala';
import { extractCFacts, type CClassFacts } from './clang';
import { extractPythonFacts } from './python';
import {
  ANNOTATION_SLOTS,
  canonicalClassName,
  CLASS_TO_WIDGET_MAP,
  escapeBlueprintString,
  expandBundleTemplates,
  parseBlueprintRoots,
  type BlueprintSourceFile,
  type BlueprintTemplate,
} from './blueprint';

/**
 * Vala spellings that make the argument the receiver's sole child slot.
 * `set_parent` is C's spelling of the same fact for a plain GtkWidget
 * subclass: the widget parented directly onto the composite is its content.
 */
const VALA_SELF_CHILD_METHODS = new Set(['set_child', 'set_content', 'child', 'content', 'set_parent']);

function formatBlueprintValue(value: string | number | boolean): string {
  return typeof value === 'string' ? `"${escapeBlueprintString(value)}"` : String(value);
}

/** `styles ["a", "b"]` for a fact target, or the empty string. */
function factStyleClasses(facts: ValaClassFacts, target: string): string {
  const names = (facts.styleClasses ?? [])
    .filter(styleClass => styleClass.target === target)
    .map(styleClass => `"${escapeBlueprintString(styleClass.name)}"`);
  return names.length ? `styles [ ${names.join(', ')} ]` : '';
}

/**
 * Project a code-defined composite as Blueprint source, using only the
 * construction facts a language adapter discovered: the widget installed as
 * the class's own child, the children deterministically inserted into it, and
 * their literal properties. Classes whose declarative template exists in the
 * bundle are emitted as `$Template` references so normal template expansion
 * resolves their contents; everything else stays a boundary.
 */
function valaCompositeSnippet(
  facts: ValaClassFacts,
  templates: Map<string, BlueprintTemplate>,
): { snippet: string; projectedBaseClass?: string } | null {
  const emitVariable = (variable: string): string | null => {
    const constructedClass = facts.constructions[variable];
    if (!constructedClass) return null;
    // A popover parented in code is a popup surface allocated above the
    // window, invisible until opened — the same reason the declarative
    // parser filters `popover`-slot children out of the layout tree.
    if (/Popover/.test(constructedClass)) return null;
    const short = constructedClass.split('.').pop() ?? constructedClass;
    if (templates.has(short)) return `$${short} ${variable} {}`;
    const properties = facts.propertyAssignments
      .filter(assignment => assignment.target === variable)
      .map(assignment => `${assignment.property.replace(/_/g, '-')}: ${formatBlueprintValue(assignment.value)};`)
      .join(' ');
    const styles = factStyleClasses(facts, variable);
    const children = facts.insertions
      .filter(insertion => insertion.parent === variable)
      .map(insertion => emitVariable(insertion.child))
      .filter(Boolean)
      .join(' ');
    if (CLASS_TO_WIDGET_MAP[constructedClass] || CLASS_TO_WIDGET_MAP[short]) {
      return `${constructedClass} ${variable} { ${properties} ${styles} ${children} }`;
    }
    // A nested code-defined class stays a boundary here; the enrichment walk
    // revisits it with its own facts.
    return `$${short} ${variable} {}`;
  };

  // A single self-installed child is the composite's whole content (the
  // FullscreenBox/DragOverlay wrapper shape). With *several* self-installed
  // children and a renderable declared base, the base projection below keeps
  // all of them — an Overlay composite's set_child main child plus its
  // add_overlay layers — where the sole-child shortcut would drop siblings.
  const selfInsertions = facts.insertions.filter(insertion => insertion.parent === 'this');
  // The same gate the base projection itself applies: a plain Gtk.Widget base
  // names a custom-drawn widget and proves nothing renderable.
  const canonicalDeclaredBase = facts.baseClass ? canonicalClassName(facts.baseClass) : null;
  const baseIsRenderable = Boolean(
    !facts.overridesSnapshot
    && canonicalDeclaredBase && canonicalDeclaredBase !== 'Gtk.Widget' && canonicalDeclaredBase !== 'Widget'
    && CLASS_TO_WIDGET_MAP[canonicalDeclaredBase],
  );
  if (!(selfInsertions.length > 1 && baseIsRenderable)) {
    for (const insertion of selfInsertions) {
      if (!VALA_SELF_CHILD_METHODS.has(insertion.method)) continue;
      const snippet = emitVariable(insertion.child);
      if (snippet) return { snippet };
    }
  }

  // No sole-child root, but the composite may *be* its declared base widget:
  // `struct _EditorPreferencesSwitch { AdwActionRow row; … }` adds a switch
  // suffix to itself in init. Projecting the base class with the code-added
  // children is a construction fact, not a guess — gated on the base being a
  // real renderable library class. A plain Gtk.Widget base names a
  // custom-drawn widget and proves nothing renderable, so it is excluded.
  const base = facts.baseClass;
  if (!base) return null;
  // A snapshot-overriding class paints itself: its base-class chrome is not
  // its appearance, so it stays an honest boundary (GcalWeekHourBar draws
  // hour lines over the labels its GtkBox base carries).
  if (facts.overridesSnapshot) return null;
  const canonicalBase = canonicalClassName(base);
  if (canonicalBase === 'Gtk.Widget' || canonicalBase === 'Widget' || !CLASS_TO_WIDGET_MAP[canonicalBase]) return null;
  const selfChildren = facts.insertions
    .filter(insertion => insertion.parent === 'this')
    .map(insertion => {
      const body = emitVariable(insertion.child);
      if (!body) return null;
      // adw_action_row_add_suffix places its child in the `[suffix]` slot.
      const slot = insertion.method.replace(/^(add|set)_/, '');
      return ANNOTATION_SLOTS.has(slot) ? `[${slot}] ${body}` : body;
    })
    .filter(Boolean)
    .join(' ');
  // A chromeless container base with no discovered children would project as
  // an empty box that renders nothing — a boundary silently erased, when the
  // subclass almost certainly populates itself at runtime. A base that draws
  // its own chrome (a row, an entry) is that widget even when empty.
  const CHROMELESS_CONTAINER_TYPES = new Set([
    'bin', 'box', 'grid', 'center-box', 'clamp', 'stack', 'scrolled-window', 'overlay',
    'list-box', 'wrap-box', 'overlay-split', 'toolbar-view',
  ]);
  if (!selfChildren && CHROMELESS_CONTAINER_TYPES.has(CLASS_TO_WIDGET_MAP[canonicalBase])) return null;
  const selfProperties = facts.propertyAssignments
    .filter(assignment => assignment.target === 'this')
    .map(assignment => `${assignment.property.replace(/_/g, '-')}: ${formatBlueprintValue(assignment.value)};`)
    .join(' ');
  return {
    snippet: `${canonicalBase} { ${selfProperties} ${factStyleClasses(facts, 'this')} ${selfChildren} }`,
    projectedBaseClass: canonicalBase,
  };
}

/**
 * C insertion calls carry their full symbol (`adw_action_row_add_suffix`);
 * the enrichment engine reasons in Vala's short spellings (`add_suffix`).
 */
const C_METHOD_SUFFIXES = [
  'set_parent', 'set_child', 'set_content', 'add_suffix', 'add_prefix',
  'add_overlay', 'add_top_bar', 'add_bottom_bar', 'add_named', 'add_titled',
  'add_child', 'append', 'prepend', 'attach', 'set_start_widget',
  'set_end_widget', 'set_title_widget', 'set_extra_child',
];
function shortCMethod(method: string): string {
  return C_METHOD_SUFFIXES.find(suffix => method === suffix || method.endsWith(`_${suffix}`)) ?? method;
}

/**
 * C and Vala describe construction differently but yield the same *facts*, so
 * both feed one enrichment engine rather than two parallel implementations.
 * Only the extraction is language-specific.
 */
function valaShapeOfCFacts(facts: CClassFacts): ValaClassFacts {
  return {
    className: facts.className,
    baseClass: facts.baseClass,
    templateResource: facts.templateResource,
    // C has no declared-default syntax; the template is the source of truth.
    propertyDefaults: {},
    constructions: facts.constructions,
    insertions: facts.insertions.map(insertion => ({ ...insertion, method: shortCMethod(insertion.method) })),
    propertyAssignments: facts.propertyAssignments,
    styleClasses: facts.styleClasses,
    overridesSnapshot: facts.overridesSnapshot,
  };
}

/**
 * Phase 4 static enrichment: give code-defined boundaries their statically
 * discoverable contents. Structural only — facts come from language syntax,
 * never from application names or invented widgets.
 */
export function enrichWithValaFacts(doc: MockupDocument, valaFiles: BlueprintSourceFile[], templates: Map<string, BlueprintTemplate>, cFiles: BlueprintSourceFile[] = [], pythonFiles: BlueprintSourceFile[] = []): void {
  const factsByClass = new Map<string, ValaClassFacts>();
  for (const file of valaFiles) {
    for (const facts of extractValaFacts(file.content)) factsByClass.set(facts.className, facts);
  }
  for (const file of cFiles) {
    for (const facts of extractCFacts(file.content)) {
      // A Vala definition wins if an app somehow has both.
      if (!factsByClass.has(facts.className)) {
        factsByClass.set(facts.className, valaShapeOfCFacts(facts));
      }
    }
  }
  for (const file of pythonFiles) {
    for (const facts of extractPythonFacts(file.content)) {
      if (!factsByClass.has(facts.className)) factsByClass.set(facts.className, facts);
    }
  }
  if (!factsByClass.size) return;

  /**
   * A subclass of another *app-defined* class inherits that ancestor's
   * construction facts: the ancestor's init runs for every instance, so its
   * constructions/insertions are source evidence for the subclass too
   * (EartagTagEditableLabel extends EartagEditableLabel, which builds an
   * entry+label overlay). The chain resolves until a library base class.
   */
  const resolveBaseChain = (facts: ValaClassFacts, guard: ReadonlySet<string>): ValaClassFacts => {
    const base = facts.baseClass;
    if (!base || guard.has(facts.className)) return facts;
    const ancestor = factsByClass.get(base) ?? factsByClass.get(base.split('.').pop() ?? base);
    if (!ancestor || ancestor === facts) return facts;
    const resolved = resolveBaseChain(ancestor, new Set([...guard, facts.className]));
    return {
      ...facts,
      baseClass: resolved.baseClass,
      overridesSnapshot: facts.overridesSnapshot || resolved.overridesSnapshot,
      templateResource: facts.templateResource ?? resolved.templateResource,
      propertyDefaults: { ...resolved.propertyDefaults, ...facts.propertyDefaults },
      constructions: { ...resolved.constructions, ...facts.constructions },
      insertions: [...resolved.insertions, ...facts.insertions],
      propertyAssignments: [...resolved.propertyAssignments, ...facts.propertyAssignments],
      styleClasses: [...(resolved.styleClasses ?? []), ...(facts.styleClasses ?? [])],
    };
  };
  const diagnostics = doc.importDiagnostics ?? (doc.importDiagnostics = []);

  const expandNode = (node: AdwNode, seen: ReadonlySet<string>): void => {
    node.children?.forEach(child => expandNode(child, seen));
    if (node.type !== 'custom-widget' || !node.sourceClass || node.children?.length) return;
    const declaredFacts = factsByClass.get(node.sourceClass);
    if (!declaredFacts || seen.has(node.sourceClass)) return;
    const facts = resolveBaseChain(declaredFacts, new Set());
    // Expand flags set in code are geometry evidence for the boundary itself.
    for (const assignment of facts.propertyAssignments) {
      if (assignment.target !== 'this' || assignment.value !== true) continue;
      const projectFromCode = (property: 'vexpand' | 'hexpand') => {
        node[property] = true;
        // Record that code, not the declarative source, produced this fact so
        // the boundary's geometry audit trail (#55) names the right layer.
        (node.geometryOrigin ??= {})[property] = 'code';
      };
      if (assignment.property === 'vexpand' || assignment.property === 'vexpand_set') projectFromCode('vexpand');
      if (assignment.property === 'hexpand' || assignment.property === 'hexpand_set') projectFromCode('hexpand');
    }
    const projection = valaCompositeSnippet(facts, templates);
    if (!projection) return;
    const childDiagnostics: ImportDiagnostic[] = [];
    const roots = parseBlueprintRoots(expandBundleTemplates(projection.snippet, templates), childDiagnostics);
    if (!roots.length) return;
    if (projection.projectedBaseClass) {
      // The composite *is* its declared base widget. The node becomes that
      // widget — declared source properties (title, subtitle, visibility)
      // win over code facts — and stops being an unresolved boundary. Child
      // ids are namespaced per instance: eleven preference rows must not
      // share a `toggle`.
      const projected = roots[0];
      const namespaceIds = (child: AdwNode): void => {
        // Browser persistence immediately exports enriched documents back to
        // Blueprint. Keep generated ids inside Blueprint's identifier grammar;
        // a hyphen tokenizes as subtraction and made the app disappear on reload.
        child.id = `${node.id}_${child.id}`.replace(/[^A-Za-z0-9_]/g, '_');
        if (/^[0-9]/.test(child.id)) child.id = `node_${child.id}`;
        child.children?.forEach(namespaceIds);
      };
      projected.children?.forEach(namespaceIds);
      node.type = projected.type;
      node.children = projected.children ?? [];
      if (node.title === node.sourceClass) delete node.title;
      for (const [key, value] of Object.entries(projected)) {
        if (key === 'id' || key === 'slot' || key === 'children' || key === 'type' || node[key] !== undefined) continue;
        node[key] = value;
      }
    } else {
      node.children = roots;
    }
    diagnostics.push(...childDiagnostics, {
      code: 'static-source-expansion',
      sourceClass: node.sourceClass,
      sourceId: node.id,
      message: projection.projectedBaseClass
        ? `${node.sourceClass} is a code-defined subclass of ${projection.projectedBaseClass}; resolved to its base widget with its code-constructed children.`
        : `${node.sourceClass} composite discovered from Vala construction facts; contents projected from declarative templates in the source bundle.`,
    });
    const nested = new Set(seen);
    nested.add(node.sourceClass);
    (node.children ?? []).forEach(child => expandNode(child, nested));
  };

  // A binding to a template property with a declared literal default has a
  // statically known initial value. Projecting it (e.g. `visible: bind
  // $Class.box-visible` with `default = false`) is source evidence, not a
  // guess; runtime state changes stay out of reach until a runtime profile.
  const resolveBindingDefaults = (node: AdwNode): void => {
    for (const [property, expression] of Object.entries(node.bindings ?? {})) {
      const reference = /^\$([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9_-]+)(\s+inverted)?$/.exec(expression);
      if (!reference) continue;
      const owner = factsByClass.get(reference[1]);
      const declaredDefault = owner?.propertyDefaults[reference[2].replace(/-/g, '_')];
      if (typeof declaredDefault !== 'boolean') continue;
      const value = reference[3] ? !declaredDefault : declaredDefault;
      if (property === 'visible' && node.visible === undefined) node.visible = value;
    }
    node.children?.forEach(resolveBindingDefaults);
  };

  doc.screens.forEach(screen => expandNode(screen.rootNode, new Set()));
  doc.screens.forEach(screen => resolveBindingDefaults(screen.rootNode));
  // An expanded composite is no longer an unresolved boundary.
  const expandedKeys = new Set(
    diagnostics.filter(d => d.code === 'static-source-expansion').map(d => `${d.sourceClass}:${d.sourceId}`),
  );
  doc.importDiagnostics = diagnostics.filter(d => !(
    (d.code === 'template-not-in-bundle' || d.code === 'renderer-does-not-support-class') &&
    expandedKeys.has(`${d.sourceClass}:${d.sourceId}`)
  ));
}

