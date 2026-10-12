/**
 * Blueprint parser/import side: Blueprint/GtkBuilder source -> AdwNode trees.
 *
 * Moved verbatim from utils/blueprint.ts (no behavior change); that module
 * is now a compatibility facade re-exporting this file alongside
 * blueprintExport.ts. Bundle/template resolution lives here on the import
 * side; static code facts come from blueprintEnrichment.ts.
 */
import type {
  AdwNode,
  AdwNodeType,
  BreakpointSetter,
  ImportDiagnostic,
  MockupDocument,
  Screen,
  ScreenTemplateType,
} from '../types/mockup';
import { TEMPLATE_ROOT } from '../types/mockup';
import {
  canonicalClassName,
  CLASS_TO_WIDGET_MAP,
  editorPropertyName,
  isBreakpointClass,
  isNonVisualClass,
  type BlueprintValue,
} from './blueprintCodec';
import { enrichWithValaFacts } from './blueprintEnrichment';

/**
 * Parse Blueprint UI code or GtkBuilder XML without losing its widget tree.
 *
 * Blueprint has constructs that Protota does not model (templates, bindings,
 * object references). We retain the widgets, scalar properties, and named
 * child slots that determine Libadwaita layout.
 */

export interface Token {
  value: string;
  kind: 'word' | 'string' | 'number' | 'punct';
}

export function tokenizeBlueprint(code: string): Token[] {
  // Comments must be stripped with string awareness: real GNOME sources
  // contain `//` inside string literals (for example markup link targets like
  // "r:///"), and a regex-based comment pass destroys the rest of the line,
  // unbalancing every following brace.
  const tokens: Token[] = [];
  const wordPattern = /\$?[A-Za-z_][A-Za-z0-9_.-]*/y;
  const numberPattern = /-?\d+(?:\.\d+)?/y;
  let index = 0;
  while (index < code.length) {
    const character = code[index];
    if (character === '/' && code[index + 1] === '/') {
      const lineEnd = code.indexOf('\n', index);
      index = lineEnd === -1 ? code.length : lineEnd + 1;
      continue;
    }
    if (character === '/' && code[index + 1] === '*') {
      const commentEnd = code.indexOf('*/', index + 2);
      index = commentEnd === -1 ? code.length : commentEnd + 2;
      continue;
    }
    if (character === '"') {
      let end = index + 1;
      while (end < code.length && code[end] !== '"') {
        if (code[end] === '\\') end++;
        end++;
      }
      tokens.push({ value: code.slice(index, end + 1), kind: 'string' });
      index = end + 1;
      continue;
    }
    numberPattern.lastIndex = index;
    const number = numberPattern.exec(code);
    if (number) {
      tokens.push({ value: number[0], kind: 'number' });
      index = numberPattern.lastIndex;
      continue;
    }
    wordPattern.lastIndex = index;
    const word = wordPattern.exec(code);
    if (word) {
      tokens.push({ value: word[0], kind: 'word' });
      index = wordPattern.lastIndex;
      continue;
    }
    if ('{}[]:;,'.includes(character)) tokens.push({ value: character, kind: 'punct' });
    index++;
  }
  return tokens;
}

export function parseValue(token: Token | undefined): BlueprintValue | undefined {
  if (!token) return undefined;
  if (token.kind === 'string') {
    try { return JSON.parse(token.value); } catch { return token.value.slice(1, -1); }
  }
  if (token.kind === 'number') return Number(token.value);
  if (token.value === 'true') return true;
  if (token.value === 'false') return false;
  return token.value;
}


