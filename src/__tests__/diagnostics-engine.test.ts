import { beforeEach, describe, expect, it } from 'vitest';
import type { AdwNode, MockupDocument } from '../types/mockup';
import type { Diagnostic } from '../diagnostics/types';
import { filterDiagnostics, getDiagnosticsForNode, runDiagnostics, worstTier } from '../diagnostics/engine';

/**
 * Engine + store behaviour for diagnostics (#95): ordering, filtering,
 * ignores, quick-fix application through existing mutations, undo.
 *
 * The store persists to localStorage at module scope, so a stub must exist
 * before the store module is evaluated — hence the dynamic import below
 * (same idiom as move-node.test.ts).
 */
const backing = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => backing.get(key) ?? null,
  setItem: (key: string, value: string) => { backing.set(key, value); },
  removeItem: (key: string) => { backing.delete(key); },
  clear: () => { backing.clear(); },
  key: (index: number) => [...backing.keys()][index] ?? null,
  get length() { return backing.size; },
} as Storage;

const { useMockupStore } = await import('../store/mockupStore');

function makeDoc(): MockupDocument {
  return {
    id: 'doc-test',
    title: 'Test',
    edges: [],
    colorScheme: 'auto',
    screens: [{
      id: 's1', title: 'Screen 1', type: 'standard', width: 900, height: 650,
      rootNode: {
        id: 'root', type: 'window',
        children: [
          { id: 'hdr', type: 'header-bar', children: [{ id: 'title', type: 'window-title', title: 'App' }] },
          { id: 'content', type: 'box', spacing: 13, children: [] },
        ],
      },
    }],
  };
}

beforeEach(() => {
  backing.clear();
  const doc = makeDoc();
  useMockupStore.setState({
    doc,
    history: [doc],
    historyIndex: 0,
    selectedNodeId: null,
    diagnosticsEnabled: false,
    diagnostics: [],
    exportCheck: [],
    tierFilters: { error: true, warning: true, suggestion: true },
    ignoredRules: [],
    ignoredInstances: [],
  });
});

describe('engine ordering and helpers', () => {
  it('orders diagnostics error → warning → suggestion', () => {
    const doc = makeDoc();
    doc.screens[0].width = 320; // E001
    doc.screens[0].rootNode.children!.push({ id: 'b1', type: 'button', title: 'save as...' }); // S001+S002
    const tiers = runDiagnostics(doc).map((d) => d.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => {
      const order = { error: 0, warning: 1, suggestion: 2 } as const;
      return order[a] - order[b];
    }));
  });

  it('getDiagnosticsForNode returns only the anchored diagnostics', () => {
    const diagnostics = runDiagnostics(makeDoc());
    expect(getDiagnosticsForNode(diagnostics, 's1', 'content').map((d) => d.ruleId)).toEqual(['HIG-W001']);
    expect(getDiagnosticsForNode(diagnostics, 's1', 'hdr')).toHaveLength(0);
  });

  it('worstTier picks the most severe tier', () => {
    const d = (tier: Diagnostic['tier']): Diagnostic => ({
      ruleId: 'X', tier, source: 'hig', message: '', screenId: 's1', nodeId: 'n', nodeType: 'box',
    });
    expect(worstTier([d('suggestion'), d('error'), d('warning')])).toBe('error');
    expect(worstTier([])).toBeNull();
  });

  it('filterDiagnostics honours tier chips, rule ignores, and instance ignores', () => {
    const diagnostics = runDiagnostics(makeDoc());
    expect(diagnostics.map((d) => d.ruleId)).toEqual(['HIG-W001']);
    expect(filterDiagnostics(diagnostics, { error: true, warning: false, suggestion: true }, [], [])).toHaveLength(0);
    expect(filterDiagnostics(diagnostics, { error: true, warning: true, suggestion: true }, ['HIG-W001'], [])).toHaveLength(0);
    expect(filterDiagnostics(diagnostics, { error: true, warning: true, suggestion: true }, [], ['HIG-W001:content'])).toHaveLength(0);
    expect(filterDiagnostics(diagnostics, { error: true, warning: true, suggestion: true }, [], ['HIG-W001:other'])).toHaveLength(1);
  });

  it('tier chips hide blueprint-source diagnostics alongside HIG', () => {
    const blp: Diagnostic = {
      ruleId: 'BLP-S001', tier: 'suggestion', source: 'blueprint',
      message: 'boundary', screenId: '', nodeId: '', nodeType: null,
    };
    const kept = filterDiagnostics([blp], { error: true, warning: true, suggestion: false }, [], []);
    expect(kept).toHaveLength(0);
  });
});

describe('store integration', () => {
  it('toggleDiagnostics runs the engine; edits re-lint while enabled', () => {
    useMockupStore.getState().toggleDiagnostics();
    let state = useMockupStore.getState();
    expect(state.diagnosticsEnabled).toBe(true);
    expect(state.diagnostics.map((d) => d.ruleId)).toEqual(['HIG-W001']);

    state.updateNodeProps('content', { spacing: 12 });
    state = useMockupStore.getState();
    expect(state.diagnostics).toHaveLength(0);

    state.toggleDiagnostics();
    expect(useMockupStore.getState().diagnostics).toHaveLength(0);
  });

  it('applyQuickFix rides updateNodeProps: the card clears and one undo restores', () => {
    useMockupStore.getState().toggleDiagnostics();
    const diagnostic = useMockupStore.getState().diagnostics[0];
    expect(diagnostic.quickFix).toMatchObject({ kind: 'set-props', props: { spacing: 12 } });

    useMockupStore.getState().applyQuickFix(diagnostic);
    let state = useMockupStore.getState();
    expect(state.diagnostics).toHaveLength(0);
    expect(state.selectedNodeId).toBe('content');

    state.undo();
    state = useMockupStore.getState();
    const box = state.doc.screens[0].rootNode.children!.find((n: AdwNode) => n.id === 'content');
    expect(box?.spacing).toBe(13);
    // Undo re-lints so the report matches the document on screen.
    expect(state.diagnostics.map((d) => d.ruleId)).toEqual(['HIG-W001']);
  });

  it('the HIG-E001 quick fix rides updateScreenProps', () => {
    useMockupStore.getState().updateScreenProps('s1', { width: 320 });
    useMockupStore.getState().toggleDiagnostics();
    const e001 = useMockupStore.getState().diagnostics.find((d) => d.ruleId === 'HIG-E001');
    expect(e001).toBeDefined();
    useMockupStore.getState().applyQuickFix(e001!);
    expect(useMockupStore.getState().doc.screens[0].width).toBe(360);
    expect(useMockupStore.getState().diagnostics.some((d) => d.ruleId === 'HIG-E001')).toBe(false);
  });

  it('ignores persist to localStorage and clearIgnores resets them', () => {
    useMockupStore.getState().ignoreRule('HIG-W001');
    useMockupStore.getState().ignoreInstance('HIG-S002', 'node-9');
    const persisted = JSON.parse(backing.get('protota_diagnostics_ignores_v1')!);
    expect(persisted).toEqual({ rules: ['HIG-W001'], instances: ['HIG-S002:node-9'] });

    useMockupStore.getState().clearIgnores();
    expect(useMockupStore.getState().ignoredRules).toEqual([]);
    expect(JSON.parse(backing.get('protota_diagnostics_ignores_v1')!)).toEqual({ rules: [], instances: [] });
  });

  it('runExportCheck round-trips a standard document cleanly', () => {
    const results = useMockupStore.getState().runExportCheck();
    expect(results).toEqual([]);
    expect(useMockupStore.getState().exportCheck).toEqual([]);
  });
});
