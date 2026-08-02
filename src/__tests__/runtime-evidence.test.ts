/**
 * Consumers of native runtime evidence (#55 exit, ADR 0001 Part 1):
 * `applyRuntimeEvidence` wiring the probe join into the rendered document,
 * the geometry path taking a boundary's allocation from native bounds, and
 * `validateProbeEvidence` keeping probe-generated finishing entries honest.
 */
import { describe, expect, it } from 'vitest';
import { blueprintToNode } from '../utils/blueprint';
import { boundaryGeometryConfidence, boundaryGeometryFacts, placementLayout } from '../utils/nodeGeometry';
import {
  applyRuntimeEvidence, matchRuntimeProfile, validateProbeEvidence,
  type ProbeDocument, type ProbeWidget,
} from '../utils/runtimeProfile';

function widget(overrides: Partial<ProbeWidget> & { gtype: string; indexPath: number[] }): ProbeWidget {
  return {
    buildableId: null,
    mapped: true,
    visible: true,
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    ...overrides,
  };
}

function probe(widgets: ProbeWidget[]): ProbeDocument {
  return { probeVersion: 1, app: 'fixture-app', settleTicks: 5, widgets };
}

// Calculator in miniature: an unresolved keypad boundary with a declared id
// and a sibling whose visibility GSettings decides at runtime.
function fixtureRoot() {
  return blueprintToNode(`
    Adw.ApplicationWindow window {
      Gtk.Box {
        orientation: vertical;
        Gtk.Box converter_box { }
        $MathButtons _buttons { vexpand: true; }
      }
    }
  `);
}

const fixtureProbe = probe([
  widget({ gtype: 'AdwApplicationWindow', indexPath: [0], buildableId: 'window' }),
  widget({ gtype: 'GtkBox', indexPath: [0, 0] }),
  // GTK's own answer to the runtime-driven state: the converter is unmapped.
  widget({
    gtype: 'GtkBox', indexPath: [0, 0, 0], buildableId: 'converter_box',
    mapped: false, visible: true, bounds: { x: 0, y: 46, width: 0, height: 0 },
  }),
  widget({
    gtype: 'MathButtons', indexPath: [0, 0, 1], buildableId: '_buttons',
    bounds: { x: 0, y: 356, width: 360, height: 260 },
  }),
]);

function findNode(root: ReturnType<typeof blueprintToNode>, id: string) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.id === id) return node;
    stack.push(...(node.children ?? []), ...(node.pages ?? []));
  }
  throw new Error(`fixture node ${id} missing`);
}

