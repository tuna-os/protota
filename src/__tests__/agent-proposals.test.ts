import { describe, it, expect, beforeEach } from 'vitest';
import type { MockupDocument } from '../types/mockup';
import { protota } from '../runtime/agentHandle';
import { useProposalStore } from '../runtime/proposals';
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

const makeDoc = (): MockupDocument => ({
  id: 'doc-test', title: 'Test', edges: [], colorScheme: 'auto',
  screens: [{
    id: 's1', title: 'Screen 1', type: 'empty', width: 800, height: 600,
    rootNode: { id: 'root', type: 'box', children: [
      { id: 'a1', type: 'button', title: 'One' },
      { id: 'a2', type: 'button', title: 'Two' },
    ] },
  }],
});

const store = () => useMockupStore.getState();
const edit = () => {
  store().updateNodeProps('a1', { title: 'X' });
  store().updateNodeProps('a2', { title: 'Y' });
};

describe('agent proposals (#500)', () => {
  beforeEach(() => {
    protota.rejectProposal();
    const doc = makeDoc();
    useMockupStore.setState({
      doc, history: [doc], historyIndex: 0,
      selectedNodeId: null, selectedNodeIds: ['a1'], selectedScreenId: 's1',
    });
  });

  it('staging and rejecting leave the document, selection, and history unchanged', () => {
    const before = store().doc;
    const handle = protota.propose(edit, 'Rename');
    expect(handle?.summary.changes).toEqual([
      expect.objectContaining({ screenId: 's1', kind: 'changed', nodesChanged: 2 }),
    ]);
    expect(store().doc).toBe(before);
    expect(store().history).toHaveLength(1);
    expect(store().selectedNodeIds).toEqual(['a1']);
    expect(useProposalStore.getState().pending?.candidate.screens[0].rootNode.children![0].title).toBe('X');
    expect(protota.rejectProposal()).toBe(true);
    expect(store().doc).toBe(before);
    expect(protota.pendingProposal).toBeNull();
  });

  it('accept commits exactly the reviewed candidate as one undo step', async () => {
    const before = store().doc;
    const handle = protota.propose(edit)!;
    const candidate = useProposalStore.getState().pending!.candidate;
    expect(protota.acceptProposal()).toBe('accepted');
    await expect(handle.settled).resolves.toBe('accepted');
    expect(store().doc).toBe(candidate);
    expect(store().history).toHaveLength(2);
    store().undo();
    expect(store().doc).toBe(before);
  });

  it('a human edit makes the proposal stale and accept is refused', async () => {
    const handle = protota.propose(edit)!;
    store().updateNodeProps('a1', { title: 'Human' });
    await expect(handle.settled).resolves.toBe('stale');
    expect(protota.acceptProposal()).toBeNull();
    expect(store().doc.screens[0].rootNode.children![0].title).toBe('Human');
    expect(store().doc.screens[0].rootNode.children![1].title).toBe('Two');
  });

  it('an illegal edit throws and stages nothing', () => {
    expect(() => protota.propose(() => store().addScreen('Oops', 'window' as never))).toThrow();
    expect(protota.pendingProposal).toBeNull();
    expect(store().history).toHaveLength(1);
  });

  it('a no-op proposal is not staged; a new proposal supersedes the old', async () => {
    expect(protota.propose(() => {})).toBeNull();
    const first = protota.propose(edit)!;
    protota.propose(() => store().updateNodeProps('a2', { title: 'Z' }));
    await expect(first.settled).resolves.toBe('superseded');
    expect(protota.acceptProposal()).toBe('accepted');
    expect(store().doc.screens[0].rootNode.children![0].title).toBe('One');
    expect(store().doc.screens[0].rootNode.children![1].title).toBe('Z');
  });

  it('does not fire documentchange while staging', () => {
    let events = 0;
    const cb = () => { events += 1; };
    protota.on('documentchange', cb);
    protota.propose(edit);
    expect(events).toBe(0);
    protota.acceptProposal();
    expect(events).toBe(1);
    protota.off('documentchange', cb);
  });

  it('a rejected edge proposal leaves showFlows alone; accepting reveals flows', () => {
    store().addScreen('Second', 'standard');
    const [a, b] = store().doc.screens.map((sc) => sc.id);
    useMockupStore.setState({ showFlows: false });
    protota.propose(() => store().addEdge(a, b));
    expect(store().showFlows).toBe(false);
    protota.rejectProposal();
    expect(store().showFlows).toBe(false);
    protota.propose(() => store().addEdge(a, b));
    expect(protota.acceptProposal()).toBe('accepted');
    expect(store().showFlows).toBe(true);
  });
});
