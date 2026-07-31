/**
 * Browser ingest adapters (#118): the in-page zip central-directory reader
 * (stored + deflate via DecompressionStream('deflate-raw')), the ustar/GNU
 * tar reader, git-forge URL normalization, and the client-side archive
 * fetch (with fetch mocked — real-forge CORS is verified manually, never in
 * CI). Archives are constructed byte-by-byte inside the tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deflateRawSync, gzipSync } from 'node:zlib';
import {
  filesFromZip,
  filesFromTar,
  filesFromTarGz,
  filesFromArchive,
  normalizeGitUrl,
  fetchGitArchive,
  stripCommonRoot,
} from '../utils/appIngest';

const encoder = new TextEncoder();

// --- Minimal zip writer (test-only) ----------------------------------------

interface ZipSpec { name: string; data: string; method: 0 | 8 }

function buildZip(entries: ZipSpec[], commentLength = 0): ArrayBuffer {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const raw = encoder.encode(entry.data);
    const stored = entry.method === 8 ? new Uint8Array(deflateRawSync(raw)) : raw;
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, entry.method, true);
    lv.setUint32(18, stored.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    chunks.push(local, stored);

    const dir = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(10, entry.method, true);
    dv.setUint32(20, stored.length, true);
    dv.setUint32(24, raw.length, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint32(42, offset, true);
    dir.set(nameBytes, 46);
    central.push(dir);
    offset += local.length + stored.length;
  }
  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const eocd = new Uint8Array(22 + commentLength);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, commentLength, true);
  const total = chunks.concat(central, [eocd]);
  const out = new Uint8Array(total.reduce((sum, chunk) => sum + chunk.length, 0));
  let cursor = 0;
  for (const chunk of total) { out.set(chunk, cursor); cursor += chunk.length; }
  return out.buffer;
}

// --- Minimal tar writer (test-only) ----------------------------------------

function tarHeader(name: string, size: number, typeFlag = '0'): Uint8Array {
  const block = new Uint8Array(512);
  block.set(encoder.encode(name).subarray(0, 100), 0);
  block.set(encoder.encode('0000644\0'), 100);
  block.set(encoder.encode(`${size.toString(8).padStart(11, '0')}\0`), 124);
  block[156] = typeFlag.charCodeAt(0);
  block.set(encoder.encode('ustar'), 257);
  block.set(encoder.encode('00'), 262);
  return block;
}

function buildTar(entries: { name: string; data: string; typeFlag?: string; longName?: boolean }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const push = (name: string, data: Uint8Array, typeFlag: string) => {
    chunks.push(tarHeader(name, data.length, typeFlag));
    const padded = new Uint8Array(Math.ceil(data.length / 512) * 512);
    padded.set(data);
    if (data.length) chunks.push(padded);
  };
  for (const entry of entries) {
    const data = encoder.encode(entry.data);
    if (entry.longName) {
      push('././@LongLink', encoder.encode(`${entry.name}\0`), 'L');
      push(entry.name.slice(0, 40), data, entry.typeFlag ?? '0');
    } else {
      push(entry.name, data, entry.typeFlag ?? '0');
    }
  }
  chunks.push(new Uint8Array(1024)); // end-of-archive
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let cursor = 0;
  for (const chunk of chunks) { out.set(chunk, cursor); cursor += chunk.length; }
  return out;
}

const BLP = 'using Gtk 4.0;\nAdw.ApplicationWindow { title: "Zip"; }\n';

// ---------------------------------------------------------------------------

describe('filesFromZip', () => {
  it('reads stored and deflated entries, skipping directories and binaries', async () => {
    const zip = buildZip([
      { name: 'repo-main/', data: '', method: 0 },
      { name: 'repo-main/src/window.blp', data: BLP, method: 8 },
      { name: 'repo-main/src/meson.build', data: "files('window.blp')", method: 0 },
      { name: 'repo-main/icon.png', data: 'not-really-a-png', method: 0 },
      { name: 'repo-main/.git/HEAD', data: 'ref: refs/heads/main', method: 0 },
    ]);
    const files = await filesFromZip(zip);
    expect(files).toEqual({
      'src/window.blp': BLP,
      'src/meson.build': "files('window.blp')",
    });
  });

  it('finds the end-of-central-directory record past an archive comment', async () => {
    const zip = buildZip([{ name: 'a/x.blp', data: BLP, method: 0 }], 40);
    const files = await filesFromZip(zip);
    expect(files['x.blp']).toBe(BLP);
  });

  it('rejects non-zip data loudly', async () => {
    await expect(filesFromZip(new Uint8Array(64).buffer)).rejects.toThrow(/ZIP/);
  });
});

describe('filesFromTar / filesFromTarGz', () => {
  it('reads ustar entries with prefix-free names and skips pax headers', () => {
    const tar = buildTar([
      { name: 'pax_global_header', data: 'comment=abc', typeFlag: 'g' },
      { name: 'repo-1.0/src/window.blp', data: BLP },
      { name: 'repo-1.0/data/app.gresource.xml', data: '<gresources/>' },
      { name: 'repo-1.0/icon.svg', data: '<svg/>' },
    ]);
    const files = filesFromTar(tar);
    expect(files).toEqual({
      'src/window.blp': BLP,
      'data/app.gresource.xml': '<gresources/>',
    });
  });

  it('honours GNU long-name (type L) entries', () => {
    const longPath = 'repo-1.0/some/quite/deeply/nested/directory/structure/for/testing/window-with-a-very-long-name.blp';
    const tar = buildTar([{ name: longPath, data: BLP, longName: true }]);
    const files = filesFromTar(tar);
    expect(Object.keys(files)).toEqual([
      'some/quite/deeply/nested/directory/structure/for/testing/window-with-a-very-long-name.blp',
    ]);
  });

  it('unpacks .tar.gz through DecompressionStream', async () => {
    const tar = buildTar([{ name: 'repo/src/window.blp', data: BLP }]);
    const files = await filesFromTarGz(new Uint8Array(gzipSync(tar)).buffer as ArrayBuffer);
    expect(files['src/window.blp']).toBe(BLP);
  });
});

describe('filesFromArchive dispatch', () => {
  it('dispatches by magic bytes', async () => {
    const zip = await filesFromArchive(buildZip([{ name: 'r/a.blp', data: BLP, method: 0 }]));
    expect(zip['a.blp']).toBe(BLP);
    const tar = buildTar([{ name: 'r/a.blp', data: BLP }]);
    const targz = await filesFromArchive(new Uint8Array(gzipSync(tar)).buffer as ArrayBuffer);
    expect(targz['a.blp']).toBe(BLP);
    const plain = await filesFromArchive(tar.slice().buffer as ArrayBuffer);
    expect(plain['a.blp']).toBe(BLP);
    await expect(filesFromArchive(new Uint8Array([1, 2, 3, 4]).buffer)).rejects.toThrow(/archive/i);
  });
});

describe('stripCommonRoot', () => {
  it('drops exactly the single wrapping directory, keeping checkout layout', () => {
    expect(stripCommonRoot({ 'repo/src/a.blp': 'x', 'repo/src/b.blp': 'y' }))
      .toEqual({ 'src/a.blp': 'x', 'src/b.blp': 'y' });
  });

  it('keeps paths that already diverge at the top', () => {
    const map = { 'src/a.blp': 'x', 'data/app.gresource.xml': 'y' };
    expect(stripCommonRoot(map)).toEqual(map);
  });
});

describe('normalizeGitUrl', () => {
  it('maps GitHub URLs to the API tarball endpoint', () => {
    expect(normalizeGitUrl('https://github.com/owner/repo').archiveUrl)
      .toBe('https://api.github.com/repos/owner/repo/tarball');
    expect(normalizeGitUrl('https://github.com/owner/repo.git', 'v1.2').archiveUrl)
      .toBe('https://api.github.com/repos/owner/repo/tarball/v1.2');
    expect(normalizeGitUrl('https://github.com/owner/repo/tree/develop').archiveUrl)
      .toBe('https://api.github.com/repos/owner/repo/tarball/develop');
  });

  it('maps GitLab URLs (incl. gitlab.gnome.org, nested groups) to the v4 archive endpoint', () => {
    expect(normalizeGitUrl('https://gitlab.gnome.org/World/amberol').archiveUrl)
      .toBe('https://gitlab.gnome.org/api/v4/projects/World%2Famberol/repository/archive.tar.gz');
    expect(normalizeGitUrl('https://gitlab.gnome.org/GNOME/gnome-text-editor/-/tree/gnome-45', undefined).archiveUrl)
      .toBe('https://gitlab.gnome.org/api/v4/projects/GNOME%2Fgnome-text-editor/repository/archive.tar.gz?sha=gnome-45');
    expect(normalizeGitUrl('https://gitlab.com/group/subgroup/project', 'main').archiveUrl)
      .toBe('https://gitlab.com/api/v4/projects/group%2Fsubgroup%2Fproject/repository/archive.tar.gz?sha=main');
  });

  it('maps Codeberg/Gitea URLs to the v1 archive endpoint', () => {
    expect(normalizeGitUrl('https://codeberg.org/owner/repo').archiveUrl)
      .toBe('https://codeberg.org/api/v1/repos/owner/repo/archive/HEAD.tar.gz');
    expect(normalizeGitUrl('https://codeberg.org/owner/repo/src/branch/main').archiveUrl)
      .toBe('https://codeberg.org/api/v1/repos/owner/repo/archive/main.tar.gz');
  });

  it('rejects non-URLs and bare hosts loudly', () => {
    expect(() => normalizeGitUrl('not a url')).toThrow(/valid URL/);
    expect(() => normalizeGitUrl('https://github.com/onlyowner')).toThrow(/owner\/repo/);
  });
});

describe('fetchGitArchive (fetch mocked — no network in CI)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('downloads, unpacks, and returns the file map', async () => {
    const tar = buildTar([{ name: 'amberol-main/src/window.blp', data: BLP }]);
    const body = new Uint8Array(gzipSync(tar));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body as unknown as BodyInit, { status: 200 })));
    const { files, request } = await fetchGitArchive('https://gitlab.gnome.org/World/amberol');
    expect(request.forge).toBe('gitlab');
    expect(files['src/window.blp']).toBe(BLP);
  });

  it('turns a network/CORS failure into an actionable zip-drop suggestion', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(fetchGitArchive('https://example.gitlab.io/o/r')).rejects
      .toThrow(/blocked the download .*drop it here/s);
  });

  it('reports HTTP errors with the status and the fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    await expect(fetchGitArchive('https://github.com/o/missing')).rejects.toThrow(/404/);
  });
});
