/**
 * Browser-side ingest adapters for the import front door (#118): turn a
 * dropped folder, a picked directory, a .zip, or a pasted git-forge URL into
 * the abstract file map `{ path → text }` that src/utils/appDiscovery.ts
 * consumes. Everything runs in-page — no server, no proxy; files are read
 * locally and archives are fetched straight from the forge.
 *
 * Zip: a minimal central-directory reader supporting stored (method 0) and
 * deflate (method 8) entries, inflated with the native
 * `DecompressionStream('deflate-raw')` — zero runtime dependencies.
 * Tar: a small ustar reader with GNU long-name (type L) support, gunzipped
 * with `DecompressionStream('gzip')`.
 *
 * Only discovery-relevant text files (.blp/.ui/.vala/.c, gresource XML,
 * meson.build) under MAX_TEXT_FILE_BYTES are kept; binaries and VCS/build
 * directories are skipped up front.
 */
import {
  isDiscoveryRelevantPath,
  isIgnoredPath,
  normalizePosixPath,
  type AppFileMap,
} from './appDiscovery';

export type { AppFileMap };

/** Per-file size cap — UI sources are small; anything bigger is not one. */
export const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;

/** Hard ceilings keep an untrusted archive from exhausting the browser tab. */
export const MAX_ARCHIVE_INPUT_BYTES = 32 * 1024 * 1024;
export const MAX_ARCHIVE_OUTPUT_BYTES = 64 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 10_000;

const keepPath = (path: string): boolean =>
  path.length > 0 && !isIgnoredPath(path) && isDiscoveryRelevantPath(path);

/**
 * Drop the single top-level directory every forge archive (and every folder
 * pick) wraps its content in, so paths become checkout-relative.
 */
export function stripCommonRoot(map: AppFileMap): AppFileMap {
  const paths = Object.keys(map);
  if (!paths.length) return map;
  const roots = new Set(paths.map((path) => path.split('/')[0]));
  if (roots.size !== 1 || paths.some((path) => !path.includes('/'))) return map;
  const stripped: AppFileMap = {};
  for (const [path, content] of Object.entries(map)) {
    stripped[path.slice(path.indexOf('/') + 1)] = content;
  }
  // One level only — the wrapper directory. Deeper structure (src/, data/…)
  // is real checkout layout and must survive for the manifest and metadata
  // dirname resolution to stay honest.
  return stripped;
}

const finalizeMap = (raw: AppFileMap): AppFileMap => {
  const out: AppFileMap = {};
  for (const [rawPath, content] of Object.entries(stripCommonRoot(raw))) {
    const path = normalizePosixPath(rawPath);
    if (keepPath(path)) out[path] = content;
  }
  return out;
};

// ---------------------------------------------------------------------------
// Folder ingest — <input webkitdirectory> and drag-and-drop
// ---------------------------------------------------------------------------

/** Ingest a `webkitdirectory` file-input selection (or a plain File list). */
export async function filesFromFileList(files: Iterable<File>): Promise<AppFileMap> {
  const raw: AppFileMap = {};
  for (const file of files) {
    const path = normalizePosixPath(
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    );
    if (!keepPath(path) || file.size > MAX_TEXT_FILE_BYTES) continue;
    raw[path] = await file.text();
  }
  return finalizeMap(raw);
}

/** Ingest a drag-and-drop of files/directories via webkitGetAsEntry. */
export async function filesFromDataTransfer(dataTransfer: DataTransfer): Promise<AppFileMap> {
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(dataTransfer.items)) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  const raw: AppFileMap = {};
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    const path = normalizePosixPath(entry.fullPath || entry.name);
    if (isIgnoredPath(path)) return;
    if (entry.isFile) {
      if (!keepPath(path)) return;
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject));
      if (file.size > MAX_TEXT_FILE_BYTES) return;
      raw[path] = await file.text();
      return;
    }
    if (!entry.isDirectory) return;
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries returns batches; keep reading until an empty batch.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) await walk(child);
    }
  };
  for (const entry of entries) await walk(entry);
  // A dropped .zip / .tar.gz is also welcome on the same drop zone.
  if (!Object.keys(raw).length) {
    for (const file of Array.from(dataTransfer.files)) {
      if (/\.(zip|tar\.gz|tgz|tar)$/i.test(file.name)) {
        return filesFromArchive(await file.arrayBuffer());
      }
    }
  }
  return finalizeMap(raw);
}

