/**
 * Vala static source enrichment — Phase 4 of docs/source-widget-architecture.md.
 *
 * Extracts conservative construction facts from Vala sources: class/base
 * relationships, composite-template attributes, deterministic widget
 * constructions, child insertions, and literal property assignments.
 *
 * The adapter is structural. It recognises language syntax and GTK
 * construction calls only — never application names, and never behavior it
 * cannot see. Anything conditional on runtime data stays undiscovered and the
 * corresponding widget remains an explicit boundary.
 */

export type ValaLiteral = string | number | boolean;

export interface ValaInsertion {
  /** `this` or the local/field variable receiving the child. */
  parent: string;
  /** Variable name of the inserted child. */
  child: string;
  method: string;
}

export interface ValaPropertyAssignment {
  /** `this` or a variable name. */
  target: string;
  property: string;
  value: ValaLiteral;
}

export interface ValaClassFacts {
  /** Short class name, matching Blueprint template spelling ($ClassName). */
  className: string;
  baseClass?: string;
  /** [GtkTemplate (ui = "…")] resource path, when declared. */
  templateResource?: string;
  /** Declared property defaults: `public bool x { get; set; default = false; }`. */
  propertyDefaults: Record<string, ValaLiteral>;
  /** variable → constructed class, for deterministic `x = new Class (…)`. */
  constructions: Record<string, string>;
  /** Child insertions in source order. */
  insertions: ValaInsertion[];
  /** Literal property assignments in source order. */
  propertyAssignments: ValaPropertyAssignment[];
  /** `x.add_css_class ("name")` calls with a literal class name. */
  styleClasses?: Array<{ target: string; name: string }>;
  /** The class overrides the snapshot vfunc — it paints itself in code. */
  overridesSnapshot?: boolean;
}

/** Calls that make the argument a child of the receiver. */
const CHILD_INSERT_METHODS = new Set([
  'set_child', 'set_content', 'append', 'prepend', 'add_child', 'add_named',
  'add_titled', 'add_overlay', 'add_top_bar', 'add_bottom_bar', 'attach',
]);

interface ValaToken {
  value: string;
  kind: 'word' | 'string' | 'number' | 'punct';
}

function tokenizeVala(code: string): ValaToken[] {
  const tokens: ValaToken[] = [];
  const wordPattern = /[A-Za-z_][A-Za-z0-9_.]*/y;
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
    if (character === '"' || character === "'") {
      const quote = character;
      let end = index + 1;
      while (end < code.length && code[end] !== quote) {
        if (code[end] === '\\') end++;
        end++;
      }
      tokens.push({ value: code.slice(index + 1, end), kind: 'string' });
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
    if (!/\s/.test(character)) tokens.push({ value: character, kind: 'punct' });
    index++;
  }
  return tokens;
}

function literalValue(token: ValaToken | undefined): ValaLiteral | undefined {
  if (!token) return undefined;
  if (token.kind === 'string') return token.value;
  if (token.kind === 'number') return Number(token.value);
  if (token.value === 'true') return true;
  if (token.value === 'false') return false;
  return undefined;
}

function shortName(qualified: string): string {
  return qualified.split('.').pop() ?? qualified;
}

