/**
 * Opt-in review-and-approve flow for agent edits (#500).
 *
 * `protota.propose(fn)` evaluates `fn` against the live store, captures the
 * resulting document as a candidate, and rolls the live state back. Nothing
 * reaches the document or undo history until a person accepts. Accepting
 * commits exactly the reviewed candidate as one undo step, and only while the
 * live document is still the one the proposal was made against. This is
 * workflow consent, not a sandbox: in-page script can still call the store.
 */

import { create } from 'zustand';
import type { MockupDocument } from '../types/mockup';
import { useMockupStore } from '../store/mockupStore';
import { summarizeProposal, type ProposalSummary } from '../utils/proposalSummary';

export type ProposalOutcome = 'accepted' | 'rejected' | 'stale' | 'superseded';

export interface Proposal {
  id: number;
  label: string;
  base: MockupDocument;
  candidate: MockupDocument;
  summary: ProposalSummary;
}

interface ProposalState {
  pending: Proposal | null;
}

export const useProposalStore = create<ProposalState>(() => ({ pending: null }));

let nextId = 1;
const resolvers = new Map<number, (outcome: ProposalOutcome) => void>();

function settle(proposal: Proposal, outcome: ProposalOutcome): void {
  if (useProposalStore.getState().pending?.id === proposal.id) {
    useProposalStore.setState({ pending: null });
  }
  resolvers.get(proposal.id)?.(outcome);
  resolvers.delete(proposal.id);
}

export interface ProposalHandle {
  readonly id: number;
  readonly summary: ProposalSummary;
  /** Resolves once the proposal is accepted, rejected, found stale, or replaced. */
  readonly settled: Promise<ProposalOutcome>;
}

/**
 * Stage `fn`'s edits for review. Throws (and stages nothing) if `fn` throws,
 * e.g. on an illegal edit. A proposal that changes nothing is not staged.
 * A new proposal replaces a pending one, which settles as `superseded`.
 */
export function propose(fn: () => void, label = 'Agent edit'): ProposalHandle | null {
  const store = useMockupStore.getState();
  const base = store.doc;
  const candidate = store.evaluateCandidate(fn);
  if (candidate === base) return null;

  const previous = useProposalStore.getState().pending;
  if (previous) settle(previous, 'superseded');

  const proposal: Proposal = {
    id: nextId++, label, base, candidate, summary: summarizeProposal(base, candidate),
  };
  const settled = new Promise<ProposalOutcome>((resolve) => resolvers.set(proposal.id, resolve));
  useProposalStore.setState({ pending: proposal });
  return { id: proposal.id, summary: proposal.summary, settled };
}

/** Commit the pending proposal. `stale` when the document moved on: it is dropped, never applied. */
export function acceptProposal(): ProposalOutcome | null {
  const proposal = useProposalStore.getState().pending;
  if (!proposal) return null;
  const ok = useMockupStore.getState().commitCandidate(proposal.base, proposal.candidate);
  const outcome: ProposalOutcome = ok ? 'accepted' : 'stale';
  settle(proposal, outcome);
  return outcome;
}

export function rejectProposal(): boolean {
  const proposal = useProposalStore.getState().pending;
  if (!proposal) return false;
  settle(proposal, 'rejected');
  return true;
}

/**
 * A committed edit, undo, or redo invalidates the pending proposal at once.
 * Keyed on history movement, not `doc`: `evaluateCandidate` moves `doc`
 * transiently while staging a replacement proposal.
 */
useMockupStore.subscribe((state, prev) => {
  const proposal = useProposalStore.getState().pending;
  if (!proposal) return;
  if (state.history === prev.history && state.historyIndex === prev.historyIndex) return;
  if (state.doc !== proposal.base && state.doc !== proposal.candidate) settle(proposal, 'stale');
});