// ---------------------------------------------------------------------------
// Zip — minimal central-directory reader (stored + deflate)
// ---------------------------------------------------------------------------

async function decompress(
  bytes: Uint8Array,
  format: 'deflate-raw' | 'gzip',
  maxOutputBytes: number,
): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream()
    .pipeThrough(new DecompressionStream(format));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxOutputBytes) {
        await reader.cancel();
        throw new Error(`Archive expands beyond the ${maxOutputBytes}-byte safety limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

const utf8 = new TextDecoder();

/** Parse a .zip archive fully in-page. */
export async function filesFromZip(data: ArrayBuffer): Promise<AppFileMap> {
  if (data.byteLength > MAX_ARCHIVE_INPUT_BYTES) {
    throw new Error(`Archive exceeds the ${MAX_ARCHIVE_INPUT_BYTES}-byte input safety limit.`);
  }
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  // End-of-central-directory record: scan back over the (bounded) comment.
  let eocd = -1;
  const lowest = Math.max(0, bytes.length - 22 - 65535);
  for (let index = bytes.length - 22; index >= lowest; index--) {
    if (view.getUint32(index, true) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP file (no end-of-central-directory record found).');
  const entryCount = view.getUint16(eocd + 10, true);
  if (entryCount > MAX_ARCHIVE_ENTRIES) {
    throw new Error(`Archive contains more than ${MAX_ARCHIVE_ENTRIES} entries.`);
  }
  let offset = view.getUint32(eocd + 16, true);
  const raw: AppFileMap = {};
  let retainedBytes = 0;
  for (let index = 0; index < entryCount; index++) {
    if (offset < 0 || offset + 46 > bytes.length) {
      throw new Error('Corrupt ZIP central directory bounds.');
    }
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('Corrupt ZIP central directory.');
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (offset + 46 + nameLength + extraLength + commentLength > bytes.length) {
      throw new Error('Corrupt ZIP central directory bounds.');
    }
    const name = utf8.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue; // directory entry
    // Cheap filters before touching the data: relevance and size cap.
    if (!isDiscoveryRelevantPath(name) || isIgnoredPath(normalizePosixPath(name))) continue;
    if (uncompressedSize > MAX_TEXT_FILE_BYTES) continue;
    // The local header repeats name/extra with possibly different lengths.
    if (localOffset + 30 > bytes.length) {
      throw new Error(`Corrupt ZIP local header bounds for ${name}.`);
    }
    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`Corrupt ZIP local header for ${name}.`);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart > bytes.length || compressedSize > bytes.length - dataStart) {
      throw new Error(`Corrupt ZIP entry bounds for ${name}.`);
    }
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    let expanded: Uint8Array | null = null;
    if (method === 0) {
      if (compressed.byteLength > MAX_TEXT_FILE_BYTES) continue;
      expanded = compressed;
    } else if (method === 8) {
      expanded = await decompress(compressed, 'deflate-raw', MAX_TEXT_FILE_BYTES);
    } // other methods: skip — never seen in forge/checkout zips.
    if (!expanded) continue;
    retainedBytes += expanded.byteLength;
    if (retainedBytes > MAX_ARCHIVE_OUTPUT_BYTES) {
      throw new Error(`Archive content exceeds the ${MAX_ARCHIVE_OUTPUT_BYTES}-byte safety limit.`);
    }
    raw[name] = utf8.decode(expanded);
  }
  return finalizeMap(raw);
}

// ---------------------------------------------------------------------------
// Tar — small ustar reader with GNU long names
// ---------------------------------------------------------------------------

/** Parse an uncompressed tar stream. */
export function filesFromTar(bytes: Uint8Array): AppFileMap {
  if (bytes.byteLength > MAX_ARCHIVE_OUTPUT_BYTES) {
    throw new Error(`Archive expands beyond the ${MAX_ARCHIVE_OUTPUT_BYTES}-byte safety limit.`);
  }
  const raw: AppFileMap = {};
  let offset = 0;
  let entryCount = 0;
  let retainedBytes = 0;
  let pendingLongName: string | null = null;
  const cutAtNul = (text: string): string => {
    const nul = text.indexOf('\u0000');
    return nul === -1 ? text : text.slice(0, nul);
  };
  const cstr = (start: number, length: number): string =>
    cutAtNul(utf8.decode(bytes.subarray(start, start + length)));
  while (offset + 512 <= bytes.length) {
    entryCount++;
    if (entryCount > MAX_ARCHIVE_ENTRIES) {
      throw new Error(`Archive contains more than ${MAX_ARCHIVE_ENTRIES} entries.`);
    }
    const block = bytes.subarray(offset, offset + 512);
    if (block.every((byte) => byte === 0)) break; // end-of-archive
    const size = parseInt(cstr(offset + 124, 12).trim() || '0', 8) || 0;
    const typeFlag = String.fromCharCode(block[156] || 0x30);
    let name = cstr(offset, 100);
    const prefix = cstr(offset + 345, 155);
    if (prefix) name = `${prefix}/${name}`;
    const dataStart = offset + 512;
    if (size > bytes.length - dataStart) throw new Error(`Corrupt TAR entry bounds for ${name}.`);
    if (typeFlag === 'L') {
      // GNU long name: the *next* entry's real name.
      pendingLongName = cutAtNul(utf8.decode(bytes.subarray(dataStart, dataStart + size)));
    } else {
      if (pendingLongName) { name = pendingLongName; pendingLongName = null; }
      const isRegular = typeFlag === '0' || typeFlag === '\u0000';
      const normalized = normalizePosixPath(name);
      if (isRegular && size <= MAX_TEXT_FILE_BYTES
        && isDiscoveryRelevantPath(normalized) && !isIgnoredPath(normalized)) {
        retainedBytes += size;
        if (retainedBytes > MAX_ARCHIVE_OUTPUT_BYTES) {
          throw new Error(`Archive content exceeds the ${MAX_ARCHIVE_OUTPUT_BYTES}-byte safety limit.`);
        }
        raw[name] = utf8.decode(bytes.subarray(dataStart, dataStart + size));
      }
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return finalizeMap(raw);
}

/** Parse a .tar.gz archive fully in-page. */
export async function filesFromTarGz(data: ArrayBuffer): Promise<AppFileMap> {
  if (data.byteLength > MAX_ARCHIVE_INPUT_BYTES) {
    throw new Error(`Archive exceeds the ${MAX_ARCHIVE_INPUT_BYTES}-byte input safety limit.`);
  }
  return filesFromTar(await decompress(new Uint8Array(data), 'gzip', MAX_ARCHIVE_OUTPUT_BYTES));
}

/** Dispatch an archive buffer by magic bytes: zip, tar.gz, or plain tar. */
export async function filesFromArchive(data: ArrayBuffer): Promise<AppFileMap> {
  if (data.byteLength > MAX_ARCHIVE_INPUT_BYTES) {
    throw new Error(`Archive exceeds the ${MAX_ARCHIVE_INPUT_BYTES}-byte input safety limit.`);
  }
  const bytes = new Uint8Array(data);
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return filesFromZip(data);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return filesFromTarGz(data);
  if (bytes.length > 262 && utf8.decode(bytes.subarray(257, 262)) === 'ustar') {
    return filesFromTar(bytes);
  }
  throw new Error('Unrecognised archive — expected a .zip or .tar.gz of the app checkout.');
}

// ---------------------------------------------------------------------------
// Git URL normalization + client-side fetch
// ---------------------------------------------------------------------------

export interface GitArchiveRequest {
  /** The forge archive endpoint to fetch. */
  archiveUrl: string;
  forge: 'github' | 'gitlab' | 'gitea';
  host: string;
  /** owner/repo (or full GitLab project path). */
  project: string;
  ref?: string;
}

/**
 * Normalize a pasted repository URL into the forge's archive endpoint:
 *   GitHub  → api.github.com/repos/:o/:r/tarball/:ref (follows to codeload)
 *   GitLab  → /api/v4/projects/:encodedPath/repository/archive.tar.gz?sha=
 *             (incl. gitlab.gnome.org and other self-hosted GitLabs)
 *   Gitea/Codeberg → /api/v1/repos/:o/:r/archive/:ref.tar.gz
 * Branch URLs (/tree/…, /-/tree/…, /src/branch/…) contribute the ref when
 * none is passed explicitly.
 */
export function normalizeGitUrl(input: string, ref?: string): GitArchiveRequest {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error(`"${input}" is not a valid URL — paste the repository page URL, e.g. https://gitlab.gnome.org/World/amberol.`);
  }
  const host = url.hostname;
  const segments = url.pathname.split('/').filter(Boolean)
    .map((segment) => segment.replace(/\.git$/, ''));
  if (segments.length < 2) {
    throw new Error(`"${input}" does not look like a repository URL (need at least /owner/repo).`);
  }

  if (host === 'github.com' || host === 'www.github.com') {
    const [owner, repo] = segments;
    const resolvedRef = ref ?? (segments[2] === 'tree' && segments[3] ? segments[3] : undefined);
    return {
      forge: 'github', host, project: `${owner}/${repo}`, ref: resolvedRef,
      archiveUrl: `https://api.github.com/repos/${owner}/${repo}/tarball${resolvedRef ? `/${encodeURIComponent(resolvedRef)}` : ''}`,
    };
  }

  if (host === 'codeberg.org' || host.includes('gitea')) {
    const [owner, repo] = segments;
    const resolvedRef = ref
      ?? (segments[2] === 'src' && segments[3] === 'branch' && segments[4] ? segments[4] : undefined)
      ?? 'HEAD';
    return {
      forge: 'gitea', host, project: `${owner}/${repo}`, ref: resolvedRef,
      archiveUrl: `https://${host}/api/v1/repos/${owner}/${repo}/archive/${encodeURIComponent(resolvedRef)}.tar.gz`,
    };
  }

  // Everything else is treated as GitLab-style — gitlab.com, gitlab.gnome.org,
  // and self-hosted instances. GitLab project paths can be nested groups; the
  // `/-/` marker separates the project path from in-repo routes.
  const dashIndex = segments.indexOf('-');
  const projectSegments = dashIndex === -1 ? segments : segments.slice(0, dashIndex);
  const resolvedRef = ref
    ?? (dashIndex !== -1 && segments[dashIndex + 1] === 'tree' && segments[dashIndex + 2]
      ? segments[dashIndex + 2]
      : undefined);
  const project = projectSegments.join('/');
  return {
    forge: 'gitlab', host, project, ref: resolvedRef,
    archiveUrl: `https://${host}/api/v4/projects/${encodeURIComponent(project)}/repository/archive.tar.gz${resolvedRef ? `?sha=${encodeURIComponent(resolvedRef)}` : ''}`,
  };
}

