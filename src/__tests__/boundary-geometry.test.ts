import { describe, expect, it } from 'vitest';
import { blueprintBundleToDocument, blueprintToNode } from '../utils/blueprint';
import {
  boundaryGeometryConfidence, boundaryGeometryFacts, containerLayout, placementLayout,
} from '../utils/nodeGeometry';
import type { AdwNode } from '../types/mockup';

/** Import a Blueprint snippet and return the unresolved `$MysteryPanel` boundary. */
function importBoundary(snippet: string): { parent: AdwNode; boundary: AdwNode } {
  const parent = blueprintToNode(snippet);
  const find = (node: AdwNode): AdwNode | undefined => {
    if (node.type === 'custom-widget') return node;
    for (const child of node.children ?? []) {
      const found = find(child);
      if (found) return found;
    }
    return undefined;
  };
  const boundary = find(parent);
  if (!boundary) throw new Error('fixture lost its $MysteryPanel boundary');
  const holds = (node: AdwNode): AdwNode | undefined =>
    node.children?.includes(boundary) ? node : node.children?.map(holds).find(Boolean);
  return { parent: holds(parent) ?? parent, boundary };
}

describe('boundary geometry: declarative facts (#55)', () => {
  it('treats width/height-request as minimums, not fixed sizes', () => {
    const { boundary } = importBoundary(`
      Gtk.Box { $MysteryPanel panel { width-request: 220; height-request: 132; } }
    `);
    const placement = placementLayout(boundary, 'column');
    expect(placement).toMatchObject({ minWidth: 220, minHeight: 132 });
    expect(placement?.width).toBeUndefined();
    expect(placement?.height).toBeUndefined();

    const facts = boundaryGeometryFacts(boundary);
    expect(facts).toEqual(expect.arrayContaining([
      { property: 'min-width', value: 220, origin: 'source:width-request', confidence: 'declared' },
      { property: 'min-height', value: 132, origin: 'source:height-request', confidence: 'declared' },
    ]));
    expect(boundaryGeometryConfidence(facts)).toBe('declared');
  });

  it('honors vexpand on the main axis of a vertical box as flex growth', () => {
    const { boundary } = importBoundary(`
      Gtk.Box {
        orientation: vertical;
        $MysteryPanel keypad { vexpand: true; }
      }
    `);
    const placement = placementLayout(boundary, 'column');
    expect(placement).toMatchObject({ flexGrow: 1, minHeight: 0, alignSelf: 'stretch' });
    expect(boundaryGeometryFacts(boundary)).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'vexpand', origin: 'source:vexpand', confidence: 'declared' }),
    ]));
  });

  it('honors hexpand in a vertical box as a cross-axis stretch, not growth', () => {
    const { boundary } = importBoundary(`
      Gtk.Box { orientation: vertical; $MysteryPanel bar { hexpand: true; } }
    `);
    const placement = placementLayout(boundary, 'column');
    expect(placement).toMatchObject({ alignSelf: 'stretch', minWidth: 0 });
    expect(placement?.flexGrow).toBeUndefined();
  });

  it('applies halign/valign, and alignment wins over expand stretch', () => {
    const { boundary } = importBoundary(`
      Gtk.Box { orientation: vertical; $MysteryPanel chip { halign: end; hexpand: true; } }
    `);
    const placement = placementLayout(boundary, 'column');
    expect(placement?.alignSelf).toBe('flex-end');
    expect(boundaryGeometryFacts(boundary)).toEqual(expect.arrayContaining([
      { property: 'halign', value: 'end', origin: 'source:halign', confidence: 'declared' },
    ]));
  });

  it('applies GTK margins to the allocated rectangle', () => {
    const { boundary } = importBoundary(`
      Gtk.Box { $MysteryPanel pad {
        margin-start: 6; margin-end: 12; margin-top: 18; margin-bottom: 24;
      } }
    `);
    expect(placementLayout(boundary, 'column')).toMatchObject({
      marginInlineStart: 6, marginInlineEnd: 12, marginBlockStart: 18, marginBlockEnd: 24,
    });
    expect(boundaryGeometryFacts(boundary).map((fact) => fact.property)).toEqual(
      expect.arrayContaining(['margin-start', 'margin-end', 'margin-top', 'margin-bottom']));
  });

  it('imports scalar visible: false and records that the boundary takes no space', () => {
    const { boundary } = importBoundary(`
      Gtk.Box { $MysteryPanel ghost { visible: false; } }
    `);
    expect(boundary.visible).toBe(false);
    expect(boundaryGeometryFacts(boundary)).toEqual(expect.arrayContaining([
      { property: 'visible', value: false, origin: 'source:visible', confidence: 'declared' },
    ]));
  });

  it('places a boundary by grid attach and spans', () => {
    const { parent, boundary } = importBoundary(`
      Gtk.Grid {
        $MysteryPanel cell {
          layout { column: 1; row: 2; column-span: 2; row-span: 3; }
        }
      }
    `);
    expect(placementLayout(boundary, 'grid')).toMatchObject({
      gridColumn: '2 / span 2',
      gridRow: '3 / span 3',
    });
    expect(boundaryGeometryFacts(boundary, parent)).toEqual(expect.arrayContaining([
      { property: 'layout.column', value: 1, origin: 'source:layout.column', confidence: 'declared' },
      { property: 'layout.column-span', value: 2, origin: 'source:layout.column-span', confidence: 'declared' },
      { property: 'layout.row-span', value: 3, origin: 'source:layout.row-span', confidence: 'declared' },
    ]));
  });
});

