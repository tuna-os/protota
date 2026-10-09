import type { AdwNode, BreakpointSetter, ImportDiagnostic } from '../types/mockup';
import {
  editorPropertyName,
  isBreakpointClass,
  isNonVisualClass,
  makeNode,
  type BlueprintValue,
  type BlueprintSourceFile,
} from './blueprint';

export interface XmlElement {
  tag: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  text: string;
}

export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Minimal structural XML parser — elements, attributes, text, comments. */
export function parseXmlElements(code: string): XmlElement[] {
  const roots: XmlElement[] = [];
  const stack: XmlElement[] = [];
  const tagPattern = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/?[A-Za-z_][\w.:-]*(?:\s+[^<>]*?)?\/?>|[^<]+/g;
  const attrPattern = /([\w.:-]+)\s*=\s*"([^"]*)"|([\w.:-]+)\s*=\s*'([^']*)'/g;
  for (const match of code.matchAll(tagPattern)) {
    const chunk = match[0];
    if (chunk.startsWith('<!--') || chunk.startsWith('<?') || chunk.startsWith('<!DOCTYPE')) continue;
    if (chunk.startsWith('<![CDATA[')) {
      const parent = stack[stack.length - 1];
      if (parent) parent.text += chunk.slice(9, -3);
      continue;
    }
    if (!chunk.startsWith('<')) {
      const parent = stack[stack.length - 1];
      if (parent) parent.text += decodeXmlEntities(chunk);
      continue;
    }
    if (chunk.startsWith('</')) { stack.pop(); continue; }
    const tag = /^<([A-Za-z_][\w.:-]*)/.exec(chunk)![1];
    const attributes: Record<string, string> = {};
    for (const attr of chunk.matchAll(attrPattern)) {
      attributes[attr[1] ?? attr[3]] = decodeXmlEntities(attr[2] ?? attr[4] ?? '');
    }
    const element: XmlElement = { tag, attributes, children: [], text: '' };
    (stack[stack.length - 1]?.children ?? roots).push(element);
    if (!chunk.endsWith('/>')) stack.push(element);
  }
  return roots;
}

export function builderScalar(raw: string): BlueprintValue {
  const text = raw.trim();
  if (text === 'true' || text === 'True') return true;
  if (text === 'false' || text === 'False') return false;
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
}

/**
 * Project a GtkBuilder <object>/<template> element to a renderer node.
 * Structure-preserving: child roles become slots, object-valued properties
 * become slotted children, style classes and layout properties project onto
 * the node, and unknown classes survive as explicit boundaries.
 */
export function builderElementToNode(
  element: XmlElement,
  diagnostics: ImportDiagnostic[],
  nextId: () => string,
): AdwNode | null {
  const rawClass = element.tag === 'template'
    ? element.attributes.parent ?? element.attributes.class ?? 'GtkWidget'
    : element.attributes.class ?? 'GtkWidget';
  if (isNonVisualClass(rawClass)) return null;
  const id = element.attributes.id ?? nextId();
  const properties: Record<string, BlueprintValue> = {};
  const bindings: Record<string, string> = {};
  const children: AdwNode[] = [];
  const breakpoint = isBreakpointClass(rawClass);
  let breakpointCondition: string | undefined;
  const breakpointSetters: BreakpointSetter[] = [];

  for (const child of element.children) {
    if (breakpoint && child.tag === 'condition') {
      breakpointCondition = child.text.trim();
      continue;
    }
    if (breakpoint && child.tag === 'setter') {
      const target = child.attributes.object;
      const property = child.attributes.property;
      if (target && property) {
        const text = child.text.trim();
        // An empty <setter/> unsets the property when the breakpoint applies.
        breakpointSetters.push({
          target,
          property: property.replace(/_/g, '-'),
          value: text === '' ? null : builderScalar(text),
        });
      }
      continue;
    }
    if (child.tag === 'property') {
      const name = child.attributes.name;
      if (!name) continue;
      const objectValue = child.children.find(inner => inner.tag === 'object');
      if (objectValue) {
        const node = builderElementToNode(objectValue, diagnostics, nextId);
        if (node) children.push({ ...node, slot: name });
      } else if (child.attributes['bind-source']) {
        bindings[name] = `${child.attributes['bind-source']}.${child.attributes['bind-property'] ?? name}`;
      } else {
        properties[name] = builderScalar(child.text);
      }
      continue;
    }
    if (child.tag === 'binding') {
      const name = child.attributes.name;
      if (name) bindings[name] = child.text.trim() || 'expression';
      continue;
    }
    if (child.tag === 'child') {
      const slot = child.attributes.type;
      for (const inner of child.children) {
        if (inner.tag !== 'object' && inner.tag !== 'placeholder') continue;
        if (inner.tag === 'placeholder') continue;
        const node = builderElementToNode(inner, diagnostics, nextId);
        if (node) children.push(slot ? { ...node, slot } : node);
      }
      continue;
    }
    if (child.tag === 'style') {
      const styleNames: string[] = [];
      for (const styleClass of child.children) {
        const name = styleClass.attributes.name;
        if (name) styleNames.push(name);
        if (name === 'suggested-action') properties.suggested = true;
        if (name === 'destructive-action') properties.destructive = true;
        if (name === 'flat') properties.flat = true;
        if (name === 'circular') properties.circular = true;
      }
      if (styleNames.length) properties.styleClasses = styleNames.join(' ');
      continue;
    }
    if (child.tag === 'layout') {
      for (const layoutProperty of child.children) {
        const name = layoutProperty.attributes.name;
        if (!name) continue;
        properties[name] = builderScalar(layoutProperty.text);
      }
      continue;
    }
    // <signal>, <accessibility>, <attributes>, <items>… are non-structural.
  }
  if (breakpoint && breakpointCondition === undefined) return null;
  const node = makeNode(rawClass, id, properties, bindings, children, diagnostics);
  // A GtkBuilder template's concrete GType is its `class`, even though its
  // renderer shape comes from `parent`. Preserve both facts: `type` remains
  // the supported parent widget while sourceClass lets runtime matching join
  // a presented composite dialog (ClocksAlarmSetupDialog) instead of
  // incorrectly seeding it at the application's first toplevel window.
  if (element.tag === 'template' && element.attributes.class) {
    node.sourceClass = element.attributes.class;
  }
  if (breakpoint && breakpointCondition !== undefined) {
    node.breakpointCondition = breakpointCondition;
    if (breakpointSetters.length) node.breakpointSetters = breakpointSetters;
  }
  return node;
}

