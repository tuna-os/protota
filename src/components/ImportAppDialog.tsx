import React, { useRef, useState } from 'react';
import { persistDocumentSource } from '../store/mockupStore';
import { blueprintBundleToDocument } from '../utils/blueprint';
import {
  discoverAppSources,
  appBundleManifest,
  type AppDiscoveryResult,
  type AppBundleManifest,
  type AppFileMap,
} from '../utils/appDiscovery';
import {
  filesFromFileList,
  filesFromDataTransfer,
  filesFromArchive,
  fetchGitArchive,
} from '../utils/appIngest';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface IngestState {
  label: string;
  suggestedTitle: string;
  discovery: AppDiscoveryResult;
  manifest: AppBundleManifest;
}

const prettifyTitle = (raw: string): string =>
  raw.replace(/\.(zip|tar\.gz|tgz|tar)$/i, '').replace(/[-_]+/g, ' ').trim() || 'Imported GNOME App';

/**
 * Import App front door (#118): drop a checkout folder, pick a folder or
 * .zip, or paste a git-forge URL. Ingest and discovery run entirely in-page
 * (src/utils/appIngest.ts → src/utils/appDiscovery.ts — the same core the
 * protota-import CLI uses); the manifest is shown before anything replaces
 * the document, with the preset gallery's confirmation/undo semantics.
 */
