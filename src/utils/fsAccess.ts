/**
 * File System Access API adapter for the write-back UX bridge (ADR 0001
 * Part 3 item 1): read a user-granted checkout directory handle into the
 * abstract file map that src/utils/appDiscovery.ts consumes, and write the
 * planned patches back through the same handle.
 *
 * Chromium-only by feature detection (`window.showDirectoryPicker`); other
 * browsers keep the download + host-command path. Everything runs in-page —
 * the browser reads and writes only inside the directory the user explicitly
 * granted, and nothing leaves the machine.
 *
 * Unlike the ingest adapters (appIngest.ts), no common root is stripped:
 * the granted handle *is* the checkout root, and every discovered path must
 * map back to the same handle for writing.
 */
import {
  isDiscoveryRelevantPath,
  isIgnoredPath,
  normalizePosixPath,
  SKIP_DIRECTORIES,
  type AppFileMap,
} from './appDiscovery';
import { MAX_TEXT_FILE_BYTES } from './appIngest';

/**
 * Structural types for the File System Access API — the subset this feature
 * uses. TypeScript's DOM lib does not (yet) ship `showDirectoryPicker` /
 * async-iterable handles everywhere, and structural typing also lets tests
 * substitute an in-memory handle at exactly this boundary.
 */
export interface WritableFileStreamLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

export interface FileHandleLike {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableFileStreamLike>;
}

export interface DirectoryHandleLike {
  kind: 'directory';
  name: string;
  entries(): AsyncIterableIterator<[string, DirectoryHandleLike | FileHandleLike]>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandleLike>;
};

/** Feature detection — true only on Chromium-family browsers today. */
export function supportsDirectoryPicker(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';
}

/**
 * Ask the user for a read-write handle on their checkout. Throws the DOM
 * AbortError when the user cancels the picker — callers treat that as a
 * plain "never mind", not an error.
 */
export function pickCheckoutDirectory(): Promise<DirectoryHandleLike> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('This browser does not support the File System Access API.');
  return picker({ id: 'protota-writeback-checkout', mode: 'readwrite' });
}

/**
 * Walk a granted directory handle into `{ posixRelativePath → text }`,
 * keeping only discovery-relevant text files and skipping VCS/build
 * directories — the same filter the CLI's filesystem walk applies.
 */
export async function filesFromDirectoryHandle(root: DirectoryHandleLike): Promise<AppFileMap> {
  const map: AppFileMap = {};
  const visit = async (directory: DirectoryHandleLike, prefix: string): Promise<void> => {
    for await (const [name, handle] of directory.entries()) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === 'directory') {
        if (!SKIP_DIRECTORIES.has(name)) await visit(handle, path);
        continue;
      }
      const normalized = normalizePosixPath(path);
      if (!normalized || isIgnoredPath(normalized) || !isDiscoveryRelevantPath(normalized)) continue;
      const file = await handle.getFile();
      if (file.size > MAX_TEXT_FILE_BYTES) continue;
      map[normalized] = await file.text();
    }
  };
  await visit(root, '');
  return map;
}

/**
 * Write one patched file back through the granted handle. The path always
 * names a file that discovery just read (write-back never creates top-level
 * files), so intermediate directories are resolved without `create` — a
 * missing segment means the checkout changed underneath us, and the error
 * should surface rather than silently create structure.
 */
export async function writeFileToDirectoryHandle(
  root: DirectoryHandleLike,
  path: string,
  content: string,
): Promise<void> {
  const segments = normalizePosixPath(path).split('/').filter(Boolean);
  if (!segments.length) throw new Error(`refusing to write empty path "${path}"`);
  let directory = root;
  for (const segment of segments.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(segment);
  }
  const file = await directory.getFileHandle(segments[segments.length - 1]);
  const stream = await file.createWritable();
  await stream.write(content);
  await stream.close();
}
