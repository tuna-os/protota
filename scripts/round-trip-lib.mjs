/**
 * Host-side round-trip machinery shared by scripts/protota-import.mjs and
 * scripts/protota-writeback.mjs (docs/round-trip-cli.md, issues #56/#80).
 *
 * Three responsibilities:
 *   1. Discovery — walk an app checkout, find its .blp/.ui files through
 *      build metadata (gresource XML, meson.build) with a glob fallback.
 *   2. A span-preserving Blueprint CST — enough structure to know which file
 *      and which byte range *defines* every widget, property, and style
 *      list, so edits can be patched textually with minimal diffs instead of
 *      re-emitting whole files.
 *   3. Write-back planning — three-way diff (imported original vs edited
 *      document), attribution of each edit to its defining file (an edit
 *      inside an expanded template belongs to the template's own file), and
 *      pinned-blueprint-compiler validation.
 *
 * Class identity is sacred: the patcher never touches a class token, so an
 * app-defined `$SomeWidget` can never be replaced by a Protota-invented
 * class. Class/type changes in the edited document are refused, not applied.
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, basename } from 'node:path';
import {
  discoverAppSources,
  appBundleManifest,
  isDiscoveryRelevantPath,
  SKIP_DIRECTORIES,
} from '../src/utils/appDiscovery.ts';
import {
  blueprintBundleToDocument,
  blueprintChildSource,
  blueprintPropertyCandidates,
  blueprintValueSource,
  blueprintStyleClassFor,
  isBlueprintLayoutProperty,
} from '../src/utils/blueprint.ts';

export { blueprintBundleToDocument };

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

function walkFiles(root) {
  const found = [];
  const visit = (directory) => {
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) visit(join(directory, entry.name));
        continue;
      }
      found.push(join(directory, entry.name));
    }
  };
  visit(root);
  return found;
}

const toPosix = (path) => path.split('\\').join('/');

/**
 * Discover the declarative UI files of a checkout. Walks the filesystem into
 * an abstract file map and delegates to the shared, environment-free
 * discovery core (src/utils/appDiscovery.ts) that the browser front door
 * also consumes — single source of truth for the gresource/meson logic.
 */
export function discoverSources(sourceRootArg) {
  const sourceRoot = resolve(sourceRootArg);
  const fileMap = {};
  for (const file of walkFiles(sourceRoot)) {
    const path = toPosix(relative(sourceRoot, file));
    if (!isDiscoveryRelevantPath(path)) continue;
    try { fileMap[path] = readFileSync(file, 'utf8'); } catch { /* unreadable file: skip */ }
  }
  return { sourceRoot, ...discoverAppSources(fileMap) };
}

/** Manifest facts about a discovered bundle (shared with the browser importer). */
export const bundleManifest = appBundleManifest;

// ---------------------------------------------------------------------------
// Span-preserving Blueprint CST
// ---------------------------------------------------------------------------

function tokenizeWithSpans(text) {
  const tokens = [];
  const wordPattern = /\$?[A-Za-z_][A-Za-z0-9_.-]*/y;
  const numberPattern = /-?\d+(?:\.\d+)?/y;
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === '/' && text[index + 1] === '/') {
      const lineEnd = text.indexOf('\n', index);
      index = lineEnd === -1 ? text.length : lineEnd + 1;
      continue;
    }
    if (character === '/' && text[index + 1] === '*') {
      const commentEnd = text.indexOf('*/', index + 2);
      index = commentEnd === -1 ? text.length : commentEnd + 2;
      continue;
    }
    if (character === '"') {
      let end = index + 1;
      while (end < text.length && text[end] !== '"') {
        if (text[end] === '\\') end++;
        end++;
      }
      tokens.push({ value: text.slice(index, end + 1), kind: 'string', start: index, end: end + 1 });
      index = end + 1;
      continue;
    }
    numberPattern.lastIndex = index;
    const number = numberPattern.exec(text);
    if (number) {
      tokens.push({ value: number[0], kind: 'number', start: index, end: numberPattern.lastIndex });
      index = numberPattern.lastIndex;
      continue;
    }
    wordPattern.lastIndex = index;
    const word = wordPattern.exec(text);
    if (word) {
      tokens.push({ value: word[0], kind: 'word', start: index, end: wordPattern.lastIndex });
      index = wordPattern.lastIndex;
      continue;
    }
    if ('{}[]:;,()'.includes(character)) tokens.push({ value: character, kind: 'punct', start: index, end: index + 1 });
    index++;
  }
  return tokens;
}

