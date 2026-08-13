/**
 * MockupBuilder + live-handle coverage for the paths agent-api.test.ts does
 * not reach: slot validation, static slots/children lookups, addChild,
 * overrideNode, the live handle's subscription lifecycle (single-store-
 * subscription guard, idle teardown, empty transactions), and
 * generateMockup's action/entry row kinds.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockupDocument, Screen } from '../types/mockup';
import { MockupBuilder, generateMockup, protota } from '../utils/agent-api';
import { useMockupStore } from '../store/mockupStore';

const backing = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => backing.get(key) ?? null,
  setItem: (key: string, value: string) => { backing.set(key, value); },
  removeItem: (key: string) => { backing.delete(key); },
  clear: () => { backing.clear(); },
  key: (index: number) => [...backing.keys()][index] ?? null,
  get length() { return backing.size; },
} as Storage;

describe('MockupBuilder: slot and lookup helpers', () => {
  it('rejects a slot the container does not offer', () => {
    const b = new MockupBuilder('T').addScreen('standard', 'S');
    b.addWidget('toolbar-view');
    expect(() => b.addWidget('header-bar', { slot: 'bogus' }))
      .toThrow('"bogus" is not a slot of "toolbar-view"');
    // A legal slot is accepted.
    expect(() => b.addWidget('header-bar', { slot: 'top' })).not.toThrow();
  });

  it('exposes legal slots and children, with [] for unknown containers', () => {
    expect(MockupBuilder.slotsFor('header-bar')).toContain('start');
    expect(MockupBuilder.slotsFor('toolbar-view')).toEqual(['top', 'content', 'bottom']);
    expect(MockupBuilder.slotsFor('box')).toEqual([]);
    expect(MockupBuilder.childrenFor('toolbar-view')).toContain('header-bar');
    expect(MockupBuilder.slotsFor('not-a-real-type' as never)).toEqual([]);
    expect(MockupBuilder.childrenFor('not-a-real-type' as never)).toEqual([]);
  });

  it('addChild delegates to addWidget and returns the builder', () => {
    const b = new MockupBuilder('T').addScreen('standard', 'S');
    expect(b.addChild('box', { orientation: 'horizontal' })).toBe(b);
    expect(b.build().screens[0].rootNode.children?.[0].type).toBe('box');
  });

  it('up() throws at root level and root() returns to the screen root', () => {
    const b = new MockupBuilder('T').addScreen('standard', 'S');
    expect(() => b.up()).toThrow('Already at root level.');
    b.addWidget('box').addWidget('button').root().addWidget('label');
    const types = b.build().screens[0].rootNode.children?.map((c) => c.type);
    expect(types).toEqual(['box', 'label']);
  });

  it('setProps sets document-level properties', () => {
    const b = new MockupBuilder('T').addScreen('standard', 'S');
    b.setProps({ title: 'Renamed', colorScheme: 'dark' });
    const doc = b.build();
    expect(doc.title).toBe('Renamed');
    expect(doc.colorScheme).toBe('dark');
  });
});

describe('MockupBuilder: overrideNode', () => {
  it('applies props to a node anywhere in the tree', () => {
    const b = new MockupBuilder('T')
      .addScreen('standard', 'S')
      .addWidget('box')
      .addWidget('label', { title: 'Original' });
    const built = b.build();
    const box = built.screens[0].rootNode.children?.[0];
    const label = box?.children?.[0];
    if (!label) throw new Error('fixture: label node missing');
    b.overrideNode(label.id, { title: 'Changed', sensitive: false });
    const changedBox = b.build().screens[0].rootNode.children?.[0];
    const changed = changedBox?.children?.[0];
    expect(changed?.title).toBe('Changed');
    expect(changed?.sensitive).toBe(false);
  });

  it('throws on unknown node ids', () => {
    const b = new MockupBuilder('T').addScreen('standard', 'S');
    expect(() => b.overrideNode('nope', {})).toThrow('no node with id "nope"');
  });

  it('validate() reports illegal nested children with node ids', () => {
    const b = new MockupBuilder('T')
      .addScreen('standard', 'S')
      .addWidget('toolbar-view')
      .addWidget('window-title'); // window-title allows NO children
    // Inject an illegal child via the builder's doc (addWidget would refuse
    // to build it in the first place).
    (b as unknown as { doc: MockupDocument }).doc.screens[0]
      .rootNode.children![0].children![0].children!.push({ id: 'bad', type: 'button' });
    const result = b.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain(
      'button is not a legal child of window-title',
    );
    expect(result.errors.join('\n')).toContain('(node: bad)');

    // A clean tree validates.
    const clean = new MockupBuilder('T').addScreen('standard', 'S').addWidget('box').validate();
    expect(clean.valid).toBe(true);
    expect(clean.errors).toEqual([]);
  });
});

describe('protota live handle: subscription lifecycle', () => {
  const makeScreens = (): Screen[] => [{
    id: 's1', title: 'Screen 1', type: 'empty', width: 800, height: 600,
    rootNode: {
      id: 'root', type: 'box',
      children: [
        { id: 'a1', type: 'button', title: 'One' },
        { id: 'a2', type: 'label', title: 'Two' },
      ],
    },
  }];
  const cleanups: Array<() => void> = [];

  beforeEach(() => {
    const doc: MockupDocument = {
      id: 'doc-test', title: 'Test', edges: [], colorScheme: 'auto', screens: makeScreens(),
    };
    useMockupStore.setState({
      doc, history: [doc], historyIndex: 0, clipboard: [],
      selectedNodeId: null, selectedNodeIds: [], selectedScreenId: 's1',
    });
  });

  afterEach(() => {
    cleanups.forEach((cleanup) => cleanup());
    cleanups.length = 0;
    vi.restoreAllMocks();
  });

  const onSelection = (cb: (payload: { selection: string[] }) => void) => {
    protota.on('selectionchange', cb);
    cleanups.push(() => protota.off('selectionchange', cb));
  };
  const onDocument = (cb: (payload: { doc: MockupDocument }) => void) => {
    protota.on('documentchange', cb);
    cleanups.push(() => protota.off('documentchange', cb));
  };

  it('registers a single store subscription for many listeners', () => {
    const subscribe = vi.spyOn(useMockupStore, 'subscribe');
    onSelection(() => {});
    onDocument(() => {});
    onSelection(() => {});
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('tears the store subscription down when the last listener leaves', () => {
    const unsubscribe = vi.fn();
    vi.spyOn(useMockupStore, 'subscribe').mockReturnValue(unsubscribe);
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    protota.on('selectionchange', cb1);
    protota.on('documentchange', cb2);
    protota.off('selectionchange', cb1);
    expect(unsubscribe).not.toHaveBeenCalled();
    protota.off('documentchange', cb2);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('transaction emits one documentchange at commit and none when empty', () => {
    const docs: MockupDocument[] = [];
    onDocument(({ doc }) => docs.push(doc));
    protota.transaction(() => {
      useMockupStore.getState().updateNodeProps('a1', { title: 'X' });
      useMockupStore.getState().updateNodeProps('a2', { title: 'Y' });
    });
    expect(docs).toHaveLength(1);
    expect(docs[0].screens[0].rootNode.children?.[0].title).toBe('X');

    protota.transaction(() => {});
    expect(docs).toHaveLength(1); // empty transaction: silent
  });
});

describe('generateMockup', () => {
  it('scaffolds a standard window when no preferences groups are given', () => {
    const doc = generateMockup('My App', 'standard');
    expect(doc.screens).toHaveLength(1);
    const root = doc.screens[0].rootNode;
    expect(root.type).toBe('window');
    const toolbar = root.children?.[0];
    expect(toolbar?.type).toBe('toolbar-view');
    const types = (toolbar?.children ?? []).map((c) => c.type);
    expect(types).toContain('header-bar');
    expect(types).toContain('box');
  });

  it('supports action and entry row kinds in preferences groups', () => {
    const doc = generateMockup('Prefs', 'preferences', {
      groups: [{
        title: 'Misc',
        rows: ['action:Open:Open the file', 'entry:Name:Your name here'],
      }],
    });
    const root = doc.screens[0].rootNode;
    const find = (node: typeof root, type: string): boolean =>
      node.type === type || (node.children ?? []).some((c) => find(c, type));
    expect(find(root, 'action-row')).toBe(true);
    expect(find(root, 'entry-row')).toBe(true);
    // The row descriptions were parsed into title/placeholder.
    const entry = ((): typeof root => {
      const walk = (node: typeof root): typeof root | null => {
        if (node.type === 'entry-row') return node;
        for (const child of node.children ?? []) {
          const hit = walk(child);
          if (hit) return hit;
        }
        return null;
      };
      return walk(root)!;
    })();
    expect(entry.title).toBe('Name');
    expect(entry.placeholder).toBe('Your name here');
  });
});