/**
 * Fetch a repository archive straight from the forge and unpack it in-page.
 * CORS is forge-dependent: when the browser blocks the download the error
 * says so and points at the zip-drop fallback instead of failing generically.
 */
export async function fetchGitArchive(
  input: string,
  ref?: string,
): Promise<{ files: AppFileMap; request: GitArchiveRequest }> {
  const request = normalizeGitUrl(input, ref);
  let response: Response;
  try {
    response = await fetch(request.archiveUrl, { redirect: 'follow' });
  } catch {
    throw new Error(
      `${request.host} blocked the download in the browser (network/CORS). ` +
      'This forge does not allow cross-origin archive downloads — download the repository as a .zip yourself and drop it here instead.',
    );
  }
  if (!response.ok) {
    throw new Error(
      `${request.host} answered ${response.status} for ${request.archiveUrl}. ` +
      'Check the URL and ref — or download the repository as a .zip and drop it here.',
    );
  }
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ARCHIVE_INPUT_BYTES) {
    throw new Error(`Archive exceeds the ${MAX_ARCHIVE_INPUT_BYTES}-byte input safety limit.`);
  }
  const archive = response.body
    ? await readStreamWithLimit(response.body, MAX_ARCHIVE_INPUT_BYTES)
    : new Uint8Array(await response.arrayBuffer());
  const files = await filesFromArchive(archive.buffer as ArrayBuffer);
  if (!Object.keys(files).length) {
    throw new Error('The archive downloaded fine but contained no .blp or .ui sources.');
  }
  return { files, request };
}

async function readStreamWithLimit(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error(`Archive exceeds the ${maxBytes}-byte input safety limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}
