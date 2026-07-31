/**
 * Static construction facts from C sources.
 *
 * The mirror of `vala.ts`, for the many GNOME apps written in C. Nautilus,
 * Calendar, Text Editor and Disks all define widgets in code that no `.ui`
 * file mentions, so without this the importer can only render them as opaque
 * boundaries.
 *
 * This reads *facts*, never inferences. A value that is computed at runtime is
 * dropped rather than guessed: a plausible fake is worse than a labelled gap.
 */

export type CLiteral = string | number | boolean;

export interface CInsertion {
  /** Receiving widget, with any `self->` qualifier stripped. */
  parent: string;
  child: string;
  /** The call this came from, kept so importers can judge the slot. */
  method: string;
}

export interface CPropertyAssignment {
  target: string;
  property: string;
  value: CLiteral;
}

export interface CClassFacts {
  /** CamelCase class name, matching Blueprint's `$Name` spelling. */
  className: string;
  /** Dotted toolkit class, or CamelCase for an app-defined base. */
  baseClass?: string;
  /** Resource path from gtk_widget_class_set_template_from_resource. */
  templateResource?: string;
  /**
   * Fields bound with gtk_widget_class_bind_template_child. These names are
   * the object ids in the template, which is what lets a code-defined
   * composite be resolved back to real widgets.
   */
  templateChildren: string[];
  /** Local variable or field → constructed widget class. */
  constructions: Record<string, string>;
  insertions: CInsertion[];
  propertyAssignments: CPropertyAssignment[];
  /** gtk_widget_add_css_class calls with a literal class name. */
  styleClasses: Array<{ target: string; name: string }>;
}

/** Namespaces whose `_new` really does build a widget we can render. */
const WIDGET_NAMESPACES: Record<string, string> = {
  gtk: 'Gtk',
  adw: 'Adw',
  gtk_source: 'GtkSource',
  gd: 'Gd',
};

/** Macro namespaces, for GTK_TYPE_BOX-style tokens. */
const TYPE_MACRO_NAMESPACES: Record<string, string> = {
  GTK: 'Gtk',
  ADW: 'Adw',
  GTK_SOURCE: 'GtkSource',
};

/**
 * Constructors that return something real but not renderable. A gesture is
 * not a child, and treating one as a widget invents UI that does not exist.
 */
const NON_WIDGET_PATTERN =
  /^(Gtk|Adw)\.(Gesture|EventController|.*Controller|.*Layout|WindowGroup|.*Filter|.*Sorter|.*Model|.*Selection|.*Adjustment|SizeGroup|.*Buffer|TextTag|.*Store|Settings|.*Provider|Shortcut.*|.*Action|.*Dialog)/;

/** Calls whose second argument becomes a child of the first. */
const INSERT_SUFFIXES = [
  '_append', '_prepend', '_set_child', '_set_content', '_add_child',
  '_add_named', '_add_titled', '_add_overlay', '_add_top_bar',
  '_add_bottom_bar', '_attach', '_set_start_widget', '_set_end_widget',
  '_set_title_widget', '_add_suffix', '_add_prefix', '_set_extra_child',
];

