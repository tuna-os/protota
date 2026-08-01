/**
 * protota-import — walk a GNOME app checkout, discover its declarative UI
 * sources through build metadata, validate them, and package a source bundle
 * the browser editor (and blueprintBundleToDocument) consumes directly.
 *
 *   npx tsx scripts/protota-import.mjs <source-root> [options]
 *
 * Options:
 *   --entry <path>   entry .blp/.ui (relative to the root); required when
 *                    more than one window-bearing file is discovered
 *   --out <file>     write the bundle JSON here (default: stdout)
 *   --with-code      include .vala/.c sources for Phase 4 enrichment
 *   --bpc <command>  blueprint-compiler command; {file}/{dir}/{name}
 *                    placeholders are substituted (podman invocations work)
 *   --no-validate    skip compiler validation explicitly (parse checks and
 *                    the manifest still run)
 *
 * Exit codes:
 *   0  bundle written, all validations passed
 *   1  usage error, no sources found, or entry not resolvable
 *   2  blueprint-compiler rejected one or more discovered files
 *   3  no blueprint-compiler available and --no-validate was not given
 *      (the bundle is still written; it is simply unvalidated)
 *
 * See docs/round-trip-cli.md.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  discoverSources, bundleManifest, resolveBlueprintCompiler, compileBlueprintFile, isDirectory,
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
const outArg = readFlag('--out');
const bpcArg = readFlag('--bpc');
const withCode = readSwitch('--with-code');
const noValidate = readSwitch('--no-validate');
const sourceRootArg = args.find((argument) => !argument.startsWith('--'));

if (!sourceRootArg || !isDirectory(sourceRootArg)) {
  console.error('Usage: npx tsx scripts/protota-import.mjs <source-root> [--entry <path>] [--out <file>] [--with-code] [--bpc <command>] [--no-validate]');
  process.exit(1);
}

const { sourceRoot, files, codeFiles, discovery, notes } = discoverSources(sourceRootArg);
if (!files.length) {
  console.error(`protota-import: no .blp or .ui files found below ${sourceRoot}`);
  process.exit(1);
}
const manifest = bundleManifest(files);

let entry = entryArg ?? null;
if (entry && !files.some((file) => file.path === entry)) {
  console.error(`protota-import: entry ${entry} is not among the discovered files.`);
  process.exit(1);
}
if (!entry) {
  if (manifest.entryCandidates.length === 1) entry = manifest.entryCandidates[0];
  else {
    console.error(manifest.entryCandidates.length
      ? `protota-import: multiple entry candidates — pass --entry.\n  candidates: ${manifest.entryCandidates.join(', ')}`
      : 'protota-import: no window-bearing file found — pass --entry explicitly.');
    process.exit(1);
  }
}

// --- Manifest (stderr, so stdout stays a clean bundle) ---------------------
console.error(`protota-import: ${sourceRoot}`);
console.error(`  discovery: ${discovery}`);
for (const note of notes) console.error(`  note: ${note}`);
console.error(`  files (${files.length}):`);
for (const file of files) {
  const marks = [];
  if (file.path === entry) marks.push('entry');
  const templates = [...file.content.matchAll(/template\s+\$([A-Za-z_][A-Za-z0-9_-]*)/g)].map((match) => match[1]);
  if (templates.length) marks.push(`template ${templates.join(', ')}`);
  console.error(`    ${file.path}${marks.length ? `  [${marks.join('; ')}]` : ''}`);
}
console.error(`  entry candidates: ${manifest.entryCandidates.join(', ') || '(none)'}`);
console.error(`  unresolved template references: ${manifest.unresolvedReferences.join(', ') || '(none)'}`);
for (const issue of manifest.parseIssues) console.error(`  parse issue: ${issue.path}: ${issue.message}`);
if (withCode) console.error(`  code files included: ${codeFiles.length}`);

// --- Bundle ----------------------------------------------------------------
const bundle = {
  version: 1,
  entry,
  files: withCode ? [...files, ...codeFiles] : files,
};
const payload = `${JSON.stringify(bundle, null, 2)}\n`;
if (outArg) {
  const outPath = resolve(outArg);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, payload);
  console.error(`  bundle: ${outPath}`);
} else {
  process.stdout.write(payload);
}

if (manifest.parseIssues.length) {
  console.error('protota-import: some files did not parse; the bundle contains them verbatim but the editor will report them.');
}

// --- Compiler validation ----------------------------------------------------
if (noValidate) {
  console.error('protota-import: compiler validation skipped (--no-validate).');
  process.exit(0);
}
const compiler = resolveBlueprintCompiler({ explicit: bpcArg, sourceRoot });
if (!compiler) {
  console.error('protota-import: NO blueprint-compiler available (checked --bpc, the checkout\'s pinned subproject, and PATH).');
  console.error('protota-import: the bundle was written but is UNVALIDATED. Install blueprint-compiler, pass --bpc, or pass --no-validate to accept this.');
  process.exit(3);
}
console.error(`  validator: ${compiler.label}`);
let failures = 0;
for (const file of files) {
  if (!file.path.endsWith('.blp')) continue;
  const result = compileBlueprintFile(compiler, join(sourceRoot, file.path));
  if (!result.ok) {
    failures++;
    console.error(`  COMPILE FAIL ${file.path}\n${result.output.split('\n').map((line) => `    ${line}`).join('\n')}`);
  }
}
if (failures) {
  console.error(`protota-import: ${failures} file(s) rejected by ${compiler.label}.`);
  process.exit(2);
}
console.error('protota-import: all .blp files compile.');
