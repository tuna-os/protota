import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMockupStore } from '../store/mockupStore';
import { exportDocumentFile } from '../utils/exportImport';
import { discoverAppSources, appBundleManifest, type AppDiscoveryResult } from '../utils/appDiscovery';
import { planWriteback, unifiedDiff, type WritebackPlan } from '../utils/writeback';
import {
  supportsDirectoryPicker,
  pickCheckoutDirectory,
  filesFromDirectoryHandle,
  writeFileToDirectoryHandle,
  type DirectoryHandleLike,
} from '../utils/fsAccess';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** The documented container fallback for hosts without blueprint-compiler. */
const BPC_CONTAINER =
  `--bpc 'podman run --rm -v {dir}:/blp:z localhost/bpc sh -c "blueprint-compiler compile /blp/{name}"'`;

interface DirectState {
  handle: DirectoryHandleLike;
  discovery: AppDiscoveryResult;
  entryCandidates: string[];
  entry: string;
  plan: WritebackPlan | null;
  planError: string | null;
}

/**
 * "Export → Patch into checkout…" — the write-back UX bridge (ADR 0001
 * Part 3 item 1; #80 decided the host action stays explicit, the browser
 * never writes into a checkout silently).
 *
 * Two paths, mirroring the import front door's local-only idiom (#118):
 *  - every browser: download the .mockup.json and run the generated
 *    protota-writeback one-liner on the host (dry-run by default there);
 *  - Chromium: grant a directory handle and run the same write-back core
 *    (src/utils/writeback.ts) in-page — report first, write only after an
 *    explicit confirm (the CLI's --write gate maps to that confirm).
 */