export function makeNode(
  rawClass: string,
  id: string,
  properties: Record<string, BlueprintValue>,
  bindings: Record<string, string>,
  children: AdwNode[],
  diagnostics: ImportDiagnostic[],
): AdwNode {
  const isTemplateReference = rawClass.startsWith('$');
  const sourceClass = isTemplateReference ? rawClass.slice(1) : rawClass;
  // Blueprint's `$` marks a type outside the imported namespaces, which
  // includes real library widgets (GtkSourceView, WebKit views) as well as
  // app-defined ones. A `$Name` whose class the registry knows is that
  // widget, not an unresolved boundary.
  let type = CLASS_TO_WIDGET_MAP[sourceClass] ?? CLASS_TO_WIDGET_MAP[canonicalClassName(sourceClass)];
  // An Adw.Leaflet declaring `can-unfold: false` never shows its pages side
  // by side — it is a navigation stack (the pattern GNOME Software's shell
  // uses). Rendering it as a split view would paint pages GTK never shows
  // together. Property-driven refinement, not an app-specific branch.
  if (type === 'overlay-split' && canonicalClassName(sourceClass) === 'Adw.Leaflet'
      && properties['can-unfold'] === false) {
    type = 'view-stack';
  }
  const node: AdwNode = { id, type: type ?? 'custom-widget', children };
  // A silent fallback or a dropped sibling makes an imported GNOME UI look
  // plausible while being structurally wrong. An unmapped class survives as
  // an explicit, labelled custom-widget boundary with a structured reason —
  // never as a fake generic box, and never as a parse error that hides the
  // rest of the source tree.
  if (!type) {
    node.sourceClass = sourceClass;
    node.title = sourceClass;
    diagnostics.push(isTemplateReference
      ? {
          code: 'template-not-in-bundle',
          sourceClass,
          sourceId: id,
          message: `$${sourceClass} has no template definition in the imported source; retained as an explicit custom-widget boundary.`,
        }
      : {
          code: 'renderer-does-not-support-class',
          sourceClass,
          sourceId: id,
          message: `${sourceClass} is not in the generic widget registry; retained as an explicit custom-widget boundary.`,
        });
  }
  for (const [key, value] of Object.entries(properties)) {
    node[editorPropertyName(key, node.type)] = value;
  }
  // Mnemonic underscores (`_Add`) are keyboard accelerators, not label text.
  if (node.useUnderline && typeof node.title === 'string') node.title = node.title.replace('_', '');
  // GTK's default GtkBox orientation is horizontal; the renderer's editing
  // default is vertical. Imported boxes must carry GTK's semantics.
  if (node.type === 'box' && node.orientation === undefined) node.orientation = 'horizontal';
  // Every imported node keeps the class the source declared. A widget mapped
  // onto a generic renderer type still has to export as itself: a
  // Gtk.Revealer rendered as a bin must not export as Adw.Bin, whose
  // properties it does not have. Rendering stays keyed on `type`; identity is
  // separate from appearance.
  if (!isTemplateReference) node.sourceClass = canonicalClassName(sourceClass);
  // A child in the `popover` slot is a popup surface: real, but allocated
  // above the window, never inside the parent's layout.
  if (node.children?.length) node.children = node.children.filter(child => child.slot !== 'popover');
  // Adw.ButtonContent supplies its parent button's icon and label.
  if (node.type === 'button' || node.type === 'menu-button' || node.type === 'split-button' || node.type === 'toggle') {
    const content = node.children?.find(child => child.sourceClass === 'Adw.ButtonContent');
    if (content) {
      if (node.title === undefined && content.title !== undefined) node.title = content.title;
      if (node.iconName === undefined && content.iconName !== undefined) node.iconName = content.iconName;
      node.children = node.children!.filter(child => child !== content);
    }
  }
  if (Object.keys(bindings).length) node.bindings = bindings;
  return node;
}

/** Custom Blueprint templates must be supplied by the source bundle. */
export function blueprintTemplateReferences(code: string): string[] {
  const tokens = tokenizeBlueprint(code);
  const references = new Set<string>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token.value.startsWith('$')) continue;
    // `template $Name: Class` declares a template; `$Name instance {}` uses it.
    if (tokens[index + 1]?.value !== ':') references.add(token.value.slice(1));
  }
  return [...references];
}

