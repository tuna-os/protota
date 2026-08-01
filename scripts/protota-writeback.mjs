/**
 * protota-writeback — patch edits from the editor's .mockup.json export back
 * into a real app checkout's own Blueprint files.
 *
 *   npx tsx scripts/protota-writeback.mjs <source-root> <edited.mockup.json> [options]
 *
 * Edits land in the file that *defines* each widget: an edit inside an
 * expanded template is written to the template's own file, never to the
 * entry file. Untouched files are left byte-identical; touched files are
 * patched textually (value spans, statement splices), so comments,
 * translation wrappers, and everything the edit did not touch survive.
 * Class tokens are never rewritten — a custom class is never replaced.
 *
 * Options:
 *   --entry <path>        entry .blp (relative to the root); required when
 *                         more than one window-bearing file is discovered
 *   --write               actually write files (dry-run is the DEFAULT:
 *                         every touched file plus a unified diff is printed)
 *   --bpc <command>       blueprint-compiler command; {file}/{dir}/{name}
 *                         placeholders are substituted
 *   --allow-unvalidated   permit --write when no compiler is available
 *
 * Exit codes:
 *   0  all edits applied (or dry-run printed) and validated
 *   1  usage error, or the patch plan could not be built
 *   2  blueprint-compiler rejected a patched file (nothing is written)
 *   3  no blueprint-compiler available (dry-run diffs are still printed;
 *      --write is refused unless --allow-unvalidated)
 *   4  some edits could not be written back (the rest were; see report)
 *
 * See docs/round-trip-cli.md.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import {
  discoverSources, bundleManifest, planWriteback, unifiedDiff,
  resolveBlueprintCompiler, compileBlueprintFile, isDirectory,
} from './round-trip-lib.mjs';

const args = process.argv.slice(2);
const readFlag = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  args.splice(index, 2);
  return value ?? null;
};
const readSwitch = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
};

const entryArg = readFlag('--entry');
const bpcArg = readFlag('--bpc');
// Self-describing aliases for the positionals; the browser's "Export → Patch
// into checkout" dialog generates commands in this form.
const checkoutArg = readFlag('--checkout');
const documentArg = readFlag('--document');
const write = readSwitch('--write');
const allowUnvalidated = readSwitch('--allow-unvalidated');
const positional = args.filter((argument) => !argument.startsWith('--'));
const sourceRootArg = checkoutArg ?? positional[0];
const mockupArg = documentArg ?? positional[checkoutArg ? 0 : 1];

if (!sourceRootArg || !isDirectory(sourceRootArg) || !mockupArg) {
  console.error('Usage: npx tsx scripts/protota-writeback.mjs <source-root> <edited.mockup.json> [--entry <path>] [--write] [--bpc <command>] [--allow-unvalidated]');
  console.error('       (--checkout <source-root> and --document <edited.mockup.json> are accepted as flag aliases)');
  process.exit(1);
}

let editedDocument;
try {
  const payload = JSON.parse(readFileSync(mockupArg, 'utf8'));
  editedDocument = payload.document ?? payload;
  if (!Array.isArray(editedDocument.screens)) throw new Error('no screens array');
} catch (error) {
  console.error(`protota-writeback: ${mockupArg} is not a mockup document: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

const { sourceRoot, files } = discoverSources(sourceRootArg);
if (!files.length) {
  console.error(`protota-writeback: no .blp or .ui files found below ${sourceRoot}`);
  process.exit(1);
}
let entry = entryArg;
if (entry && !files.some((file) => file.path === entry)) {
  console.error(`protota-writeback: entry ${entry} is not among the discovered files.`);
  process.exit(1);
}
if (!entry) {
  const { entryCandidates } = bundleManifest(files);
  if (entryCandidates.length === 1) entry = entryCandidates[0];
  else {
    console.error(entryCandidates.length
      ? `protota-writeback: multiple entry candidates — pass --entry.\n  candidates: ${entryCandidates.join(', ')}`
      : 'protota-writeback: no window-bearing file found — pass --entry explicitly.');
    process.exit(1);
  }
}

let plan;
try {
  plan = planWriteback({ files, entry, editedDocument });
} catch (error) {
  console.error(`protota-writeback: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

// --- Report every touched file before anything is written -------------------
console.error(`protota-writeback: ${sourceRoot} (entry ${entry})`);
console.error(`  edits detected: ${plan.edits.length}`);
if (!plan.changedFiles.size && !plan.unsupported.length) {
  console.error('  nothing to do: the edited document matches the imported source.');
  process.exit(0);
}
for (const [path] of plan.changedFiles) {
  const labels = plan.touched.filter((entry_) => entry_.path === path).map((entry_) => entry_.label);
  console.error(`  touched: ${path}`);
  for (const label of labels) console.error(`    - ${label}`);
}
for (const [path, next] of plan.changedFiles) {
  const before = files.find((file) => file.path === path)?.content ?? '';
  console.log(unifiedDiff(before, next, path));
}
for (const reason of plan.unsupported) console.error(`  NOT WRITTEN: ${reason}`);

// --- Validate the patched results before any write --------------------------
const compiler = resolveBlueprintCompiler({ explicit: bpcArg, sourceRoot });
let validationExit = 0;
if (!compiler) {
  console.error('protota-writeback: NO blueprint-compiler available (checked --bpc, the checkout\'s pinned subproject, and PATH).');
  console.error('protota-writeback: patched output is UNVALIDATED.');
  validationExit = 3;
} else if (plan.changedFiles.size) {
  console.error(`  validator: ${compiler.label}`);
  const staging = mkdtempSync(join(tmpdir(), 'protota-writeback-'));
  try {
    let failures = 0;
    for (const [path, next] of plan.changedFiles) {
      if (!path.endsWith('.blp')) continue;
      const staged = join(staging, basename(path));
      writeFileSync(staged, next);
      const result = compileBlueprintFile(compiler, staged);
      if (!result.ok) {
        failures++;
        console.error(`  COMPILE FAIL ${path}\n${result.output.split('\n').map((line) => `    ${line}`).join('\n')}`);
      } else {
        console.error(`  compiles: ${path}`);
      }
    }
    if (failures) {
      console.error(`protota-writeback: ${failures} patched file(s) rejected — nothing was written.`);
      process.exit(2);
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

// --- Write (only on request, and only validated or explicitly allowed) ------
if (write) {
  if (validationExit === 3 && !allowUnvalidated) {
    console.error('protota-writeback: refusing to --write unvalidated output; pass --allow-unvalidated to override.');
    process.exit(3);
  }
  for (const [path, next] of plan.changedFiles) {
    const target = join(sourceRoot, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, next);
    console.error(`  wrote: ${path}`);
  }
} else {
  console.error('protota-writeback: dry run (default) — re-run with --write to apply.');
}

if (plan.unsupported.length) process.exit(4);
process.exit(validationExit);
