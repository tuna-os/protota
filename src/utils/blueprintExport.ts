/**
 * Blueprint serializer/export side: MockupDocument -> Blueprint source.
 *
 * Moved verbatim from utils/blueprint.ts (no behavior change); that module
 * is now a compatibility facade re-exporting this file alongside
 * blueprintImport.ts. blueprintChildSource lives here because it emits
 * source exactly as the exporter would (consumed by utils/writeback.ts).
 */
import type { AdwNode, MockupDocument, Screen } from '../types/mockup';
import {
  ANNOTATION_SLOTS,
  blueprintStyleClassFor,
  BREAKPOINT_HOST_CLASSES,
  canonicalClassName,
  CLASS_TO_WIDGET_MAP,
  escapeBlueprintString,
  EXPORTED_FALSE_PROPERTIES,
  exportPropertyName,
  formatPropertyValue,
  INTERNAL_PROPERTIES,
  isBlueprintLayoutProperty,
  isNonVisualClass,
  OBJECT_REFERENCE_PROPERTIES,
  propertiesOf,
  widgetClassForType,
} from './blueprintCodec';

export function indent(n: number): string { return '  '.repeat(n); }





export interface ExportContext {
  /** Object ids present in this document, so references can be validated. */
  knownIds: Set<string>;
  /** Ids already written, so a flattened template cannot duplicate one. */
  usedIds: Set<string>;
  /**
   * Original id → exported id. Renaming a duplicate is only half the job: a
   * property naming the original would otherwise resolve to whichever copy
   * kept the name, which is a different widget.
   */
  idMap: Map<AdwNode, string>;
  /** Original id → the single exported id references should point at. */
  renames: Map<string, string>;
  /**
   * Ids that actually appear in the emitted source. A subset of knownIds:
   * children of a source-referenced boundary exist in the document but are
   * not written (the boundary exports as its reference alone), and a
   * breakpoint setter naming one would stop the file compiling.
   */
  emittedIds?: Set<string>;
  /**
   * Export has two purposes and they disagree on one point. Patching back
   * into an app's own source must preserve a boundary's instance bindings,
   * where `template.` still resolves. A standalone file has no template
   * context, so the same binding stops it compiling.
   */
  standalone: boolean;
}

export interface BlueprintExportOptions {
  /** Emit a file that compiles on its own, rather than a patch for app source. */
  standalone?: boolean;
}

/**
 * Re-emit a preserved Adw.Breakpoint in real Blueprint syntax. Setters whose
 * target id is not in the exported document (or whose value is an unset) are
 * dropped — blueprint-compiler validates setter targets, and an unresolvable
 * reference would stop the whole file compiling. A condition-only breakpoint
 * is valid Blueprint and still worth keeping.
 */
export function breakpointToBlueprint(node: AdwNode, depth: number, context?: ExportContext): string {
  const exportedIds = context?.emittedIds ?? context?.knownIds;
  const setters = (node.breakpointSetters ?? []).filter((setter) =>
    setter.value !== null && (!exportedIds || exportedIds.has(setter.target)));
  // The breakpoint keeps its id: an anonymous re-import would mint a fresh
  // `imported-N` that can collide with a literal id elsewhere in the file.
  const exportedId = context?.idMap.get(node) ?? node.id;
  let source = `${indent(depth)}Adw.Breakpoint${exportedId ? ` ${exportedId}` : ''} {\n` +
    `${indent(depth + 1)}condition ("${escapeBlueprintString(String(node.breakpointCondition))}")\n`;
  if (setters.length) {
    source += `${indent(depth + 1)}setters {\n`;
    for (const setter of setters) {
      const target = context?.renames.get(setter.target) ?? setter.target;
      source += `${indent(depth + 2)}${target}.${setter.property}: ${formatPropertyValue(setter.property, setter.value)};\n`;
    }
    source += `${indent(depth + 1)}}\n`;
  }
  return `${source}${indent(depth)}}\n`;
}

