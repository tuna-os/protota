/**
 * Browser-consumable write-back core (ADR 0001 Part 3 item 1): the same
 * three-way diff + CST patching the protota-writeback CLI runs, extracted to
 * src/utils/writeback.ts, exercised here against a purely in-memory file map
 * — no filesystem anywhere. Fixtures mirror the PR #111 CLI suite
 * (round-trip-cli.test.ts) so both entry points are proven against the same
 * bundle; that suite additionally pins that the CLI re-exports stay intact.
 *
 * Also covers the File System Access adapter (src/utils/fsAccess.ts) at the
 * directory-handle boundary with an in-memory handle — the same seam the
 * Playwright spec mocks, since real handles cannot be granted headlessly.
 */
import { describe, expect, it } from 'vitest';
import { planWriteback, parseBlueprintCst, unifiedDiff } from '../utils/writeback';
import {
  filesFromDirectoryHandle,
  writeFileToDirectoryHandle,
  type DirectoryHandleLike,
  type FileHandleLike,
} from '../utils/fsAccess';
import { discoverAppSources } from '../utils/appDiscovery';
import { blueprintBundleToDocument } from '../utils/blueprint';
import type { AdwNode, MockupDocument } from '../types/mockup';

// Same bundle as the PR #111 CLI suite: an entry window using a template
// (with comments and a translation wrapper) plus an unresolved custom class.
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

describe('write-back core in the browser environment (in-memory file map)', () => {
  it('plans a template-owned edit into the template file, entry untouched, no fs involved', () => {
    const files = bundleFiles();
    const original = blueprintBundleToDocument(files, 'src/window.blp');
    const edited = structuredClone(original);
    findNode(edited, 'open_button').title = 'Open File';

    const plan = planWriteback({ files, entry: 'src/window.blp', editedDocument: edited });
    expect(plan.unsupported).toEqual([]);
    expect([...plan.changedFiles.keys()]).toEqual(['src/panel.blp']);
    // Minimal patch, translation wrapper preserved.
    expect(plan.changedFiles.get('src/panel.blp')).toBe(PANEL_BLP.replace('_("Open")', '_("Open File")'));
    // Every touched file carries per-edit labels (the #80 report rule).
    expect(plan.touched).toEqual([{ path: 'src/panel.blp', label: 'label: "Open File"' }]);
  });

  it('never rewrites a custom class token', () => {
    const files = bundleFiles();
    const original = blueprintBundleToDocument(files, 'src/window.blp');
    const edited = structuredClone(original);
    findNode(edited, 'main_box').spacing = 24;

    const plan = planWriteback({ files, entry: 'src/window.blp', editedDocument: edited });
    const next = plan.changedFiles.get('src/window.blp')!;
    expect(next).toBe(WINDOW_BLP.replace('spacing: 12;', 'spacing: 24;'));
    expect(next).toContain('$ThirdPartyWidget preview');
  });

  it('refuses class/type changes with an explicit unsupported entry', () => {
    const files = bundleFiles();
    const original = blueprintBundleToDocument(files, 'src/window.blp');
    const edited = structuredClone(original);
    const preview = findNode(edited, 'preview');
    preview.sourceClass = 'Gtk.Box';
    (preview as { type: string }).type = 'box';

    const plan = planWriteback({ files, entry: 'src/window.blp', editedDocument: edited });
    expect(plan.unsupported.join(' ')).toContain('never replaced');
    expect(plan.changedFiles.size).toBe(0);
  });

  it('parses spans and emits unified diffs identically to the CLI', () => {
    const cst = parseBlueprintCst(PANEL_BLP);
    const open = cst.templates[0].children.find((child) => child.id === 'open_button')!;
    const label = open.props.find((prop) => prop.name === 'label')!;
    expect(PANEL_BLP.slice(label.valueStart, label.valueEnd)).toBe('_("Open")');

    const diff = unifiedDiff('a\nb\n', 'a\nB\n', 'x.blp');
    expect(diff).toContain('-b');
    expect(diff).toContain('+B');
  });
});

