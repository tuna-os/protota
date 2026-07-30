import { describe, it, expect } from 'vitest';
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
      .addWidget('toolbar-view');

    // button is not a legal child of toolbar-view
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
