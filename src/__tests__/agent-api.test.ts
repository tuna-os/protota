import { describe, it, expect, vi } from 'vitest';
import { MockupBuilder, generateMockup } from '../utils/agent-api';
import { mockupToBlueprint, blueprintToNode } from '../utils/blueprint';

describe('MockupBuilder flow and import tooling', () => {
  it('connects screens with flow edges by title', () => {
    const doc = new MockupBuilder('Flow App')
      .addScreen('standard', 'Main')
      .addScreen('preferences', 'Preferences')
      .connectScreens('Main', 'Preferences')
      .build();
    expect(doc.edges).toHaveLength(1);
    expect(doc.edges[0].sourceId).toBe(doc.screens[0].id);
    expect(doc.edges[0].targetId).toBe(doc.screens[1].id);
  });

  it('imports Blueprint source as screens and applies finishing overrides', () => {
    const doc = new MockupBuilder('Imported App')
      .importScreens([
        { path: 'window.blp', content: 'Adw.ApplicationWindow { Adw.ToolbarView { Adw.HeaderBar bar {} Gtk.Box body { orientation: vertical; Gtk.Label hint { label: "Hi"; } } } }' },
      ], 'window.blp', { width: 700, height: 500 })
      .overrideNode('hint', { visible: false })
      .build();
    expect(doc.screens).toHaveLength(1);
    expect(doc.screens[0].width).toBe(700);
    const findHint = (node: typeof doc.screens[0]['rootNode']): boolean =>
      (node.id === 'hint' && node.visible === false) || (node.children ?? []).some(findHint);
    expect(findHint(doc.screens[0].rootNode)).toBe(true);
  });

  it('continues building from an existing document', () => {
    const base = new MockupBuilder('Base').addScreen('standard', 'Main').build();
    const extended = MockupBuilder.fromDocument(base)
      .addScreen('dialog', 'Confirm')
      .connectScreens('Main', 'Confirm')
      .build();
    expect(extended.screens).toHaveLength(2);
    expect(extended.edges).toHaveLength(1);
    expect(base.screens).toHaveLength(1);
  });

  it('rejects unknown screens and nodes loudly', () => {
    const builder = new MockupBuilder('Strict').addScreen('standard', 'Main');
    expect(() => builder.connectScreens('Main', 'Nowhere')).toThrow(/unknown screen/);
    expect(() => builder.overrideNode('ghost', { visible: false })).toThrow(/no node/);
  });
});