describe('applyRuntimeEvidence (#55 exit wiring)', () => {
  it('suppresses a matched widget the probe saw unmapped, at native origin', () => {
    const root = fixtureRoot();
    const applied = applyRuntimeEvidence(root, matchRuntimeProfile(fixtureProbe, root));
    expect(applied.suppressed).toContain('converter_box');
    const converter = findNode(root, 'converter_box');
    expect(converter.visible).toBe(false);
    expect(converter.geometryOrigin?.visible).toBe('native');
    // The audit trail credits the probe, not a hand guess.
    expect(boundaryGeometryFacts(converter)).toContainEqual(
      { property: 'visible', value: false, origin: 'native:visible', confidence: 'native' },
    );
  });

  it('gives an unresolved boundary its allocation from matched native bounds', () => {
    const root = fixtureRoot();
    const applied = applyRuntimeEvidence(root, matchRuntimeProfile(fixtureProbe, root));
    expect(applied.allocated).toContain('_buttons');
    const buttons = findNode(root, '_buttons');
    expect(buttons.runtimeEvidence).toMatchObject({
      probeVersion: 1, matchedBy: 'buildable-id', buildableId: '_buttons',
      gtype: 'MathButtons', bounds: { x: 0, y: 356, width: 360, height: 260 },
    });
    // The renderer takes exactly the region GTK assigned: the measured
    // bounds already contain the expansion, so no flex growth past them and
    // no squeeze below them.
    const placement = placementLayout(buttons, 'column');
    expect(placement?.width).toBe(360);
    expect(placement?.height).toBe(260);
    expect(placement?.flexGrow).toBe(0);
    expect(placement?.flexShrink).toBe(0);
    const facts = boundaryGeometryFacts(buttons);
    expect(facts).toContainEqual(
      { property: 'bounds', value: '0,356 360x260', origin: 'native:bounds', confidence: 'native' },
    );
    expect(boundaryGeometryConfidence(facts)).toBe('native');
  });

  it('native allocation never shrinks a larger declared size request', () => {
    const buttons = findNode(fixtureRoot(), '_buttons');
    buttons.widthRequest = 400;
    buttons.runtimeEvidence = {
      probeVersion: 1, matchedBy: 'buildable-id', buildableId: '_buttons',
      gtype: 'MathButtons', mapped: true, visible: true,
      bounds: { x: 0, y: 356, width: 360, height: 260 },
    };
    const placement = placementLayout(buttons, 'column');
    // CSS ranks min-* above width, so the declared 400px minimum still wins.
    expect(placement?.minWidth).toBe(400);
    expect(placement?.width).toBe(360);
    expect(placement?.height).toBe(260);
  });

  it('leaves resolved nodes and unmatched boundaries untouched', () => {
    const root = fixtureRoot();
    // A probe that only saw the window: no widget for the boundary.
    applyRuntimeEvidence(root, matchRuntimeProfile(probe([
      widget({ gtype: 'AdwApplicationWindow', indexPath: [0], buildableId: 'window' }),
    ]), root));
    const buttons = findNode(root, '_buttons');
    expect(buttons.runtimeEvidence).toBeUndefined();
    expect(findNode(root, 'converter_box').visible).not.toBe(false);
    // No evidence: the boundary keeps its static facts and tier.
    expect(boundaryGeometryConfidence(boundaryGeometryFacts(buttons))).not.toBe('native');
  });

  it('projects semantic runtime-only branches under their matched source parent', () => {
    const root = blueprintToNode(`
      Adw.ApplicationWindow window {
        Gtk.Box shell { orientation: vertical; }
      }
    `);
    const runtime = probe([
      widget({ gtype: 'AdwApplicationWindow', indexPath: [0], buildableId: 'window' }),
      widget({ gtype: 'GtkBox', indexPath: [0, 0], buildableId: 'shell' }),
      // Created by application code after the builder source loaded.
      widget({ gtype: 'GtkListBox', indexPath: [0, 0, 0] }),
      widget({ gtype: 'GtkListBoxRow', indexPath: [0, 0, 0, 0] }),
      widget({
        gtype: 'GtkLabel', indexPath: [0, 0, 0, 0, 0],
        properties: { label: 'Wi-Fi' },
      }),
    ]);

    const applied = applyRuntimeEvidence(root, matchRuntimeProfile(runtime, root), runtime);

    expect(applied.projected).toEqual(expect.arrayContaining([
      'runtime_0_0_0', 'runtime_0_0_0_0', 'runtime_0_0_0_0_0',
    ]));
    const label = findNode(root, 'runtime_0_0_0_0_0');
    expect(label).toMatchObject({ type: 'label', title: 'Wi-Fi', value: 'Wi-Fi', sourceClass: 'GtkLabel' });
    expect(findNode(root, 'shell').children?.[0]).toMatchObject({ type: 'list-box' });
  });
});

describe('validateProbeEvidence (probe-generated finishing entries)', () => {
  const evidence = { probeVersion: 1, buildableId: 'converter_box', expect: { mapped: false } };

  it('accepts an entry the committed dump still supports', () => {
    expect(validateProbeEvidence(evidence, fixtureProbe)).toEqual([]);
    expect(validateProbeEvidence(
      { probeVersion: 1, buildableId: '_buttons', expect: { mapped: true, visible: true } },
      fixtureProbe,
    )).toEqual([]);
  });

  it('fails loudly when the dump is missing', () => {
    expect(validateProbeEvidence(evidence, null)).toEqual([
      expect.stringContaining('no probe dump'),
    ]);
  });

  it('fails loudly on a probe version mismatch', () => {
    expect(validateProbeEvidence({ ...evidence, probeVersion: 2 }, fixtureProbe)).toEqual([
      expect.stringContaining('probeVersion 2 does not match dump version 1'),
    ]);
  });

  it('fails loudly when the referenced widget left the dump (stale entry)', () => {
    expect(validateProbeEvidence({ ...evidence, buildableId: 'gone_box' }, fixtureProbe)).toEqual([
      expect.stringContaining('not present in the probe dump'),
    ]);
  });

  it('fails loudly when the dump no longer says what the entry claims', () => {
    expect(validateProbeEvidence(
      { ...evidence, expect: { mapped: true } }, fixtureProbe,
    )).toEqual([expect.stringContaining('dump says mapped=false')]);
  });

  it('rejects fields the probe cannot check (a label is not probe evidence)', () => {
    expect(validateProbeEvidence(
      { probeVersion: 1, buildableId: '_buttons', expect: { title: 'Basic' } as never },
      fixtureProbe,
    )).toEqual([expect.stringContaining("'title' is not a probe-checkable field")]);
  });

  it('checks stack visible-child-name against the dump', () => {
    const stackProbe = probe([
      widget({ gtype: 'GtkStack', indexPath: [0], buildableId: 'panel_stack', visibleChildName: 'bas_panel' }),
    ]);
    expect(validateProbeEvidence(
      { probeVersion: 1, buildableId: 'panel_stack', expect: { visibleChildName: 'bas_panel' } }, stackProbe,
    )).toEqual([]);
    expect(validateProbeEvidence(
      { probeVersion: 1, buildableId: 'panel_stack', expect: { visibleChildName: 'adv_panel' } }, stackProbe,
    )).toEqual([expect.stringContaining('stale entry')]);
  });
});
