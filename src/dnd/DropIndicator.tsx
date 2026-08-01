import React from 'react';
import { useDndStore } from './dndStore';
import { useMockupStore } from '../store/mockupStore';
import { findNodeById } from '../utils/treeHelpers';
import { isOnSpacingScale } from '../utils/spacingScale';

/** Schema defaults for the containers whose `spacing` a drop inherits. */
const SPACING_DEFAULTS: Record<string, number> = { box: 12, 'wrap-box': 6 };

/**
 * Live drop preview for canvas drags (#79): an accent outline around the
 * candidate container plus an insertion caret between its children. Pure
 * editor chrome — reads transient dnd state and the DOM, mutates neither.
 * Rendered outside the transformed canvas surface so position: fixed means
 * viewport coordinates.
 */
export const DropIndicator: React.FC = () => {
  const target = useDndStore((s) => s.target);
  const doc = useMockupStore((s) => s.doc);

  if (!target) return null;
  const containerEl = document.querySelector<HTMLElement>(
    `.protota-canvas [data-node-id="${CSS.escape(target.parentId)}"]`,
  );
  if (!containerEl) return null;
  const rect = containerEl.getBoundingClientRect();

  let container = null;
  for (const screen of doc.screens) {
    container = findNodeById([screen.rootNode], target.parentId);
    if (container) break;
  }

  // Caret geometry: before the child at `index`, after the last child when
  // appending, or an inset line when the container is empty.
  const axis = container && (
    (container.type === 'box' || container.type === 'center-box' || container.type === 'wrap-box')
      ? (container.orientation === 'horizontal' ? 'x' : 'y')
      : (container.type === 'header-bar' || container.type === 'overlay-split' || container.type === 'list-box-row')
        ? 'x' : 'y'
  );
  let caret: React.CSSProperties | null = null;
  const children = container?.children ?? [];
  const childRect = (id: string) => {
    const el = document.querySelector<HTMLElement>(`.protota-canvas [data-node-id="${CSS.escape(id)}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width === 0 && r.height === 0 ? null : r;
  };
  const beforeR = target.index < children.length ? childRect(children[target.index].id) : null;
  const afterR = children.length > 0 ? childRect(children[children.length - 1].id) : null;
  if (axis === 'y') {
    const y = beforeR ? beforeR.top - 2 : afterR ? afterR.bottom + 2 : rect.top + 6;
    caret = { left: rect.left + 4, width: Math.max(rect.width - 8, 8), top: y, height: 3 };
  } else if (axis === 'x') {
    const x = beforeR ? beforeR.left - 2 : afterR ? afterR.right + 2 : rect.left + 6;
    caret = { top: rect.top + 4, height: Math.max(rect.height - 8, 8), left: x, width: 3 };
  }

  // Spacing badge (#79, penpot-study.md §5.4): the constraint model's
  // equal-spacing guide is a single number by construction — the container's
  // `spacing` the drop will inherit. Off the Adwaita scale it takes the
  // diagnostics warning tint (HIG-W001), echoing the linter, not a new rule.
  const spacing = container && container.type in SPACING_DEFAULTS
    ? Number(container.spacing ?? SPACING_DEFAULTS[container.type])
    : null;
  const spacingOffScale = spacing !== null && !isOnSpacingScale(spacing);

  const accent = 'var(--accent-bg-color, #3584e4)';
  const warning = '#e5a50a'; // matches DiagnosticsPanel's warning tier colour
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 3000 }} aria-hidden="true">
      <div
        data-testid="dnd-target-highlight"
        style={{
          position: 'fixed',
          left: rect.left - 2,
          top: rect.top - 2,
          width: rect.width + 4,
          height: rect.height + 4,
          border: `2px solid ${accent}`,
          borderRadius: 6,
          background: 'rgba(53, 132, 228, 0.08)',
        }}
      />
      {caret && (
        <div
          data-testid="dnd-insert-line"
          style={{
            position: 'fixed',
            background: spacingOffScale ? warning : accent,
            borderRadius: 2,
            ...caret,
          }}
        />
      )}
      {spacing !== null && (
        <div
          data-testid="dnd-spacing-badge"
          data-off-scale={spacingOffScale ? 'true' : 'false'}
          title={spacingOffScale ? `Spacing ${spacing}px is off the Adwaita 6/12/18/24 scale` : undefined}
          style={{
            position: 'fixed',
            left: (caret?.left as number | undefined) ?? rect.left + 4,
            top: Math.max(((caret?.top as number | undefined) ?? rect.top) - 20, 4),
            background: spacingOffScale ? warning : accent,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            lineHeight: '14px',
            padding: '0 5px',
            borderRadius: 7,
            fontFamily: 'Adwaita Mono, monospace',
          }}
        >
          {spacing}px{spacingOffScale ? ' ⚠' : ''}
        </div>
      )}
    </div>
  );
};