export function parseBlueprintRoots(code: string, diagnostics: ImportDiagnostic[]): AdwNode[] {
  const tokens = tokenizeBlueprint(code);
  let cursor = 0;
  let generatedId = 0;
  const nextId = () => `imported-${++generatedId}`;

  // Blueprint classes are capitalized (`Grid`, `Adw.Bin`) or template
  // references (`$MathButtons`); slot and property names are lowercase.
  // Recognition is syntactic — an unknown class is still an object node, so
  // it can survive as an explicit boundary instead of vanishing.
  const isClassWord = (token: Token | undefined): boolean =>
    token?.kind === 'word' &&
    (token.value.startsWith('$') || token.value.includes('.') || /^[A-Z]/.test(token.value));
  const isObjectStart = (index: number): boolean =>
    isClassWord(tokens[index]) &&
    (tokens[index + 1]?.value === '{' ||
      (tokens[index + 1]?.kind === 'word' && tokens[index + 2]?.value === '{'));

  const parseObject = (): AdwNode | null => {
    const rawClass = tokens[cursor++].value;
    const id = tokens[cursor]?.value === '{' ? nextId() : tokens[cursor++].value;
    cursor++; // opening '{'
    const properties: Record<string, BlueprintValue> = {};
    const bindings: Record<string, string> = {};
    const children: AdwNode[] = [];
    let pendingSlot: string | undefined;
    // Adw.Breakpoint bodies use dedicated syntax: `condition ("…")` and a
    // `setters { id.prop: value; }` block. Without explicit handling the
    // generic property/slot branches desynchronise the braces (the setters'
    // `}` closes the breakpoint, whose own `}` then closes the PARENT early,
    // silently dropping every following sibling).
    const breakpoint = isBreakpointClass(rawClass);
    let breakpointCondition: string | undefined;
    const breakpointSetters: BreakpointSetter[] = [];

    while (cursor < tokens.length && tokens[cursor].value !== '}') {
      const key = tokens[cursor];

      if (breakpoint && key?.value === 'condition' && tokens[cursor + 1]?.kind === 'string') {
        const parsed = parseValue(tokens[cursor + 1]);
        if (typeof parsed === 'string') breakpointCondition = parsed;
        cursor += 2;
        continue;
      }

      if (breakpoint && key?.value === 'setters' && tokens[cursor + 1]?.value === '{') {
        cursor += 2;
        while (cursor < tokens.length && tokens[cursor].value !== '}') {
          const entry = tokens[cursor];
          if (entry.kind === 'word' && tokens[cursor + 1]?.value === ':') {
            cursor += 2;
            let value: BlueprintValue | null | undefined;
            if (tokens[cursor]?.value === 'null') { value = null; cursor++; }
            else value = parseValue(tokens[cursor++]);
            while (cursor < tokens.length && tokens[cursor].value !== ';' && tokens[cursor].value !== '}') cursor++;
            if (tokens[cursor]?.value === ';') cursor++;
            const dot = entry.value.lastIndexOf('.');
            if (dot > 0 && value !== undefined) {
              breakpointSetters.push({
                target: entry.value.slice(0, dot),
                property: entry.value.slice(dot + 1).replace(/_/g, '-'),
                value,
              });
            }
          } else cursor++;
        }
        if (tokens[cursor]?.value === '}') cursor++;
        continue;
      }

      if (tokens[cursor + 1]?.value === ':') {
        cursor += 2;
        // Object-valued property (`child: Gtk.Label { ... };`) — the value is
        // a real widget in the named slot, and must not corrupt nesting.
        if (isObjectStart(cursor)) {
          const child = parseObject();
          if (child) children.push({ ...child, slot: key.value });
          if (tokens[cursor]?.value === ';') cursor++;
          continue;
        }
        // Translated strings: `_("x")` and `C_("ctx", "x")` mark the last
        // string literal as the display text. Parentheses are not tokens, so
        // the wrapper word is followed directly by its string arguments.
        if (tokens[cursor]?.kind === 'word' && /^(N?C?_|N_)$/.test(tokens[cursor].value) && tokens[cursor + 1]?.kind === 'string') {
          cursor++;
          let text: BlueprintValue | undefined;
          while (cursor < tokens.length && tokens[cursor].value !== ';' && tokens[cursor].value !== '}') {
            if (tokens[cursor].kind === 'string') text = parseValue(tokens[cursor]);
            cursor++;
          }
          if (tokens[cursor]?.value === ';') cursor++;
          if (text !== undefined) properties[key.value] = text;
          continue;
        }
        // Bindings and expressions are opaque source facts, preserved for
        // export rather than mistaken for one-token scalars.
        if (tokens[cursor]?.value === 'bind' || tokens[cursor]?.value === 'bind-property') {
          cursor++;
          const parts: string[] = [];
          while (cursor < tokens.length && tokens[cursor].value !== ';' && tokens[cursor].value !== '}') {
            parts.push(tokens[cursor++].value);
          }
          if (tokens[cursor]?.value === ';') cursor++;
          bindings[key.value] = parts.join(' ');
          continue;
        }
        const value = parseValue(tokens[cursor++]);
        if (value !== undefined) properties[key.value] = value;
        // A multi-token expression tail we do not model may not swallow the
        // following sibling; consume it up to the statement terminator.
        while (cursor < tokens.length && !['{', ';', ',', '}'].includes(tokens[cursor].value)) cursor++;
        if (tokens[cursor]?.value === ';' || tokens[cursor]?.value === ',') cursor++;
        continue;
      }

      // Child-type annotation: `[top]` places the object that follows it.
      // Ignoring these loses the placement of every header-bar button.
      if (key?.value === '[' && tokens[cursor + 1]?.kind === 'word' && tokens[cursor + 2]?.value === ']') {
        pendingSlot = tokens[cursor + 1].value;
        cursor += 3;
        continue;
      }

      if (key?.kind === 'word' && tokens[cursor + 1]?.value === '[') {
        // Blueprint arrays. Style classes with widget-property equivalents
        // (suggested-action, flat, …) project onto the node; the rest is
        // metadata, consumed so it cannot swallow following source widgets.
        const arrayValues: string[] = [];
        cursor += 2;
        while (cursor < tokens.length && tokens[cursor]?.value !== ']') {
          if (tokens[cursor].kind === 'string') {
            const parsed = parseValue(tokens[cursor]);
            if (typeof parsed === 'string') arrayValues.push(parsed);
          }
          cursor++;
        }
        if (tokens[cursor]?.value === ']') cursor++;
        if (tokens[cursor]?.value === ';' || tokens[cursor]?.value === ',') cursor++;
        if (key.value === 'styles') {
          for (const styleClass of arrayValues) {
            if (styleClass === 'suggested-action') properties.suggested = true;
            if (styleClass === 'destructive-action') properties.destructive = true;
            if (styleClass === 'flat') properties.flat = true;
            if (styleClass === 'circular') properties.circular = true;
          }
          // Remaining GTK style classes are retained verbatim: the renderer
          // styles the ones Adwaita defines (card, boxed-list, toolbar,
          // dim-label, title-N…) and app-specific ones stay as provenance.
          if (arrayValues.length) properties.styleClasses = arrayValues.join(' ');
        }
        continue;
      }

      if (key?.value === 'layout' && tokens[cursor + 1]?.value === '{') {
        cursor += 2;
        while (cursor < tokens.length && tokens[cursor]?.value !== '}') {
          const layoutKey = tokens[cursor];
          if (tokens[cursor + 1]?.value === ':') {
            cursor += 2;
            let value = parseValue(tokens[cursor++]);
            // GtkBuilder layout values are strings ("0"); grid placement math
            // needs real numbers.
            if (typeof value === 'string' && /^-?\d+$/.test(value)) value = Number(value);
            if (value !== undefined) properties[layoutKey.value] = value;
            if (tokens[cursor]?.value === ';' || tokens[cursor]?.value === ',') cursor++;
          } else cursor++;
        }
        if (tokens[cursor]?.value === '}') cursor++;
        continue;
      }

      if (isObjectStart(cursor)) {
        const child = parseObject();
        if (child) children.push(pendingSlot ? { ...child, slot: pendingSlot } : child);
        pendingSlot = undefined;
        continue;
      }

      // Slot blocks such as `content { Gtk.Box { ... } }` retain both their
      // widgets and their parent-defined structural role.
      if (key?.kind === 'word' && tokens[cursor + 1]?.value === '{') {
        const slot = key.value;
        cursor += 2;
        children.push(...parseBlock().map(child => ({ ...child, slot })));
        if (tokens[cursor]?.value === '}') cursor++;
        continue;
      }

      cursor++;
    }
    if (tokens[cursor]?.value === '}') cursor++;
    if (isNonVisualClass(rawClass)) return null;
    // A breakpoint with no readable condition can never activate; dropping it
    // is the pre-existing behavior and keeps it from rendering as a stray bin.
    if (breakpoint && breakpointCondition === undefined) return null;
    const node = makeNode(rawClass, id, properties, bindings, children, diagnostics);
    if (breakpoint && breakpointCondition !== undefined) {
      node.breakpointCondition = breakpointCondition;
      if (breakpointSetters.length) node.breakpointSetters = breakpointSetters;
    }
    return node;
  };

  const parseBlock = (): AdwNode[] => {
    const nodes: AdwNode[] = [];
    while (cursor < tokens.length && tokens[cursor].value !== '}') {
      if (isObjectStart(cursor)) {
        const node = parseObject();
        if (node) nodes.push(node);
        continue;
      }
      if (tokens[cursor]?.kind === 'word' && tokens[cursor + 1]?.value === '{') {
        const slot = tokens[cursor].value;
        cursor += 2;
        nodes.push(...parseBlock().map(child => ({ ...child, slot })));
        if (tokens[cursor]?.value === '}') cursor++;
        continue;
      }
      cursor++;
    }
    return nodes;
  };

  return parseBlock();
}