export const ExportWritebackDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const { doc } = useMockupStore();
  const [checkoutPath, setCheckoutPath] = useState('~/src/my-app');
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [direct, setDirect] = useState<DirectState | null>(null);
  const [written, setWritten] = useState<string[] | null>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const documentFileName = `${doc.title.toLowerCase().replace(/\s+/g, '-')}.mockup.json`;
  const shellPath = (raw: string): string => (/[\s"'\\$`]/.test(raw) ? JSON.stringify(raw) : raw);
  const command = useMemo(
    () => `npx tsx scripts/protota-writeback.mjs --checkout ${shellPath(checkoutPath.trim() || '~/src/my-app')} --document ${shellPath(documentFileName)}`,
    [checkoutPath, documentFileName],
  );

  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (isOpen) {
      (el as any).present?.();
    }
  }, [isOpen]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = () => onClose();
    el.addEventListener('closed', handler);
    return () => el.removeEventListener('closed', handler);
  }, [onClose]);

  if (!isOpen) return null;

  const handleCopy = (label: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(label);
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => setCopied(null), 1500);
  };

  const close = () => {
    setDirect(null);
    setWritten(null);
    setError(null);
    setBusy(null);
    onClose();
  };

  const rebuildPlan = (state: Omit<DirectState, 'plan' | 'planError'>): DirectState => {
    try {
      const plan = planWriteback({ files: state.discovery.files, entry: state.entry, editedDocument: doc });
      return { ...state, plan, planError: null };
    } catch (err) {
      return { ...state, plan: null, planError: (err as Error).message };
    }
  };

  const handlePickDirectory = async () => {
    setError(null);
    setWritten(null);
    setBusy('Reading the checkout…');
    try {
      const handle = await pickCheckoutDirectory();
      const fileMap = await filesFromDirectoryHandle(handle);
      const discovery = discoverAppSources(fileMap);
      if (!discovery.files.length) {
        throw new Error('No .blp or .ui files found in that folder. Grant the checkout root (the folder containing meson.build).');
      }
      const manifest = appBundleManifest(discovery.files);
      const entry = manifest.entryCandidates.length === 1 ? manifest.entryCandidates[0] : '';
      const base = { handle, discovery, entryCandidates: manifest.entryCandidates, entry };
      setDirect(entry ? rebuildPlan(base) : { ...base, plan: null, planError: null });
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') setError((err as Error).message);
    }
    setBusy(null);
  };

  const handleEntryChange = (entry: string) => {
    if (!direct) return;
    setDirect(rebuildPlan({ ...direct, entry }));
  };

  const handleConfirmWrite = async () => {
    if (!direct?.plan) return;
    setBusy('Writing patches…');
    setError(null);
    try {
      const paths: string[] = [];
      for (const [path, content] of direct.plan.changedFiles) {
        await writeFileToDirectoryHandle(direct.handle, path, content);
        paths.push(path);
      }
      setWritten(paths);
    } catch (err) {
      setError(`Write failed: ${(err as Error).message}`);
    }
    setBusy(null);
  };

  const plan = direct?.plan ?? null;
  const touchedByFile = plan
    ? [...plan.changedFiles.keys()].map((path) => ({
        path,
        labels: plan.touched.filter((entry) => entry.path === path).map((entry) => entry.label),
      }))
    : [];
  const validateCommands = touchedByFile
    .filter(({ path }) => path.endsWith('.blp'))
    .map(({ path }) => `blueprint-compiler compile ${path}`)
    .join('\n');

  return (
    <adw-dialog
      ref={dialogRef}
      data-testid="writeback-dialog"
      title="Export → Patch into Checkout"
      content-width={680}
      can-close=""
    >
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'auto' }}>
        <p style={{ fontSize: '12px', opacity: 0.65, margin: '0 0 4px' }}>
          Patch your edits back into a real app checkout&apos;s own Blueprint files —
          minimal diffs, comments and translation wrappers preserved, untouched files byte-identical.
        </p>
        <p style={{ fontSize: '12px', fontWeight: 600, margin: '0 0 12px' }} data-testid="writeback-privacy">
          Everything runs locally — no proxy, nothing leaves this machine.
        </p>

        {/* ------------------------------------------------ download + command */}
        <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
          1. Download the document, then run the write-back CLI in this repo
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <button className="protota-btn" data-testid="writeback-download" onClick={() => void exportDocumentFile(doc)}>
            Download {documentFileName}
          </button>
        </div>
        <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
          Path to your app checkout on the host:
          <input
            className="protota-input"
            data-testid="writeback-checkout-path"
            type="text"
            value={checkoutPath}
            onChange={(event) => setCheckoutPath(event.target.value)}
            placeholder="~/src/my-app"
            style={{ width: '100%', marginTop: '4px' }}
          />
        </label>
        <pre
          data-testid="writeback-command"
          style={{
            background: 'var(--card-bg-color, #1e1e1e)', color: '#f8f8f2', padding: '10px',
            borderRadius: '8px', fontSize: '12px', overflow: 'auto', whiteSpace: 'pre-wrap',
            wordBreak: 'break-all', margin: '0 0 6px',
          }}
        >
          {command}
        </pre>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
          <button className="protota-btn" data-testid="writeback-copy" onClick={() => handleCopy('command', command)}>
            {copied === 'command' ? 'Copied!' : 'Copy Command'}
          </button>
          <button
            className="protota-btn"
            data-testid="writeback-copy-bpc"
            onClick={() => handleCopy('bpc', `${command} \\\n  ${BPC_CONTAINER}`)}
            title="Same command with the containerized blueprint-compiler from docs/round-trip-cli.md — for hosts without blueprint-compiler installed"
          >
            {copied === 'bpc' ? 'Copied!' : 'Copy with --bpc container'}
          </button>
        </div>
        <p style={{ fontSize: '11px', opacity: 0.65, margin: '0 0 12px' }} data-testid="writeback-dryrun-note">
          The command is a dry run by default — it reports every touched file with a unified
          diff and writes nothing until you re-run it with <code>--write</code>.
        </p>

        {/* ------------------------------------------------ File System Access */}
        {supportsDirectoryPicker() && (
          <>
            <div style={{ fontWeight: 600, fontSize: '13px', margin: '4px 0' }}>
              2. Or write the patch directly (Chromium)
            </div>
            <p style={{ fontSize: '12px', opacity: 0.65, margin: '0 0 8px' }}>
              Grant this page access to your checkout folder; the same write-back logic runs
              in the browser, shows you every touched file, and writes only after you confirm.
            </p>
            {!direct && (
              <div style={{ marginBottom: '10px' }}>
                <button
                  className="protota-btn"
                  data-testid="writeback-direct"
                  onClick={() => void handlePickDirectory()}
                  disabled={!!busy}
                >
                  Write patch directly…
                </button>
              </div>
            )}
          </>
        )}

        {busy && <div style={{ padding: '8px', fontSize: '13px' }}>{busy}</div>}
        {error && (
          <div
            data-testid="writeback-error"
            style={{
              padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px',
              background: 'rgba(224,27,36,0.08)', color: 'var(--destructive-fg-color, #c01c28)',
            }}
          >
            {error}
          </div>
        )}

        {direct && !written && (
          <div data-testid="writeback-report" style={{ fontSize: '12px', marginBottom: '10px' }}>
            <div style={{ marginBottom: '6px' }}>
              <strong>{direct.discovery.files.length}</strong> source file(s) discovered
              ({direct.discovery.discovery}).
            </div>
            {direct.entryCandidates.length !== 1 && (
              <label style={{ display: 'block', marginBottom: '8px' }}>
                Entry file:
                <select
                  className="protota-input"
                  data-testid="writeback-entry"
                  value={direct.entry}
                  onChange={(event) => handleEntryChange(event.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="" disabled>Choose the entry file…</option>
                  {(direct.entryCandidates.length ? direct.entryCandidates : direct.discovery.files.map((file) => file.path))
                    .map((path) => <option key={path} value={path}>{path}</option>)}
                </select>
              </label>
            )}
            {direct.planError && (
              <div data-testid="writeback-plan-error" style={{ color: 'var(--destructive-fg-color, #c01c28)' }}>
                Could not build a patch plan: {direct.planError}
              </div>
            )}
            {plan && !plan.changedFiles.size && !plan.unsupported.length && (
              <div data-testid="writeback-no-changes" style={{ opacity: 0.75 }}>
                Nothing to do — the current document matches the checkout&apos;s source.
              </div>
            )}
            {plan && plan.changedFiles.size > 0 && (
              <>
                <div style={{ fontWeight: 600, margin: '6px 0 4px' }}>
                  Files that will be modified ({plan.changedFiles.size})
                </div>
                <ul style={{ margin: '0 0 6px', paddingLeft: '18px' }}>
                  {touchedByFile.map(({ path, labels }) => (
                    <li key={path} data-testid="writeback-touched-file">
                      <code>{path}</code>
                      <ul style={{ margin: 0, paddingLeft: '16px', opacity: 0.75 }}>
                        {labels.map((label, index) => <li key={index}>{label}</li>)}
                      </ul>
                    </li>
                  ))}
                </ul>
                <details style={{ marginBottom: '6px' }}>
                  <summary style={{ cursor: 'pointer' }}>Show diffs</summary>
                  <pre
                    data-testid="writeback-diff"
                    style={{
                      background: 'var(--card-bg-color, #1e1e1e)', color: '#f8f8f2', padding: '10px',
                      borderRadius: '8px', fontSize: '11px', overflow: 'auto', maxHeight: '220px',
                    }}
                  >
                    {[...plan.changedFiles].map(([path, next]) =>
                      unifiedDiff(direct.discovery.files.find((file) => file.path === path)?.content ?? '', next, path),
                    ).join('\n\n')}
                  </pre>
                </details>
              </>
            )}
            {plan && plan.unsupported.length > 0 && (
              <div data-testid="writeback-unsupported" style={{ margin: '6px 0' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Not written back</div>
                {plan.unsupported.map((reason, index) => (
                  <div key={index} style={{ opacity: 0.75 }}>{reason}</div>
                ))}
              </div>
            )}
            {plan && plan.changedFiles.size > 0 && (
              <p style={{ fontSize: '11px', opacity: 0.75, margin: '6px 0 0' }} data-testid="writeback-validate-note">
                blueprint-compiler cannot run in the browser, so unlike the CLI these patches are
                written <em>unvalidated</em> — validate with blueprint-compiler on the host afterwards
                (from the checkout root):
              </p>
            )}
            {plan && plan.changedFiles.size > 0 && validateCommands && (
              <pre
                style={{
                  background: 'var(--card-bg-color, #1e1e1e)', color: '#f8f8f2', padding: '8px',
                  borderRadius: '8px', fontSize: '11px', overflow: 'auto', margin: '4px 0 0',
                }}
              >
                {validateCommands}
              </pre>
            )}
          </div>
        )}

        {written && (
          <div
            data-testid="writeback-success"
            style={{
              padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px',
              background: 'rgba(38,162,105,0.10)', color: 'var(--success-fg-color, #1b8553)',
            }}
          >
            Wrote {written.length} file(s): {written.join(', ')}. Now validate on the host
            (blueprint-compiler) and review with <code>git diff</code>.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
          {direct && !written && (
            <button className="protota-btn" onClick={() => { setDirect(null); setError(null); }}>
              Back
            </button>
          )}
          <button className="protota-btn" onClick={close}>Close</button>
          {plan && plan.changedFiles.size > 0 && !written && (
            <button
              className="protota-btn suggested"
              data-testid="writeback-confirm"
              onClick={() => void handleConfirmWrite()}
              disabled={!!busy}
            >
              Write {plan.changedFiles.size} file(s) into checkout
            </button>
          )}
        </div>
      </div>
    </adw-dialog>
  );
};
