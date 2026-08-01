import { describe, expect, it } from 'vitest';
import { blueprintToDocument, blueprintToNode, mockupToBlueprint } from '../utils/blueprint';
import {
  activeBreakpoints, breakpointConditionMatches, breakpointOverrides, missingSetterTargets,
} from '../utils/breakpoints';
import type { AdwNode, MockupDocument } from '../types/mockup';

const AMBEROL_STYLE_BLP = `using Gtk 4.0;
using Adw 1;

Adw.ApplicationWindow {
  default-width: 800;
  default-height: 600;

  content: Adw.OverlaySplitView split_view {
    sidebar: Gtk.Label sidebar_label { label: "Playlist"; };
    content: Gtk.Label content_label { label: "Now Playing"; };
  };

  Adw.Breakpoint {
    condition ("max-width: 560sp")

    setters {
      split_view.collapsed: true;
    }
  }

  Gtk.Label after_breakpoint { label: "Sibling after the breakpoint"; }
}
`;

const APOSTROPHE_STYLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<interface>
  <object class="AdwApplicationWindow" id="window">
    <property name="default-width">900</property>
    <property name="default-height">650</property>
    <child>
      <object class="GtkStack" id="headerbar_stack">
        <child>
          <object class="GtkLabel" id="headerbar_wide"><property name="label">Wide</property></object>
        </child>
        <child>
          <object class="GtkLabel" id="headerbar_narrow"><property name="label">Narrow</property></object>
        </child>
      </object>
    </child>
    <child>
      <object class="AdwBreakpoint" id="headerbars_breakpoint">
        <condition>max-width: 500px</condition>
        <setter object="headerbar_stack" property="visible-child-name">headerbar_narrow</setter>
        <setter object="MissingTemplate" property="preview-layout">0</setter>
        <setter object="headerbar_wide" property="visible"/>
      </object>
    </child>
  </object>
