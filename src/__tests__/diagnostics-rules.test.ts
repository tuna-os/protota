import { describe, expect, it } from 'vitest';
import type { AdwNode, MockupDocument } from '../types/mockup';
import { runHigRules, runDiagnostics } from '../diagnostics/engine';
import { mapImportDiagnostics } from '../diagnostics/blueprintSource';
import { ALL_HIG_RULES } from '../diagnostics/rules';

/**
 * The HIG rule catalog (#95): one positive and one negative case per rule.
 * The engine is pure — no store, no DOM — so trees are built directly.
 */

let nextId = 0;
function n(type: AdwNode['type'], props: Partial<AdwNode> = {}, children?: AdwNode[]): AdwNode {
  return { id: `n${nextId++}`, type, ...(children ? { children } : {}), ...props };
}

function doc(rootNode: AdwNode, width = 900): MockupDocument {
  return {
    id: 'doc-test',
    title: 'Test',
    edges: [],
    colorScheme: 'auto',
    screens: [{ id: 's1', title: 'Screen 1', type: 'standard', width, height: 650, rootNode }],
  };
}

const ids = (d: MockupDocument) => runHigRules(d).map((x) => x.ruleId);
const only = (d: MockupDocument, ruleId: string) =>
  runHigRules(d).filter((x) => x.ruleId === ruleId);