/** Extract construction facts for every class declared in a Vala source. */
export function extractValaFacts(code: string): ValaClassFacts[] {
  const tokens = tokenizeVala(code);
  const classes: ValaClassFacts[] = [];
  const classStack: Array<{ facts: ValaClassFacts; depth: number }> = [];
  /** Word immediately preceding each open brace — a property block's name. */
  const braceOwners: Array<string | null> = [];
  let depth = 0;
  let pendingTemplateResource: string | undefined;
  let anonymousCounter = 0;

  const current = () => classStack[classStack.length - 1]?.facts;

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];

    if (token.value === '{') {
      depth++;
      braceOwners.push(tokens[index - 1]?.kind === 'word' ? tokens[index - 1].value : null);
      continue;
    }
    if (token.value === '}') {
      depth--;
      braceOwners.pop();
      while (classStack.length && depth < classStack[classStack.length - 1].depth) classStack.pop();
      continue;
    }

    // Attribute block: capture [GtkTemplate (ui = "resource")].
    if (token.value === '[') {
      let end = index + 1;
      let isTemplate = false;
      while (end < tokens.length && tokens[end].value !== ']') {
        if (tokens[end].value === 'GtkTemplate') isTemplate = true;
        if (isTemplate && tokens[end].value === 'ui' && tokens[end + 1]?.value === '=' && tokens[end + 2]?.kind === 'string') {
          pendingTemplateResource = tokens[end + 2].value;
        }
        end++;
      }
      index = end;
      continue;
    }

    if (token.value === 'class' && tokens[index + 1]?.kind === 'word') {
      const facts: ValaClassFacts = {
        className: shortName(tokens[index + 1].value),
        templateResource: pendingTemplateResource,
        propertyDefaults: {},
        constructions: {},
        insertions: [],
        propertyAssignments: [],
      };
      pendingTemplateResource = undefined;
      let cursor = index + 2;
      if (tokens[cursor]?.value === ':' && tokens[cursor + 1]?.kind === 'word') {
        facts.baseClass = tokens[cursor + 1].value;
        cursor += 2;
      }
      while (cursor < tokens.length && tokens[cursor].value !== '{') cursor++;
      classes.push(facts);
      // The '{' is consumed by the main loop; the class scope starts one deeper.
      classStack.push({ facts, depth: depth + 1 });
      index = cursor - 1;
      continue;
    }

    const facts = current();
    if (!facts) continue;

    // `public override void snapshot (…)` — the class paints itself.
    if (token.value === 'snapshot' && tokens[index - 1]?.value === 'void'
      && tokens.slice(Math.max(0, index - 4), index).some((preceding) => preceding.value === 'override')) {
      facts.overridesSnapshot = true;
      continue;
    }

    // Declared property default: `public bool x { get; set; default = false; }`.
    if (token.value === 'default' && tokens[index + 1]?.value === '=' && tokens[index + 3]?.value === ';') {
      const value = literalValue(tokens[index + 2]);
      const owner = braceOwners[braceOwners.length - 1];
      if (value !== undefined && owner) facts.propertyDefaults[owner] = value;
      index += 3;
      continue;
    }

    // Deterministic construction: `name = new Class (…)`, including field
    // declarations (`private Gtk.Stack name = new Gtk.Stack ()`).
    if (token.value === 'new' && tokens[index + 1]?.kind === 'word' && tokens[index + 2]?.value === '(') {
      const constructedClass = tokens[index + 1].value;
      const before = tokens[index - 1];
      const target = before?.value === '=' && tokens[index - 2]?.kind === 'word' ? tokens[index - 2].value : undefined;
      if (target) facts.constructions[target] = constructedClass;
      continue;
    }

    if (token.kind !== 'word') continue;

    // Child-insertion call: `receiver.method (argument)` or `method (argument)`
    // with an implicit `this` receiver.
    if (tokens[index + 1]?.value === '(') {
      const call = token.value;
      const method = shortName(call);
      // A literal style class is a rendered fact, mirroring the C adapter's
      // gtk_widget_add_css_class.
      if (method === 'add_css_class' && tokens[index + 2]?.kind === 'string') {
        const receiver = call.includes('.') ? call.slice(0, call.lastIndexOf('.')) : 'this';
        if (!receiver.includes('.')) {
          (facts.styleClasses ??= []).push({ target: receiver, name: tokens[index + 2].value });
        }
        continue;
      }
      if (!CHILD_INSERT_METHODS.has(method)) continue;
      const receiver = call.includes('.') ? call.slice(0, call.lastIndexOf('.')) : 'this';
      if (receiver.includes('.')) continue; // chained receivers are not statically identifiable
      const argument = tokens[index + 2];
      if (argument?.value === 'new' && tokens[index + 3]?.kind === 'word' && tokens[index + 4]?.value === '(') {
        const variable = `constructed_${++anonymousCounter}`;
        facts.constructions[variable] = tokens[index + 3].value;
        facts.insertions.push({ parent: receiver, child: variable, method });
      } else if (argument?.kind === 'word' && !argument.value.includes('.') &&
        (tokens[index + 3]?.value === ')' || tokens[index + 3]?.value === ',')) {
        facts.insertions.push({ parent: receiver, child: argument.value, method });
      }
      continue;
    }

    // Literal property assignment: `x.prop = literal;` or `prop = literal;`.
    if (tokens[index + 1]?.value === '=' && tokens[index + 2]?.value !== '=' && token.value !== 'ui') {
      const path = token.value;
      const valueToken = tokens[index + 2];
      // `x.child = y;` is the property spelling of set_child.
      if ((shortName(path) === 'child' || shortName(path) === 'content') &&
        valueToken?.kind === 'word' && !valueToken.value.includes('.') &&
        !['true', 'false', 'null', 'new'].includes(valueToken.value) && tokens[index + 3]?.value === ';') {
        const receiver = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : 'this';
        if (!receiver.includes('.')) facts.insertions.push({ parent: receiver, child: valueToken.value, method: shortName(path) });
        continue;
      }
      const value = literalValue(tokens[index + 2]);
      if (value === undefined || tokens[index + 3]?.value !== ';') continue;
      if (path.includes('.')) {
        const receiver = path.slice(0, path.lastIndexOf('.'));
        if (receiver.includes('.')) continue;
        facts.propertyAssignments.push({ target: receiver, property: shortName(path), value });
      } else {
        facts.propertyAssignments.push({ target: 'this', property: path, value });
      }
      continue;
    }
  }
  return classes;
}
