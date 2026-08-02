import { describe, expect, it } from 'vitest';
import { blueprintToNode } from '../utils/blueprint';
import { boundaryGeometryConfidence } from '../utils/nodeGeometry';
import {
  matchRuntimeProfile, nativeFactsFor, type ProbeDocument, type ProbeWidget,
} from '../utils/runtimeProfile';

/** Minimal probe widget with defaults, so fixtures state only what matters. */
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

// A window whose keypad boundary has a source-declared id (`_buttons`) and
// whose plain boxes are anonymous — the two matching regimes side by side.
const sourceRoot = blueprintToNode(`
  Adw.ApplicationWindow window {
    Gtk.Box {
      orientation: vertical;
      Gtk.Box { }
      Gtk.Box { }
      $MathButtons _buttons { vexpand: true; }
    }
  }
`);

describe('runtime profile matching (#58)', () => {
  it('matches by buildable ID first, independent of structural position', () => {
    const report = matchRuntimeProfile(probe([
      widget({ gtype: 'AdwApplicationWindow', indexPath: [0], buildableId: 'window' }),
      // The runtime parent chain differs from source (an interposed
      // AdwDialogHost the source graph has no node for): the buildable id
      // still lands the join.
      widget({ gtype: 'AdwDialogHost', indexPath: [0, 0] }),
      widget({ gtype: 'MathButtons', indexPath: [0, 0, 3], buildableId: '_buttons', bounds: { x: 0, y: 356, width: 360, height: 260 } }),
    ]), sourceRoot);

    const buttons = report.matches.find((match) => match.nodeId === '_buttons');
    expect(buttons).toBeDefined();
    expect(buttons!.matchedBy).toBe('buildable-id');
    expect(buttons!.gtype).toBe('MathButtons');
    expect(report.byBuildableId).toBe(2); // window + _buttons
  });

  it('falls back to gtype-ordinal structure within an already-matched parent', () => {
    const report = matchRuntimeProfile(probe([
      widget({ gtype: 'AdwApplicationWindow', indexPath: [0], buildableId: 'window' }),
      widget({ gtype: 'GtkBox', indexPath: [0, 0] }),
      widget({ gtype: 'GtkBox', indexPath: [0, 0, 0], bounds: { x: 0, y: 0, width: 360, height: 40 } }),
      widget({ gtype: 'GtkBox', indexPath: [0, 0, 1], bounds: { x: 0, y: 40, width: 360, height: 300 } }),
    ]), sourceRoot);

    const structural = report.matches.filter((match) => match.matchedBy === 'structure');
    // Outer box plus its two anonymous children, aligned k-th to k-th.
    expect(structural).toHaveLength(3);
    const [first, second] = structural.filter((match) => match.indexPath.length === 3);
    expect(first.bounds).toEqual({ x: 0, y: 0, width: 360, height: 40 });
    expect(second.bounds).toEqual({ x: 0, y: 40, width: 360, height: 300 });
  });

  it('never matches structurally across gtype mismatches', () => {
    const report = matchRuntimeProfile(probe([
      widget({ gtype: 'AdwApplicationWindow', indexPath: [0], buildableId: 'window' }),
      widget({ gtype: 'GtkBox', indexPath: [0, 0] }),
      // Same position and plausible bounds, wrong class: must not join.
      widget({ gtype: 'GtkGrid', indexPath: [0, 0, 0] }),
    ]), sourceRoot);
    expect(report.matches.filter((match) => match.indexPath.length === 3)).toHaveLength(0);
  });

  it('sees through one interposed runtime-only container, never deeper', () => {
    const report = matchRuntimeProfile(probe([
      widget({ gtype: 'AdwApplicationWindow', indexPath: [0], buildableId: 'window' }),
      widget({ gtype: 'AdwToolbarView', indexPath: [0, 0] }), // runtime interloper
      widget({ gtype: 'GtkBox', indexPath: [0, 0, 0] }),      // one level down: found
      // Below the matched box, MathButtons hides under TWO interposed
      // containers — outside the bounded descent, so it must stay unmatched.
      widget({ gtype: 'AdwBin', indexPath: [0, 0, 0, 0] }),
      widget({ gtype: 'AdwBin', indexPath: [0, 0, 0, 0, 0] }),
      widget({ gtype: 'MathButtons', indexPath: [0, 0, 0, 0, 0, 0] }),
    ]), sourceRoot);
    const outerBox = report.matches.find((match) => match.gtype === 'GtkBox');
    expect(outerBox?.matchedBy).toBe('structure');
    expect(report.matches.some((match) => match.gtype === 'MathButtons')).toBe(false);
  });

  it('reports an honest match rate over all matchable source nodes', () => {
    const report = matchRuntimeProfile(probe([
      widget({ gtype: 'AdwApplicationWindow', indexPath: [0], buildableId: 'window' }),
    ]), sourceRoot);
    // window + outer box + 2 anonymous boxes + $MathButtons boundary = 5.
    expect(report.sourceNodes).toBe(5);
    expect(report.matchedNodes).toBe(1);
    expect(report.matchRate).toBeCloseTo(0.2);
  });

  it('handles an empty or absent probe as no evidence, not failure', () => {
    const report = matchRuntimeProfile(probe([]), sourceRoot);
    expect(report.matchedNodes).toBe(0);
    expect(report.matchRate).toBe(0);
    expect(report.matches).toEqual([]);
  });

  it('matches a presented composite dialog below the application toplevel', () => {
    const dialogRoot = {
      id: 'dialog', type: 'dialog', sourceClass: 'ExampleSetupDialog', children: [],
    } as ReturnType<typeof blueprintToNode>;
    const report = matchRuntimeProfile(probe([
      widget({ gtype: 'ExampleWindow', indexPath: [0], buildableId: 'window' }),
      widget({ gtype: 'AdwDialogHost', indexPath: [0, 0] }),
      widget({ gtype: 'ExampleSetupDialog', indexPath: [0, 0, 1], buildableId: 'ExampleSetupDialog' }),
    ]), dialogRoot);

    expect(report.matches[0]).toMatchObject({
      nodeId: 'dialog',
      gtype: 'ExampleSetupDialog',
      indexPath: [0, 0, 1],
    });
  });

  it('prefers the mapped occurrence of a template-scoped duplicate id', () => {
    const root = blueprintToNode('Adw.ApplicationWindow window { Gtk.Button action { label: "Go"; } }');
    const report = matchRuntimeProfile(probe([
      widget({ gtype: 'AdwApplicationWindow', indexPath: [0], buildableId: 'window' }),
      widget({ gtype: 'GtkButton', indexPath: [0, 0], buildableId: 'action', mapped: false }),
      widget({ gtype: 'GtkButton', indexPath: [0, 1], buildableId: 'action', mapped: true }),
    ]), root);

    expect(report.matches.find((match) => match.nodeId === 'action')).toMatchObject({
      mapped: true,
      indexPath: [0, 1],
    });
  });

  it('emits native:* facts at the top native confidence tier', () => {
    const facts = nativeFactsFor(widget({
      gtype: 'MathButtons', indexPath: [0, 2],
      bounds: { x: 0, y: 356, width: 360, height: 260 },
      mapped: true, visible: true, visibleChildName: 'basic',
    }));
    expect(facts).toEqual(expect.arrayContaining([
      { property: 'bounds', value: '0,356 360x260', origin: 'native:bounds', confidence: 'native' },
      { property: 'mapped', value: true, origin: 'native:mapped', confidence: 'native' },
      { property: 'visible', value: true, origin: 'native:visible', confidence: 'native' },
      { property: 'visible-child-name', value: 'basic', origin: 'native:visible-child-name', confidence: 'native' },
    ]));
    // Native evidence outranks every static tier in the Phase 2 scale.
    expect(boundaryGeometryConfidence(facts)).toBe('native');
  });

  it('aligns named pages by the parent visible-child-name, not sibling order', () => {
    // AdwLeaflet keeps its runtime children in reverse page order (and
    // interposes AdwGizmo internals). Ordinal alignment alone would join the
    // source's first page to the runtime's unmapped second page. The parent's
    // own visible-child-name record disambiguates: the visible page's child
    // is the mapped widget of the class, every other page's child an
    // unmapped one.
    const navRoot = blueprintToNode(`
      Adw.ApplicationWindow window {
        Adw.ViewStack nav {
          Adw.ViewStackPage {
            name: "main";
            child: Gtk.Box main_box {};
          }
          Adw.ViewStackPage {
            name: "details";
            child: Gtk.Box details_box {};
          }
        }
      }
    `);
    const report = matchRuntimeProfile(probe([
      widget({ gtype: 'AdwApplicationWindow', indexPath: [0], buildableId: 'window' }),
      widget({ gtype: 'AdwLeaflet', indexPath: [0, 0], buildableId: 'nav', visibleChildName: 'main' }),
      widget({ gtype: 'AdwGizmo', indexPath: [0, 0, 0], mapped: false }),
      // Reverse page order: details first, main second.
      widget({ gtype: 'GtkBox', indexPath: [0, 0, 1], mapped: false, bounds: { x: 0, y: 0, width: 0, height: 0 } }),
      widget({ gtype: 'GtkBox', indexPath: [0, 0, 2], mapped: true, bounds: { x: 0, y: 0, width: 360, height: 600 } }),
    ]), navRoot);
    const main = report.matches.find((match) => match.nodeId === 'main_box');
    const details = report.matches.find((match) => match.nodeId === 'details_box');
    expect(main?.mapped).toBe(true);
    expect(details?.mapped).toBe(false);
  });

  it('records runtime visibility divergence (converter_box mapped:false)', () => {
    const facts = nativeFactsFor(widget({
      gtype: 'GtkBox', indexPath: [0, 1, 1], buildableId: 'converter_box',
      mapped: false, visible: true, bounds: { x: 0, y: 46, width: 0, height: 0 },
    }));
    expect(facts).toEqual(expect.arrayContaining([
      { property: 'mapped', value: false, origin: 'native:mapped', confidence: 'native' },
    ]));
  });
});