export function nodeToBlueprint(node: AdwNode, depth: number = 0, context?: ExportContext): string {
  // A preserved Adw.Breakpoint has its own syntax; the generic property and
  // child emission below would mangle it.
  if (typeof node.breakpointCondition === 'string') {
    return breakpointToBlueprint(node, depth, context);
  }
  // An unresolved boundary exports as its real source reference. Replacing
  // `$MathButtons` with a Protota-invented class would corrupt the app source.
  // Export the class the source declared when we know it; fall back to the
  // renderer type's canonical class for widgets created in the editor.
  // Only claim a class the toolkit actually has. An app-defined composite
  // that was resolved from a template exports as the widget it resolved to,
  // because `ClocksHeaderBar` means nothing outside that app's source.
  const declaredClass = typeof node.sourceClass === 'string' ? node.sourceClass : '';
  // Runtime probes and GtkBuilder spell classes as GObject names (`GtkBox`),
  // which Blueprint reads as an unqualified name in the Gtk namespace and
  // rejects. Emit the namespaced spelling of any class the registry knows.
  const canonicalDeclared = canonicalClassName(declaredClass);
  const libraryClass = declaredClass && CLASS_TO_WIDGET_MAP[canonicalDeclared]
    ? canonicalDeclared
    : declaredClass && CLASS_TO_WIDGET_MAP[declaredClass]
      ? declaredClass
      : '';
  // A `$` reference names a GType, which has no dots: an unresolved
  // `Gtk.SourceBuffer` boundary is `$GtkSourceBuffer`.
  const className = node.type === 'custom-widget' && declaredClass
    ? `$${declaredClass.replace(/\./g, '')}`
    : libraryClass || widgetClassForType(node.type) || node.type;
  const props: string[] = [];
  const layout: string[] = [];
  const classProperties = className.startsWith('$') ? null : propertiesOf(className);

  // A source-referenced boundary exports as its reference alone. Its children
  // and expand flags are Protota's projection of code the app owns; writing
  // them back would flatten the app's source.
  const isSourceReference = node.type === 'custom-widget' && !!node.sourceClass;

  const styleClasses = typeof node.styleClasses === 'string'
    ? node.styleClasses.trim().split(/\s+/).filter(Boolean)
    : [];

  for (const [key, value] of Object.entries(node)) {
    if (INTERNAL_PROPERTIES.has(key) || value === undefined ||
        (value === false && !EXPORTED_FALSE_PROPERTIES.has(key)) || value === '') continue;
    // Signal handlers imported as properties (`notify::x`) are not properties.
    if (key.includes('::') || key.startsWith('notify')) continue;
    const styleClass = blueprintStyleClassFor(key);
    if (styleClass) {
      if (value === true) styleClasses.push(styleClass);
      continue;
    }
    if (isSourceReference && (key === 'vexpand' || key === 'hexpand')) continue;
    if (key === 'title' && node.type === 'custom-widget' && value === node.sourceClass) continue;

    if (key === 'title' && (node.type === 'button' || node.type === 'label' ||
        node.type === 'toggle' || node.type === 'inscription' ||
        node.type === 'menu-button' || node.type === 'split-button')) {
      if (!classProperties || classProperties.has('label')) {
        props.push(`label: ${formatPropertyValue('label', value)};`);
      }
      continue;
    }
    const name = exportPropertyName(key);
    // Drop a property the exported class does not have. An unknown class (an
    // app-defined boundary) is not filtered, since we have no data for it.
    if (classProperties && !classProperties.has(name) && !isBlueprintLayoutProperty(name)) continue;
    if (OBJECT_REFERENCE_PROPERTIES.has(name) &&
        (/^[A-Z]/.test(String(value)) || (context && !context.knownIds.has(String(value))))) {
      // Menus and adjustments live outside the exported widget tree; a
      // reference to one would not resolve.
      continue;
    }
    if (OBJECT_REFERENCE_PROPERTIES.has(name) && context) {
      const renamed = context.renames.get(String(value));
      if (renamed) {
        props.push(`${name}: ${renamed};`);
        continue;
      }
    }
    const declaration = `${name}: ${formatPropertyValue(name, value)};`;
    (isBlueprintLayoutProperty(name) ? layout : props).push(declaration);
  }
  const emittedNames = new Set(props.map((entry) => entry.split(':')[0].trim()));
  for (const [key, expression] of Object.entries(node.bindings ?? {})) {
    // `expression` is the placeholder for a binding the parser could not
    // model; emitting it would produce source that does not compile.
    if (!expression || expression === 'expression') continue;
    // A source-referenced boundary is written back into the app's own source,
    // where `template.` still resolves, so its instance bindings are kept. A
    // flattened widget has no template context, and emitting one there
    // produces Blueprint that does not compile.
    const flattened = expression.startsWith('$') || expression.startsWith('template.');
    if (flattened && (!isSourceReference || context?.standalone)) continue;
    const boundName = exportPropertyName(key);
    if (classProperties && !classProperties.has(boundName)) continue;
    // The resolved literal already carries this property's value.
    if (emittedNames.has(boundName)) continue;
    // A binding whose source object is not in this document cannot resolve.
    // GtkBuilder bindings name an object id, which a flattened export may not
    // carry.
    const bindingSource = expression.split('.')[0].replace(/^\$/, '');
    if (context?.standalone && bindingSource && !context.knownIds.has(bindingSource)) continue;
    props.push(`${boundName}: bind ${expression};`);
  }
  if (styleClasses.length) {
    props.push(`styles [ ${[...new Set(styleClasses)].map((name) => `"${name}"`).join(', ')} ]`);
  }

  const childSource = (isSourceReference ? [] : node.children || [])
    // Buffers, adjustments and other non-visual objects imported before the
    // non-visual filter learned their class must not survive into export:
    // `buffer: $GtkSourceBuffer { }` is source we cannot honestly emit.
    .filter((child) => !(typeof child.sourceClass === 'string' && isNonVisualClass(child.sourceClass)))
    // A breakpoint compiles only under a breakpoint-capable host. Under any
    // other parent (a user moved it, or import attached it oddly) it is
    // dropped rather than emitted as source that does not compile.
    .filter((child) => typeof child.breakpointCondition !== 'string' || BREAKPOINT_HOST_CLASSES.has(className))
    .map((child) => {
    const body = nodeToBlueprint(child, depth + 1, context);
    if (!child.slot) return body;
    if (ANNOTATION_SLOTS.has(child.slot)) {
      // `[top]` annotates the child that follows it.
      return `${indent(depth + 1)}[${child.slot}]\n${body}`;
    }
    // Everything else is an object-valued property: `content: Widget { … };`.
    // The name has to be one this class has — Adw.Bin takes `child` where
    // Adw.ToolbarView takes `content`.
    let slotName = child.slot;
    if (classProperties && !classProperties.has(slotName)) {
      const fallback = ['child', 'content'].find((candidate) => classProperties.has(candidate));
      if (!fallback) return body;
      slotName = fallback;
    }
    const trimmed = body.replace(/^\s+/, '').replace(/\n$/, '');
    return `${indent(depth + 1)}${slotName}: ${trimmed};\n`;
  });

  const exportedId = context?.idMap.get(node) ?? node.id;
  const idStr = exportedId ? ` ${exportedId}` : '';
  if (childSource.length === 0 && props.length === 0 && layout.length === 0) {
    return `${indent(depth)}${className}${idStr} {\n${indent(depth)}}\n`;
  }
  const layoutBlock = layout.length
    ? `${indent(depth + 1)}layout {\n` +
      layout.map((entry) => `${indent(depth + 2)}${entry}\n`).join('') +
      `${indent(depth + 1)}}\n`
    : '';

  return `${indent(depth)}${className}${idStr} {\n` +
    props.map((entry) => `${indent(depth + 1)}${entry}\n`).join('') +
    layoutBlock +
    childSource.join('') +
    `${indent(depth)}}\n`;
}

