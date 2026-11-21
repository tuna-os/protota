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
  /**
   * The class installs its own GtkWidgetClass.snapshot vfunc — it paints
   * itself in code. Such a widget must never dissolve into a base-class
   * projection: whatever chrome its init constructs, the drawing is the
   * widget, and erasing the boundary would hide that from every metric.
   */
  overridesSnapshot?: boolean;
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

/**
 * `fn` without its `_new` or `_new_from_x` ending, when it has one.
 *
 * The ending is lower case to the last character, so only that tail of the
 * name is searched. A pattern here tried every `_new` against the whole rest
 * of the name, which is quadratic on a name built from repeats (#578).
 */
function constructorBase(fn: string): string | undefined {
  let tail = fn.length;
  while (tail > 0 && /[a-z0-9_]/.test(fn[tail - 1])) tail -= 1;
  for (let at = fn.indexOf('_new', tail); at !== -1; at = fn.indexOf('_new', at + 1)) {
    const after = at + 4;
    if (after === fn.length || (fn[after] === '_' && after + 1 < fn.length)) return fn.slice(0, at);
  }
  return undefined;
}

/** gtk_label_new → Gtk.Label; quux_list_row_new → QuuxListRow. */
function classFromConstructor(fn: string): string | undefined {
  const base = constructorBase(fn);
  if (base === undefined) return undefined;
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
  // Each argument is cut out whole. Adding one character at a time made a
  // long argument list cost far more memory than its length (#578).
  let start = 0;
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === '"' || character === "'") {
      const quote = character;
      index += 1;
      while (index < text.length) {
        if (text[index] === '\\') { index += 2; continue; }
        index += 1;
        if (text[index - 1] === quote) break;
      }
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      args.push(text.slice(start, index).trim());
      start = index + 1;
    }
    index += 1;
  }
  const rest = text.slice(start).trim();
  if (rest) args.push(rest);
  return args;
}

/**
 * For each `open` character, the index of the `close` that ends it, or -1
 * when none does. One pass over the file, whatever the nesting.
 */
function matchPairs(code: string, open: string, close: string): Int32Array {
  const partner = new Int32Array(code.length).fill(-1);
  const pending: number[] = [];
  for (let index = 0; index < code.length; index += 1) {
    const character = code[index];
    if (character === open) pending.push(index);
    else if (character === close) {
      const from = pending.pop();
      if (from !== undefined) partner[from] = index;
    }
  }
  return partner;
}

/** The name that ends at `end`: the word characters before it, less any leading digits. */
function nameEndingAt(text: string, end: number): string | undefined {
  let start = end;
  while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1])) start -= 1;
  while (start < end && /[0-9]/.test(text[start])) start += 1;
  return start < end ? text.slice(start, end) : undefined;
}

/**
 * The variable a call's result goes to, for `Type *var = call (...)` and
 * `self->var = call (...)`.
 *
 * `g_object_ref_sink (…)` / `g_object_ref (…)` are transparent ownership
 * wrappers — the GObject idiom for keeping a floating widget alive — so an
 * assignment through one is still the same assignment.
 *
 * Read backwards from the call and never past the line start. A pattern over
 * the line so far cost the square of a long line or a long word (#578).
 */
function assignedVariable(code: string, callStart: number): string | undefined {
  let cursor = callStart;
  const skipSpace = (): void => {
    while (cursor > 0 && code[cursor - 1] !== '\n' && /\s/.test(code[cursor - 1])) cursor -= 1;
  };
  skipSpace();
  if (code[cursor - 1] === '(') {
    cursor -= 1;
    skipSpace();
    const wrapper = ['g_object_ref_sink', 'g_object_ref']
      .find((name) => cursor >= name.length && code.startsWith(name, cursor - name.length));
    if (!wrapper) return undefined;
    cursor -= wrapper.length;
    skipSpace();
  }
  if (code[cursor - 1] !== '=') return undefined;
  cursor -= 1;
  skipSpace();
  return nameEndingAt(code, cursor);
}

/**
 * Calls nested deeper than this inside other calls are not read. Each level
 * reads its whole argument text, so N nested calls cost N² without a limit
 * (#578). GTK code nests a handful: a cast, a constructor, a translation.
 */
export const MAX_CALL_DEPTH = 32;

interface CCall {
  name: string;
  args: string[];
  /** The variable in `Type *var = call (...)`, when the call is assigned. */
  assignedTo?: string;
  index: number;
}

