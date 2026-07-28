import type { MockupDocument, AdwNode } from '../types/mockup';

function indent(n: number): string { return '  '.repeat(n); }

function nodeToBlueprint(node: AdwNode, depth: number = 0): string {
  const attrs = Object.entries(node)
    .filter(([k, v]) => k !== 'id' && k !== 'type' && k !== 'children' && v !== undefined && v !== false && v !== '')
    .map(([k, v]) => typeof v === 'boolean' ? `<property name="${k}">true</property>` : `<property name="${k}">${v}</property>`);

  const children = (node.children || []).map(c => nodeToBlueprint(c, depth + 1));

  if (children.length === 0 && attrs.length === 0) {
    return `${indent(depth)}<object class="${node.type}" id="${node.id}"/>\n`;
  }

  if (children.length === 0) {
    return `${indent(depth)}<object class="${node.type}" id="${node.id}">\n` +
      attrs.map(a => `${indent(depth + 1)}${a}\n`).join('') +
      `${indent(depth)}</object>\n`;
  }

  return `${indent(depth)}<object class="${node.type}" id="${node.id}">\n` +
    attrs.map(a => `${indent(depth + 1)}${a}\n`).join('') +
    children.join('') +
    `${indent(depth)}</object>\n`;
}

export function mockupToBlueprint(doc: MockupDocument): string {
  return doc.screens.map(s => nodeToBlueprint(s.rootNode)).join('\n');
}
