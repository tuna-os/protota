/**
 * Python (PyGObject) static source enrichment — the #59 Wave 3 language
 * adapter, completing the C (`clang.ts`) and Vala (`vala.ts`) pair.
 *
 * Extracts conservative construction facts from PyGObject sources: class/base
 * relationships (`class EartagTagEntryRow(Adw.EntryRow, …)`), Gtk.Template
 * decorators, deterministic widget constructions with literal keyword
 * properties (`self.entry = Gtk.Entry(valign=Gtk.Align.CENTER)`), child
 * insertions (`self.add_overlay(self.label)`), literal style classes, and
 * `@GObject.Property(default=…)` declarations.
 *
 * The adapter is structural, exactly like its siblings: it recognises Python
 * syntax and GTK construction calls only — never application names, and never
 * behavior it cannot see. Anything conditional on runtime data stays
 * undiscovered and the corresponding widget remains an explicit boundary.
 * Facts are emitted in the shared `ValaClassFacts` shape so all three
 * languages feed one enrichment engine.
 */
import type { ValaClassFacts, ValaLiteral } from './vala';

/** Calls that make the argument a child of the receiver (Python spellings). */
const CHILD_INSERT_METHODS = new Set([
  'set_child', 'set_content', 'append', 'prepend', 'add_child', 'add_named',
  'add_titled', 'add_overlay', 'add_top_bar', 'add_bottom_bar', 'attach',
  'add_suffix', 'add_prefix', 'set_start_widget', 'set_end_widget',
  'set_title_widget', 'set_extra_child',
]);

/**
 * A literal Python value, including the enum-member spelling GTK property
 * values use in Blueprint: `Gtk.Align.CENTER` → `center`,
 * `Pango.WrapMode.WORD_CHAR` → `word_char` (Blueprint spells enum member
 * idents with underscores — the compiler rejects the dashed GObject nick).
 * The mapping is mechanical, not a per-enum table.
 */
