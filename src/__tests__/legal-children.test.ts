import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { LEGAL_CHILDREN, type AdwNode } from '../types/mockup';

/**
 * The importer and the builder must agree.
 *
 * Imports bypass LEGAL_CHILDREN, so it is possible to ship a preset whose
 * structure a user cannot reproduce with the palette — the tool would render
 * something it refuses to let you build. These tests hold the two honest with
 * each other against the presets actually shipped.
 */
const presetDir = new URL('../../public/presets/', import.meta.url).pathname;

function parentChildPairs(root: AdwNode): Array<{ parent: string; child: string; id: string }> {
  const pairs: Array<{ parent: string; child: string; id: string }> = [];
  const visit = (node: AdwNode) => {
    for (const child of node.children ?? []) {
      pairs.push({ parent: node.type, child: child.type, id: child.id });
      visit(child);
    }
  };
  visit(root);
  return pairs;
}

describe('generated presets stay buildable in the editor', () => {
  const presets = existsSync(presetDir)
    ? readdirSync(presetDir).filter(name => name.endsWith('.mockup.json'))
    : [];

  it('finds presets to check', () => {
    expect(presets.length).toBeGreaterThan(0);
  });

  it.each(presets)('%s uses only parent/child pairs the palette permits', (name) => {
    const payload = JSON.parse(readFileSync(join(presetDir, name), 'utf8'));
    // Only source-generated presets are held to this contract; hand-authored
    // legacy files are migrated separately.
    if (!payload.generatedBy) return;

    const illegal = new Map<string, string>();
    for (const screen of payload.document.screens as Array<{ rootNode: AdwNode }>) {
      for (const pair of parentChildPairs(screen.rootNode)) {
        const legal = LEGAL_CHILDREN[pair.parent as keyof typeof LEGAL_CHILDREN];
        // An unknown parent type is a separate failure, caught by the type
        // system; here we only judge combinations we have rules for.
        if (!legal) continue;
        if (!legal.includes(pair.child as never)) {
          illegal.set(`${pair.parent} > ${pair.child}`, pair.id);
        }
      }
    }
    expect(
      [...illegal.keys()].sort(),
      `${name}: real GNOME structure the editor would refuse to build. Either the ` +
      'combination is legitimate and LEGAL_CHILDREN should allow it, or the importer ' +
      'is producing a tree it should not.',
    ).toEqual([]);
  });
});