describe('rule catalog metadata', () => {
  it('every rule carries a corpus citation with excerpt and upstream URL', () => {
    for (const rule of ALL_HIG_RULES) {
      expect(rule.citation.specPath, rule.id).toMatch(/^docs\/spec\//);
      expect(rule.citation.url, rule.id).toMatch(/^https:\/\/developer\.gnome\.org\/hig/);
      expect(rule.citation.excerpt.length, rule.id).toBeGreaterThan(20);
    }
  });

  it('rule ids are unique', () => {
    const all = ALL_HIG_RULES.map((r) => r.id);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('HIG-E001 window minimum width', () => {
  it('flags a window narrower than 360px with a screen-props quick fix', () => {
    const matches = only(doc(n('window'), 320), 'HIG-E001');
    expect(matches).toHaveLength(1);
    expect(matches[0].tier).toBe('error');
    expect(matches[0].quickFix).toMatchObject({ kind: 'set-screen-props', props: { width: 360 } });
  });
  it('accepts a 360px window', () => {
    expect(only(doc(n('window'), 360), 'HIG-E001')).toHaveLength(0);
  });
});

describe('HIG-E002 icon-only button without label/tooltip', () => {
  it('flags an icon-only button and seeds a label from the icon name', () => {
    const matches = only(doc(n('window', {}, [n('button', { iconName: 'open-menu-symbolic' })])), 'HIG-E002');
    expect(matches).toHaveLength(1);
    expect(matches[0].quickFix).toMatchObject({ kind: 'set-props', props: { title: 'Open Menu' } });
  });
  it('accepts a labelled or tooltipped icon button', () => {
    expect(only(doc(n('window', {}, [n('button', { iconName: 'x-symbolic', title: 'X' })])), 'HIG-E002')).toHaveLength(0);
    expect(only(doc(n('window', {}, [n('button', { iconName: 'x-symbolic', tooltipText: 'X' })])), 'HIG-E002')).toHaveLength(0);
  });
});

describe('HIG-E003 alert dialog button count', () => {
  it('flags zero and more-than-three buttons', () => {
    expect(only(doc(n('alert-dialog')), 'HIG-E003')).toHaveLength(1);
    const four = n('alert-dialog', {}, [1, 2, 3, 4].map((i) => n('button', { title: `B${i}` })));
    expect(only(doc(four), 'HIG-E003')).toHaveLength(1);
  });
  it('accepts one to three buttons', () => {
    const two = n('alert-dialog', {}, [n('button', { title: 'Cancel' }), n('button', { title: 'Save' })]);
    expect(only(doc(two), 'HIG-E003')).toHaveLength(0);
  });
});

describe('HIG-E004 nested submenu', () => {
  it('flags a menu-button nested inside a popover menu', () => {
    const tree = n('window', {}, [
      n('menu-button', { iconName: 'open-menu-symbolic', tooltipText: 'Menu' }, [
        n('popover', {}, [n('box', {}, [n('menu-button', { title: 'More' })])]),
      ]),
    ]);
    const matches = only(doc(tree), 'HIG-E004');
    expect(matches).toHaveLength(1);
    expect(matches[0].nodeType).toBe('menu-button');
  });
  it('accepts a menu-button with its own direct popover', () => {
    const tree = n('window', {}, [
      n('menu-button', { iconName: 'open-menu-symbolic', tooltipText: 'Menu' }, [
        n('popover', {}, [n('box')]),
      ]),
    ]);
    expect(only(doc(tree), 'HIG-E004')).toHaveLength(0);
  });
});

describe('HIG-W001 spacing scale', () => {
  it('flags off-scale spacing and fixes to the nearest scale step', () => {
    const matches = only(doc(n('box', { spacing: 13 })), 'HIG-W001');
    expect(matches).toHaveLength(1);
    expect(matches[0].quickFix).toMatchObject({ kind: 'set-props', props: { spacing: 12 } });
  });
  it('accepts on-scale spacing', () => {
    expect(only(doc(n('box', { spacing: 12 })), 'HIG-W001')).toHaveLength(0);
  });
});

describe('HIG-W002 header bar title widget', () => {
  it('flags a header bar without a title widget and offers to add one', () => {
    const matches = only(doc(n('window', {}, [n('header-bar')])), 'HIG-W002');
    expect(matches).toHaveLength(1);
    expect(matches[0].quickFix).toMatchObject({ kind: 'add-child', childType: 'window-title' });
  });
  it('accepts a header bar with a window-title or view-switcher', () => {
    expect(only(doc(n('window', {}, [n('header-bar', {}, [n('window-title', { title: 'App' })])])), 'HIG-W002')).toHaveLength(0);
    expect(only(doc(n('window', {}, [n('header-bar', {}, [n('view-switcher')])])), 'HIG-W002')).toHaveLength(0);
  });
});

describe('HIG-W003 destructive action confirmation', () => {
  it('flags a destructive button outside an alert dialog', () => {
    expect(only(doc(n('window', {}, [n('box', {}, [n('button', { title: 'Delete', destructive: true })])])), 'HIG-W003')).toHaveLength(1);
  });
  it('accepts a destructive button inside an alert dialog', () => {
    const tree = n('alert-dialog', {}, [n('button', { title: 'Delete', destructive: true })]);
    expect(only(doc(tree), 'HIG-W003')).toHaveLength(0);
  });
});

describe('HIG-W004 view switcher page count', () => {
  const stack = (count: number) => n('view-stack', {}, Array.from({ length: count }, (_, i) => n('box', { title: `P${i}` })));
  it('flags more than five pages', () => {
    expect(only(doc(n('window', {}, [stack(6)])), 'HIG-W004')).toHaveLength(1);
  });
  it('flags fewer than three pages when a view switcher presents them', () => {
    const tree = n('window', {}, [n('header-bar', {}, [n('view-switcher')]), stack(2)]);
    expect(only(doc(tree), 'HIG-W004')).toHaveLength(1);
  });
  it('accepts 3–5 pages, and small stacks without a switcher', () => {
    expect(only(doc(n('window', {}, [stack(4)])), 'HIG-W004')).toHaveLength(0);
    expect(only(doc(n('window', {}, [stack(2)])), 'HIG-W004')).toHaveLength(0);
  });
});

describe('HIG-W005 single accented button per view', () => {
  it('flags the extra suggested/destructive buttons', () => {
    const tree = n('window', {}, [
      n('box', {}, [n('button', { title: 'Save', suggested: true }), n('button', { title: 'Apply', suggested: true })]),
    ]);
    expect(only(doc(tree), 'HIG-W005')).toHaveLength(1);
  });
  it('accepts a single suggested button', () => {
    expect(only(doc(n('window', {}, [n('button', { title: 'Save', suggested: true })])), 'HIG-W005')).toHaveLength(0);
  });
});

describe('HIG-W006 header bar button styles', () => {
  it('flags text-only and accented buttons in a primary window header bar', () => {
    const tree = n('window', {}, [n('header-bar', {}, [
      n('window-title', { title: 'App' }),
      n('button', { title: 'Save', suggested: true }),
    ])]);
    expect(only(doc(tree), 'HIG-W006')).toHaveLength(1);
  });
  it('accepts icon buttons in a window header bar and any style in a dialog', () => {
    const win = n('window', {}, [n('header-bar', {}, [n('button', { iconName: 'open-menu-symbolic', tooltipText: 'Menu' })])]);
    expect(only(doc(win), 'HIG-W006')).toHaveLength(0);
    const dialog = n('dialog', {}, [n('header-bar', {}, [n('button', { title: 'Save', suggested: true })])]);
    expect(only(doc(dialog), 'HIG-W006')).toHaveLength(0);
  });
});

describe('HIG-W007 content buttons with icon and label', () => {
  it('flags an icon+label button outside a header bar', () => {
    expect(only(doc(n('window', {}, [n('box', {}, [n('button', { title: 'Open', iconName: 'document-open-symbolic' })])])), 'HIG-W007')).toHaveLength(1);
  });
  it('accepts icon+label inside a header bar', () => {
    const tree = n('window', {}, [n('header-bar', {}, [n('button', { title: 'Open', iconName: 'document-open-symbolic' })])]);
    expect(only(doc(tree), 'HIG-W007')).toHaveLength(0);
  });
});

describe('HIG-W008 menu size', () => {
  const menu = (items: number) => n('window', {}, [
    n('menu-button', { iconName: 'open-menu-symbolic', tooltipText: 'Menu' }, [
      n('popover', {}, [n('list-box', {}, Array.from({ length: items }, (_, i) => n('button', { title: `Item ${i}` })))]),
    ]),
  ]);
  it('flags a menu with fewer than three items', () => {
    expect(only(doc(menu(2)), 'HIG-W008')).toHaveLength(1);
  });
  it('accepts 3–12 items and unmodelled (empty) menus', () => {
    expect(only(doc(menu(5)), 'HIG-W008')).toHaveLength(0);
    expect(only(doc(menu(0)), 'HIG-W008')).toHaveLength(0);
  });
});

describe('HIG-W009 generic affirmative dialog button', () => {
  it('flags OK/Done/Yes on a suggested dialog button', () => {
    const tree = n('dialog', {}, [n('box', {}, [n('button', { title: 'OK', suggested: true })])]);
    expect(only(doc(tree), 'HIG-W009')).toHaveLength(1);
  });
  it('accepts a specific imperative verb', () => {
    const tree = n('dialog', {}, [n('box', {}, [n('button', { title: 'Save', suggested: true })])]);
    expect(only(doc(tree), 'HIG-W009')).toHaveLength(0);
  });
});

describe('HIG-W010 confirmation without cancel', () => {
  it('flags a multi-button alert dialog with no Cancel', () => {
    const tree = n('alert-dialog', {}, [n('button', { title: 'Keep' }), n('button', { title: 'Delete', destructive: true })]);
    expect(only(doc(tree), 'HIG-W010')).toHaveLength(1);
  });
  it('accepts a Cancel button or a single-button alert', () => {
    const withCancel = n('alert-dialog', {}, [n('button', { title: 'Cancel' }), n('button', { title: 'Delete', destructive: true })]);
    expect(only(doc(withCancel), 'HIG-W010')).toHaveLength(0);
    expect(only(doc(n('alert-dialog', {}, [n('button', { title: 'Dismiss' })])), 'HIG-W010')).toHaveLength(0);
  });
});

describe('HIG-W011 text fields need placeholder or label', () => {
  it('flags a bare entry', () => {
    expect(only(doc(n('window', {}, [n('box', {}, [n('entry')])])), 'HIG-W011')).toHaveLength(1);
  });
  it('accepts a placeholder or an adjacent label', () => {
    expect(only(doc(n('window', {}, [n('box', {}, [n('entry', { placeholder: 'Name' })])])), 'HIG-W011')).toHaveLength(0);
    const labelled = n('window', {}, [n('box', {}, [n('label', { title: 'Name' }), n('entry')])]);
    expect(only(doc(labelled), 'HIG-W011')).toHaveLength(0);
  });
});

describe('HIG-W012 empty status page', () => {
  it('flags a status page missing icon or title', () => {
    expect(only(doc(n('status-page', { title: 'Nothing Here' })), 'HIG-W012')).toHaveLength(1);
  });
  it('accepts a status page with icon and title', () => {
    expect(only(doc(n('status-page', { title: 'Nothing Here', iconName: 'system-search-symbolic' })), 'HIG-W012')).toHaveLength(0);
  });
});

describe('HIG-W013 Quit/Close in a primary menu', () => {
  const menuWith = (label: string) => n('window', {}, [n('header-bar', {}, [
    n('window-title', { title: 'App' }),
    n('menu-button', { iconName: 'open-menu-symbolic', tooltipText: 'Menu' }, [
      n('popover', {}, [n('list-box', {}, [
        n('button', { title: 'Preferences' }), n('button', { title: 'About' }), n('button', { title: label }),
      ])]),
    ]),
  ])]);
  it('flags a Quit item', () => {
    expect(only(doc(menuWith('Quit')), 'HIG-W013')).toHaveLength(1);
  });
  it('accepts a menu without Quit/Close', () => {
    expect(only(doc(menuWith('Help')), 'HIG-W013')).toHaveLength(0);
  });
});

describe('HIG-W014 crowded header bar', () => {
  const bar = (buttons: number) => n('window', {}, [n('header-bar', {}, [
    ...Array.from({ length: buttons }, (_, i) => n('button', { iconName: `icon-${i}`, tooltipText: `B${i}` })),
    n('window-title', { title: 'App' }),
  ])]);
  it('flags more than six controls on one side', () => {
    expect(only(doc(bar(7)), 'HIG-W014')).toHaveLength(1);
  });
  it('accepts up to six controls per side', () => {
    expect(only(doc(bar(4)), 'HIG-W014')).toHaveLength(0);
  });
});

describe('HIG-S001 Header Case for control titles', () => {
  it('flags a lowercase button title', () => {
    expect(only(doc(n('window', {}, [n('button', { title: 'save file' })])), 'HIG-S001')).toHaveLength(1);
  });
  it('accepts Header Case', () => {
    expect(only(doc(n('window', {}, [n('button', { title: 'Save File' })])), 'HIG-S001')).toHaveLength(0);
  });
});

describe('HIG-S002 ellipsis character', () => {
  it('flags "..." and fixes it to "…"', () => {
    const matches = only(doc(n('window', {}, [n('button', { title: 'Save As...' })])), 'HIG-S002');
    expect(matches).toHaveLength(1);
    expect(matches[0].quickFix).toMatchObject({ kind: 'set-props', props: { title: 'Save As…' } });
  });
  it('accepts the single ellipsis character', () => {
    expect(only(doc(n('window', {}, [n('button', { title: 'Save As…' })])), 'HIG-S002')).toHaveLength(0);
  });
});

describe('HIG-S003 trailing periods', () => {
  it('flags a heading ending in a period and strips it', () => {
    const matches = only(doc(n('window', {}, [n('action-row', { title: 'Enable Feature.' })])), 'HIG-S003');
    expect(matches).toHaveLength(1);
    expect(matches[0].quickFix).toMatchObject({ kind: 'set-props', props: { title: 'Enable Feature' } });
  });
  it('accepts headings without a period and body-text labels', () => {
    expect(only(doc(n('window', {}, [n('action-row', { title: 'Enable Feature' })])), 'HIG-S003')).toHaveLength(0);
    expect(only(doc(n('window', {}, [n('label', { title: 'A full sentence.' })])), 'HIG-S003')).toHaveLength(0);
  });
});

describe('HIG-S004 no ellipsis on Preferences/Properties', () => {
  it('flags "Preferences…" and renames it', () => {
    const matches = only(doc(n('window', {}, [n('button', { title: 'Preferences…' })])), 'HIG-S004');
    expect(matches).toHaveLength(1);
    expect(matches[0].quickFix).toMatchObject({ kind: 'set-props', props: { title: 'Preferences' } });
  });
  it('accepts other ellipsised actions', () => {
    expect(only(doc(n('window', {}, [n('button', { title: 'Save As…' })])), 'HIG-S004')).toHaveLength(0);
  });
});

describe('HIG-S005 unclamped content at desktop widths', () => {
  const longLabel = () => n('label', { title: 'A long paragraph of body text that will span the full window width unclamped.' });
  it('flags long unclamped text on a wide screen', () => {
    expect(only(doc(n('window', {}, [n('box', {}, [longLabel()])]), 900), 'HIG-S005')).toHaveLength(1);
  });
  it('accepts clamped text and narrow screens', () => {
    expect(only(doc(n('window', {}, [n('clamp', {}, [longLabel()])]), 900), 'HIG-S005')).toHaveLength(0);
    expect(only(doc(n('window', {}, [n('box', {}, [longLabel()])]), 500), 'HIG-S005')).toHaveLength(0);
  });
});

describe('HIG-S006 primary menu button icon', () => {
  const bar = (iconName: string) => n('window', {}, [n('header-bar', {}, [
    n('window-title', { title: 'App' }),
    n('menu-button', { iconName, tooltipText: 'Menu' }),
  ])]);
  it('flags a non-standard primary menu icon and fixes it', () => {
    const matches = only(doc(bar('view-list-symbolic')), 'HIG-S006');
    expect(matches).toHaveLength(1);
    expect(matches[0].quickFix).toMatchObject({ kind: 'set-props', props: { iconName: 'open-menu-symbolic' } });
  });
  it('accepts open-menu-symbolic and the secondary view-more-symbolic', () => {
    expect(only(doc(bar('open-menu-symbolic')), 'HIG-S006')).toHaveLength(0);
    expect(only(doc(bar('view-more-symbolic')), 'HIG-S006')).toHaveLength(0);
  });
});

describe('Blueprint source diagnostics (BLP-W001/S001/S002)', () => {
  it('maps recorded ImportDiagnostics into the unified model with correct tiers', () => {
    const d = doc(n('window', {}, [n('custom-widget', { sourceClass: 'GtkSourceView' })]));
    d.importDiagnostics = [
      { code: 'template-not-in-bundle', sourceClass: 'MyWidget', message: '$MyWidget has no template in the bundle' },
      { code: 'renderer-does-not-support-class', sourceClass: 'GtkSourceView', message: 'GtkSourceView survives as a custom-widget boundary' },
      { code: 'static-source-expansion', sourceClass: 'MathButtons', message: 'MathButtons projected from source facts' },
    ];
    const mapped = mapImportDiagnostics(d);
    expect(mapped.map((m) => [m.ruleId, m.tier, m.source])).toEqual([
      ['BLP-W001', 'warning', 'blueprint'],
      ['BLP-S001', 'suggestion', 'blueprint'],
      ['BLP-S002', 'suggestion', 'blueprint'],
    ]);
    // The BLP-S001 entry anchors to the live custom-widget node.
    expect(mapped[1].nodeId).not.toBe('');
    expect(mapped[1].nodeType).toBe('custom-widget');
    // Unanchored entries stay document-level.
    expect(mapped[0].nodeId).toBe('');
    // runDiagnostics folds both sources into one report.
    const allIds = runDiagnostics(d).map((x) => x.ruleId);
    expect(allIds).toEqual(expect.arrayContaining(['BLP-W001', 'BLP-S001', 'BLP-S002']));
  });

  it('produces nothing for a document without import diagnostics', () => {
    expect(mapImportDiagnostics(doc(n('window')))).toHaveLength(0);
  });
});

describe('clean document', () => {
  it('the standard app template passes every rule', () => {
    const tree = n('window', {}, [
      n('toolbar-view', {}, [
        n('header-bar', { title: 'My App' }, [n('window-title', { title: 'My App' })]),
        n('box', { orientation: 'vertical', spacing: 12 }, [
          n('clamp', {}, [n('label', { title: 'Welcome to your mockup' })]),
        ]),
      ]),
    ]);
    expect(ids(doc(tree))).toEqual([]);
  });
});
