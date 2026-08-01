/**
 * Host-side round-trip CLI machinery (scripts/protota-import.mjs and
 * scripts/protota-writeback.mjs; issues #56/#80): discovery, write-back
 * attribution, minimal textual patching, and the full import → edit →
 * write-back → re-import loop.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  discoverSources, bundleManifest, parseBlueprintCst, planWriteback, unifiedDiff,
} from '../../scripts/round-trip-lib.mjs';
import { blueprintBundleToDocument } from '../utils/blueprint';
import type { AdwNode, MockupDocument } from '../types/mockup';

const WINDOW_BLP = `using Gtk 4.0;
using Adw 1;

template $DemoWindow : Adw.ApplicationWindow {
  title: _("Demo");
  content: Adw.ToolbarView toolbar {
    [top]
    Adw.HeaderBar header_bar {
      title-widget: Adw.WindowTitle { title: "Demo"; };
    }
    content: Gtk.Box main_box {
      orientation: vertical;
      spacing: 12;
      $DemoPanel panel {}
      $ThirdPartyWidget preview {
        hexpand: true;
      }
    };
  };
}
`;

const PANEL_BLP = `using Gtk 4.0;
using Adw 1;

// The action strip shown under the content.
template $DemoPanel : Gtk.Box {
  orientation: horizontal;
  spacing: 6;

  Gtk.Button open_button {
    label: _("Open");
    styles [ "suggested-action" ]
  }

  Gtk.Button close_button {
    label: "Close";
  }
}
`;

const bundleFiles = () => [
  { path: 'src/window.blp', content: WINDOW_BLP },
  { path: 'src/panel.blp', content: PANEL_BLP },
];

const findNode = (doc: MockupDocument, id: string): AdwNode => {
  let found: AdwNode | null = null;
  const visit = (node: AdwNode) => {
    if (node.id === id) found = node;
    node.children?.forEach(visit);
  };
  doc.screens.forEach((screen) => visit(screen.rootNode));
  if (!found) throw new Error(`node ${id} not found`);
  return found;
};

const importBundle = (files = bundleFiles()) => blueprintBundleToDocument(files, 'src/window.blp');

const editedCopy = (doc: MockupDocument): MockupDocument => structuredClone(doc);

describe('protota-import discovery', () => {
  it('discovers sources through build metadata and reports honest manifest facts', () => {
    const root = mkdtempSync(join(tmpdir(), 'protota-import-'));
    try {
      mkdirSync(join(root, 'src'), { recursive: true });
      writeFileSync(join(root, 'src', 'window.blp'), WINDOW_BLP);
      writeFileSync(join(root, 'src', 'panel.blp'), PANEL_BLP);
      writeFileSync(join(root, 'src', 'scratch.blp'), 'using Gtk 4.0;\nGtk.Box abandoned {}\n');
      writeFileSync(join(root, 'src', 'meson.build'),
        "blueprints = custom_target(input: files('window.blp', 'panel.blp'))\n");

      const discovered = discoverSources(root);
      expect(discovered.discovery).toContain('build-metadata');
      expect(discovered.files.map((file) => file.path)).toEqual(['src/panel.blp', 'src/window.blp']);
      // The unreferenced file is excluded, and the exclusion is reported.
      expect(discovered.notes.join(' ')).toContain('src/scratch.blp');

      const manifest = bundleManifest(discovered.files);
      expect(manifest.entryCandidates).toEqual(['src/window.blp']);
      expect(manifest.declaredTemplates).toEqual(['DemoPanel', 'DemoWindow']);
      expect(manifest.unresolvedReferences).toEqual(['ThirdPartyWidget']);
      expect(manifest.parseIssues).toEqual([]);

      // The packaged bundle is exactly what the browser importer consumes.
      const doc = blueprintBundleToDocument(discovered.files, 'src/window.blp');
      expect(findNode(doc, 'open_button')).toMatchObject({ type: 'button', title: 'Open' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back to a glob with an explicit note when no metadata exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'protota-import-'));
    try {
      mkdirSync(join(root, 'ui'));
      writeFileSync(join(root, 'ui', 'window.blp'), WINDOW_BLP);
      const discovered = discoverSources(root);
      expect(discovered.discovery).toBe('glob fallback');
      expect(discovered.notes[0]).toContain('glob');
      expect(discovered.files.map((file) => file.path)).toEqual(['ui/window.blp']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('span-preserving Blueprint CST', () => {
  it('records byte spans for widgets, properties, styles, and template bodies', () => {
    const cst = parseBlueprintCst(PANEL_BLP);
    expect(cst.templates).toHaveLength(1);
    const template = cst.templates[0];
    expect(template.templateName).toBe('DemoPanel');
    expect(template.className).toBe('Gtk.Box');
    const open = template.children.find((child) => child.id === 'open_button')!;
    expect(open.className).toBe('Gtk.Button');
    const label = open.props.find((prop) => prop.name === 'label')!;
    expect(PANEL_BLP.slice(label.valueStart, label.valueEnd)).toBe('_("Open")');
    expect(open.styles!.entries).toEqual(['suggested-action']);
  });
});

describe('protota-writeback', () => {
  it('writes a template-owned edit to the template file and leaves the entry byte-identical', () => {
    const files = bundleFiles();
    const original = importBundle(files);
    const edited = editedCopy(original);
    findNode(edited, 'open_button').title = 'Open File';

    const plan = planWriteback({ files, entry: 'src/window.blp', editedDocument: edited });
    expect(plan.unsupported).toEqual([]);
    expect([...plan.changedFiles.keys()]).toEqual(['src/panel.blp']);

    // Minimal diff: the only change is the label value, translation wrapper kept.
    const next = plan.changedFiles.get('src/panel.blp');
    expect(next).toBe(PANEL_BLP.replace('_("Open")', '_("Open File")'));

    // Re-import reflects the edit.
    const roundTripped = blueprintBundleToDocument(
      files.map((file) => ({ ...file, content: plan.changedFiles.get(file.path) ?? file.content })),
      'src/window.blp',
    );
    expect(findNode(roundTripped, 'open_button').title).toBe('Open File');
  });

  it('patches an entry-file edit in place and never touches the custom class', () => {
    const files = bundleFiles();
    const original = importBundle(files);
    const edited = editedCopy(original);
    findNode(edited, 'main_box').spacing = 24;

    const plan = planWriteback({ files, entry: 'src/window.blp', editedDocument: edited });
    expect(plan.unsupported).toEqual([]);
    expect([...plan.changedFiles.keys()]).toEqual(['src/window.blp']);
    const next = plan.changedFiles.get('src/window.blp');
    expect(next).toBe(WINDOW_BLP.replace('spacing: 12;', 'spacing: 24;'));
    // The unresolved custom class survives verbatim — never replaced.
    expect(next).toContain('$ThirdPartyWidget preview');
    expect(next).not.toContain('Protota');
  });

  it('locates an id-less widget through its nearest identified ancestor', () => {
    const files = bundleFiles();
    const original = importBundle(files);
    const edited = editedCopy(original);
    const headerBar = findNode(edited, 'header_bar');
    const windowTitle = headerBar.children!.find((child) => child.sourceClass === 'Adw.WindowTitle')!;
    windowTitle.title = 'Demo — Draft';

    const plan = planWriteback({ files, entry: 'src/window.blp', editedDocument: edited });
    expect(plan.unsupported).toEqual([]);
    expect(plan.changedFiles.get('src/window.blp')).toBe(WINDOW_BLP.replace('title: "Demo";', 'title: "Demo — Draft";'));
  });

  it('inserts a new child of an expanded template into the template file', () => {
    const files = bundleFiles();
    const original = importBundle(files);
    const edited = editedCopy(original);
    const panel = findNode(edited, 'panel');
    panel.children!.push({ id: 'extra_button', type: 'button', title: 'Extra', children: [] });

    const plan = planWriteback({ files, entry: 'src/window.blp', editedDocument: edited });
    expect(plan.unsupported).toEqual([]);
    expect([...plan.changedFiles.keys()]).toEqual(['src/panel.blp']);
    const next = plan.changedFiles.get('src/panel.blp');
    expect(next).toContain('Gtk.Button extra_button');
    expect(next).toContain('label: "Extra";');

    const roundTripped = blueprintBundleToDocument(
      files.map((file) => ({ ...file, content: plan.changedFiles.get(file.path) ?? file.content })),
      'src/window.blp',
    );
    expect(findNode(roundTripped, 'extra_button')).toMatchObject({ type: 'button', title: 'Extra' });
  });

  it('removes a deleted child from its defining file without collateral damage', () => {
    const files = bundleFiles();
    const original = importBundle(files);
    const edited = editedCopy(original);
    const panel = findNode(edited, 'panel');
    panel.children = panel.children!.filter((child) => child.id !== 'close_button');

    const plan = planWriteback({ files, entry: 'src/window.blp', editedDocument: edited });
    expect(plan.unsupported).toEqual([]);
    expect([...plan.changedFiles.keys()]).toEqual(['src/panel.blp']);
    const next = plan.changedFiles.get('src/panel.blp');
    expect(next).not.toContain('close_button');
    expect(next).toContain('open_button');
    // The comment and the untouched sibling survive.
    expect(next).toContain('// The action strip shown under the content.');
  });

  it('rewrites style classes in place', () => {
    const files = bundleFiles();
    const original = importBundle(files);
    const edited = editedCopy(original);
    const open = findNode(edited, 'open_button');
    delete open.suggested;
    open.styleClasses = 'destructive-action';

    const plan = planWriteback({ files, entry: 'src/window.blp', editedDocument: edited });
    expect(plan.unsupported).toEqual([]);
    const next = plan.changedFiles.get('src/panel.blp');
    expect(next).toContain('styles [ "destructive-action" ]');
    expect(next).not.toContain('suggested-action');
  });

  it('refuses class/type changes instead of replacing a custom class', () => {
    const files = bundleFiles();
    const original = importBundle(files);
    const edited = editedCopy(original);
    const preview = findNode(edited, 'preview');
    preview.sourceClass = 'Gtk.Box';
    (preview as { type: string }).type = 'box';

    const plan = planWriteback({ files, entry: 'src/window.blp', editedDocument: edited });
    expect(plan.unsupported.join(' ')).toContain('never replaced');
    expect(plan.changedFiles.size).toBe(0);
  });

  it('reports no changes for an untouched document', () => {
    const files = bundleFiles();
    const original = importBundle(files);
    const plan = planWriteback({ files, entry: 'src/window.blp', editedDocument: editedCopy(original) });
    expect(plan.edits).toEqual([]);
    expect(plan.unsupported).toEqual([]);
    expect(plan.changedFiles.size).toBe(0);
  });
});

describe('unified diff', () => {
  it('produces hunks with context and correct line numbers', () => {
    const before = 'a\nb\nc\nd\ne\nf\ng\n';
    const after = 'a\nb\nc\nD\ne\nf\ng\n';
    const diff = unifiedDiff(before, after, 'x.blp');
    expect(diff).toContain('--- a/x.blp');
    expect(diff).toContain('-d');
    expect(diff).toContain('+D');
    expect(diff).toContain('@@ -1,7 +1,7 @@');
  });

  it('returns an empty diff for identical inputs', () => {
    expect(unifiedDiff('same\n', 'same\n', 'x.blp')).toBe('');
  });
});