// ---------------------------------------------------------------------------
// GtkBuilder XML import (delegated to blueprintBuilder.ts)
// ---------------------------------------------------------------------------

export {
  type XmlElement,
  decodeXmlEntities,
  parseXmlElements,
  builderScalar,
  builderElementToNode,
  parseGtkBuilderRoots,
  collectBuilderTemplates,
  resolveBuilderTemplates,
} from './blueprintBuilder';
import {
  parseGtkBuilderRoots,
  collectBuilderTemplates,
  resolveBuilderTemplates,
} from './blueprintBuilder';

export interface BlueprintImportResult {
  roots: AdwNode[];
  diagnostics: ImportDiagnostic[];
}

/**
 * Parse a Blueprint or GtkBuilder document into its top-level widget trees,
 * with an import report. Unsupported classes and unresolved template
 * references survive as explicit `custom-widget` boundaries; each one is
 * recorded as a diagnostic rather than dropped or faked.
 */
export function blueprintImport(code: string): BlueprintImportResult {
  const diagnostics: ImportDiagnostic[] = [];
  const roots = /<(interface|object|template)[\s>]/.test(code)
    ? parseGtkBuilderRoots(code, diagnostics)
    : parseBlueprintRoots(code, diagnostics);
  if (!roots.length) throw new Error('No GTK or Libadwaita widgets found in the supplied code.');
  return { roots, diagnostics };
}