// ---------------------------------------------------------------------------
// In-memory File System Access handle — the boundary the browser flow (and
// the Playwright mock) uses.
// ---------------------------------------------------------------------------

type MemoryTree = { [name: string]: MemoryTree | string };

function memoryDirectory(tree: MemoryTree, name = 'checkout'): DirectoryHandleLike {
  const fileHandle = (fileName: string, parent: MemoryTree): FileHandleLike => ({
    kind: 'file',
    name: fileName,
    getFile: async () => new File([parent[fileName] as string], fileName),
    createWritable: async () => {
      let buffer = '';
      return {
        write: async (data: string) => { buffer += data; },
        close: async () => { parent[fileName] = buffer; },
      };
    },
  });
  const handle: DirectoryHandleLike = {
    kind: 'directory',
    name,
    entries: async function* () {
      for (const [entryName, value] of Object.entries(tree)) {
        yield [
          entryName,
          typeof value === 'string' ? fileHandle(entryName, tree) : memoryDirectory(value, entryName),
        ] as [string, DirectoryHandleLike | FileHandleLike];
      }
    },
    getDirectoryHandle: async (dirName) => {
      const value = tree[dirName];
      if (typeof value !== 'object' || value === null) throw new Error(`NotFoundError: ${dirName}`);
      return memoryDirectory(value, dirName);
    },
    getFileHandle: async (fileName) => {
      if (typeof tree[fileName] !== 'string') throw new Error(`NotFoundError: ${fileName}`);
      return fileHandle(fileName, tree);
    },
  };
  return handle;
}

describe('File System Access adapter (in-memory directory handle)', () => {
  const checkoutTree = (): MemoryTree => ({
    'meson.build': "subdir('src')",
    src: {
      'meson.build': "blueprints = custom_target(input: files('window.blp', 'panel.blp'))",
      'window.blp': WINDOW_BLP,
      'panel.blp': PANEL_BLP,
      'main.rs': 'fn main() {}', // not discovery-relevant → never read
    },
    '.git': { HEAD: 'ref: refs/heads/main' }, // skipped directory
  });

  it('reads only discovery-relevant files, skipping VCS/build directories', async () => {
    const map = await filesFromDirectoryHandle(memoryDirectory(checkoutTree()));
    expect(Object.keys(map).sort()).toEqual([
      'meson.build', 'src/meson.build', 'src/panel.blp', 'src/window.blp',
    ]);
    const discovery = discoverAppSources(map);
    expect(discovery.discovery).toContain('build-metadata');
    expect(discovery.files.map((file) => file.path)).toEqual(['src/panel.blp', 'src/window.blp']);
  });

  it('round-trips: read handle → plan → confirm-write through the handle', async () => {
    const tree = checkoutTree();
    const root = memoryDirectory(tree);
    const map = await filesFromDirectoryHandle(root);
    const { files } = discoverAppSources(map);
    const original = blueprintBundleToDocument(files, 'src/window.blp');
    const edited = structuredClone(original);
    findNode(edited, 'open_button').title = 'Open File';

    const plan = planWriteback({ files, entry: 'src/window.blp', editedDocument: edited });
    for (const [path, content] of plan.changedFiles) {
      await writeFileToDirectoryHandle(root, path, content);
    }
    expect((tree.src as MemoryTree)['panel.blp']).toBe(PANEL_BLP.replace('_("Open")', '_("Open File")'));
    // Untouched files stay byte-identical.
    expect((tree.src as MemoryTree)['window.blp']).toBe(WINDOW_BLP);
  });

  it('surfaces a missing path instead of creating structure', async () => {
    const root = memoryDirectory(checkoutTree());
    await expect(writeFileToDirectoryHandle(root, 'src/nope/x.blp', 'y')).rejects.toThrow(/NotFound/);
  });
});
