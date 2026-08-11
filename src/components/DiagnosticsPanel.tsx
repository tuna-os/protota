import React, { useMemo, useState } from 'react';
import { useMockupStore } from '../store/mockupStore';
import type { Diagnostic, DiagnosticTier } from '../diagnostics/types';
import { filterDiagnostics } from '../diagnostics/engine';
import { useLiveBlueprint } from '../diagnostics/useLiveBlueprint';
import {
  dialogErrorSymbolic,
  dialogWarningSymbolic,
  dialogInformationSymbolic,
} from '@gjsify/adwaita-icons/status';
import { toDataUri } from '@gjsify/adwaita-icons/utils';

const TIER_ICON: Record<DiagnosticTier, string> = {
  error: dialogErrorSymbolic,
  warning: dialogWarningSymbolic,
  suggestion: dialogInformationSymbolic,
};

const TIER_COLOR: Record<DiagnosticTier, string> = {
  error: 'var(--destructive-bg-color, #e01b24)',
  warning: '#e5a50a',
  suggestion: 'var(--accent-bg-color, #3584e4)',
};

const TIER_LABEL: Record<DiagnosticTier, string> = {
  error: 'Errors',
  warning: 'Warnings',
  suggestion: 'Suggestions',
};

const tierIconStyle = (tier: DiagnosticTier): React.CSSProperties => ({
  display: 'inline-block',
  width: '14px',
  height: '14px',
  flexShrink: 0,
  maskImage: toDataUri(TIER_ICON[tier]),
  WebkitMaskImage: toDataUri(TIER_ICON[tier]),
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  backgroundColor: TIER_COLOR[tier],
});

const cardKey = (d: Diagnostic, index: number) => `${d.ruleId}:${d.nodeId || 'doc'}:${index}`;

/**
 * Diagnostics panel (design §5.1): tier filter chips with live counts, cards
 * grouped by screen, a Source group for Blueprint diagnostics, expandable
 * citations with quick-fix / go-to / ignore actions.
 */
