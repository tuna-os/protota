/**
 * imageStore — the IndexedDB-backed image asset store (src/services/imageStore.ts).
 * Runs against fake-indexeddb (a full in-memory IDB implementation), so the
 * save/get/delete contract and the blob round-trip are proven without a real
 * browser database.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteImageBlob, getImageBlob, saveImageBlob } from '../services/imageStore';

beforeEach(() => {
  // Fresh in-memory database per test.
  globalThis.indexedDB = new IDBFactory();
});

describe('imageStore', () => {
  it('round-trips a blob through save → get', async () => {
    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    await saveImageBlob('asset-1', blob);

    const got = await getImageBlob('asset-1');
    expect(got).not.toBeNull();
    expect(got!.type).toBe('image/png');
    expect(await got!.text()).toBe('png-bytes');
  });

  it('overwrites an existing id', async () => {
    await saveImageBlob('asset-1', new Blob(['first'], { type: 'image/png' }));
    await saveImageBlob('asset-1', new Blob(['second'], { type: 'image/png' }));

    const got = await getImageBlob('asset-1');
    expect(await got!.text()).toBe('second');
  });

  it('returns null for a missing id', async () => {
    expect(await getImageBlob('never-saved')).toBeNull();
  });

  it('delete removes the entry', async () => {
    await saveImageBlob('asset-1', new Blob(['x'], { type: 'image/png' }));
    await deleteImageBlob('asset-1');
    expect(await getImageBlob('asset-1')).toBeNull();
    // Deleting a missing id is a no-op success.
    await deleteImageBlob('asset-1');
  });

  it('keeps distinct ids independent', async () => {
    await saveImageBlob('a', new Blob(['A'], { type: 'image/png' }));
    await saveImageBlob('b', new Blob(['B'], { type: 'image/png' }));
    expect(await (await getImageBlob('a'))!.text()).toBe('A');
    expect(await (await getImageBlob('b'))!.text()).toBe('B');
  });
});
