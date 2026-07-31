/**
 * Real-Pyodide integration proof for the live Blueprint syntax tier.
 *
 * Loads the actual Pyodide runtime (pyodide npm package, node build) and the
 * vendored blueprint-compiler v0.22.2 from public/vendor/blueprint-compiler,
 * exactly the code the browser worker runs, and proves:
 *   - a syntactically broken .blp yields at least one error with a position,
 *   - a well-formed .blp (including our own exporter's output) yields none.
 *
 * This is the same tier boundary as production: syntax only, no typelibs, so
 * a GIR-level mistake (e.g. a made-up property) must NOT be flagged here —
 * that is the host compiler's job (blueprint-export CI).
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { join } from 'node:path';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { blueprintToDocument, mockupToBlueprint } from '../utils/blueprint';

const VENDOR_DIR = join(__dirname, '..', '..', 'public', 'vendor', 'blueprint-compiler');

let pyodide: PyodideInterface;

function check(source: string): Array<{ message: string; line: number; col: number }> {
  pyodide.globals.set('__src', source);
  return JSON.parse(pyodide.runPython('blueprint_check.check_json(__src)') as string);
}

describe('blueprint-compiler under Pyodide (real runtime)', () => {
  beforeAll(async () => {
    pyodide = await loadPyodide();
    pyodide.FS.mkdir('/vendor');
    pyodide.FS.mount(pyodide.FS.filesystems.NODEFS, { root: VENDOR_DIR }, '/vendor');
    pyodide.runPython("import sys; sys.path.insert(0, '/vendor')");
    pyodide.runPython('import blueprint_check');
  }, 120_000);

  it('reports a positioned syntax error for a broken .blp', () => {
    const errors = check('using Gtk 4.0;\n\nBox {\n  orientation: horizontal\n');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toBeTruthy();
    expect(errors[0].line).toBeGreaterThan(0);
    expect(errors[0].col).toBeGreaterThan(0);
  });

  it('reports nothing for a well-formed .blp', () => {
    const errors = check(
      'using Gtk 4.0;\nusing Adw 1;\n\nAdw.ApplicationWindow {\n  content: Adw.ToolbarView {\n    [top]\n    Adw.HeaderBar {}\n  };\n}\n');
    expect(errors).toEqual([]);
  });

  it("accepts Protota's own exporter output (per-screen, standalone)", () => {
    // Round-trip through the real import/export pair, like the CI job does.
    const doc = blueprintToDocument(
      'using Gtk 4.0;\nusing Adw 1;\n\nAdw.ApplicationWindow {\n  content: Box {\n    orientation: vertical;\n    Label { label: "Hello"; }\n  };\n}\n');
    for (const screen of doc.screens) {
      const source = mockupToBlueprint({ ...doc, screens: [screen] }, { standalone: true });
      expect(check(source)).toEqual([]);
    }
  });

  it('does NOT flag GIR-level mistakes — that tier is host-only', () => {
    // `Gtk.Label` has no property `frobnicate`; only a compiler with
    // typelibs can know that. The browser tier must stay silent instead of
    // guessing, so nobody mistakes "syntax OK" for "compiles clean".
    const errors = check('using Gtk 4.0;\n\nLabel {\n  frobnicate: true;\n}\n');
    expect(errors).toEqual([]);
  });
}, 180_000);