/**
 * A screen's width/height re-emitted as the faithful GTK property, so the
 * geometry survives the Blueprint round trip localStorage persistence rides
 * on (previously every reload reset screens to 1024×720). Windows carry
 * `default-width`/`default-height`; the Adw.Dialog family sizes through
 * `content-width`/`content-height`.
 */
export function withScreenGeometry(screen: Screen): AdwNode {
  const root = screen.rootNode;
  if (!(screen.width > 0) || !(screen.height > 0)) return root;
  if (root.type === 'window') {
    return { ...root, defaultWidth: screen.width, defaultHeight: screen.height };
  }
  if (root.type === 'dialog' || root.type === 'preferences-dialog' ||
      root.type === 'alert-dialog' || root.type === 'about-dialog') {
    return { ...root, contentWidth: screen.width, contentHeight: screen.height };
  }
  return root;
}

export function mockupToBlueprint(doc: MockupDocument, options?: BlueprintExportOptions): string {
  const roots = doc.screens.map(withScreenGeometry);
  const knownIds = new Set<string>();
  const collect = (node: AdwNode) => {
    if (node.id) knownIds.add(node.id);
    node.children?.forEach(collect);
  };
  roots.forEach(collect);
  // Assign exported ids up front, so a reference emitted before its target is
  // written still resolves to the right widget.
  const idMap = new Map<AdwNode, string>();
  const renames = new Map<string, string>();
  const usedIds = new Set<string>();
  const assign = (node: AdwNode) => {
    if (node.id) {
      let candidate = node.id;
      let suffix = 2;
      while (usedIds.has(candidate)) candidate = `${node.id}_${suffix++}`;
      usedIds.add(candidate);
      idMap.set(node, candidate);
      // The first widget to claim an id is the one references mean.
      if (!renames.has(node.id)) renames.set(node.id, candidate);
    }
    node.children?.forEach(assign);
  };
  roots.forEach(assign);

  // Mirror the emitter's descent so breakpoint setters can be validated
  // against ids the file will really contain: a source-referenced boundary
  // exports as its reference alone, so its children never get ids on disk.
  const emittedIds = new Set<string>();
  const collectEmitted = (node: AdwNode) => {
    if (node.id) emittedIds.add(node.id);
    if (node.type === 'custom-widget' && node.sourceClass) return;
    for (const child of node.children ?? []) {
      if (typeof child.sourceClass === 'string' && isNonVisualClass(child.sourceClass)) continue;
      collectEmitted(child);
    }
  };
  roots.forEach(collectEmitted);

  const context: ExportContext = {
    knownIds, usedIds, idMap, renames, emittedIds, standalone: options?.standalone ?? false,
  };
  const body = roots.map(root => nodeToBlueprint(root, 0, context)).join('\n');
  // A re-emitted GtkSource class (the importer canonicalizes `GtkSourceView`
  // to `GtkSource.View`) compiles only with its namespace imported.
  const gtkSourceImport = /\bGtkSource\.[A-Z]/.test(body) ? 'using GtkSource 5;\n' : '';
  return `using Gtk 4.0;\nusing Adw 1;\n${gtkSourceImport}\n${body}`;
}

