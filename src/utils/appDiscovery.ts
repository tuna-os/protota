/**
 * App-checkout discovery — the single source of truth for "which declarative
 * UI files does this GNOME app actually ship, and which one is the entry".
 *
 * Environment-free by design: it operates on an abstract file map
 * (`{ posixRelativePath → text }`) so the same logic serves
 *   - the host CLI (`scripts/protota-import.mjs` walks the filesystem into a
 *     map, see scripts/round-trip-lib.mjs), and
 *   - the browser front door (folder drop / zip / git archive → map, see
 *     src/utils/appIngest.ts and components/ImportAppDialog.tsx).
 *
 * Build metadata is the authority when present: gresource XML names the .ui
 * files the app ships (mapped back to sibling .blp sources when they exist),
 * and meson.build files name .blp sources handed to blueprint-compiler. When
 * no metadata references any UI file, every .blp/.ui in the map is taken,
 * with an explicit note that this was a glob fallback.
 */
import {
  blueprintImport,
  blueprintTemplateReferences,
  type BlueprintSourceFile,
} from './blueprint';

/** Directories never walked/ingested — VCS internals and build output. */
export const SKIP_DIRECTORIES = new Set([
  '.git', 'node_modules', 'builddir', '_build', 'build', '.flatpak-builder', 'subprojects',
]);

/** Path → file text. Paths are POSIX-style, relative to the checkout root. */
export type AppFileMap = Record<string, string>;

export interface AppDiscoveryResult {
  /** The declarative UI sources, sorted by path. */
  files: BlueprintSourceFile[];
  /** .vala/.c/.py sources for static composite enrichment, sorted by path. */
  codeFiles: BlueprintSourceFile[];
  /** Human-readable description of how the files were selected. */
  discovery: string;
  /** Honest caveats: glob fallback, metadata-excluded files, … */
  notes: string[];
}

export interface AppBundleManifest {
  entryCandidates: string[];
  parseIssues: { path: string; message: string }[];
  unresolvedReferences: string[];
  declaredTemplates: string[];
}

/** True when discovery could ever care about this path (cheap ingest filter). */
export function isDiscoveryRelevantPath(path: string): boolean {
  return /\.(blp|ui|vala|c|py)$/.test(path)
    || path.endsWith('.gresource.xml')
    || path.endsWith('/meson.build')
    || path === 'meson.build';
}

/** True when any path segment is a skipped directory (.git, builddir, …). */
export function isIgnoredPath(path: string): boolean {
  return path.split('/').some((segment) => SKIP_DIRECTORIES.has(segment));
}

/** Resolve `./` and `../` segments in a POSIX-style relative path. */
export function normalizePosixPath(path: string): string {
  const resolved: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') resolved.pop();
    else resolved.push(segment);
  }
  return resolved.join('/');
}

const posixDirname = (path: string): string => {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
};

/**
 * Discover the declarative UI files of a checkout given as a file map.
 * Mirrors the CLI behaviour exactly — scripts/round-trip-lib.mjs delegates
 * here after walking the filesystem.
 */
export function discoverAppSources(fileMap: AppFileMap): AppDiscoveryResult {
  const onDisk = new Set(
    Object.keys(fileMap).map(normalizePosixPath).filter((path) => path && !isIgnoredPath(path)),
  );
  const contentOf = new Map<string, string>();
  for (const [rawPath, content] of Object.entries(fileMap)) {
    const path = normalizePosixPath(rawPath);
    if (onDisk.has(path) && !contentOf.has(path)) contentOf.set(path, content);
  }
  const notes: string[] = [];
  const referenced = new Set<string>();

  const addCandidate = (rawCandidate: string) => {
    let candidate = normalizePosixPath(rawCandidate);
    if (candidate.endsWith('.ui')) {
      const sibling = candidate.replace(/\.ui$/, '.blp');
      if (onDisk.has(sibling)) candidate = sibling;
    }
    if (!/\.(blp|ui)$/.test(candidate) || !onDisk.has(candidate)) return;
    referenced.add(candidate);
  };

  const sortedPaths = [...onDisk].sort();
  for (const path of sortedPaths.filter((entry) => entry.endsWith('.gresource.xml'))) {
    const xml = contentOf.get(path)!;
    for (const match of xml.matchAll(/<file[^>]*>([^<]+)<\/file>/g)) {
      addCandidate(`${posixDirname(path)}/${match[1].trim()}`);
    }
  }
  for (const path of sortedPaths.filter((entry) => entry === 'meson.build' || entry.endsWith('/meson.build'))) {
    const meson = contentOf.get(path)!;
    for (const match of meson.matchAll(/'([^']+\.(?:blp|ui))'/g)) {
      addCandidate(`${posixDirname(path)}/${match[1]}`);
    }
  }

  let discovery = 'build-metadata (gresource XML + meson.build)';
  let selected = [...referenced];
  if (!selected.length) {
    discovery = 'glob fallback';
    notes.push('no gresource/meson metadata referenced any .blp/.ui file; falling back to a recursive glob — review the file list for stale or test-only sources.');
    selected = sortedPaths.filter((path) => /\.(blp|ui)$/.test(path));
  } else {
    const unreferenced = sortedPaths.filter((path) => /\.(blp|ui)$/.test(path) && !referenced.has(path));
    if (unreferenced.length) {
      notes.push(`${unreferenced.length} declarative file(s) on disk are not referenced by build metadata and were excluded: ${unreferenced.join(', ')}`);
    }
  }
  selected.sort();
  const files = selected.map((path) => ({ path, content: contentOf.get(path)! }));
  const codeFiles = sortedPaths
    .filter((path) => /\.(vala|c|py)$/.test(path))
    .map((path) => ({ path, content: contentOf.get(path)! }));
  return { files, codeFiles, discovery, notes };
}

/** Manifest facts about a discovered bundle: entry candidates, template links, parseability. */
export function appBundleManifest(files: BlueprintSourceFile[]): AppBundleManifest {
  const declared = new Set<string>();
  for (const file of files) {
    if (file.path.endsWith('.blp')) {
      for (const match of file.content.matchAll(/template\s+\$([A-Za-z_][A-Za-z0-9_-]*)/g)) declared.add(match[1]);
    } else {
      for (const match of file.content.matchAll(/<template\s+[^>]*class="([^"]+)"/g)) declared.add(match[1]);
    }
  }
  const entryCandidates: string[] = [];
  const parseIssues: { path: string; message: string }[] = [];
  const unresolvedReferences = new Set<string>();
  const WINDOW_TYPES = new Set(['window', 'dialog', 'preferences-dialog', 'about-dialog']);
  for (const file of files) {
    try {
      const { roots } = blueprintImport(file.content);
      if (roots.some((root) => WINDOW_TYPES.has(root.type))) entryCandidates.push(file.path);
    } catch (error) {
      parseIssues.push({ path: file.path, message: error instanceof Error ? error.message : String(error) });
    }
    if (file.path.endsWith('.blp')) {
      for (const reference of blueprintTemplateReferences(file.content)) {
        if (!declared.has(reference)) unresolvedReferences.add(reference);
      }
    }
  }
  return {
    entryCandidates,
    parseIssues,
    unresolvedReferences: [...unresolvedReferences].sort(),
    declaredTemplates: [...declared].sort(),
  };
}