function pythonLiteral(raw: string): ValaLiteral | undefined {
  const text = raw.trim();
  if (text === 'True') return true;
  if (text === 'False') return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  const string = /^(?:f?)(["'])(.*)\1$/.exec(text);
  // An f-string with interpolation is runtime text, not a literal.
  if (string && !(raw.trimStart().startsWith('f') && string[2].includes('{'))) return string[2];
  const enumMember = /^[A-Z][A-Za-z0-9]*\.[A-Z][A-Za-z0-9]*\.([A-Z][A-Z0-9_]*)$/.exec(text);
  if (enumMember) return enumMember[1].toLowerCase();
  return undefined;
}

/** Split a call's argument list on top-level commas (parens/brackets nested). */
function splitArguments(argumentText: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let quote: string | null = null;
  for (let index = 0; index < argumentText.length; index++) {
    const character = argumentText[index];
    if (quote) {
      if (character === '\\') index++;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if ('([{'.includes(character)) depth++;
    else if (')]}'.includes(character)) depth--;
    else if (character === ',' && depth === 0) {
      parts.push(argumentText.slice(start, index));
      start = index + 1;
    }
  }
  const tail = argumentText.slice(start);
  if (tail.trim()) parts.push(tail);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * Join physical lines into logical statements: a statement continues while
 * its parentheses/brackets are unbalanced (the standard Python continuation).
 * Comments and string contents are skipped when counting.
 */
function logicalLines(code: string): Array<{ text: string; indent: number }> {
  const result: Array<{ text: string; indent: number }> = [];
  const lines = code.split('\n');
  let buffer = '';
  let bufferIndent = 0;
  let depth = 0;
  for (const line of lines) {
    const stripped = line.replace(/\r$/, '');
    if (!buffer) {
      if (!stripped.trim() || stripped.trim().startsWith('#')) continue;
      bufferIndent = stripped.length - stripped.trimStart().length;
    }
    let quote: string | null = null;
    for (let index = 0; index < stripped.length; index++) {
      const character = stripped[index];
      if (quote) {
        if (character === '\\') index++;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === '#') break;
      if (character === '"' || character === "'") quote = character;
      else if ('([{'.includes(character)) depth++;
      else if (')]}'.includes(character)) depth--;
    }
    buffer += (buffer ? ' ' : '') + stripped.trim();
    if (depth <= 0) {
      result.push({ text: buffer, indent: bufferIndent });
      buffer = '';
      depth = 0;
    }
  }
  if (buffer) result.push({ text: buffer, indent: bufferIndent });
  return result;
}

/** `self` → `this`; `self.name` → `name`; anything else is unidentifiable. */
function factTarget(receiver: string): string | null {
  if (receiver === 'self') return 'this';
  const field = /^self\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(receiver);
  return field ? field[1] : null;
}

/** Extract construction facts for every class declared in a Python source. */
export function extractPythonFacts(code: string): ValaClassFacts[] {
  const classes: ValaClassFacts[] = [];
  let current: ValaClassFacts | null = null;
  let classIndent = 0;
  let pendingTemplateResource: string | undefined;
  let pendingPropertyDefault: ValaLiteral | undefined;
  let anonymousCounter = 0;

  const recordConstruction = (facts: ValaClassFacts, variable: string, callee: string, argumentText: string): void => {
    facts.constructions[variable] = callee;
    for (const argument of splitArguments(argumentText)) {
      const keyword = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)([\s\S]+)$/.exec(argument);
      if (!keyword) continue;
      const value = pythonLiteral(keyword[2]);
      if (value === undefined) continue;
      facts.propertyAssignments.push({ target: variable, property: keyword[1], value });
    }
  };

  for (const { text, indent } of logicalLines(code)) {
    if (current && indent <= classIndent && !text.startsWith('@') && !text.startsWith('class ')) {
      // Dedent past the class body ends the class scope.
      if (indent < classIndent + 1 && !/^(def|class|@)/.test(text) && indent === 0) current = null;
    }

    // @Gtk.Template(resource_path=…) precedes the class it decorates.
    const template = /^@Gtk\.Template\s*\(\s*(?:resource_path|filename|string)\s*=\s*f?(["'])(.*?)\1/.exec(text);
    if (template) {
      pendingTemplateResource = template[2];
      continue;
    }

    const classMatch = /^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?\s*:/.exec(text);
    if (classMatch && indent === 0) {
      const bases = splitArguments(classMatch[2] ?? '');
      // The first base is the widget ancestry; later bases are mixins
      // (GObject interfaces, app helper classes) that contribute no widget.
      const base = bases.find((candidate) => /^[A-Za-z_][A-Za-z0-9_.]*$/.test(candidate));
      current = {
        className: classMatch[1],
        baseClass: base || undefined,
        templateResource: pendingTemplateResource,
        propertyDefaults: {},
        constructions: {},
        insertions: [],
        propertyAssignments: [],
      };
      pendingTemplateResource = undefined;
      classIndent = indent;
      classes.push(current);
      continue;
    }
    pendingTemplateResource = undefined;
    if (!current) continue;

    // `__gtype_name__ = "X"` is the GType (and Blueprint `$X`) spelling.
    const gtypeName = /^__gtype_name__\s*=\s*(["'])(.+?)\1/.exec(text);
    if (gtypeName) {
      current.className = gtypeName[2];
      continue;
    }

    // @GObject.Property(type=…, default=…) decorating `def name(self)`.
    const propertyDecorator = /^@GObject\.Property\s*\(([^)]*)\)/.exec(text);
    if (propertyDecorator) {
      const defaultArgument = splitArguments(propertyDecorator[1])
        .map((argument) => /^default\s*=([\s\S]+)$/.exec(argument))
        .find(Boolean);
      pendingPropertyDefault = defaultArgument ? pythonLiteral(defaultArgument[1]) : undefined;
      continue;
    }
    // `def do_snapshot(self, snapshot):` — the class paints itself.
    if (/^def\s+do_snapshot\s*\(/.test(text)) {
      current.overridesSnapshot = true;
      continue;
    }

    const propertyGetter = /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(text);
    if (propertyGetter && pendingPropertyDefault !== undefined) {
      current.propertyDefaults[propertyGetter[1]] = pendingPropertyDefault;
      pendingPropertyDefault = undefined;
      continue;
    }
    if (!text.startsWith('@')) pendingPropertyDefault = undefined;

    // Deterministic construction: `self.name = Ns.Class(…)` or `self.name = AppClass(…)`.
    const construction = /^self\.([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)?)\s*\(([\s\S]*)\)\s*$/.exec(text);
    if (construction) {
      recordConstruction(current, construction[1], construction[2], construction[3]);
      continue;
    }

    // Method call on self or a self field: `self.add_overlay(…)`,
    // `self.icon.add_css_class(…)`.
    const call = /^(self(?:\.[A-Za-z_][A-Za-z0-9_]*)?)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*$/.exec(text);
    if (call) {
      const receiver = factTarget(call[1]);
      const method = call[2];
      const callArguments = splitArguments(call[3]);
      if (!receiver) continue;
      if (method === 'add_css_class') {
        const name = callArguments.length === 1 ? pythonLiteral(callArguments[0]) : undefined;
        if (typeof name === 'string') (current.styleClasses ??= []).push({ target: receiver, name });
        continue;
      }
      if (!CHILD_INSERT_METHODS.has(method)) continue;
      const childArgument = callArguments[0] ?? '';
      const childField = factTarget(childArgument);
      if (childField && childField !== 'this') {
        current.insertions.push({ parent: receiver, child: childField, method });
        continue;
      }
      // Inline constructor argument: `self.append(Gtk.Label(label="…"))`.
      const inline = /^([A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)?)\s*\(([\s\S]*)\)$/.exec(childArgument);
      if (inline) {
        const variable = `constructed_${++anonymousCounter}`;
        recordConstruction(current, variable, inline[1], inline[2]);
        current.insertions.push({ parent: receiver, child: variable, method });
      }
      continue;
    }

    // Literal property assignment through the props namespace:
    // `self.props.hexpand = True`, `self.label.props.visible = False`.
    const propsAssignment = /^(self(?:\.[A-Za-z_][A-Za-z0-9_]*)?)\.props\.([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/.exec(text);
    if (propsAssignment) {
      const target = factTarget(propsAssignment[1]);
      const value = pythonLiteral(propsAssignment[3]);
      if (target && value !== undefined) {
        current.propertyAssignments.push({ target, property: propsAssignment[2], value });
      }
      continue;
    }
  }
  return classes;
}
