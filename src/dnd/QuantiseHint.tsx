import React, { useEffect } from 'react';
import { useDndStore } from './dndStore';
import { useMockupStore } from '../store/mockupStore';

/**
 * Post-drop spacing quantise (#79, penpot-study.md §5): when a drop lands in
 * a `box` whose explicit `spacing` sits off the Adwaita scale — exactly the
 * condition HIG-W001 warns about — offer the diagnostic's own fix as a
 * transient chip (recorded by `noteDropQuantise` in ./quantise). Applying it
 * is one `updateNodeProps`, so one undo step, identical to pressing the
 * quick fix in the diagnostics panel.
 */

const AUTO_DISMISS_MS = 8000;

export const QuantiseHintChip: React.FC = () => {
  const hint = useDndStore((s) => s.quantiseHint);
  const setQuantiseHint = useDndStore((s) => s.setQuantiseHint);
  const updateNodeProps = useMockupStore((s) => s.updateNodeProps);

  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setQuantiseHint(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [hint, setQuantiseHint]);

  if (!hint) return null;
  return (
    <div
      data-testid="quantise-hint"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 48,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 999,
        background: 'var(--headerbar-bg-color, #303030)',
        color: 'var(--headerbar-fg-color, #fff)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        fontSize: 12,
        zIndex: 3200,
      }}
    >
      <span>
        <span style={{ color: '#e5a50a', fontWeight: 700 }}>{hint.spacing}px</span>
        {' '}spacing is off the Adwaita scale
      </span>
      <button
        className="adw-button"
        data-testid="quantise-apply"
        onClick={() => {
          updateNodeProps(hint.parentId, { spacing: hint.nearest });
          setQuantiseHint(null);
        }}
      >
        Set to {hint.nearest}px
      </button>
      <button
        className="adw-button flat"
        data-testid="quantise-dismiss"
        aria-label="Dismiss spacing suggestion"
        onClick={() => setQuantiseHint(null)}
      >
        ✕
      </button>
    </div>
  );
};