/** Every `name (args)` call in source order. */
function findCalls(code: string): CCall[] {
  const calls: CCall[] = [];
  const closing = matchPairs(code, '(', ')');
  /** Where each call around the current one closes, outermost first. */
  const around: number[] = [];
  const pattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code))) {
    const open = match.index + match[0].length - 1;
    const close = closing[open];
    if (close === -1) continue;
    while (around.length && around[around.length - 1] < open) around.pop();
    around.push(close);
    if (around.length > MAX_CALL_DEPTH) continue;
    calls.push({
      name: match[1],
      args: splitArguments(code.slice(open + 1, close)),
      assignedTo: assignedVariable(code, match.index),
      index: match.index,
    });
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

interface CFunctionBody {
  name: string;
  start: number;
  end: number;
  instance?: string;
}

/**
 * Byte ranges of each function body, with the function's name, in source
 * order. A block inside a listed body is left out: a lookup by position takes
 * the outermost body, so the list holds ranges that do not overlap.
 *
 * A header is `name (parameters) {`, with no `;` or `{` in the parameters.
 */
function findFunctionBodies(code: string): CFunctionBody[] {
  const bodies: CFunctionBody[] = [];
  const closing = matchPairs(code, '{', '}');
  const pattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  const stopPattern = /[;{]/g;
  // The first `;` or `{` after the parameters start, and the last character
  // before it that is not whitespace. Both are kept across names and only
  // move forward. One pattern for the whole header searched the rest of the
  // file again from every name that no `;` or `{` followed (#578).
  let stop = -1;
  let last = -1;
  let covered = -1;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code))) {
    const parameters = match.index + match[0].length;
    if (stop < parameters) {
      stopPattern.lastIndex = parameters;
      stop = stopPattern.exec(code)?.index ?? code.length;
      last = stop - 1;
      while (last >= parameters && /\s/.test(code[last])) last -= 1;
    }
    if (code[stop] !== '{' || code[last] !== ')') continue;
    const open = stop;
    pattern.lastIndex = open + 1;
    if (open < covered) continue;
    covered = closing[open] === -1 ? code.length : closing[open];
    // The first parameter of a class-owned function is the instance. Its
    // name is the author's choice (`self`, `sidebar`, `entry`); recording it
    // lets facts normalise it to the language-neutral `this`.
    const firstParameter = code.slice(parameters, last).split(',')[0]?.trim() ?? '';
    const instance = nameEndingAt(firstParameter, firstParameter.length);
    bodies.push({ name: match[1], start: open, end: covered, instance });
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
  const classByPrefix = new Map<string, CClassFacts>();
  const definePattern =
    /\bG_DEFINE_(?:ABSTRACT_)?(?:FINAL_)?TYPE(?:_WITH_PRIVATE|_WITH_CODE)?\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([a-z_][a-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)/g;
  let define: RegExpExecArray | null;
  while ((define = definePattern.exec(source))) {
    const [, className, prefix, baseMacro] = define;
    if (classes.has(className)) continue;
    const facts: CClassFacts = {
      className,
      baseClass: classFromTypeMacro(baseMacro),
      templateChildren: [],
      constructions: {},
      insertions: [],
      propertyAssignments: [],
      styleClasses: [],
    };
    classes.set(className, facts);
    if (!classByPrefix.has(prefix)) classByPrefix.set(prefix, facts);
  }
  if (!classes.size) return [];

  // Longest prefix first, so quux_panel_row_init is not read as quux_panel's.
  // Only the lengths that some prefix has are tried, so a file of many
  // classes does not cost a comparison per class for each function.
  const prefixLengths = [...new Set([...classByPrefix.keys()].map((prefix) => prefix.length))]
    .sort((a, b) => b - a);
  const ownerOf = (name: string): CClassFacts | undefined => {
    for (const length of prefixLengths) {
      const facts = name[length] === '_' ? classByPrefix.get(name.slice(0, length)) : undefined;
      if (facts) return facts;
    }
    return undefined;
  };
  const bodies = findFunctionBodies(source);
  const owners = bodies.map((body) => ownerOf(body.name));
  const contextAt = (index: number): { facts: CClassFacts; instance?: string } | undefined => {
    // The bodies are in source order and do not overlap, so the one that can
    // hold `index` is the last that starts before it.
    let low = 0;
    let high = bodies.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (bodies[middle].start < index) low = middle + 1;
      else high = middle;
    }
    const body = bodies[low - 1];
    const facts = body && index < body.end ? owners[low - 1] : undefined;
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

  // A GtkWidgetClass.snapshot vfunc assignment in a class's class_init marks
  // the class as self-painting (`widget_class->snapshot = quux_snapshot;`).
  const snapshotPattern = /->\s*snapshot\s*=/g;
  let snapshotAssignment: RegExpExecArray | null;
  while ((snapshotAssignment = snapshotPattern.exec(source))) {
    const owner = classAt(snapshotAssignment.index);
    if (owner) owner.overridesSnapshot = true;
  }

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
    const variable = call.assignedTo;
    if (variable !== undefined) {
      let constructed: string | undefined;
      if (call.name === 'g_object_new') {
        constructed = call.args[0] ? classFromTypeMacro(call.args[0]) : undefined;
      } else {
        constructed = classFromConstructor(call.name);
      }
      if (constructed && !NON_WIDGET_PATTERN.test(constructed)) {
        facts.constructions[variable] = constructed;
      }
      continue;
    }

    // Literal property assignment: gtk_button_set_icon_name (b, "open").
    // The property is what follows the first `_set_` of a lower-case name.
    const setAt = /^[a-z][a-z0-9_]*$/.test(call.name) ? call.name.indexOf('_set_', 1) : -1;
    const property = setAt === -1 ? '' : call.name.slice(setAt + '_set_'.length);
    if (property && call.args.length >= 2) {
      const isWidgetCall = Object.keys(WIDGET_NAMESPACES)
        .some((ns) => call.name.startsWith(`${ns}_`));
      const target = normalize(bareName(call.args[0]));
      const value = literalOf(call.args[1]);
      if (isWidgetCall && target && value !== undefined) {
        facts.propertyAssignments.push({
          target,
          property: property.replace(/_/g, '-'),
          value,
        });
      }
    }
  }

  return [...classes.values()];
}
