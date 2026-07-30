/**
 * Export every generated preset to Blueprint source, for validation with the
 * upstream compiler.
 *
 *   npx tsx scripts/export-blueprint.mjs [--out artifacts/blp]
 *
 * "Design here, ship there" is only trustworthy if what this tool emits
 * actually builds. Pair this with blueprint-compiler (see
 * docs/preset-workflow.md); the compiler is the authority on whether our
 * output is valid, not our own parser.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { mockupToBlueprint } from '../src/utils/blueprint.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outDir = join(repoRoot, args.includes('--out') ? args[args.indexOf('--out') + 1] : 'artifacts/blp');
mkdirSync(outDir, { recursive: true });

const presetDir = join(repoRoot, 'public/presets');
let written = 0;
for (const name of readdirSync(presetDir).filter((file) => file.endsWith('.mockup.json'))) {
  const payload = JSON.parse(readFileSync(join(presetDir, name), 'utf8'));
  if (!payload.generatedBy) continue;
  const appId = name.replace('.mockup.json', '');
  payload.document.screens.forEach((screen, index) => {
    const single = { ...payload.document, screens: [screen] };
    const file = join(outDir, `${appId}-${screen.id || index}.blp`);
    writeFileSync(file, mockupToBlueprint(single));
    written += 1;
  });
}
console.log(`${written} Blueprint file(s) in ${outDir}`);