describe('boundary geometry: container-driven allocation (#55)', () => {
  it('records a homogeneous box share as derived container evidence', () => {
    const { parent, boundary } = importBoundary(`
      Gtk.Box { homogeneous: true; spacing: 6; $MysteryPanel pane {} }
    `);
    expect(parent.homogeneous).toBe(true);
    expect(containerLayout(parent)).toMatchObject({ gap: 6 });
    const facts = boundaryGeometryFacts(boundary, parent);
    expect(facts).toEqual([
      { property: 'allocation', value: 'homogeneous-share', origin: 'container:GtkBox.homogeneous', confidence: 'derived' },
    ]);
    expect(boundaryGeometryConfidence(facts)).toBe('derived');
  });

  it('gives a boundary inside a scroller the viewport, not an intrinsic size', () => {
    const { parent, boundary } = importBoundary(`
      Gtk.ScrolledWindow { $MysteryPanel list {} }
    `);
    expect(containerLayout(parent)).toMatchObject({ overflow: 'auto' });
    expect(boundaryGeometryFacts(boundary, parent)).toEqual([
      { property: 'allocation', value: 'scroller-viewport', origin: 'container:GtkScrolledWindow.child', confidence: 'derived' },
    ]);
  });

  it('caps a clamped boundary at the declared maximum-size', () => {
    const { parent, boundary } = importBoundary(`
      Adw.Clamp { maximum-size: 480; tightening-threshold: 380; $MysteryPanel form {} }
    `);
    expect(containerLayout(parent)).toMatchObject({ '--protota-clamp-max': '480px' });
    expect(boundaryGeometryFacts(boundary, parent)).toEqual([
      { property: 'max-width', value: 480, origin: 'container:Adw.Clamp.maximum-size', confidence: 'derived' },
    ]);
  });

  it('records stack-page allocation for the visible child of a stack', () => {
    const { parent, boundary } = importBoundary(`
      Gtk.Stack { visible-child-name: "panel"; $MysteryPanel panel {} }
    `);
    expect(parent.visibleChildName).toBe('panel');
    expect(boundaryGeometryFacts(boundary, parent)).toEqual([
      { property: 'allocation', value: 'stack-page', origin: 'container:GtkStack.visible-child', confidence: 'derived' },
    ]);
  });
});

describe('boundary geometry: origin and confidence (#55)', () => {
  it('labels a code-projected expand flag with a code origin', () => {
    const doc = blueprintBundleToDocument([
      {
        path: 'window.blp',
        content: `
          Adw.ApplicationWindow root {
            content: Gtk.Box {
              orientation: vertical;
              $PanelHost _panels {}
            };
          }
        `,
      },
      {
        path: 'panel-host.vala',
        content: `
public class PanelHost : Adw.Bin
{
    construct
    {
        vexpand = true;
    }
}
`,
      },
    ], 'window.blp', 'Code origin');
    const find = (node: AdwNode): AdwNode | undefined =>
      node.type === 'custom-widget' ? node : node.children?.map(find).find(Boolean);
    const boundary = find(doc.screens[0].rootNode);
    expect(boundary).toMatchObject({ sourceClass: 'PanelHost', vexpand: true });
    const facts = boundaryGeometryFacts(boundary!);
    expect(facts).toEqual(expect.arrayContaining([
      { property: 'vexpand', value: true, origin: 'code:vexpand', confidence: 'code' },
    ]));
    expect(boundaryGeometryConfidence(facts)).toBe('code');
  });

  it('keeps the honest labelled fallback when no evidence exists', () => {
    const { boundary } = importBoundary(`
      Gtk.Box { $MysteryPanel mystery {} }
    `);
    const facts = boundaryGeometryFacts(boundary);
    expect(facts).toEqual([
      { property: 'min-size', value: '48x48', origin: 'fallback:renderer-minimum', confidence: 'fallback' },
    ]);
    expect(boundaryGeometryConfidence(facts)).toBe('fallback');
  });
});