/** snake_case → CamelCase. */
function camel(snake: string): string {
  return snake
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/**
 * GTK_TYPE_APPLICATION_WINDOW → Gtk.ApplicationWindow.
 * QUUX_TYPE_LIST_ROW → QuuxListRow (app-defined, so no dotted namespace).
 */
function classFromTypeMacro(macro: string): string | undefined {
  const match = /^([A-Z][A-Z0-9_]*?)_TYPE_([A-Z0-9_]+)$/.exec(macro.trim());
  if (!match) return undefined;
  const [, namespace, rest] = match;
  const known = TYPE_MACRO_NAMESPACES[namespace];
  if (known) return `${known}.${camel(rest)}`;
  return `${camel(namespace)}${camel(rest)}`;
}

/** gtk_label_new → Gtk.Label; quux_list_row_new → QuuxListRow. */
function classFromConstructor(fn: string): string | undefined {
  const base = fn.replace(/_new(_[a-z0-9_]+)?$/, '');
  if (base === fn) return undefined;
  // Longest namespace wins, so gtk_source_view_new is not read as Gtk.SourceView.
  const namespace = Object.keys(WIDGET_NAMESPACES)
    .filter((ns) => base === ns || base.startsWith(`${ns}_`))
    .sort((a, b) => b.length - a.length)[0];
  if (namespace) {
    const rest = base.slice(namespace.length + 1);
    if (!rest) return undefined;
    return `${WIDGET_NAMESPACES[namespace]}.${camel(rest)}`;
  }
  // g_*, gio, glib and friends are not widgets at all.
  if (/^g_/.test(base)) return undefined;
  return camel(base);
}

/** Strip comments without being fooled by ones inside string literals. */
function stripComments(code: string): string {
  let out = '';
  let index = 0;
  while (index < code.length) {
    const character = code[index];
    if (character === '"' || character === "'") {
      const quote = character;
      out += character;
      index += 1;
      while (index < code.length) {
        if (code[index] === '\\') { out += code.slice(index, index + 2); index += 2; continue; }
        out += code[index];
        index += 1;
        if (code[index - 1] === quote) break;
      }
      continue;
    }
    if (character === '/' && code[index + 1] === '/') {
      while (index < code.length && code[index] !== '\n') index += 1;
      continue;
    }
    if (character === '/' && code[index + 1] === '*') {
      index += 2;
      while (index < code.length && !(code[index] === '*' && code[index + 1] === '/')) index += 1;
      index += 2;
      continue;
    }
    out += character;
    index += 1;
  }
  return out;
}

/** Split a call's argument list at top-level commas. */
function splitArguments(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === '"' || character === "'") {
      const quote = character;
      current += character;
      index += 1;
      while (index < text.length) {
        if (text[index] === '\\') { current += text.slice(index, index + 2); index += 2; continue; }
        current += text[index];
        index += 1;
        if (text[index - 1] === quote) break;
      }
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      index += 1;
      continue;
    }
    current += character;
    index += 1;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

interface CCall {
  name: string;
  args: string[];
  /** Text immediately before the call, for `Type *var = call (...)`. */
  prefix: string;
  index: number;
}

/** Every `name (args)` call in source order. */
function findCalls(code: string): CCall[] {
  const calls: CCall[] = [];
  const pattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code))) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let cursor = open;
    while (cursor < code.length) {
      if (code[cursor] === '(') depth += 1;
      else if (code[cursor] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
      cursor += 1;
    }
    if (cursor >= code.length) continue;
    const lineStart = code.lastIndexOf('\n', match.index) + 1;
    calls.push({
      name: match[1],
      args: splitArguments(code.slice(open + 1, cursor)),
      prefix: code.slice(lineStart, match.index),
      index: match.index,
    });
    pattern.lastIndex = open + 1;
  }
  return calls;
}

/**
 * `self->sidebar` / `GTK_BOX (self->body)` / `heading` → the bare name.
 *
 * Cast macros wrap almost every argument in real GTK code, so unwrapping them
 * is the difference between reading a widget tree and reading nothing.
 */
function bareName(expression: string): string | undefined {
  let cleaned = expression.trim();
  // Unwrap nested casts: GTK_WIDGET (ADW_BIN (self->slot)).
  for (let guard = 0; guard < 8; guard += 1) {
    const cast = /^[A-Z][A-Z0-9_]*\s*\((.*)\)$/.exec(cleaned);
    if (!cast) break;
    cleaned = cast[1].trim();
  }
  cleaned = cleaned.replace(/^\((?:const\s+)?[A-Za-z_][A-Za-z0-9_ *]*\)\s*/, '').trim();
  const match = /^(?:[A-Za-z_][A-Za-z0-9_]*\s*->\s*)?([A-Za-z_][A-Za-z0-9_]*)$/.exec(cleaned);
  return match?.[1];
}

function literalOf(expression: string): CLiteral | undefined {
  const text = expression.trim();
  const string = /^"((?:[^"\\]|\\.)*)"$/.exec(text);
  if (string) return string[1].replace(/\\(.)/g, '$1');
  if (text === 'TRUE') return true;
  if (text === 'FALSE') return false;
  if (/^-?\d+$/.test(text)) return Number(text);
  if (/^-?\d*\.\d+$/.test(text)) return Number(text);
  return undefined;
}