/**
 * Parse one Blueprint file into a CST whose every node/property/styles-list
 * carries its byte span in the original text. Menus and other non-widget
 * top-level blocks are skipped with balanced braces so spans stay honest.
 */
export function parseBlueprintCst(text) {
  const tokens = tokenizeWithSpans(text);
  let cursor = 0;
  const isClassWord = (token) =>
    token?.kind === 'word' && (token.value.startsWith('$') || token.value.includes('.') || /^[A-Z]/.test(token.value));
  const isObjectStart = (offset = 0) =>
    isClassWord(tokens[cursor + offset]) &&
    (tokens[cursor + offset + 1]?.value === '{' ||
      (tokens[cursor + offset + 1]?.kind === 'word' && tokens[cursor + offset + 2]?.value === '{'));

  const skipBalancedBraces = () => {
    let depth = 0;
    while (cursor < tokens.length) {
      const value = tokens[cursor++].value;
      if (value === '{') depth++;
      if (value === '}' && --depth === 0) return;
    }
  };

  const parseBody = (node, depth) => {
    let pendingSlot = null;
    let pendingStart = null;
    while (cursor < tokens.length && tokens[cursor].value !== '}') {
      const token = tokens[cursor];
      if (token.value === '[' && tokens[cursor + 1]?.kind === 'word' && tokens[cursor + 2]?.value === ']') {
        pendingSlot = tokens[cursor + 1].value;
        pendingStart = token.start;
        cursor += 3;
        continue;
      }
      if (token.value === 'styles' && tokens[cursor + 1]?.value === '[') {
        const start = token.start;
        cursor += 2;
        const listStart = tokens[cursor - 1].end;
        const entries = [];
        while (cursor < tokens.length && tokens[cursor].value !== ']') {
          if (tokens[cursor].kind === 'string') {
            try { entries.push(JSON.parse(tokens[cursor].value)); } catch { /* keep span-only */ }
          }
          cursor++;
        }
        const listEnd = tokens[cursor]?.start ?? listStart;
        let end = tokens[cursor]?.end ?? listEnd;
        if (tokens[cursor]?.value === ']') cursor++;
        if (tokens[cursor]?.value === ';') { end = tokens[cursor].end; cursor++; }
        node.styles = { start, listStart, listEnd, end, entries };
        continue;
      }
      if (token.value === 'layout' && tokens[cursor + 1]?.value === '{') {
        const start = token.start;
        cursor += 2;
        const layout = { start, bodyStart: tokens[cursor - 1].end, end: 0, props: [] };
        while (cursor < tokens.length && tokens[cursor].value !== '}') {
          if (tokens[cursor].kind === 'word' && tokens[cursor + 1]?.value === ':') {
            const nameToken = tokens[cursor];
            cursor += 2;
            const valueToken = tokens[cursor];
            while (cursor < tokens.length && tokens[cursor].value !== ';' && tokens[cursor].value !== '}') cursor++;
            const lastToken = tokens[cursor - 1];
            let statementEnd = lastToken?.end ?? nameToken.end;
            if (tokens[cursor]?.value === ';') { statementEnd = tokens[cursor].end; cursor++; }
            layout.props.push({
              name: nameToken.value.replace(/_/g, '-'),
              start: nameToken.start,
              valueStart: valueToken?.start ?? statementEnd,
              valueEnd: lastToken?.end ?? statementEnd,
              end: statementEnd,
            });
          } else cursor++;
        }
        if (tokens[cursor]?.value === '}') { layout.end = tokens[cursor].end; cursor++; }
        node.layout = layout;
        continue;
      }
      if (token.kind === 'word' && tokens[cursor + 1]?.value === ':') {
        const nameToken = token;
        cursor += 2;
        if (isObjectStart()) {
          node.children.push(parseObject(depth + 1, nameToken.value, nameToken.start, true));
          continue;
        }
        const valueToken = tokens[cursor];
        let level = 0;
        while (cursor < tokens.length) {
          const value = tokens[cursor].value;
          if (!level && (value === ';' || value === '}')) break;
          if (value === '{') level++;
          if (value === '}') level--;
          cursor++;
        }
        const lastToken = tokens[cursor - 1];
        const valueEnd = lastToken?.end ?? nameToken.end;
        let statementEnd = valueEnd;
        if (tokens[cursor]?.value === ';') { statementEnd = tokens[cursor].end; cursor++; }
        node.props.push({
          name: nameToken.value.replace(/_/g, '-'),
          start: nameToken.start,
          valueStart: valueToken?.start ?? valueEnd,
          valueEnd,
          end: statementEnd,
        });
        continue;
      }
      if (isObjectStart()) {
        node.children.push(parseObject(depth + 1, pendingSlot, pendingStart, false));
        pendingSlot = null;
        pendingStart = null;
        continue;
      }
      if (token.kind === 'word' && tokens[cursor + 1]?.value === '{') {
        // Slot block (`content { … }`) or metadata block (`accessibility { … }`).
        const slotName = token.value;
        cursor += 2;
        while (cursor < tokens.length && tokens[cursor].value !== '}') {
          if (isObjectStart()) { node.children.push(parseObject(depth + 1, slotName, null, false)); continue; }
          if (tokens[cursor].value === '{') { skipBalancedBraces(); continue; }
          cursor++;
        }
        if (tokens[cursor]?.value === '}') cursor++;
        continue;
      }
      cursor++;
    }
    if (tokens[cursor]?.value === '}') {
      node.closeBrace = tokens[cursor].start;
      node.end = tokens[cursor].end;
      cursor++;
    }
  };

  const parseObject = (depth, slot, annotationStart, isPropertyValue) => {
    const classToken = tokens[cursor++];
    let id = null;
    if (tokens[cursor]?.kind === 'word' && tokens[cursor + 1]?.value === '{') {
      id = tokens[cursor].value;
      cursor++;
    }
    const node = {
      className: classToken.value, id, isTemplate: false, templateName: null,
      slot: slot ?? null, depth,
      start: annotationStart ?? classToken.start, bodyStart: 0, closeBrace: 0, end: 0,
      props: [], styles: null, layout: null, children: [],
    };
    if (tokens[cursor]?.value === '{') { node.bodyStart = tokens[cursor].end; cursor++; }
    parseBody(node, depth);
    if (isPropertyValue && tokens[cursor]?.value === ';') { node.end = tokens[cursor].end; cursor++; }
    return node;
  };

  const parseTemplate = () => {
    const start = tokens[cursor++].start; // 'template'
    const nameToken = tokens[cursor++]; // $Name
    if (tokens[cursor]?.value === ':') cursor++;
    const classToken = tokens[cursor]?.kind === 'word' ? tokens[cursor++] : null;
    const node = {
      className: classToken?.value ?? 'Gtk.Widget', id: null,
      isTemplate: true, templateName: nameToken.value.replace(/^\$/, ''),
      slot: null, depth: 0,
      start, bodyStart: 0, closeBrace: 0, end: 0,
      props: [], styles: null, layout: null, children: [],
    };
    if (tokens[cursor]?.value === '{') {
      node.bodyStart = tokens[cursor].end;
      cursor++;
      parseBody(node, 0);
    }
    return node;
  };

  const roots = [];
  const templates = [];
  while (cursor < tokens.length) {
    const token = tokens[cursor];
    if (token.kind === 'word' && token.value === 'using') {
      while (cursor < tokens.length && tokens[cursor].value !== ';') cursor++;
      cursor++;
      continue;
    }
    if (token.kind === 'word' && token.value === 'template') { templates.push(parseTemplate()); continue; }
    if (isObjectStart()) { roots.push(parseObject(0, null, null, false)); continue; }
    if (token.kind === 'word' && tokens[cursor + 1]?.kind === 'word' && tokens[cursor + 2]?.value === '{') {
      // `menu primary_menu { … }` and friends: skip with balanced braces.
      cursor += 2;
      skipBalancedBraces();
      continue;
    }
    cursor++;
  }
  return { roots, templates };
}

