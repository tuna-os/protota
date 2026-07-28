import React from 'react';
import { useMockupStore } from '../store/mockupStore';
import type { LintViolation } from '../utils/higLinter';

const SEVERITY_ICON: Record<string, string> = {
  error: '🔴',
  warning: '🟡',
  info: '🔵',
};

export const AuditPanel: React.FC = () => {
  const { violations, lintEnabled, selectedNodeId, selectNode } = useMockupStore();

  if (!lintEnabled || violations.length === 0) return null;

  const bySeverity = {
    error: violations.filter(v => v.severity === 'error'),
    warning: violations.filter(v => v.severity === 'warning'),
    info: violations.filter(v => v.severity === 'info'),
  };

  const handleClickViolation = (v: LintViolation) => {
    selectNode(v.nodeId, v.screenId);
  };

  return (
    <div className="protota-audit-panel" style={{
      borderTop: '1px solid var(--separator-color, rgba(0,0,6,0.1))',
      background: 'var(--sidebar-bg-color, #ebebed)',
      maxHeight: '200px',
      overflow: 'auto',
      padding: '8px 12px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '12px', fontWeight: 600 }}>
        <span>HIG Audit: {violations.length} issues</span>
        <span style={{ color: 'var(--destructive-bg-color, #e01b24)' }}>{bySeverity.error.length} errors</span>
        <span style={{ color: '#e5a50a' }}>{bySeverity.warning.length} warnings</span>
        <span style={{ color: 'var(--accent-bg-color, #3584e4)' }}>{bySeverity.info.length} info</span>
      </div>
      {(['error', 'warning', 'info'] as const).map(severity => {
        const items = bySeverity[severity];
        if (items.length === 0) return null;
        return (
          <div key={severity} style={{ marginBottom: '4px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.5, padding: '2px 0' }}>
              {severity} ({items.length})
            </div>
            {items.slice(0, 5).map((v, i) => (
              <div
                key={`${v.ruleId}-${v.nodeId}-${i}`}
                className="protota-audit-item"
                onClick={() => handleClickViolation(v)}
                style={{
                  padding: '4px 6px', borderRadius: '4px', cursor: 'pointer',
                  fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
                  background: selectedNodeId === v.nodeId ? 'var(--accent-bg-color, #3584e4)' : 'transparent',
                  color: selectedNodeId === v.nodeId ? 'var(--accent-fg-color, #fff)' : 'inherit',
                }}
                title={v.fix || v.message}
              >
                <span style={{ flexShrink: 0 }}>{SEVERITY_ICON[v.severity]}</span>
                <code style={{ fontSize: '10px', opacity: 0.7, flexShrink: 0 }}>{v.ruleId}</code>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.message}
                </span>
                <span style={{ fontSize: '10px', opacity: 0.5, flexShrink: 0, marginLeft: 'auto' }}>
                  {v.nodeType}
                </span>
              </div>
            ))}
            {items.length > 5 && (
              <div style={{ fontSize: '11px', opacity: 0.4, padding: '2px 6px' }}>
                +{items.length - 5} more
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
