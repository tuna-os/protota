/**
 * The lint config refuses `exec` and `execSync` from child_process (#566).
 *
 * Both take a command line, so a file name or title pasted into one is shell
 * text. The rule runs through the real oxlint with the repository's config:
 * a config that parses but no longer carries the rule would pass any check
 * that only reads the JSON.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const oxlint = fileURLToPath(new URL('../../node_modules/oxlint/bin/oxlint', import.meta.url));
const config = fileURLToPath(new URL('../../.oxlintrc.json', import.meta.url));
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function lint(source: string): { status: number | null; output: string } {
  const directory = mkdtempSync(join(tmpdir(), 'protota-lint-'));
  temporaryDirectories.push(directory);
  const file = join(directory, 'sample.mjs');
  writeFileSync(file, source);
  const run = spawnSync(process.execPath, [oxlint, '--config', config, file], { encoding: 'utf8' });
  return { status: run.status, output: run.stdout + run.stderr };
}

describe('lint: shell-running child_process imports', () => {
  it.each([
    ["import { execSync } from 'node:child_process';\nexecSync('true');\n", 'execSync'],
    ["import { exec } from 'node:child_process';\nexec('true');\n", 'exec'],
    ["import { execSync } from 'child_process';\nexecSync('true');\n", 'execSync'],
    ["import { exec } from 'child_process';\nexec('true');\n", 'exec'],
  ])('refuses %j', (source, name) => {
    const { status, output } = lint(source);
    expect(output).toContain(`'${name}' import from`);
    expect(output).toContain('no-restricted-imports');
    expect(status).toBe(1);
  });

  it('accepts the argument-array calls', () => {
    const { status, output } = lint(
      "import { execFileSync, spawn } from 'node:child_process';\nexecFileSync('true', []);\nspawn('true', []);\n",
    );
    expect(output).not.toContain('no-restricted-imports');
    expect(status).toBe(0);
  });
});
