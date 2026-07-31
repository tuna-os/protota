/**
 * Host-side round-trip machinery shared by scripts/protota-import.mjs and
 * scripts/protota-writeback.mjs (docs/round-trip-cli.md, issues #56/#80).
 *
 * Three responsibilities:
 *   1. Discovery — walk an app checkout, find its .blp/.ui files through
 *      build metadata (gresource XML, meson.build) with a glob fallback.
 *   2. The write-back core — span-preserving Blueprint CST, three-way diff,
 *      and patch planning — re-exported from src/utils/writeback.ts, where it
 *      lives environment-free so the browser's "Export → Patch into checkout"
 *      File System Access path runs the exact same logic.
 *   3. Pinned-blueprint-compiler resolution and validation (host-only).
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
import { blueprintBundleToDocument } from '../src/utils/blueprint.ts';

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
// Write-back core (CST, three-way diff, patch planning, unified diff)
// ---------------------------------------------------------------------------
//
// The environment-free core was extracted to src/utils/writeback.ts (mirroring
// the appDiscovery extraction, #118) so the browser's "Export → Patch into
// checkout" File System Access path runs the exact same logic as this CLI.
// Re-exported here so CLI callers and the PR #111 test suite are unchanged.
export {
  parseBlueprintCst,
  indexBundleCst,
  diffDocuments,
  planWriteback,
  unifiedDiff,
} from '../src/utils/writeback.ts';

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