export function parseGtkBuilderRoots(code: string, diagnostics: ImportDiagnostic[]): AdwNode[] {
  let generatedId = 0;
  const nextId = () => `imported-${++generatedId}`;
  const roots: AdwNode[] = [];
  const visit = (elements: XmlElement[]) => {
    for (const element of elements) {
      if (element.tag === 'interface') { visit(element.children); continue; }
      if (element.tag === 'object' || element.tag === 'template') {
        const node = builderElementToNode(element, diagnostics, nextId);
        if (node) roots.push(node);
      }
      // <menu>, <requires>… are non-visual at the interface level.
    }
  };
  visit(parseXmlElements(code));
  return roots;
}

/**
 * GtkBuilder composite templates: an <object class="EditorPage"> instance
 * resolves against a <template class="EditorPage" parent="…"> defined in
 * another .ui file of the same bundle — the XML equivalent of Blueprint's
 * `$Class` template linking.
 */
export function collectBuilderTemplates(files: BlueprintSourceFile[], diagnostics: ImportDiagnostic[]): Map<string, AdwNode> {
  const templates = new Map<string, AdwNode>();
  let generatedId = 0;
  const nextId = () => `template-imported-${++generatedId}`;
  for (const file of files) {
    if (!/<template[\s>]/.test(file.content)) continue;
    const visit = (elements: XmlElement[]) => {
      for (const element of elements) {
        if (element.tag === 'interface') { visit(element.children); continue; }
        if (element.tag !== 'template') continue;
        const className = element.attributes.class;
        if (!className) continue;
        const node = builderElementToNode(element, diagnostics, nextId);
        if (node) templates.set(className, node);
      }
    };
    visit(parseXmlElements(file.content));
  }
  return templates;
}

export function resolveBuilderTemplates(node: AdwNode, templates: Map<string, AdwNode>, seen: ReadonlySet<string>, resolved: Set<string>): void {
  node.children?.forEach(child => resolveBuilderTemplates(child, templates, seen, resolved));
  if (node.type !== 'custom-widget' || !node.sourceClass || node.children?.length) return;
  const template = templates.get(node.sourceClass);
  if (!template || seen.has(node.sourceClass)) return;
  resolved.add(`${node.sourceClass}:${node.id}`);
  const projected = structuredClone(template);
  // GtkBuilder composite templates commonly bind an inner widget to a
  // property supplied by the concrete instance, e.g. ClocksHeaderBar's
  // `AdwViewSwitcher.stack <- ClocksHeaderBar.stack` while the instance sets
  // `stack=stack`. Once the template is flattened there is no GObject owner
  // left to perform that binding, so carry any source-known instance literal
  // onto the projected child. Dynamic properties remain as bindings.
  const resolveInstanceBindings = (projectedNode: AdwNode): void => {
    for (const [targetProperty, expression] of Object.entries(projectedNode.bindings ?? {})) {
      const reference = /^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9_-]+)$/.exec(expression);
      if (!reference || reference[1] !== node.sourceClass) continue;
      const sourceKey = editorPropertyName(reference[2], node.type);
      const value = node[sourceKey];
      if (value === undefined) continue;
      projectedNode[editorPropertyName(targetProperty, projectedNode.type)] = value;
      delete projectedNode.bindings![targetProperty];
    }
    if (projectedNode.bindings && Object.keys(projectedNode.bindings).length === 0) delete projectedNode.bindings;
    projectedNode.children?.forEach(resolveInstanceBindings);
  };
  resolveInstanceBindings(projected);
  node.type = projected.type;
  node.children = projected.children ?? [];
  if (node.title === node.sourceClass) delete node.title;
  for (const [key, value] of Object.entries(projected)) {
    if (key === 'id' || key === 'slot' || key === 'children' || node[key] !== undefined) continue;
    node[key] = value;
  }
  const nested = new Set(seen);
  nested.add(node.sourceClass!);
  node.children?.forEach(child => resolveBuilderTemplates(child, templates, nested, resolved));
}
