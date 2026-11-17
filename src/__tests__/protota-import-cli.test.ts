/**
 * scripts/protota-import.mjs, run as the command: which compiler validates a
 * checkout that carries one of its own.
 *
 * The checkout's copy is a program from the folder being read, so the import
 * must leave it alone unless --pinned-bpc asks for it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WINDOW_BLP = `using Gtk 4.0;
using Adw 1;

Adw.ApplicationWindow window {
  title: "Demo";
}
`;

// Stands in for blueprint-compiler.py: records that it ran, then succeeds.
const PINNED_COMPILER = `import pathlib, sys
pathlib.Path(sys.argv[0]).with_name('ran').write_text('ran')
`;

class Exit extends Error {}

/** Run the CLI in this process; returns what it wrote to stderr. */
async function runImport(args: string[]): Promise<string> {
  const lines: string[] = [];
  const argv = process.argv;
  process.argv = ['node', 'protota-import.mjs', ...args];
  vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => { lines.push(parts.join(' ')); });
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Exit(`process.exit(${code ?? 0})`); }) as never);
  vi.resetModules();
  try {
    // @ts-expect-error -- the CLI is plain ESM JavaScript without declarations.
    await import('../../scripts/protota-import.mjs');
  } catch (error) {
    if (!(error instanceof Exit)) throw error;
  } finally {
    process.argv = argv;
  }
  return lines.join('\n');
}

describe('protota-import and a checkout with its own blueprint-compiler', () => {
  let root = '';
  const checkout = () => {
    root = mkdtempSync(join(tmpdir(), 'protota-import-cli-'));
    const pinnedDir = join(root, 'app', 'subprojects', 'blueprint-compiler');
    mkdirSync(pinnedDir, { recursive: true });
    mkdirSync(join(root, 'app', 'ui'));
    writeFileSync(join(root, 'app', 'ui', 'window.blp'), WINDOW_BLP);
    writeFileSync(join(pinnedDir, 'blueprint-compiler.py'), PINNED_COMPILER);
    return { app: join(root, 'app'), out: join(root, 'bundle.json'), ran: join(pinnedDir, 'ran') };
  };

  afterEach(() => {
    vi.restoreAllMocks();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('does not run the checkout copy by default, and says it found one', async () => {
    const { app, out, ran } = checkout();
    const stderr = await runImport([app, '--out', out]);
    expect(existsSync(out)).toBe(true);
    expect(existsSync(ran)).toBe(false);
    expect(stderr).not.toContain('(project-pinned)');
    expect(stderr).toContain('it was not run. Pass --pinned-bpc');
  });

  it('runs the checkout copy when --pinned-bpc asks for it', async () => {
    const { app, out, ran } = checkout();
    const stderr = await runImport([app, '--out', out, '--pinned-bpc']);
    expect(stderr).toContain('(project-pinned)');
    expect(stderr).toContain('all .blp files compile.');
    expect(existsSync(ran)).toBe(true);
  });
});
