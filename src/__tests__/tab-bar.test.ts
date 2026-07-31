import { describe, expect, it } from 'vitest';
import { blueprintImport, mockupToBlueprint } from '../utils/blueprint';
import { tabBarModel } from '../utils/tabBar';
import type { AdwNode, MockupDocument } from '../types/mockup';

/**
 * Adw.TabBar promotion (#59 Wave 1): registry mapping, tab derivation from
 * the linked Adw.TabView's declared pages, autohide semantics, and the
 * export round trip. The shape under test is the one the real apps declare
 * (Files `nautilus-window.blp`, Text Editor `editor-window.ui`): a TabBar
 * with only a `view` reference, sitting in a toolbar-view top slot beside
 * the view it presents.
 */
const snippet = `
using Gtk 4.0;
using Adw 1;

Adw.ToolbarView shell {
  [top]
  Adw.TabBar tab_bar {
    view: tab_view;
    autohide: false;
  }

  content: Adw.TabView tab_view {
    Adw.TabPage {
      title: "Home";
      child: Gtk.Label home_label { label: "Home"; };
    }

    Adw.TabPage {
      title: "Search";
      child: Gtk.Label search_label { label: "Search"; };
    }
  };
}
`;

describe('Adw.TabBar import', () => {
  it('imports AdwTabBar as a registry widget, not a boundary', () => {
    const { roots, diagnostics } = blueprintImport(snippet);
    const bar = roots[0].children?.find((child) => child.id === 'tab_bar');
    expect(bar).toMatchObject({
      type: 'tab-bar', slot: 'top', view: 'tab_view', autohide: false, sourceClass: 'Adw.TabBar',
    });
    expect(diagnostics).toEqual([]);
  });

  it('imports Adw.TabPage children of the view as stack pages', () => {
    const { roots } = blueprintImport(snippet);
    const view = roots[0].children?.find((child) => child.id === 'tab_view');
    expect(view).toMatchObject({ type: 'tab-view', slot: 'content' });
    expect(view?.children?.map((page) => ({ type: page.type, title: page.title }))).toEqual([
      { type: 'stack-page', title: 'Home' },
      { type: 'stack-page', title: 'Search' },
    ]);
  });
});

describe('tabBarModel', () => {
  const shell = (): AdwNode => blueprintImport(snippet).roots[0];
  const barOf = (root: AdwNode) => root.children!.find((child) => child.id === 'tab_bar')!;

  it('derives tabs from the linked view’s declared pages, first selected', () => {
    const root = shell();
    const model = tabBarModel(barOf(root), root);
    expect(model.viewResolved).toBe(true);
    expect(model.hidden).toBe(false);
    expect(model.tabs.map((tab) => tab.title)).toEqual(['Home', 'Search']);
  });

  it('carries a page icon when the page declares one', () => {
    const root = shell();
    const view = root.children!.find((child) => child.id === 'tab_view')!;
    view.children![0].iconName = 'folder-symbolic';
    expect(tabBarModel(barOf(root), root).tabs[0].iconName).toBe('folder-symbolic');
  });

  it('autohides with fewer than two tabs, exactly like Adw.TabBar', () => {
    const root = shell();
    const view = root.children!.find((child) => child.id === 'tab_view')!;
    view.children = [view.children![0]];
    const bar = barOf(root);
    delete bar.autohide; // GTK default: autohide = true
    expect(tabBarModel(bar, root).hidden).toBe(true);
  });

  it('stays visible with one tab when autohide is false', () => {
    const root = shell();
    const view = root.children!.find((child) => child.id === 'tab_view')!;
    view.children = [view.children![0]];
    const model = tabBarModel(barOf(root), root); // snippet declares autohide: false
    expect(model.hidden).toBe(false);
    expect(model.tabs.map((tab) => tab.title)).toEqual(['Home']);
  });

  it('keeps a finishing-pinned runtime allocation as an empty strip', () => {
    // Text Editor: the view is populated at runtime (zero declared pages);
    // the finishing file pins the strip’s 34px runtime allocation.
    const root = shell();
    const view = root.children!.find((child) => child.id === 'tab_view')!;
    view.children = [];
    const bar = barOf(root);
    delete bar.autohide;
    bar.heightRequest = 34;
    const model = tabBarModel(bar, root);
    expect(model.hidden).toBe(false);
    expect(model.tabs).toEqual([]);
  });

  it('hides a runtime-populated bar with no pinned allocation', () => {
    // Files: zero declared pages, no finishing pin — native autohides too.
    const root = shell();
    const view = root.children!.find((child) => child.id === 'tab_view')!;
    view.children = [];
    const bar = barOf(root);
    delete bar.autohide;
    expect(tabBarModel(bar, root).hidden).toBe(true);
  });

  it('falls back to a single labelled tab when no view resolves', () => {
    const bar: AdwNode = { id: 'orphan', type: 'tab-bar', children: [] };
    const model = tabBarModel(bar, undefined);
    expect(model.viewResolved).toBe(false);
    expect(model.hidden).toBe(false);
    expect(model.tabs).toEqual([{ id: 'orphan-placeholder', title: 'Tab' }]);
  });
});

describe('Adw.TabBar export', () => {
  const documentOf = (rootNode: AdwNode): MockupDocument => ({
    id: 'doc', title: 'Doc', colorScheme: 'auto', edges: [],
    screens: [{ id: 'main', title: 'Main', type: 'standard', width: 800, height: 600, rootNode }],
  });

  it('re-emits Adw.TabBar with its view reference and autohide through a round trip', () => {
    const { roots } = blueprintImport(snippet);
    const source = mockupToBlueprint(documentOf(roots[0]));
    expect(source).toContain('Adw.TabBar tab_bar {');
    expect(source).toContain('view: tab_view;');
    expect(source).toContain('autohide: false;');
    expect(source).toContain('Adw.TabPage');

    const reimported = blueprintImport(source);
    expect(reimported.diagnostics).toEqual([]);
    const bar = reimported.roots[0].children?.find((child) => child.id === 'tab_bar');
    expect(bar).toMatchObject({ type: 'tab-bar', view: 'tab_view', autohide: false });
    const view = reimported.roots[0].children?.find((child) => child.id === 'tab_view');
    expect(view?.children?.map((page) => page.title)).toEqual(['Home', 'Search']);
  });

  it('drops a view reference that names no object in the document', () => {
    const bar: AdwNode = { id: 'bar', type: 'tab-bar', view: 'missing_view', children: [] };
    const source = mockupToBlueprint(documentOf({ id: 'w', type: 'window', children: [bar] }));
    expect(source).toContain('Adw.TabBar');
    expect(source).not.toContain('missing_view');
  });
});