/** Parse a Blueprint or GtkBuilder document into its top-level widget trees. */
export function blueprintToNodes(code: string): AdwNode[] {
  return blueprintImport(code).roots;
}

/** Backwards-compatible single-root import API. */
export function blueprintToNode(code: string): AdwNode {
  return blueprintToNodes(code)[0];
}

/** Import all top-level widgets as editable screens in a Protota document. */
/**
 * Adw.MultiLayoutView shows one Adw.Layout at a time; every Adw.LayoutSlot in
 * that layout renders the sibling child whose slot name (or builder ID)
 * matches. Project the first declared layout — libadwaita's default — and
 * substitute its slots with the named children.
 */
export function resolveMultiLayoutViews(node: AdwNode): void {
  node.children?.forEach(resolveMultiLayoutViews);
  if (node.sourceClass !== 'Adw.MultiLayoutView' || !node.children?.length) return;
  const layouts = node.children.filter(child => child.sourceClass === 'Adw.Layout');
  if (!layouts.length) return;
  const fillers = node.children.filter(child => child.sourceClass !== 'Adw.Layout');
  const active = structuredClone(layouts[0]);
  const substitute = (host: AdwNode): void => {
    if (!host.children) return;
    host.children = host.children.map(child => {
      if (child.sourceClass === 'Adw.LayoutSlot') {
        const slotName = String(child.id ?? '');
        const filler = fillers.find(candidate => candidate.slot === slotName || candidate.id === slotName);
        if (filler) return { ...filler, slot: child.slot };
        return child;
      }
      substitute(child);
      return child;
    });
  };
  substitute(active);
  node.children = active.children ?? [];
  delete node.sourceClass;
}