/** Byte ranges of each function body, with the function's name. */
function findFunctionBodies(code: string): Array<{ name: string; start: number; end: number; instance?: string }> {
  const bodies: Array<{ name: string; start: number; end: number; instance?: string }> = [];
  const pattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(([^;{]*)\)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code))) {
    const open = code.indexOf('{', match.index + match[0].length - 1);
    let depth = 0;
    let cursor = open;
    while (cursor < code.length) {
      if (code[cursor] === '{') depth += 1;
      else if (code[cursor] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
      cursor += 1;
    }
    // The first parameter of a class-owned function is the instance. Its
    // name is the author's choice (`self`, `sidebar`, `entry`); recording it
    // lets facts normalise it to the language-neutral `this`.
    const firstParameter = match[2].split(',')[0]?.trim() ?? '';
    const instance = /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(firstParameter)?.[1];
    bodies.push({ name: match[1], start: open, end: cursor, instance });
    pattern.lastIndex = open + 1;
  }
  return bodies;
}

/**
 * Extract construction facts for every GObject class defined in a C file.
 */
export function extractCFacts(code: string): CClassFacts[] {
  const source = stripComments(code);

  // G_DEFINE_TYPE (Name, snake_prefix, BASE_TYPE) and its variants.
  const classes = new Map<string, CClassFacts>();
  const prefixes: Array<{ prefix: string; className: string }> = [];
  const definePattern =
    /\bG_DEFINE_(?:ABSTRACT_)?(?:FINAL_)?TYPE(?:_WITH_PRIVATE|_WITH_CODE)?\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([a-z_][a-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)/g;
  let define: RegExpExecArray | null;
  while ((define = definePattern.exec(source))) {
    const [, className, prefix, baseMacro] = define;
    if (classes.has(className)) continue;
    classes.set(className, {
      className,
      baseClass: classFromTypeMacro(baseMacro),
      templateChildren: [],
      constructions: {},
      insertions: [],
      propertyAssignments: [],
      styleClasses: [],
    });
    prefixes.push({ prefix, className });
  }
  if (!classes.size) return [];

  // Longest prefix first, so quux_panel_row_init is not read as quux_panel's.
  prefixes.sort((a, b) => b.prefix.length - a.prefix.length);
  const bodies = findFunctionBodies(source);
  const contextAt = (index: number): { facts: CClassFacts; instance?: string } | undefined => {
    const body = bodies.find((candidate) => index > candidate.start && index < candidate.end);
    if (!body) return undefined;
    const owner = prefixes.find(({ prefix }) => body.name.startsWith(`${prefix}_`));
    const facts = owner ? classes.get(owner.className) : undefined;
    return facts ? { facts, instance: body.instance } : undefined;
  };
  const classAt = (index: number): CClassFacts | undefined => contextAt(index)?.facts;

  // Constructors whose literal argument is a well-known property, by GTK
  // naming convention: gtk_image_new_from_icon_name ("x") sets icon-name.
  const CONSTRUCTOR_ARGUMENT_PROPERTIES: Array<{ pattern: RegExp; property: string }> = [
    { pattern: /_new_from_icon_name$/, property: 'icon-name' },
    { pattern: /_new_with_label$/, property: 'label' },
    { pattern: /^gtk_label_new$/, property: 'label' },
  ];

  let inlineCounter = 0;
  /**
   * A child argument that is itself a widget constructor call —
   * `adw_action_row_add_suffix (row, gtk_image_new_from_icon_name ("x"))` —
   * is as deterministic as a named variable. Synthesise one.
   */
  const inlineConstruction = (facts: CClassFacts, expression: string): string | undefined => {
    const call = /^([a-z][a-z0-9_]*)\s*\((.*)\)$/s.exec(expression.trim());
    if (!call || !/_new(_[a-z0-9_]+)?$/.test(call[1])) return undefined;
    const constructed = classFromConstructor(call[1]);
    if (!constructed || NON_WIDGET_PATTERN.test(constructed)) return undefined;
    const variable = `inline_${++inlineCounter}`;
    facts.constructions[variable] = constructed;
    const convention = CONSTRUCTOR_ARGUMENT_PROPERTIES.find(({ pattern }) => pattern.test(call[1]));
    const argument = splitArguments(call[2])[0];
    const value = argument === undefined ? undefined : literalOf(argument);
    if (convention && typeof value === 'string') {
      facts.propertyAssignments.push({ target: variable, property: convention.property, value });
    }
    return variable;
  };

  for (const call of findCalls(source)) {
    // Template wiring names its own class, which is more reliable than
    // guessing from the enclosing function.
    if (call.name === 'gtk_widget_class_bind_template_child'
        || call.name === 'gtk_widget_class_bind_template_child_private') {
      const owner = classes.get(call.args[1]?.trim() ?? '');
      const field = call.args[2] ? bareName(call.args[2]) : undefined;
      if (owner && field) owner.templateChildren.push(field);
      continue;
    }

    if (call.name === 'gtk_widget_class_set_template_from_resource') {
      const facts = classAt(call.index);
      const resource = call.args[1] !== undefined ? literalOf(call.args[1]) : undefined;
      if (facts && typeof resource === 'string') facts.templateResource = resource;
      continue;
    }

    const context = contextAt(call.index);
    if (!context) continue;
    const facts = context.facts;
    // The class's own instance parameter is `this` in fact terms, whatever
    // the author named it (`self`, `sidebar`, `entry`). A bare `self` is the
    // GObject convention for the same thing even when the parameter is a
    // GObject* (constructed() casts it to a local named self).
    const normalize = (name: string | undefined): string | undefined =>
      name !== undefined && (name === context.instance || name === 'self') ? 'this' : name;

    // set_parent takes (child, parent) — the reverse of every append.
    if (call.name === 'gtk_widget_set_parent' && call.args.length >= 2) {
      const child = bareName(call.args[0]);
      const parent = normalize(bareName(call.args[1]));
      if (child && parent) {
        facts.insertions.push({ parent, child, method: call.name });
      }
      continue;
    }

    // A literal style class is a rendered fact: Adwaita styles like
    // navigation-sidebar or spin change what the widget looks like.
    if (call.name === 'gtk_widget_add_css_class' && call.args.length >= 2) {
      const target = normalize(bareName(call.args[0]));
      const name = literalOf(call.args[1]);
      if (target && typeof name === 'string') {
        facts.styleClasses.push({ target, name });
      }
      continue;
    }

    const insertSuffix = INSERT_SUFFIXES.find((suffix) => call.name.endsWith(suffix));
    if (insertSuffix && call.args.length >= 2) {
      // g_list_append also ends in _append but is not a widget call.
      const namespace = Object.keys(WIDGET_NAMESPACES)
        .some((ns) => call.name.startsWith(`${ns}_`));
      const parent = normalize(bareName(call.args[0]));
      const child = bareName(call.args[1]) ?? (namespace && parent ? inlineConstruction(facts, call.args[1]) : undefined);
      if (namespace && parent && child) {
        facts.insertions.push({ parent, child, method: call.name });
        continue;
      }
      if (namespace) continue;
    }

    // Construction: `Type *var = gtk_label_new (...)` or a bare assignment.
    // `g_object_ref_sink (…)` / `g_object_ref (…)` are transparent ownership
    // wrappers — the GObject idiom for keeping a floating widget alive — so an
    // assignment through one is still the same construction fact.
    const assignment = /([A-Za-z_][A-Za-z0-9_]*)\s*(?:->\s*([A-Za-z_][A-Za-z0-9_]*)\s*)?=\s*(?:g_object_ref_sink\s*\(\s*|g_object_ref\s*\(\s*)?$/
      .exec(call.prefix);
    if (assignment) {
      const variable = assignment[2] ?? assignment[1];
      let constructed: string | undefined;
      if (call.name === 'g_object_new') {
        constructed = call.args[0] ? classFromTypeMacro(call.args[0]) : undefined;
      } else if (/_new(_[a-z0-9_]+)?$/.test(call.name)) {
        constructed = classFromConstructor(call.name);
      }
      if (constructed && !NON_WIDGET_PATTERN.test(constructed)) {
        facts.constructions[variable] = constructed;
      }
      continue;
    }

    // Literal property assignment: gtk_button_set_icon_name (b, "open").
    const setter = /^([a-z][a-z0-9_]*?)_set_([a-z0-9_]+)$/.exec(call.name);
    if (setter && call.args.length >= 2) {
      const isWidgetCall = Object.keys(WIDGET_NAMESPACES)
        .some((ns) => call.name.startsWith(`${ns}_`));
      const target = normalize(bareName(call.args[0]));
      const value = literalOf(call.args[1]);
      if (isWidgetCall && target && value !== undefined) {
        facts.propertyAssignments.push({
          target,
          property: setter[2].replace(/_/g, '-'),
          value,
        });
      }
    }
  }

  return [...classes.values()];
}