export const DiagnosticsPanel: React.FC = () => {
  const {
    doc,
    diagnostics,
    exportCheck,
    diagnosticsEnabled,
    tierFilters,
    ignoredRules,
    ignoredInstances,
    setTierFilter,
    ignoreRule,
    ignoreInstance,
    clearIgnores,
    applyQuickFix,
    selectNode,
    selectedNodeId,
    liveBlueprintEnabled,
    liveBlueprintStatus,
    liveBlueprintError,
    liveBlueprintDiagnostics,
    toggleLiveBlueprint,
  } = useMockupStore();

  // Live syntax tier driver (BLP-L001): only checks while this panel exists
  // and the user opted in — the Pyodide download never happens on app start.
  useLiveBlueprint();

  const [showIgnored, setShowIgnored] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ignoreMenuFor, setIgnoreMenuFor] = useState<string | null>(null);

  const all = useMemo(
    () => [...diagnostics, ...exportCheck, ...liveBlueprintDiagnostics],
    [diagnostics, exportCheck, liveBlueprintDiagnostics]);
  const higDiagnostics = all.filter((d) => d.source === 'hig');
  const blueprintDiagnostics = all.filter((d) => d.source === 'blueprint');

  const notIgnored = useMemo(
    () => filterDiagnostics(all, { error: true, warning: true, suggestion: true }, ignoredRules, ignoredInstances),
    [all, ignoredRules, ignoredInstances]);
  const visible = useMemo(
    () => filterDiagnostics(all, tierFilters, ignoredRules, ignoredInstances),
    [all, tierFilters, ignoredRules, ignoredInstances]);
  const ignored = all.filter((d) => !notIgnored.includes(d));

  if (!diagnosticsEnabled) {
    return (
      <div data-testid="diagnostics-panel" style={{ padding: '16px', opacity: 0.5, fontStyle: 'italic' }}>
        Diagnostics are off. Toggle them in the top bar (Ctrl+') to audit this
        mockup against the GNOME HIG.
      </div>
    );
  }

  const tierCount = (tier: DiagnosticTier) =>
    notIgnored.filter((d) => d.tier === tier).length;

  const renderCard = (d: Diagnostic, index: number, isIgnoredCard = false) => {
    const key = cardKey(d, index);
    const isExpanded = expanded === key;
    const anchored = !!d.nodeId;
    return (
      <div
        key={key}
        data-testid="diagnostic-card"
        data-rule-id={d.ruleId}
        data-tier={d.tier}
        className="protota-diagnostic-card"
        style={{
          borderRadius: '8px',
          border: '1px solid var(--separator-color, rgba(0,0,6,0.1))',
          marginBottom: '6px',
          background: selectedNodeId && selectedNodeId === d.nodeId
            ? 'color-mix(in srgb, var(--accent-bg-color, #3584e4) 12%, transparent)'
            : 'var(--card-bg-color, rgba(255,255,255,0.5))',
          opacity: isIgnoredCard ? 0.55 : 1,
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setExpanded(isExpanded ? null : key);
            if (anchored) selectNode(d.nodeId, d.screenId);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(isExpanded ? null : key); if (anchored) selectNode(d.nodeId, d.screenId); } }}
          style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '6px 8px', cursor: 'pointer' }}
        >
          <span style={{ ...tierIconStyle(d.tier), marginTop: '2px' }} aria-label={d.tier} />
          <span style={{ fontSize: '12px', flex: 1, minWidth: 0 }}>
            <code style={{ fontSize: '10px', opacity: 0.7, marginRight: '4px' }}>{d.ruleId}</code>
            {d.message}
          </span>
          {d.nodeType && (
            <span style={{ fontSize: '10px', opacity: 0.5, flexShrink: 0 }}>{d.nodeType}</span>
          )}
        </div>
        {isExpanded && (
          <div style={{ padding: '0 8px 8px 28px', fontSize: '11px' }}>
            {d.citation && (
              <blockquote style={{ margin: '0 0 6px 0', paddingLeft: '8px', borderLeft: `2px solid ${TIER_COLOR[d.tier]}`, opacity: 0.75 }}>
                {d.citation.excerpt}
                <div style={{ marginTop: '2px' }}>
                  <a href={d.citation.url} target="_blank" rel="noreferrer">View guideline</a>
                  <span style={{ opacity: 0.6, marginLeft: '6px' }}>({d.citation.specPath})</span>
                </div>
              </blockquote>
            )}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', position: 'relative' }}>
              {d.quickFix && !isIgnoredCard && (
                <button
                  className="adw-button"
                  data-testid="diagnostic-fix"
                  onClick={() => applyQuickFix(d)}
                  title={d.quickFix.label}
                >
                  Fix: {d.quickFix.label}
                </button>
              )}
              {anchored && (
                <button className="adw-button flat" onClick={() => selectNode(d.nodeId, d.screenId)}>
                  Go to widget
                </button>
              )}
              {!isIgnoredCard && (
                <>
                  <button
                    className="adw-button flat"
                    data-testid="diagnostic-ignore"
                    aria-expanded={ignoreMenuFor === key}
                    onClick={() => setIgnoreMenuFor(ignoreMenuFor === key ? null : key)}
                  >
                    Ignore ▾
                  </button>
                  {ignoreMenuFor === key && (
                    <div className="protota-menu-dropdown" style={{ top: '100%', right: 0, left: 'auto' }}>
                      <button
                        className="protota-menu-item"
                        data-testid="ignore-instance"
                        onClick={() => { ignoreInstance(d.ruleId, d.nodeId); setIgnoreMenuFor(null); }}
                      >
                        <span className="protota-menu-item-label">Ignore this instance</span>
                      </button>
                      <button
                        className="protota-menu-item"
                        data-testid="ignore-rule"
                        onClick={() => { ignoreRule(d.ruleId); setIgnoreMenuFor(null); }}
                      >
                        <span className="protota-menu-item-label">Disable rule {d.ruleId}</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const higVisible = visible.filter((d) => d.source === 'hig');
  const blueprintVisible = visible.filter((d) => d.source === 'blueprint');

  return (
    <div data-testid="diagnostics-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Filter row — toggle chips with live counts, like a devtools console */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
        {(['error', 'warning', 'suggestion'] as const).map((tier) => (
          <button
            key={tier}
            className={`adw-button flat${tierFilters[tier] ? ' active' : ''}`}
            data-testid={`diag-filter-${tier}`}
            data-active={tierFilters[tier] ? 'true' : undefined}
            onClick={() => setTierFilter(tier, !tierFilters[tier])}
            style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px' }}
            title={`Show or hide ${TIER_LABEL[tier].toLowerCase()}`}
          >
            <span style={tierIconStyle(tier)} />
            {TIER_LABEL[tier]} ({tierCount(tier)})
          </button>
        ))}
        <button
          className="adw-button flat"
          aria-label="Diagnostics options"
          aria-expanded={overflowOpen}
          onClick={() => setOverflowOpen((v) => !v)}
          style={{ marginLeft: 'auto', padding: '2px 8px' }}
        >
          ⋮
        </button>
        {overflowOpen && (
          <div className="protota-menu-dropdown" style={{ top: '100%', right: 0, left: 'auto' }}>
            <button
              className="protota-menu-item"
              onClick={() => { setShowIgnored((v) => !v); setOverflowOpen(false); }}
            >
              <span className="protota-menu-item-label">{showIgnored ? 'Hide ignored' : `Show ignored (${ignored.length})`}</span>
            </button>
            <button
              className="protota-menu-item"
              onClick={() => { clearIgnores(); setOverflowOpen(false); }}
            >
              <span className="protota-menu-item-label">Re-enable all rules</span>
            </button>
          </div>
        )}
      </div>

      {/* Empty state — mirrors the HIG's own placeholder pattern */}
      {higVisible.length === 0 && blueprintVisible.length === 0 && (
        <div data-testid="diagnostics-empty" style={{ textAlign: 'center', padding: '24px 8px', opacity: 0.6 }}>
          <div style={{ fontSize: '20px' }}>✓</div>
          <div style={{ fontWeight: 600, fontSize: '13px' }}>No Issues Found</div>
          <div style={{ fontSize: '11px' }}>
            {higDiagnostics.length + blueprintDiagnostics.length > 0
              ? 'Everything remaining is filtered or ignored.'
              : 'This mockup passes every enabled HIG rule.'}
          </div>
        </div>
      )}

      {/* HIG cards, grouped by screen, ordered error → warning → suggestion */}
      {doc.screens.map((screen) => {
        const forScreen = higVisible.filter((d) => d.screenId === screen.id);
        if (forScreen.length === 0) return null;
        return (
          <div key={screen.id}>
            <div className="protota-menu-section-header" style={{ padding: '2px 0' }}>
              {screen.title}
            </div>
            {forScreen.map((d, i) => renderCard(d, i))}
          </div>
        );
      })}

      {/* Source group — Blueprint diagnostics, per document (design §5.1.3),
          plus the opt-in live syntax tier (BLP-L001, design §2.3 level 3). */}
      <div data-testid="diagnostics-source-group">
        <div className="protota-menu-section-header" style={{ padding: '2px 0' }}>
          Source (Blueprint)
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap', padding: '2px 0 6px' }}>
          <button
            className={`adw-button flat${liveBlueprintEnabled ? ' active' : ''}`}
            data-testid="live-blueprint-toggle"
            data-active={liveBlueprintEnabled ? 'true' : undefined}
            onClick={toggleLiveBlueprint}
            style={{ fontSize: '11px', padding: '2px 8px' }}
            title="Parse the exported Blueprint with blueprint-compiler running in your browser. Syntax only — full GIR validation still needs a host compile."
          >
            Live syntax check
          </button>
          <span
            data-testid="live-blueprint-status"
            data-status={liveBlueprintEnabled ? liveBlueprintStatus : 'off'}
            style={{ fontSize: '10px', opacity: 0.65 }}
          >
            {!liveBlueprintEnabled
              ? 'Off — parses exported .blp in-browser (one-time ~14 MB runtime download).'
              : liveBlueprintStatus === 'loading'
                ? 'Loading Python runtime…'
                : liveBlueprintStatus === 'ready'
                  ? 'Syntax check (browser) — not a compile; GIR validation runs on the host.'
                  : liveBlueprintStatus === 'error'
                    ? `Unavailable: ${liveBlueprintError ?? 'failed to load'} — toggle to retry.`
                    : 'Starting…'}
          </span>
        </div>
        {blueprintVisible.map((d, i) => renderCard(d, i))}
      </div>

      {showIgnored && ignored.length > 0 && (
        <div data-testid="diagnostics-ignored-group">
          <div className="protota-menu-section-header" style={{ padding: '2px 0' }}>
            Ignored
          </div>
          {ignored.map((d, i) => renderCard(d, i, true))}
        </div>
      )}
    </div>
  );
};