</interface>
`;

const findById = (node: AdwNode, id: string): AdwNode | null => {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
};

const breakpointsOf = (node: AdwNode): AdwNode[] => {
  const found: AdwNode[] = [];
  const visit = (candidate: AdwNode) => {
    if (typeof candidate.breakpointCondition === 'string') found.push(candidate);
    candidate.children?.forEach(visit);
  };
  visit(node);
  return found;
};

describe('Adw.Breakpoint import', () => {
  it('preserves condition and setters from Blueprint syntax', () => {
    const root = blueprintToNode(AMBEROL_STYLE_BLP);
    const breakpoints = breakpointsOf(root);
    expect(breakpoints).toHaveLength(1);
    expect(breakpoints[0].breakpointCondition).toBe('max-width: 560sp');
    expect(breakpoints[0].breakpointSetters).toEqual([
      { target: 'split_view', property: 'collapsed', value: true },
    ]);
  });

  it('keeps siblings declared after a breakpoint (brace desync regression)', () => {
    const root = blueprintToNode(AMBEROL_STYLE_BLP);
    expect(findById(root, 'after_breakpoint')).not.toBeNull();
    expect(findById(root, 'split_view')).not.toBeNull();
  });

  it('preserves condition and setters from GtkBuilder XML, null for empty setters', () => {
    const doc = blueprintToDocument(APOSTROPHE_STYLE_XML);
    const breakpoints = breakpointsOf(doc.screens[0].rootNode);
    expect(breakpoints).toHaveLength(1);
    expect(breakpoints[0].breakpointCondition).toBe('max-width: 500px');
    expect(breakpoints[0].breakpointSetters).toEqual([
      { target: 'headerbar_stack', property: 'visible-child-name', value: 'headerbar_narrow' },
      { target: 'MissingTemplate', property: 'preview-layout', value: 0 },
      { target: 'headerbar_wide', property: 'visible', value: null },
    ]);
  });

  it('reports setter targets the import did not keep as a diagnostic', () => {
    const doc = blueprintToDocument(APOSTROPHE_STYLE_XML);
    const missing = (doc.importDiagnostics ?? []).filter((d) => d.code === 'breakpoint-setter-target-missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].message).toContain('MissingTemplate');
  });

  it('round-trips breakpoints through export and re-import', () => {
    const doc = blueprintToDocument(AMBEROL_STYLE_BLP);
    const source = mockupToBlueprint(doc);
    // The breakpoint keeps a stable id so re-import cannot mint a colliding one.
    expect(source).toMatch(/Adw\.Breakpoint [\w-]+ \{/);
    expect(source).toContain('condition ("max-width: 560sp")');
    expect(source).toContain('split_view.collapsed: true;');
    const again = blueprintToDocument(source);
    const breakpoints = breakpointsOf(again.screens[0].rootNode);
    expect(breakpoints).toHaveLength(1);
    expect(breakpoints[0].breakpointSetters).toEqual([
      { target: 'split_view', property: 'collapsed', value: true },
    ]);
  });

  it('drops setters whose target is not exported, keeping the file compilable', () => {
    const doc = blueprintToDocument(APOSTROPHE_STYLE_XML);
    const source = mockupToBlueprint(doc);
    expect(source).toContain('headerbar_stack.visible-child-name: "headerbar_narrow";');
    expect(source).not.toContain('MissingTemplate');
    // null-valued (unset) setters have no Blueprint spelling we can emit.
    expect(source).not.toContain('headerbar_wide.visible');
  });
});

describe('screen size round trip', () => {
  const documentWithSize = (width: number, height: number): MockupDocument => ({
    id: 'doc', title: 'Doc', colorScheme: 'auto', edges: [],
    screens: [{
      id: 's1', title: 'Main', type: 'standard', width, height,
      rootNode: { id: 'win', type: 'window', children: [] },
    }],
  });

  it('persists screen width/height through Blueprint as default-width/height', () => {
    const source = mockupToBlueprint(documentWithSize(640, 480));
    expect(source).toContain('default-width: 640;');
    expect(source).toContain('default-height: 480;');
    const doc = blueprintToDocument(source);
    expect(doc.screens[0].width).toBe(640);
    expect(doc.screens[0].height).toBe(480);
  });

  it('persists dialog screens through content-width/content-height', () => {
    const doc: MockupDocument = {
      id: 'doc', title: 'Doc', colorScheme: 'auto', edges: [],
      screens: [{
        id: 's1', title: 'Dialog', type: 'dialog', width: 520, height: 410,
        rootNode: { id: 'dlg', type: 'dialog', children: [] },
      }],
    };
    const source = mockupToBlueprint(doc);
    expect(source).toContain('content-width: 520;');
    expect(source).toContain('content-height: 410;');
    const again = blueprintToDocument(source);
    expect(again.screens[0].width).toBe(520);
    expect(again.screens[0].height).toBe(410);
  });
});

describe('breakpoint evaluation', () => {
  it('evaluates the corpus condition grammar', () => {
    expect(breakpointConditionMatches('max-width: 550sp', 500, 700)).toBe(true);
    expect(breakpointConditionMatches('max-width: 550sp', 551, 700)).toBe(false);
    expect(breakpointConditionMatches('max-width: 550px', 550, 700)).toBe(true);
    expect(breakpointConditionMatches('min-width: 800sp', 800, 700)).toBe(true);
    expect(breakpointConditionMatches('min-width: 800sp', 799, 700)).toBe(false);
    expect(breakpointConditionMatches('max-height: 400sp', 900, 400)).toBe(true);
    expect(breakpointConditionMatches('min-height: 400sp', 900, 399)).toBe(false);
    expect(breakpointConditionMatches('max-width: 600sp and max-height: 400sp', 500, 300)).toBe(true);
    expect(breakpointConditionMatches('max-width: 600sp and max-height: 400sp', 500, 500)).toBe(false);
    expect(breakpointConditionMatches('max-width: 400sp or min-width: 900sp', 950, 500)).toBe(true);
    expect(breakpointConditionMatches('max-width: 400sp or min-width: 900sp', 600, 500)).toBe(false);
    // Unknown grammar never matches — no guessed layout switches.
    expect(breakpointConditionMatches('max-aspect-ratio: 4/3', 500, 500)).toBe(false);
  });

  const host = (breakpoints: AdwNode[]): AdwNode => ({
    id: 'win', type: 'window',
    children: [
      { id: 'stack', type: 'stack', children: [
        { id: 'wide', type: 'label', title: 'Wide' },
        { id: 'narrow', type: 'label', title: 'Narrow' },
      ] },
      ...breakpoints,
    ],
  });

  it('picks the LAST matching breakpoint per host (libadwaita tie-break)', () => {
    const root = host([
      { id: 'bp1', type: 'bin', breakpointCondition: 'max-width: 700sp',
        breakpointSetters: [{ target: 'stack', property: 'visible-child-name', value: 'wide' }] },
      { id: 'bp2', type: 'bin', breakpointCondition: 'max-width: 500sp',
        breakpointSetters: [{ target: 'stack', property: 'visible-child-name', value: 'narrow' }] },
    ]);
    // Both match at 400 — the later declaration wins.
    expect(activeBreakpoints(root, 400, 600).map((entry) => entry.node.id)).toEqual(['bp2']);
    expect(breakpointOverrides(root, 400, 600)).toEqual({ stack: { visibleChildName: 'narrow' } });
    // Only the first matches at 600.
    expect(activeBreakpoints(root, 600, 600).map((entry) => entry.node.id)).toEqual(['bp1']);
    expect(breakpointOverrides(root, 600, 600)).toEqual({ stack: { visibleChildName: 'wide' } });
    // Neither matches at 900.
    expect(activeBreakpoints(root, 900, 600)).toEqual([]);
    expect(breakpointOverrides(root, 900, 600)).toEqual({});
  });

  it('translates setter spellings per target type and honours null as unset', () => {
    const root: AdwNode = {
      id: 'win', type: 'window',
      children: [
        { id: 'split', type: 'overlay-split', children: [] },
        { id: 'title_label', type: 'label', title: 'Visible', visible: true },
        { id: 'bp', type: 'bin', breakpointCondition: 'max-width: 550sp',
          breakpointSetters: [
            { target: 'split', property: 'collapsed', value: true },
            { target: 'title_label', property: 'visible', value: null },
          ] },
      ],
    };
    const overrides = breakpointOverrides(root, 360, 720);
    expect(overrides.split).toEqual({ collapsed: true });
    // null unsets: the merged node's `visible` reverts to GTK's default.
    expect('visible' in overrides.title_label).toBe(true);
    expect(overrides.title_label.visible).toBeUndefined();
    expect(breakpointOverrides(root, 900, 720)).toEqual({});
  });

  it('reports setters whose target is missing from the tree', () => {
    const root = host([
      { id: 'bp', type: 'bin', breakpointCondition: 'max-width: 500sp',
        breakpointSetters: [{ target: 'ghost', property: 'collapsed', value: true }] },
    ]);
    expect(missingSetterTargets([root])).toEqual([{ target: 'ghost', property: 'collapsed', value: true }]);
    // A missing target never produces an override.
    expect(breakpointOverrides(root, 400, 600)).toEqual({});
  });
});
