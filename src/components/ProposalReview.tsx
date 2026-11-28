import React from 'react';
import { useProposalStore, acceptProposal, rejectProposal } from '../runtime/proposals';
import { AdwaitaRenderer } from './AdwaitaRenderer';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import { breakpointOverrides } from '../utils/breakpoints';

const PREVIEW_WIDTH = 320;

/** Review card for an agent proposal (#500): summary, candidate preview, accept/reject. */
export const ProposalReview: React.FC = () => {
  const proposal = useProposalStore((s) => s.pending);
  if (!proposal) return null;

  const { changes } = proposal.summary;
  const previewChange = changes.find((c) => c.kind !== 'removed');
  const screen = previewChange
    ? proposal.candidate.screens.find((s) => s.id === previewChange.screenId)
    : undefined;
  const scale = screen ? Math.min(1, PREVIEW_WIDTH / screen.width) : 1;

  return (
    <aside
      role="dialog"
      aria-label="Review proposed changes"
      data-testid="proposal-review"
      style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 1000, width: PREVIEW_WIDTH + 32,
        padding: 16, borderRadius: 12, background: 'var(--window-bg-color, #fff)',
        color: 'var(--window-fg-color, #000)', boxShadow: '0 4px 24px rgba(0,0,0,.35)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <strong data-testid="proposal-label">{proposal.label}</strong>
      <ul data-testid="proposal-summary" style={{ margin: 0, paddingLeft: 18 }}>
        {changes.map((c) => (
          <li key={c.screenId}>
            {c.title}: {c.kind}
            {c.nodesAdded > 0 && `, +${c.nodesAdded}`}
            {c.nodesRemoved > 0 && `, -${c.nodesRemoved}`}
            {c.nodesChanged > 0 && `, ~${c.nodesChanged}`}
          </li>
        ))}
      </ul>
      {screen && (
        <div
          data-testid="proposal-preview"
          style={{ width: PREVIEW_WIDTH, height: screen.height * scale, overflow: 'hidden', pointerEvents: 'none' }}
        >
          <div style={{ width: screen.width, height: screen.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <CanvasErrorBoundary resetKey={proposal.id}>
              <AdwaitaRenderer
                node={screen.rootNode}
                screenId={screen.id}
                screenWidth={screen.width}
                screenHeight={screen.height}
                overrides={breakpointOverrides(screen.rootNode, screen.width, screen.height)}
              />
            </CanvasErrorBoundary>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" data-testid="proposal-reject" onClick={() => rejectProposal()}>Reject</button>
        <button type="button" data-testid="proposal-accept" onClick={() => acceptProposal()}>Accept</button>
      </div>
    </aside>
  );
};