/**
 * Resolve `visible: bind <widget-id>.visible [inverted]` against the referenced
 * widget's declared visibility. GTK widgets are visible unless the source says
 * otherwise, so a pair of mutually exclusive buttons (one bound to the
 * inverse of the other) renders as the one the app shows first — real static
 * evidence, not a guess about runtime state.
 */
export function resolveWidgetVisibilityBindings(root: AdwNode): void {
  const byId = new Map<string, AdwNode>();
  const index = (node: AdwNode) => { byId.set(node.id, node); node.children?.forEach(index); };
  index(root);

  const apply = (node: AdwNode) => {
    const expression = node.bindings?.visible;
    const reference = expression ? /^([A-Za-z_][A-Za-z0-9_]*)\.visible(\s+inverted)?$/.exec(expression) : null;
    const target = reference ? byId.get(reference[1]) : null;
    if (reference && target && node.visible === undefined) {
      const targetVisible = target.visible !== false;
      node.visible = reference[2] ? !targetVisible : targetVisible;
    }
    node.children?.forEach(apply);
  };
  apply(root);
}

export function blueprintToDocument(code: string, title = 'Imported GNOME App'): MockupDocument {
  const { roots: allRoots, diagnostics } = blueprintImport(code);
  // Real UI files declare popovers, panels, and helper widgets as siblings of
  // the window; when a window-like root exists, the document's screens are those
  // roots. The set is every window- or dialog-like root class the screen
  // templates can produce rather than an ad-hoc list: `alert-dialog` was
  // missing here, so a document whose last screen was an alert dialog exported
  // an `Adw.AlertDialog` root and then DROPPED that whole screen on the way back
  // in — silently, because `roots` was non-empty without it.
  // `box` (the `empty` template's root) is deliberately excluded: a bare
  // Gtk.Box sibling is a plausible helper widget, and keeping it would promote
  // helpers to phantom screens. A lone box still imports via the fallback below.
  const SCREEN_ROOT_TYPES = new Set<AdwNodeType>(
    Object.values(TEMPLATE_ROOT).filter((type) => type !== 'box'),
  );
  const windowRoots = allRoots.filter(root => SCREEN_ROOT_TYPES.has(root.type));
  const roots = windowRoots.length ? windowRoots : allRoots;
  roots.forEach(resolveMultiLayoutViews);
  roots.forEach(resolveWidgetVisibilityBindings);
  const inferType = (root: AdwNode): ScreenTemplateType =>
    root.type === 'preferences-dialog' ? 'preferences'
    : root.type === 'dialog' ? 'dialog'
    : root.type === 'alert-dialog' ? 'alert-dialog'
    : root.type === 'about-dialog' ? 'about'
    : root.type === 'status-page' ? 'status-page'
    : root.type === 'box' ? 'empty'
    : 'standard';
  // Screen geometry comes from the source's own declaration when it has one
  // (default-width on windows, content-width on the Adw.Dialog family) —
  // this is also what carries an edited screen size across the Blueprint
  // persistence round trip.
  const dimension = (value: unknown): number | undefined =>
    typeof value === 'number' && value > 0 ? value : undefined;
  const screens: Screen[] = roots.map((root, index) => {
    const width = dimension(root.defaultWidth) ?? dimension(root.contentWidth) ?? 1024;
    const height = dimension(root.defaultHeight) ?? dimension(root.contentHeight) ?? 720;
    // The size properties are transport for Screen.width/height: once
    // consumed they leave the node, so the document diff (write-back #80)
    // never mistakes the exporter's re-injection for a user edit.
    delete root.defaultWidth;
    delete root.defaultHeight;
    delete root.contentWidth;
    delete root.contentHeight;
    return {
      id: `imported-screen-${index + 1}`,
      title: String(root.title || `${title} ${index + 1}`),
      type: inferType(root),
      width,
      height,
      rootNode: root,
    };
  });
  // A breakpoint setter that names an id the import did not keep can never
  // apply; surface that as a diagnostic instead of silently ignoring it.
  const keptIds = new Set<string>();
  const indexIds = (node: AdwNode) => { keptIds.add(node.id); node.children?.forEach(indexIds); };
  roots.forEach(indexIds);
  const reportMissing = (node: AdwNode) => {
    for (const setter of node.breakpointSetters ?? []) {
      if (!keptIds.has(setter.target)) {
        diagnostics.push({
          code: 'breakpoint-setter-target-missing',
          sourceClass: 'Adw.Breakpoint',
          sourceId: node.id,
          message: `Adw.Breakpoint (${node.breakpointCondition}) sets ${setter.target}.${setter.property}, but no imported widget has id "${setter.target}"; the setter cannot apply.`,
        });
      }
    }
    node.children?.forEach(reportMissing);
  };
  roots.forEach(reportMissing);
  return { id: 'imported-document', title, colorScheme: 'auto', edges: [], screens, importDiagnostics: diagnostics };
}