// ---------------------------------------------------------------------------
// Bundle CST index — which file defines which widget
// ---------------------------------------------------------------------------

const canonicalClass = (raw) => {
  const match = /^(Adw|GtkSource|Gtk|Gio)([A-Z][A-Za-z0-9]*)$/.exec(raw);
  return match ? `${match[1]}.${match[2]}` : raw;
};

const GENERATED_ID = /^(imported|template-imported)-\d+$/;

export function indexBundleCst(files) {
  const csts = new Map();
  const templates = new Map();
  const idIndex = new Map();
  const register = (path, node) => {
    if (node.id) {
      const hits = idIndex.get(node.id) ?? [];
      hits.push({ path, node });
      idIndex.set(node.id, hits);
    }
    node.children.forEach((child) => register(path, child));
  };
  for (const file of files) {
    if (!file.path.endsWith('.blp')) continue;
    const cst = parseBlueprintCst(file.content);
    csts.set(file.path, { ...cst, text: file.content });
    for (const template of cst.templates) {
      templates.set(template.templateName, { path: file.path, node: template });
      register(file.path, template);
    }
    for (const root of cst.roots) register(file.path, root);
  }
  return { csts, templates, idIndex };
}

/** The class a CST node resolves to once template linking is applied. */
function effectiveClass(node, templates) {
  if (node.className.startsWith('$')) {
    const name = node.className.slice(1);
    const template = templates.get(name);
    return template ? canonicalClass(template.node.className) : canonicalClass(name);
  }
  return canonicalClass(node.className);
}

