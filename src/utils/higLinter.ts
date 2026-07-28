import type { MockupDocument, AdwNode, AdwNodeType } from '../types/mockup';

export type Severity = 'error' | 'warning' | 'info';

export interface LintViolation {
  ruleId: string;
  severity: Severity;
  message: string;
  fix?: string;
  screenId: string;
  nodeId: string;
  nodeType: AdwNodeType;
}

type LintRule = (doc: MockupDocument, screenId: string, node: AdwNode) => LintViolation[];

const SPACING_SCALE = new Set([0, 3, 4, 6, 8, 10, 12, 18, 24, 32, 36, 40, 48]);

const rules: LintRule[] = [
  // === Errors ===
  function checkWindowMinWidth(_doc, screenId, node) {
    const v: LintViolation[] = [];
    if (node.type === 'window') {
      const screen = _doc.screens.find(s => s.id === screenId);
      if (screen && screen.width < 360) {
        v.push({ ruleId: 'HIG-E001', severity: 'error', screenId, nodeId: node.id, nodeType: node.type,
          message: `Window width ${screen.width}px < 360px minimum (HIG)`,
          fix: 'Set width-request to at least 360px' });
      }
    }
    return v;
  },

  function checkIconButtonHasTooltip(_doc, screenId, node) {
    const v: LintViolation[] = [];
    if (node.type === 'button' && node.iconName && !node.title) {
      v.push({ ruleId: 'HIG-E002', severity: 'error', screenId, nodeId: node.id, nodeType: node.type,
        message: 'Icon-only button missing label/tooltip — inaccessible',
        fix: 'Add a title (label) or set tooltip-text' });
    }
    return v;
  },

  // === Warnings ===
  function checkSpacingScale(_doc, screenId, node) {
    const v: LintViolation[] = [];
    if (node.type === 'box' && node.spacing !== undefined) {
      const s = Number(node.spacing);
      if (!SPACING_SCALE.has(s)) {
        const nearest = [...SPACING_SCALE].reduce((a, b) =>
          Math.abs(b - s) < Math.abs(a - s) ? b : a);
        v.push({ ruleId: 'HIG-W001', severity: 'warning', screenId, nodeId: node.id, nodeType: node.type,
          message: `Spacing ${s}px not on HIG scale — use ${nearest}px`,
          fix: `Set spacing to ${nearest}px (6/12/18/24 scale)` });
      }
    }
    return v;
  },

  function checkHeaderHasTitle(_doc, screenId, node) {
    const v: LintViolation[] = [];
    if (node.type === 'header-bar') {
      const hasTitle = (node.children || []).some(c =>
        c.type === 'window-title' || c.type === 'view-switcher');
      if (!hasTitle) {
        v.push({ ruleId: 'HIG-W002', severity: 'warning', screenId, nodeId: node.id, nodeType: node.type,
          message: 'Header bar has no AdwWindowTitle or ViewSwitcher',
          fix: 'Add a window-title or view-switcher child' });
      }
    }
    return v;
  },

  function checkDestructiveButtonContext(_doc, screenId, node) {
    const v: LintViolation[] = [];
    if (node.type === 'button' && node.destructive) {
      // Navigate up to find if we're inside an alert-dialog
      let safe = false;
      const findParent = (nodes: AdwNode[], targetId: string): AdwNode | null => {
        for (const n of nodes) {
          if (n.children?.some(c => c.id === targetId)) return n;
          if (n.children) { const r = findParent(n.children, targetId); if (r) return r; }
        }
        return null;
      };
      for (const screen of _doc.screens) {
        let parent = findParent([screen.rootNode], node.id);
        while (parent) {
          if (parent.type === 'alert-dialog') { safe = true; break; }
          parent = findParent([screen.rootNode], parent.id);
        }
      }
      if (!safe) {
        v.push({ ruleId: 'HIG-W003', severity: 'warning', screenId, nodeId: node.id, nodeType: node.type,
          message: 'Destructive button outside confirmation dialog',
          fix: 'Move destructive button into an alert-dialog context' });
      }
    }
    return v;
  },

  function checkViewSwitcherTabCount(_doc, screenId, node) {
    const v: LintViolation[] = [];
    if (node.type === 'toolbar-view') {
      const stackChildren = node.children?.filter(c => c.type === 'view-stack') || [];
      for (const vs of stackChildren) {
        const pageCount = (vs.children || []).length;
        if (pageCount > 5) {
          v.push({ ruleId: 'HIG-W004', severity: 'warning', screenId, nodeId: vs.id, nodeType: vs.type,
            message: `ViewSwitcher has ${pageCount} pages (HIG recommends 3-5)`,
            fix: 'Reduce to 3-5 pages or use AdwTabView instead' });
        }
      }
    }
    return v;
  },

  // === Info ===
  function checkLabelCasing(_doc, screenId, node) {
    const v: LintViolation[] = [];
    const titleTextWidgets: AdwNodeType[] = ['button', 'action-row', 'switch-row',
      'combo-row', 'spin-row', 'button-row', 'preferences-group', 'tab-view'];
    if (titleTextWidgets.includes(node.type) && node.title && node.title.length > 0) {
      // Check if first letter of each word is capitalized (Header Case)
      const words = node.title.split(/\s+/);
      const hasLowerCase = words.some(w => w.length > 1 && w[0] === w[0].toLowerCase() && w[0] !== w[0].toUpperCase());
      if (hasLowerCase && !node.title.includes('…') && node.title.length > 3) {
        v.push({ ruleId: 'HIG-I001', severity: 'info', screenId, nodeId: node.id, nodeType: node.type,
          message: `"${node.title}" should use Header Case for ${node.type} title`,
          fix: `Capitalize: "${words.map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}"` });
      }
    }
    return v;
  },

  function checkEllipsisCharacter(_doc, screenId, node) {
    const v: LintViolation[] = [];
    const fields: (keyof AdwNode)[] = ['title', 'subtitle', 'description', 'placeholder'];
    for (const field of fields) {
      const val = node[field];
      if (typeof val === 'string' && val.includes('...')) {
        v.push({ ruleId: 'HIG-I002', severity: 'info', screenId, nodeId: node.id, nodeType: node.type,
          message: `"..." should be "…" (ellipsis character) in ${node.type} ${field}`,
          fix: val.replace(/\.\.\./g, '…') });
      }
    }
    return v;
  },
];

/**
 * Run all HIG lint rules against the document and return violations.
 */
export function lintDocument(doc: MockupDocument): LintViolation[] {
  const results: LintViolation[] = [];

  function walk(node: AdwNode, screenId: string) {
    for (const rule of rules) {
      results.push(...rule(doc, screenId, node));
    }
    if (node.children) {
      for (const child of node.children) walk(child, screenId);
    }
  }

  for (const screen of doc.screens) {
    walk(screen.rootNode, screen.id);
  }

  return results;
}

/**
 * Get violations for a specific screen + node combination.
 */
export function getViolationsForNode(
  violations: LintViolation[],
  screenId: string,
  nodeId: string,
): LintViolation[] {
  return violations.filter(v => v.screenId === screenId && v.nodeId === nodeId);
}