export interface BlueprintSourceFile {
  path: string;
  content: string;
}

export interface BlueprintTemplate {
  className: string;
  body: string;
}

export function closingBrace(source: string, openingIndex: number): number {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = openingIndex; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (!escaped && character === '"') quoted = false;
      escaped = !escaped && character === '\\';
      continue;
    }
    if (character === '"') { quoted = true; continue; }
    if (character === '{') depth++;
    if (character === '}' && --depth === 0) return index;
  }
  throw new Error('Unclosed Blueprint template body');
}

export function collectTemplates(files: BlueprintSourceFile[]): Map<string, BlueprintTemplate> {
  const templates = new Map<string, BlueprintTemplate>();
  const declaration = /template\s+\$([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*([A-Za-z_.][A-Za-z0-9_.-]*)\s*\{/g;
  for (const file of files) {
    for (const match of file.content.matchAll(declaration)) {
      const openingIndex = (match.index || 0) + match[0].lastIndexOf('{');
      const end = closingBrace(file.content, openingIndex);
      templates.set(match[1], { className: match[2], body: file.content.slice(openingIndex + 1, end) });
    }
  }
  return templates;
}

export function expandBundleTemplates(source: string, templates: Map<string, BlueprintTemplate>, stack: string[] = []): string {
  const reference = /\$([A-Za-z_][A-Za-z0-9_-]*)\s+([A-Za-z_][A-Za-z0-9_-]*)\s*\{/g;
  return source.replace(reference, (match, name: string, id: string) => {
    const template = templates.get(name);
    if (!template) {
      // Leave the reference in source form; the parser retains it as an
      // explicit custom-widget boundary with its real class and instance ID.
      return match;
    }
    if (stack.includes(name)) throw new Error(`Recursive Blueprint template reference: $${[...stack, name].join(' → $')}`);
    // Inside an inlined body, `template.` refers to this template's class.
    // Qualify it so bindings keep their owner through expansion; inner
    // templates already qualified theirs during their own expansion.
    const body = expandBundleTemplates(template.body, templates, [...stack, name])
      .replace(/\b(bind(?:-property)?)\s+template\./g, `$1 $${name}.`);
    return `${template.className} ${id} {${body}`;
  });
}

/**
 * Import an official app's declarative UI bundle. The entry source is expanded
 * only through templates declared in the supplied files. Optional Vala sources
 * enrich code-defined boundaries with statically discoverable structure;
 * everything else remains an explicit boundary rather than an invented visual
 * stand-in.
 */
export function blueprintBundleToDocument(files: BlueprintSourceFile[], entryPath: string, title?: string): MockupDocument {
  const declarativeFiles = files.filter(file => /\.(blp|ui)$/i.test(file.path));
  const valaFiles = files.filter(file => /\.vala$/i.test(file.path));
  const cFiles = files.filter(file => /\.c$/i.test(file.path));
  const pythonFiles = files.filter(file => /\.py$/i.test(file.path));
  const entry = declarativeFiles.find(file => file.path === entryPath || file.path.endsWith(`/${entryPath}`));
  if (!entry) throw new Error(`Blueprint entry file not found in source bundle: ${entryPath}`);
  const templates = collectTemplates(declarativeFiles);
  const documentTitle = title || entry.path.replace(/^.*\//, '').replace(/\.(blp|ui)$/i, '');
  let doc: MockupDocument;
  let builderTemplates: Map<string, AdwNode> | null = null;
  // A resolved composite instance is no longer an unresolved boundary,
  // whichever boundary code the parse assigned it.
  const resolveBuilderPass = () => {
    if (!builderTemplates?.size) return;
    const diagnostics = doc.importDiagnostics ?? (doc.importDiagnostics = []);
    const resolvedKeys = new Set<string>();
    doc.screens.forEach(screen => resolveBuilderTemplates(screen.rootNode, builderTemplates!, new Set(), resolvedKeys));
    doc.importDiagnostics = diagnostics.filter(d => d.code === 'static-source-expansion' || !resolvedKeys.has(`${d.sourceClass}:${d.sourceId}`));
  };
  if (/\.ui$/i.test(entry.path)) {
    // GtkBuilder bundle: parse the entry, then resolve composite-template
    // instances against <template> definitions from the other .ui files.
    doc = blueprintToDocument(entry.content, documentTitle);
    builderTemplates = collectBuilderTemplates(declarativeFiles.filter(file => file !== entry), doc.importDiagnostics ?? (doc.importDiagnostics = []));
    resolveBuilderPass();
  } else {
    doc = blueprintToDocument(expandBundleTemplates(entry.content, templates), documentTitle);
  }
  if (valaFiles.length || cFiles.length || pythonFiles.length) {
    enrichWithValaFacts(doc, valaFiles, templates, cFiles, pythonFiles);
    // Enrichment can introduce boundaries whose classes are .ui templates.
    resolveBuilderPass();
  }
  // Template resolution and enrichment can introduce MultiLayoutView bodies.
  doc.screens.forEach(screen => resolveMultiLayoutViews(screen.rootNode));
  return doc;
}
