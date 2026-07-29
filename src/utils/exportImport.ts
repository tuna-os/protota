import type { MockupDocument, AdwNode } from '../types/mockup';
import { getImageBlob, saveImageBlob } from '../services/imageStore';
import { blueprintToDocument } from './blueprint';

interface ExportPayload {
  version: number;
  exportedAt: string;
  document: MockupDocument;
  assets: Record<string, string>;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0].replace('data:', '');
  const raw = window.atob(parts[1]);
  const uInt8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

function extractImageIds(doc: MockupDocument): string[] {
  const ids: string[] = [];
  const traverse = (node: AdwNode) => {
    if (node.imageId) ids.push(node.imageId);
    if (node.children) node.children.forEach(traverse);
  };
  doc.screens.forEach((s) => traverse(s.rootNode));
  return Array.from(new Set(ids));
}

export async function exportDocumentFile(doc: MockupDocument): Promise<void> {
  const imageIds = extractImageIds(doc);
  const assets: Record<string, string> = {};

  for (const id of imageIds) {
    const blob = await getImageBlob(id);
    if (blob) {
      assets[id] = await blobToBase64(blob);
    }
  }

  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    document: doc,
    assets,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.title.toLowerCase().replace(/\s+/g, '-')}.mockup.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importDocumentFile(file: File): Promise<MockupDocument> {
  const text = await file.text();
  const filename = file.name.toLowerCase();
  if (filename.endsWith('.blp') || filename.endsWith('.ui')) {
    const title = file.name.replace(/\.(blp|ui)$/i, '').replace(/[-_]+/g, ' ').trim() || 'Imported GNOME App';
    return blueprintToDocument(text, title);
  }
  const payload: ExportPayload = JSON.parse(text);

  if (!payload.document) throw new Error('Invalid mockup document format');

  if (payload.assets) {
    for (const [id, base64] of Object.entries(payload.assets)) {
      const blob = base64ToBlob(base64);
      await saveImageBlob(id, blob);
    }
  }

  return payload.document;
}