// ---------------------------------------------------------------------------
// Document diff (imported original vs edited)
// ---------------------------------------------------------------------------

const IGNORED_KEYS = new Set(['id', 'type', 'children', 'slot', 'sourceClass']);
const STYLE_KEYS = new Set(['suggested', 'destructive', 'flat', 'circular', 'styleClasses']);
const UNSUPPORTED_KEYS = new Set(['bindings', 'options', 'pages', 'imageId', 'breakpointCondition']);

const jsonEqual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function diffDocuments(original, edited) {
  const edits = [];
  const unsupported = [];

  const diffNodes = (originalNode, editedNode) => {
    if (originalNode.type !== editedNode.type ||
        (originalNode.sourceClass ?? null) !== (editedNode.sourceClass ?? null)) {
      unsupported.push(`widget "${originalNode.id}": class/type changes are never written back — a source class is never replaced with a Protota-invented one.`);
      return;
    }
    const keys = new Set([...Object.keys(originalNode), ...Object.keys(editedNode)]);
    let stylesChanged = false;
    for (const key of keys) {
      if (IGNORED_KEYS.has(key)) continue;
      const before = originalNode[key];
      const after = editedNode[key];
      if (jsonEqual(before, after)) continue;
      if (STYLE_KEYS.has(key)) { stylesChanged = true; continue; }
      if (UNSUPPORTED_KEYS.has(key)) {
        unsupported.push(`widget "${originalNode.id}": edits to "${key}" are opaque source facts the patcher cannot write back yet.`);
        continue;
      }
      if (after === undefined || after === '' || after === false) {
        edits.push({ kind: 'unset', target: originalNode, editedNode, key });
      } else {
        edits.push({ kind: 'set', target: originalNode, editedNode, key, value: after });
      }
    }
    if (stylesChanged) edits.push({ kind: 'styles', target: originalNode, editedNode });

    const originalChildren = originalNode.children ?? [];
    const editedChildren = editedNode.children ?? [];
    const originalById = new Map(originalChildren.filter((child) => child.id).map((child) => [child.id, child]));
    const editedById = new Map(editedChildren.filter((child) => child.id).map((child) => [child.id, child]));
    const pairedOriginalOrder = originalChildren.filter((child) => editedById.has(child.id)).map((child) => child.id);
    const pairedEditedOrder = editedChildren.filter((child) => originalById.has(child.id)).map((child) => child.id);
    if (pairedOriginalOrder.join('\u0000') !== pairedEditedOrder.join('\u0000')) {
      unsupported.push(`widget "${originalNode.id}": reordering children is not written back yet (remove + re-add instead).`);
    }
    for (const child of originalChildren) {
      if (!editedById.has(child.id)) edits.push({ kind: 'remove', parent: originalNode, child });
    }
    editedChildren.forEach((child, index) => {
      if (originalById.has(child.id)) {
        diffNodes(originalById.get(child.id), child);
        return;
      }
      const followingIds = editedChildren.slice(index + 1).map((sibling) => sibling.id).filter((id) => originalById.has(id));
      edits.push({ kind: 'insert', parent: originalNode, editedParent: editedNode, node: child, followingIds });
    });
  };

  original.screens.forEach((screen, index) => {
    const counterpart = edited.screens.find((candidate) => candidate.id === screen.id) ?? edited.screens[index];
    if (!counterpart) {
      unsupported.push(`screen "${screen.id}" was removed — removing top-level screens is not written back.`);
      return;
    }
    diffNodes(screen.rootNode, counterpart.rootNode);
  });
  if (edited.screens.length > original.screens.length) {
    unsupported.push('the edited document has screens the source bundle does not; new top-level files are not created by write-back.');
  }
  return { edits, unsupported };
}

// ---------------------------------------------------------------------------
// Edit attribution and textual patching
// ---------------------------------------------------------------------------

function buildParentMap(document) {
  const parents = new Map();
  const visit = (node, parent) => {
    parents.set(node, parent);
    node.children?.forEach((child) => visit(child, node));
  };
  document.screens.forEach((screen) => visit(screen.rootNode, null));
  return parents;
}

