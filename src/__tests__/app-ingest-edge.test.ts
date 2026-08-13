/**
 * Edge cases of the app-ingest pipeline (src/utils/appIngest.ts) that
 * app-ingest.test.ts does not reach: stripCommonRoot guards, folder ingest
 * (webkitdirectory / drag-drop entry walks, size caps, zip fallback),
 * corrupt-zip errors, GNU long-name tar entries, and the empty-archive
 * error of fetchGitArchive.
 */
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchGitArchive,
  filesFromArchive,
  filesFromDataTransfer,
  filesFromFileList,
  MAX_TEXT_FILE_BYTES,
  stripCommonRoot,
} from '../utils/appIngest';

const BLP = 'Adw.Window { }';
const encoder = new TextEncoder();

// ── zip builder (stored only) ────────────────────────────────────────────────

function buildZip(entries: { name: string; data: string }[]): ArrayBuffer {
  const chunks: Uint8Array[] = [];
  const cds: Uint8Array[] = [];
  let cdOffset = 0;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const raw = encoder.encode(entry.data);
    const local = new Uint8Array(30 + nameBytes.length + raw.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint32(18, raw.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(raw, 30 + nameBytes.length);
    chunks.push(local);

    const dir = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint32(20, raw.length, true);
    dv.setUint32(24, raw.length, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint32(42, cdOffset, true);
    dir.set(nameBytes, 46);
    cds.push(dir);
    cdOffset += local.length;
  }
  const total = chunks.reduce((n, c) => n + c.length, 0)
    + cds.reduce((n, c) => n + c.length, 0) + 22;
  const all = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  for (const c of cds) { all.set(c, o); o += c.length; }
  const ev = new DataView(all.buffer);
  ev.setUint32(o, 0x06054b50, true);
  ev.setUint16(o + 8, entries.length, true);
  ev.setUint16(o + 10, entries.length, true);
  ev.setUint32(o + 16, cdOffset, true);
  return all.buffer;
}

// ── stripCommonRoot ──────────────────────────────────────────────────────────

describe('stripCommonRoot guards', () => {
  it('strips the single top-level wrapper directory', () => {
    expect(stripCommonRoot({ 'repo/src/app.blp': 'x' })).toEqual({ 'src/app.blp': 'x' });
  });

  it('leaves maps with multiple roots untouched', () => {
    const map = { 'a/x.blp': '1', 'b/y.blp': '2' };
    expect(stripCommonRoot(map)).toEqual(map);
  });

  it('leaves root-level files untouched (no nested path)', () => {
    const map = { 'app.blp': '1' };
    expect(stripCommonRoot(map)).toEqual(map);
  });

  it('leaves an empty map untouched', () => {
    expect(stripCommonRoot({})).toEqual({});
  });
});

// ── filesFromFileList / filesFromDataTransfer ────────────────────────────────

describe('folder ingest', () => {
  it('maps webkitRelativePath and applies the size cap', async () => {
    const files = [
      new File([BLP], 'app.blp', { type: 'text/plain' }),
    ];
    Object.defineProperty(files[0], 'webkitRelativePath', { value: 'checkout/src/app.blp' });
    const oversized = new File([new Uint8Array(MAX_TEXT_FILE_BYTES + 1)], 'huge.ui', { type: 'text/plain' });
    const ignored = new File([BLP], 'node_modules/x.blp', { type: 'text/plain' });

    const map = await filesFromFileList([files[0], oversized, ignored]);
    expect(map).toEqual({ 'src/app.blp': BLP });
  });

  function fakeFileEntry(name: string, fullPath: string, content: string, size = 0) {
    return {
      isFile: true, isDirectory: false, name, fullPath,
      file: (resolve: (f: File) => void) => resolve(
        new File([size ? new Uint8Array(size) : content], name, { type: 'text/plain' })),
    };
  }

  function fakeDirEntry(name: string, fullPath: string, children: unknown[]) {
    let reads = 0;
    return {
      isFile: false, isDirectory: true, name, fullPath,
      createReader: () => ({
        readEntries: (resolve: (e: unknown[]) => void) => {
          // Two batches then empty — exercises the batched-read loop.
          if (reads === 0) { reads++; resolve(children.slice(0, 1)); }
          else if (reads === 1) { reads++; resolve(children.slice(1)); }
          else resolve([]);
        },
      }),
    };
  }

  it('walks dropped files and directories with batched reads', async () => {
    const dir = fakeDirEntry('root', '/root', [
      fakeFileEntry('app.blp', '/root/src/app.blp', BLP),
      fakeFileEntry('other.ui', '/root/other.ui', BLP),
    ]);
    const dataTransfer = {
      items: [{ webkitGetAsEntry: () => dir }],
      files: [],
    } as unknown as DataTransfer;

    const map = await filesFromDataTransfer(dataTransfer);
    expect(map['src/app.blp']).toBe(BLP);
    expect(map['other.ui']).toBe(BLP);
  });

  it('skips ignored directories and oversized files', async () => {
    const dir = fakeDirEntry('root', '/root', [
      fakeDirEntry('builddir', '/root/builddir', [fakeFileEntry('x.blp', '/root/builddir/x.blp', BLP)]),
      fakeFileEntry('big.ui', '/root/big.ui', BLP, MAX_TEXT_FILE_BYTES + 1),
      fakeFileEntry('ok.blp', '/root/ok.blp', BLP),
    ]);
    const dataTransfer = {
      items: [{ webkitGetAsEntry: () => dir }],
      files: [],
    } as unknown as DataTransfer;

    const map = await filesFromDataTransfer(dataTransfer);
    expect(map).toEqual({ 'ok.blp': BLP });
  });

  it('falls back to a dropped zip when no sources were found', async () => {
    const zip = buildZip([{ name: 'repo/src/app.blp', data: BLP }]);
    const dataTransfer = {
      items: [],
      files: [new File([zip], 'app.zip', { type: 'application/zip' })],
    } as unknown as DataTransfer;

    const map = await filesFromDataTransfer(dataTransfer);
    expect(map['src/app.blp']).toBe(BLP);
  });
});

// ── corrupt archives ─────────────────────────────────────────────────────────

describe('corrupt archives fail loudly', () => {
  it('rejects a ZIP with a corrupt central directory', async () => {
    const zip = new Uint8Array(buildZip([{ name: 'a.blp', data: BLP }]));
    // Central directory starts right after the local header; break its
    // 0x02014b50 signature.
    const cdOffset = 30 + 5 + BLP.length;
    zip[cdOffset] = 0x00;
    await expect(filesFromArchive(zip.buffer as ArrayBuffer)).rejects.toThrow(/Corrupt ZIP central directory/);
  });

  it('rejects a ZIP with a corrupt local header', async () => {
    const zip = new Uint8Array(buildZip([
      { name: 'a.blp', data: BLP },
      { name: 'b.blp', data: BLP },
    ]));
    // Corrupt the SECOND entry's local header signature (the first one
    // doubles as the zip magic the dispatch sniffs).
    const firstLen = 30 + 5 + BLP.length;
    zip[firstLen] = 0x00;
    await expect(filesFromArchive(zip.buffer as ArrayBuffer)).rejects.toThrow(/Corrupt ZIP local header/);
  });
});

// ── GNU long-name tar entries ────────────────────────────────────────────────

describe('tar GNU long names', () => {
  function tarHeader(name: string, size: number, typeFlag = '0'): Uint8Array {
    const header = new Uint8Array(512);
    header.set(encoder.encode(name.slice(0, 100)), 0);
    header.set(encoder.encode(size.toString(8).padStart(11, '0')), 124);
    header[156] = typeFlag.charCodeAt(0);
    header.set(encoder.encode('ustar'), 257);
    header.set(encoder.encode('00'), 263);
    return header;
  }

  function buildTar(entries: { name: string; data?: string; typeFlag?: string }[]): Uint8Array {
    const chunks: Uint8Array[] = [];
    for (const entry of entries) {
      const data = entry.data ? encoder.encode(entry.data) : new Uint8Array(0);
      const padded = Math.ceil(data.length / 512) * 512;
      const block = new Uint8Array(512 + padded);
      block.set(tarHeader(entry.name, data.length, entry.typeFlag ?? '0'), 0);
      block.set(data, 512);
      chunks.push(block);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0) + 1024;
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  it('resolves the real name from the preceding L entry', async () => {
    const longName = 'very/deeply/nested/source/file.blp';
    const tar = buildTar([
      { name: '././@LongLink', typeFlag: 'L', data: longName },
      { name: 'truncated', data: BLP },
    ]);
    const map = await filesFromArchive(tar.buffer as ArrayBuffer);
    // stripCommonRoot unwraps the single top-level directory segment.
    expect(map['deeply/nested/source/file.blp']).toBe(BLP);
  });
});

// ── fetchGitArchive: empty archive ───────────────────────────────────────────

describe('fetchGitArchive edge case', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects an archive that contains no sources', async () => {
    const zip = buildZip([{ name: 'repo/README.md', data: 'docs only' }]);
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(new Uint8Array(gzipSync(zip)) as unknown as BodyInit, { status: 200 })));
    await expect(fetchGitArchive('https://github.com/o/r')).rejects.toThrow(/contained no \.blp or \.ui sources/);
  });
});