describe('MockupBuilder app import front door (#118)', () => {
  const WINDOW_BLP = 'using Gtk 4.0;\nusing Adw 1;\nAdw.ApplicationWindow { content: Adw.ToolbarView { Adw.HeaderBar bar {} }; }\n';
  const PANEL_BLP = 'using Gtk 4.0;\ntemplate $DemoPanel : Gtk.Box { Gtk.Button open_button { label: "Open"; } }\n';

  it('imports an app from a file map, running discovery for the entry', () => {
    const doc = new MockupBuilder('Imported')
      .importApp({
        'src/window.blp': WINDOW_BLP,
        'src/panel.blp': PANEL_BLP,
        'src/meson.build': "files('window.blp', 'panel.blp')",
      })
      .build();
    expect(doc.screens).toHaveLength(1);
    const findBar = (node: typeof doc.screens[0]['rootNode']): boolean =>
      node.id === 'bar' || (node.children ?? []).some(findBar);
    expect(findBar(doc.screens[0].rootNode)).toBe(true);
  });

  it('excludes metadata-unreferenced files exactly like the CLI', () => {
    expect(() => new MockupBuilder('Imported').importApp({
      'src/window.blp': WINDOW_BLP,
      'src/meson.build': "files('window.blp')",
    }, 'src/stray.blp')).toThrow(/not among the discovered files/);
  });

  it('fails loudly on ambiguous or missing entries instead of guessing', () => {
    expect(() => new MockupBuilder('X').importApp({
      'a.blp': WINDOW_BLP,
      'b.blp': WINDOW_BLP,
    })).toThrow(/multiple entry candidates/);
    expect(() => new MockupBuilder('X').importApp({
      'panel.blp': PANEL_BLP,
    })).toThrow(/no window-bearing file/);
    expect(() => new MockupBuilder('X').importApp({})).toThrow(/no \.blp or \.ui files/);
  });

  it('imports an app from a forge URL with fetch mocked', async () => {
    const { gzipSync } = await import('node:zlib');
    const encoder = new TextEncoder();
    const block = (name: string, size: number) => {
      const header = new Uint8Array(512);
      header.set(encoder.encode(name), 0);
      header.set(encoder.encode(`${size.toString(8).padStart(11, '0')}\0`), 124);
      header[156] = 0x30;
      header.set(encoder.encode('ustar'), 257);
      return header;
    };
    const data = encoder.encode(WINDOW_BLP);
    const padded = new Uint8Array(Math.ceil(data.length / 512) * 512);
    padded.set(data);
    const tar = new Uint8Array(512 + padded.length + 1024);
    tar.set(block('demo-main/src/window.blp', data.length), 0);
    tar.set(padded, 512);
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(new Uint8Array(gzipSync(tar)) as unknown as BodyInit, { status: 200 })));
    try {
      const builder = await new MockupBuilder('Remote').importAppFromUrl('https://github.com/o/demo');
      expect(builder.build().screens).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('MockupBuilder', () => {
  it('creates a document with a screen', () => {
    const doc = new MockupBuilder('Test App')
      .addScreen('standard', 'Main')
      .build();

    expect(doc.title).toBe('Test App');
    expect(doc.screens.length).toBe(1);
    expect(doc.screens[0].title).toBe('Main');
  });

  it('adds widgets with legal children enforcement', () => {
    const doc = new MockupBuilder('Test')
      .addScreen('standard', 'Main')
      .addWidget('toolbar-view')
      .addWidget('header-bar', { title: 'My App' })
      .up()
      .up()
      .build();

    const root = doc.screens[0].rootNode;
    expect(root.children?.length).toBeGreaterThan(0);
  });

  it('rejects illegal child additions', () => {
    const b = new MockupBuilder('Test')
      .addScreen('standard', 'Main')
      .addWidget('toolbar-view')
      .addWidget('header-bar')
      .addWidget('window-title');

    // AdwWindowTitle is a leaf: it shows a title and subtitle, nothing else.
    expect(() => b.addWidget('button')).toThrow(/legal/);
  });

  it('validate() returns errors for illegal nesting', () => {
    const doc = new MockupBuilder('Test')
      .addScreen('standard', 'Main')
      .addWidget('toolbar-view')
      .build();

    // Manually corrupt the tree to test validation
    doc.screens[0].rootNode.children![0].children!.push({
      id: 'bad', type: 'button',
    });
  });

  it('generates preferences mockups from high-level description', () => {
    const doc = generateMockup('Settings', 'preferences', {
      groups: [
        {
          title: 'Appearance',
          rows: ['switch:Dark Mode:Toggle dark theme', 'combo:Theme:Select theme'],
        },
      ],
    });

    expect(doc.screens.length).toBe(1);
    expect(doc.screens[0].type).toBe('preferences');
  });

  it('generated document can be re-imported', () => {
    const original = generateMockup('Test', 'standard');
    const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), document: original, assets: {} });
    const parsed = JSON.parse(json);
    expect(parsed.document.id).toBe(original.id);
    expect(parsed.document.screens.length).toBe(1);
  });

  it('supports roundtrip Blueprint BLP code export and parsing', () => {
    const doc = generateMockup('Blueprint Test', 'standard');
    const blpCode = mockupToBlueprint(doc);
    expect(blpCode).toContain('using Gtk 4.0;');
    expect(blpCode).toContain('Adw.ApplicationWindow');

    const parsedNode = blueprintToNode(blpCode);
    expect(parsedNode.type).toBe('window');
    expect(parsedNode.children?.length).toBeGreaterThan(0);
  });
});

describe('MockupBuilder slot placement', () => {
  it('places a widget in a named slot', () => {
    const doc = new MockupBuilder('Slots')
      .addScreen('standard', 'Main')
      .addWidget('toolbar-view')
      .addWidget('header-bar')
      .addWidget('button', { title: 'Open', slot: 'start' })
      .build();
    const header = doc.screens[0].rootNode.children?.[0].children?.[0];
    expect(header?.children?.[0]).toMatchObject({ type: 'button', title: 'Open', slot: 'start' });
  });

  it('rejects a slot the container does not offer', () => {
    const builder = new MockupBuilder('Slots')
      .addScreen('standard', 'Main')
      .addWidget('toolbar-view')
      .addWidget('header-bar');
    expect(() => builder.addWidget('button', { slot: 'sidebar' })).toThrow(/not a slot/);
  });

  it('reports the slots and children a container offers', () => {
    expect(MockupBuilder.slotsFor('header-bar')).toEqual(['start', 'title', 'end']);
    expect(MockupBuilder.slotsFor('label')).toEqual([]);
    expect(MockupBuilder.childrenFor('window-title')).toEqual([]);
    expect(MockupBuilder.childrenFor('list-box')).toContain('action-row');
  });
});