export const ImportAppDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ingested, setIngested] = useState<IngestState | null>(null);
  const [entry, setEntry] = useState<string>('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitRef, setGitRef] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const reset = () => {
    setIngested(null);
    setEntry('');
    setError(null);
    setBusy(null);
  };

  const finishIngest = (files: AppFileMap, label: string, suggestedTitle: string) => {
    const discovery = discoverAppSources(files);
    if (!discovery.files.length) {
      setError(`No .blp or .ui files found in ${label}. Point this at an app checkout (the folder containing meson.build).`);
      setBusy(null);
      return;
    }
    const manifest = appBundleManifest(discovery.files);
    setIngested({ label, suggestedTitle, discovery, manifest });
    setEntry(manifest.entryCandidates.length === 1 ? manifest.entryCandidates[0] : '');
    setError(null);
    setBusy(null);
  };

  const runIngest = async (task: () => Promise<{ files: AppFileMap; label: string; title: string }>, busyLabel: string) => {
    setBusy(busyLabel);
    setError(null);
    setIngested(null);
    try {
      const { files, label, title } = await task();
      finishIngest(files, label, title);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const handleFolderPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list?.length) return;
    const rootName = (list[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0] ?? 'folder';
    void runIngest(async () => ({
      files: await filesFromFileList(Array.from(list)),
      label: `folder "${rootName}"`,
      title: prettifyTitle(rootName),
    }), 'Reading folder…');
    event.target.value = '';
  };

  const handleZipPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void runIngest(async () => ({
      files: await filesFromArchive(await file.arrayBuffer()),
      label: file.name,
      title: prettifyTitle(file.name),
    }), 'Unpacking archive…');
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const transfer = event.dataTransfer;
    void runIngest(async () => ({
      files: await filesFromDataTransfer(transfer),
      label: 'the dropped files',
      title: prettifyTitle(transfer.files[0]?.name ?? 'Imported GNOME App'),
    }), 'Reading dropped files…');
  };

  const handleFetchUrl = () => {
    if (!gitUrl.trim()) return;
    void runIngest(async () => {
      const { files, request } = await fetchGitArchive(gitUrl, gitRef.trim() || undefined);
      return {
        files,
        label: `${request.host}/${request.project}${request.ref ? `@${request.ref}` : ''}`,
        title: prettifyTitle(request.project.split('/').pop() ?? 'Imported GNOME App'),
      };
    }, 'Downloading archive…');
  };

  const handleImport = () => {
    if (!ingested || !entry) return;
    try {
      const doc = blueprintBundleToDocument(ingested.discovery.files, entry, ingested.suggestedTitle);
      doc.colorScheme = doc.colorScheme || 'auto';
      // Same confirmation/undo semantics as the preset gallery: persist and
      // reload; Undo (Ctrl+Z) restores the previous document.
      persistDocumentSource(doc);
      localStorage.setItem('protota_was_preset', 'true');
      window.location.reload();
    } catch (err) {
      setError('Import failed: ' + (err as Error).message);
    }
  };

  const manifest = ingested?.manifest;

  return (
    <div className="protota-modal-backdrop" onClick={onClose}>
      <div
        className="protota-modal"
        data-testid="import-app-dialog"
        onClick={(event) => event.stopPropagation()}
        style={{ width: 'min(640px, 94vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '4px' }}>Import App</h3>
        <p style={{ fontSize: '12px', opacity: 0.65, margin: '0 0 4px' }}>
          Bring a GNOME app checkout into the designer: drop its source folder, pick a .zip,
          or paste its repository URL. Importing replaces the current document —
          use Undo (Ctrl+Z) to restore it afterwards.
        </p>
        <p style={{ fontSize: '12px', fontWeight: 600, margin: '0 0 12px' }} data-testid="import-app-privacy">
          Files are read locally in your browser — nothing is uploaded.
        </p>

        {!ingested && (
          <>
            <div
              data-testid="import-app-dropzone"
              onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent-bg-color, #3584e4)' : 'var(--separator-color, rgba(0,0,6,0.15))'}`,
                borderRadius: '10px',
                padding: '22px 16px',
                textAlign: 'center',
                fontSize: '13px',
                opacity: 0.85,
                background: dragOver ? 'rgba(53,132,228,0.06)' : 'transparent',
                marginBottom: '12px',
              }}
            >
              Drop the checkout folder (or a .zip / .tar.gz) here
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
                <button className="protota-btn" onClick={() => folderInputRef.current?.click()}>
                  Choose Folder…
                </button>
                <button className="protota-btn" onClick={() => zipInputRef.current?.click()}>
                  Choose Zip…
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
              <input
                className="protota-input"
                data-testid="import-app-url"
                type="text"
                placeholder="Repository URL — GitHub, GitLab (incl. gitlab.gnome.org), Codeberg"
                value={gitUrl}
                onChange={(event) => setGitUrl(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') handleFetchUrl(); }}
                style={{ flex: 3 }}
              />
              <input
                className="protota-input"
                data-testid="import-app-ref"
                type="text"
                placeholder="ref (optional)"
                value={gitRef}
                onChange={(event) => setGitRef(event.target.value)}
                style={{ flex: 1, minWidth: '90px' }}
              />
              <button className="protota-btn" data-testid="import-app-fetch" onClick={handleFetchUrl} disabled={!!busy}>
                Fetch
              </button>
            </div>
            <p style={{ fontSize: '11px', opacity: 0.55, margin: '0 0 8px' }}>
              The archive is downloaded straight from the forge. Some forges block browser
              downloads (CORS) — if that happens, download the zip yourself and drop it above.
            </p>
          </>
        )}

        {busy && <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>{busy}</div>}
        {error && (
          <div
            data-testid="import-app-error"
            style={{
              padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px',
              background: 'rgba(224,27,36,0.08)', color: 'var(--destructive-fg-color, #c01c28)',
            }}
          >
            {error}
          </div>
        )}

        {ingested && manifest && (
          <div data-testid="import-app-manifest" style={{ overflow: 'auto', flex: 1, fontSize: '12px' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>{ingested.label}</strong> — discovery: {ingested.discovery.discovery}
            </div>
            {ingested.discovery.notes.map((note, index) => (
              <div key={index} style={{ opacity: 0.7, marginBottom: '6px' }}>Note: {note}</div>
            ))}

            <div style={{ fontWeight: 600, margin: '8px 0 4px' }}>
              Files found ({ingested.discovery.files.length})
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', maxHeight: '140px', overflow: 'auto' }}>
              {ingested.discovery.files.map((file) => (
                <li key={file.path} data-testid="import-app-file">
                  {file.path}
                  {manifest.entryCandidates.includes(file.path) && (
                    <span style={{ opacity: 0.6 }}> — window-bearing</span>
                  )}
                </li>
              ))}
            </ul>

            <div style={{ fontWeight: 600, margin: '10px 0 4px' }}>Entry file</div>
            {manifest.entryCandidates.length === 0 && (
              <div style={{ opacity: 0.75 }}>
                No window-bearing file was found — pick the file to import as the entry:
              </div>
            )}
            <select
              className="protota-input"
              data-testid="import-app-entry"
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
              style={{ width: '100%', margin: '4px 0' }}
            >
              <option value="" disabled>Choose the entry file…</option>
              {(manifest.entryCandidates.length ? manifest.entryCandidates : ingested.discovery.files.map((file) => file.path))
                .map((path) => <option key={path} value={path}>{path}</option>)}
            </select>
            {manifest.entryCandidates.length > 1 && (
              <div style={{ opacity: 0.7 }}>
                Multiple window-bearing files were found — choose which one to import.
              </div>
            )}

            {manifest.unresolvedReferences.length > 0 && (
              <div style={{ margin: '10px 0 0' }} data-testid="import-app-unresolved">
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Unresolved template references</div>
                <div style={{ opacity: 0.75 }}>
                  {manifest.unresolvedReferences.join(', ')} — these stay as explicit custom-widget boundaries.
                </div>
              </div>
            )}
            {manifest.parseIssues.length > 0 && (
              <div style={{ margin: '10px 0 0' }} data-testid="import-app-parse-issues">
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Parse issues</div>
                {manifest.parseIssues.map((issue) => (
                  <div key={issue.path} style={{ opacity: 0.75 }}>{issue.path}: {issue.message}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
          {ingested && (
            <button className="protota-btn" onClick={reset}>
              Back
            </button>
          )}
          <button className="protota-btn" onClick={onClose}>Cancel</button>
          {ingested && (
            <button
              className="protota-btn suggested"
              data-testid="import-app-confirm"
              onClick={handleImport}
              disabled={!entry}
            >
              Import
            </button>
          )}
        </div>

        {/* Hidden pickers; setInputFiles targets these in tests. */}
        <input
          ref={folderInputRef}
          data-testid="import-app-folder-input"
          type="file"
          // React's typings do not know webkitdirectory; the DOM does.
          {...{ webkitdirectory: '', directory: '' } as Record<string, string>}
          multiple
          onChange={handleFolderPick}
          style={{ display: 'none' }}
        />
        <input
          ref={zipInputRef}
          data-testid="import-app-zip-input"
          type="file"
          accept=".zip,.tar.gz,.tgz,.tar,application/zip"
          onChange={handleZipPick}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};