// ---------------------------------------------------------------------------
// Host-side write-back helpers (scripts/protota-writeback.mjs)
//
// The write-back CLI patches property values and splices subtrees into an
// app's own Blueprint files. It reuses the exporter's single source of truth
// for property spelling, value formatting, and slot emission, so a patched
// file and a fully exported file can never disagree about syntax.
// ---------------------------------------------------------------------------


/**
 * Emit one node (and its subtree) as Blueprint source at the given indent
 * depth, including its slot decoration — `[top]` annotation or
 * `slot: Class { … };` object-valued property — exactly as the full exporter
 * would place a child of `parentClassName`.
 */
export function blueprintChildSource(node: AdwNode, depth: number, parentClassName?: string): string {
  const knownIds = new Set<string>();
  const idMap = new Map<AdwNode, string>();
  const usedIds = new Set<string>();
  const collect = (candidate: AdwNode) => {
    if (candidate.id) { knownIds.add(candidate.id); usedIds.add(candidate.id); idMap.set(candidate, candidate.id); }
    candidate.children?.forEach(collect);
  };
  collect(node);
  const context: ExportContext = { knownIds, usedIds, idMap, renames: new Map(), standalone: false };
  const body = nodeToBlueprint(node, depth, context);
  if (!node.slot) return body;
  if (ANNOTATION_SLOTS.has(node.slot)) return `${indent(depth)}[${node.slot}]\n${body}`;
  const parentProperties = parentClassName && !parentClassName.startsWith('$') ? propertiesOf(parentClassName) : null;
  let slotName = node.slot;
  if (parentProperties && !parentProperties.has(slotName)) {
    const fallback = ['child', 'content'].find((candidate) => parentProperties.has(candidate));
    if (!fallback) return body;
    slotName = fallback;
  }
  const trimmed = body.replace(/^\s+/, '').replace(/\n$/, '');
  return `${indent(depth)}${slotName}: ${trimmed};\n`;
}