const classKeyOf = (node) => (node.sourceClass ? canonicalClass(node.sourceClass) : null);

/**
 * Plan the write-back of an edited document against a source bundle.
 * Pure: reads file contents from `files`, never touches the filesystem.
 */
export function planWriteback({ files, entry, editedDocument }) {
  const original = blueprintBundleToDocument(files, entry);
  const { edits, unsupported } = diffDocuments(original, editedDocument);
  const { csts, templates, idIndex } = indexBundleCst(files);
  const parents = buildParentMap(original);
  const patchesByFile = new Map();
  const touched = [];

  const addPatch = (path, start, end, text, label) => {
    const patches = patchesByFile.get(path) ?? [];
    patches.push({ start, end, text, label });
    patchesByFile.set(path, patches);
    touched.push({ path, label });
  };

  const jumpIntoTemplate = (location) => {
    if (!location.node.className?.startsWith('$')) return location;
    const template = templates.get(location.node.className.slice(1));
    return template ? { path: template.path, node: template.node } : location;
  };

  /**
   * All CST nodes that can define the given original-document node, most
   * specific first. A template instance yields both the instance block (in
   * the file that uses the template) and the template declaration (in the
   * template's own file).
   */
  const locate = (documentNode) => {
    const chain = [];
    for (let node = documentNode; node; node = parents.get(node)) chain.unshift(node);

    let anchorIndex = -1;
    let anchors = null;
    for (let index = chain.length - 1; index >= 0; index--) {
      const candidate = chain[index];
      if (candidate.id && !GENERATED_ID.test(candidate.id) && idIndex.has(candidate.id)) {
        anchorIndex = index;
        anchors = idIndex.get(candidate.id);
        break;
      }
    }
    if (anchorIndex === -1) {
      // Fall back to the file's top-level structure: match the screen root
      // against entry-file roots/templates by resolved class.
      const rootNode = chain[0];
      const rootClass = classKeyOf(rootNode);
      const entryCst = csts.get(entry) ?? csts.get([...csts.keys()].find((path) => path.endsWith(`/${entry}`)) ?? '');
      if (!entryCst || !rootClass) return { error: `cannot locate the screen root for widget "${documentNode.id}" in the source bundle.` };
      const topLevel = [...entryCst.templates, ...entryCst.roots]
        .sort((a, b) => a.start - b.start)
        .filter((node) => effectiveClass(node, templates) === rootClass);
      const sameClassScreens = original.screens.filter((screen) => classKeyOf(screen.rootNode) === rootClass);
      const occurrence = sameClassScreens.findIndex((screen) => screen.rootNode === rootNode);
      const anchorNode = topLevel[Math.max(occurrence, 0)];
      if (!anchorNode) return { error: `cannot locate the screen root for widget "${documentNode.id}" in ${entry}.` };
      anchorIndex = 0;
      anchors = [{ path: [...csts.keys()].find((path) => csts.get(path) === entryCst) ?? entry, node: anchorNode }];
    }

    const descend = (start) => {
      let current = start;
      for (let index = anchorIndex + 1; index < chain.length; index++) {
        current = jumpIntoTemplate(current);
        if (current.node.className?.startsWith('$')) {
          return { error: `widget "${documentNode.id}" lives inside $${current.node.className.slice(1)}, whose template is not in the bundle.` };
        }
        const step = chain[index];
        const key = classKeyOf(step);
        if (!key) return { error: `widget "${step.id}" has no source class; cannot locate it in the checkout.` };
        const parentDoc = parents.get(step);
        const occurrence = (parentDoc.children ?? []).filter((sibling) => classKeyOf(sibling) === key).indexOf(step);
        const matches = current.node.children.filter((child) => effectiveClass(child, templates) === key);
        const target = matches[occurrence];
        if (!target) return { error: `cannot find ${key} (occurrence ${occurrence + 1}) below "${chain[anchorIndex].id ?? 'the file root'}" in ${current.path}.` };
        current = { path: current.path, node: target };
      }
      return current;
    };

    const results = [];
    let lastError = null;
    for (const anchor of anchors) {
      const outcome = descend(anchor);
      if (outcome.error) { lastError = outcome.error; continue; }
      results.push(outcome);
    }
    if (!results.length) return { error: lastError ?? `cannot locate widget "${documentNode.id}" in any Blueprint source file.` };
    // A template instance also resolves to its declaration.
    const expanded = [];
    for (const result of results) {
      expanded.push(result);
      if (result.node.className?.startsWith('$')) {
        const template = templates.get(result.node.className.slice(1));
        if (template && !expanded.some((existing) => existing.node === template.node)) {
          expanded.push({ path: template.path, node: template.node });
        }
      }
    }
    return { candidates: expanded };
  };

  const lineStartOf = (text, offset) => text.lastIndexOf('\n', offset - 1) + 1;
  const lineEndOf = (text, offset) => {
    const next = text.indexOf('\n', offset);
    return next === -1 ? text.length : next + 1;
  };

  /** Delete a span, taking the whole line when the statement owns it. */
  const deletionSpan = (text, start, end) => {
    const lineStart = lineStartOf(text, start);
    const lineEnd = lineEndOf(text, end);
    const before = text.slice(lineStart, start);
    const after = text.slice(end, lineEnd);
    if (/^\s*$/.test(before) && /^\s*$/.test(after)) return { start: lineStart, end: lineEnd };
    return { start, end: end + (text[end] === ' ' ? 1 : 0) };
  };

  const GETTEXT_VALUE = /^(?:C_|NC_|N_|_)\(/;
  const replaceValue = (text, prop, newSource) => {
    const raw = text.slice(prop.valueStart, prop.valueEnd);
    if (GETTEXT_VALUE.test(raw.trim()) && newSource.startsWith('"')) {
      // Preserve the translation wrapper; swap only the final string literal.
      const literals = [...raw.matchAll(/"(?:[^"\\]|\\.)*"/g)];
      if (literals.length) {
        const last = literals[literals.length - 1];
        return raw.slice(0, last.index) + newSource + raw.slice(last.index + last[0].length);
      }
    }
    return newSource;
  };

  const insertStatement = (path, cst, node, statement) => {
    const indent = '  '.repeat(node.depth + 1);
    const bodyRange = cst.text.slice(node.bodyStart, node.closeBrace);
    const insertion = bodyRange.includes('\n')
      ? `\n${indent}${statement}`
      : `\n${indent}${statement}\n${'  '.repeat(node.depth)}`;
    addPatch(path, node.bodyStart, node.bodyStart, insertion, statement);
  };

  const applySet = (edit) => {
    const location = locate(edit.target);
    if (location.error) return location.error;
    const propertyNames = blueprintPropertyCandidates(edit.key, edit.editedNode.type);
    const layoutProperty = propertyNames.some((name) => isBlueprintLayoutProperty(name));
    const valueSource = blueprintValueSource(propertyNames[0], edit.value);

    for (const candidate of location.candidates) {
      const cst = csts.get(candidate.path);
      if (layoutProperty && candidate.node.layout) {
        const prop = candidate.node.layout.props.find((entry) => propertyNames.includes(entry.name));
        if (prop) {
          addPatch(candidate.path, prop.valueStart, prop.valueEnd, valueSource, `${prop.name}: ${valueSource}`);
          return null;
        }
        continue;
      }
      const prop = candidate.node.props.find((entry) => propertyNames.includes(entry.name));
      if (prop) {
        addPatch(candidate.path, prop.valueStart, prop.valueEnd, replaceValue(cst.text, prop, valueSource), `${prop.name}: ${valueSource}`);
        return null;
      }
    }
    // Absent everywhere: add it to the most specific defining block.
    const target = location.candidates[0];
    const cst = csts.get(target.path);
    if (layoutProperty) {
      if (target.node.layout) {
        const indent = '  '.repeat(target.node.depth + 2);
        addPatch(target.path, target.node.layout.bodyStart, target.node.layout.bodyStart,
          `\n${indent}${propertyNames[0]}: ${valueSource};`, `layout ${propertyNames[0]}`);
      } else {
        insertStatement(target.path, cst, target.node,
          `layout {\n${'  '.repeat(target.node.depth + 2)}${propertyNames[0]}: ${valueSource};\n${'  '.repeat(target.node.depth + 1)}}`);
      }
      return null;
    }
    insertStatement(target.path, cst, target.node, `${propertyNames[0]}: ${valueSource};`);
    return null;
  };

  const applyUnset = (edit) => {
    const location = locate(edit.target);
    if (location.error) return location.error;
    const propertyNames = blueprintPropertyCandidates(edit.key, edit.editedNode.type);
    for (const candidate of location.candidates) {
      const cst = csts.get(candidate.path);
      const pool = propertyNames.some((name) => isBlueprintLayoutProperty(name)) && candidate.node.layout
        ? candidate.node.layout.props
        : candidate.node.props;
      const prop = pool.find((entry) => propertyNames.includes(entry.name));
      if (prop) {
        const span = deletionSpan(cst.text, prop.start, prop.end);
        addPatch(candidate.path, span.start, span.end, '', `remove ${prop.name}`);
        return null;
      }
    }
    return null; // The property never existed in source; nothing to remove.
  };

  const desiredStyles = (node) => {
    const styles = typeof node.styleClasses === 'string' ? node.styleClasses.trim().split(/\s+/).filter(Boolean) : [];
    for (const key of ['suggested', 'destructive', 'flat', 'circular']) {
      const mapped = blueprintStyleClassFor(key);
      if (node[key] === true && mapped && !styles.includes(mapped)) styles.push(mapped);
      if (node[key] !== true && mapped && !node.styleClasses?.includes(mapped)) {
        const index = styles.indexOf(mapped);
        if (index !== -1) styles.splice(index, 1);
      }
    }
    return [...new Set(styles)];
  };

  const applyStyles = (edit) => {
    const location = locate(edit.target);
    if (location.error) return location.error;
    const styles = desiredStyles(edit.editedNode);
    const withStyles = location.candidates.find((candidate) => candidate.node.styles);
    const target = withStyles ?? location.candidates[0];
    const cst = csts.get(target.path);
    if (target.node.styles) {
      if (!styles.length) {
        const span = deletionSpan(cst.text, target.node.styles.start, target.node.styles.end);
        addPatch(target.path, span.start, span.end, '', 'remove styles');
      } else {
        addPatch(target.path, target.node.styles.listStart, target.node.styles.listEnd,
          ` ${styles.map((name) => `"${name}"`).join(', ')} `, `styles [ ${styles.join(', ')} ]`);
      }
      return null;
    }
    if (!styles.length) return null;
    insertStatement(target.path, cst, target.node, `styles [ ${styles.map((name) => `"${name}"`).join(', ')} ]`);
    return null;
  };

  const applyInsert = (edit) => {
    const location = locate(edit.parent);
    if (location.error) return location.error;
    // Children of an expanded template belong to the template's own file.
    const declaration = location.candidates.find((candidate) => candidate.node.isTemplate || !candidate.node.className?.startsWith('$'));
    const target = declaration ?? location.candidates[0];
    if (target.node.className?.startsWith('$')) {
      return `cannot insert into "${edit.parent.id}": its template is not part of the bundle.`;
    }
    const cst = csts.get(target.path);
    const emitted = blueprintChildSource(edit.node, target.node.depth + 1, effectiveClass(target.node, templates));
    let offset = lineStartOf(cst.text, target.node.closeBrace);
    for (const followingId of edit.followingIds) {
      const sibling = target.node.children.find((child) => child.id === followingId);
      if (sibling) { offset = lineStartOf(cst.text, sibling.start); break; }
    }
    addPatch(target.path, offset, offset, emitted, `insert ${edit.node.type} "${edit.node.id}"`);
    return null;
  };

  const applyRemove = (edit) => {
    const location = locate(edit.child);
    if (location.error) return location.error;
    const target = location.candidates[0];
    const cst = csts.get(target.path);
    const span = deletionSpan(cst.text, target.node.start, target.node.end);
    addPatch(target.path, span.start, span.end, '', `remove ${edit.child.type} "${edit.child.id}"`);
    return null;
  };

  for (const edit of edits) {
    let failure = null;
    if (edit.kind === 'set') failure = applySet(edit);
    else if (edit.kind === 'unset') failure = applyUnset(edit);
    else if (edit.kind === 'styles') failure = applyStyles(edit);
    else if (edit.kind === 'insert') failure = applyInsert(edit);
    else if (edit.kind === 'remove') failure = applyRemove(edit);
    if (failure) unsupported.push(failure);
  }

  const changedFiles = new Map();
  for (const [path, patches] of patchesByFile) {
    const cst = csts.get(path);
    let text = cst.text;
    const ordered = [...patches].sort((a, b) => b.start - a.start || b.end - a.end);
    for (let index = 1; index < ordered.length; index++) {
      if (ordered[index].end > ordered[index - 1].start) {
        throw new Error(`overlapping edits in ${path} (${ordered[index - 1].label} vs ${ordered[index].label}); refusing to guess.`);
      }
    }
    for (const patch of ordered) text = text.slice(0, patch.start) + patch.text + text.slice(patch.end);
    if (text !== cst.text) changedFiles.set(path, text);
  }
  return { original, edits, unsupported, changedFiles, touched };
}

// ---------------------------------------------------------------------------
// Unified diff
// ---------------------------------------------------------------------------

export function unifiedDiff(before, after, path) {
  const a = before.split('\n');
  const b = after.split('\n');
  // LCS table (files are UI sources; quadratic is fine at this size).
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] = a[i] === b[j]
        ? table[(i + 1) * cols + j + 1] + 1
        : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }
  const ops = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { ops.push([' ', a[i]]); i++; j++; }
    else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) { ops.push(['-', a[i]]); i++; }
    else { ops.push(['+', b[j]]); j++; }
  }
  while (i < a.length) ops.push(['-', a[i++]]);
  while (j < b.length) ops.push(['+', b[j++]]);

  const CONTEXT = 3;
  // Precompute the a/b line number (1-based) at each op index.
  const aAt = new Array(ops.length + 1);
  const bAt = new Array(ops.length + 1);
  aAt[0] = 1; bAt[0] = 1;
  ops.forEach(([tag], index) => {
    aAt[index + 1] = aAt[index] + (tag === '+' ? 0 : 1);
    bAt[index + 1] = bAt[index] + (tag === '-' ? 0 : 1);
  });
  // Group changed op indices into hunks, merging when within 2*CONTEXT.
  const changed = ops.map(([tag], index) => (tag === ' ' ? -1 : index)).filter((index) => index !== -1);
  if (!changed.length) return '';
  const hunks = [];
  for (const index of changed) {
    const last = hunks[hunks.length - 1];
    if (last && index - last.end <= CONTEXT * 2) last.end = index;
    else hunks.push({ start: index, end: index });
  }
  const lines = [`--- a/${path}`, `+++ b/${path}`];
  for (const hunk of hunks) {
    const from = Math.max(0, hunk.start - CONTEXT);
    const to = Math.min(ops.length - 1, hunk.end + CONTEXT);
    let aCount = 0, bCount = 0;
    const body = [];
    for (let index = from; index <= to; index++) {
      const [tag, text] = ops[index];
      body.push(`${tag}${text}`);
      if (tag !== '+') aCount++;
      if (tag !== '-') bCount++;
    }
    lines.push(`@@ -${aAt[from]},${aCount} +${bAt[from]},${bCount} @@`, ...body);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// blueprint-compiler resolution and validation
// ---------------------------------------------------------------------------

/**
 * Resolve the validating compiler: an explicit --bpc command wins, then the
 * checkout's own pinned copy (meson subproject), then the host PATH. Null
 * means no validator is available — callers must surface that loudly (exit
 * code 3), never skip silently.
 */
export function resolveBlueprintCompiler({ explicit, sourceRoot } = {}) {
  if (explicit) return { kind: 'shell', label: explicit, command: explicit };
  if (sourceRoot) {
    const pinned = join(sourceRoot, 'subprojects', 'blueprint-compiler', 'blueprint-compiler.py');
    if (existsSync(pinned)) return { kind: 'exec', label: `${pinned} (project-pinned)`, command: ['python3', pinned] };
  }
  try {
    execFileSync('blueprint-compiler', ['--version'], { stdio: 'ignore' });
    return { kind: 'exec', label: 'blueprint-compiler (host PATH)', command: ['blueprint-compiler'] };
  } catch {
    return null;
  }
}

/**
 * Compile one .blp with the resolved compiler. Shell commands may use
 * {file}, {dir}, and {name} placeholders (e.g. a podman invocation that
 * mounts {dir}); without placeholders the file path is appended.
 */
export function compileBlueprintFile(compiler, filePath) {
  const absolute = resolve(filePath);
  try {
    if (compiler.kind === 'shell') {
      let command = compiler.command;
      if (/\{(file|dir|name)\}/.test(command)) {
        command = command
          .replaceAll('{file}', absolute)
          .replaceAll('{dir}', dirname(absolute))
          .replaceAll('{name}', basename(absolute));
      } else {
        command = `${command} ${JSON.stringify(absolute)}`;
      }
      execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] });
    } else {
      execFileSync(compiler.command[0], [...compiler.command.slice(1), 'compile', absolute], { stdio: ['ignore', 'pipe', 'pipe'] });
    }
    return { ok: true, output: '' };
  } catch (error) {
    const stderr = error.stderr?.toString() ?? '';
    const stdout = error.stdout?.toString() ?? '';
    return { ok: false, output: (stderr + stdout).trim() || String(error) };
  }
}

/** True when the path exists and is a directory. */
export function isDirectory(path) {
  try { return statSync(path).isDirectory(); } catch { return false; }
}
