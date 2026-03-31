import type { OrderProof } from '../types/proofs.types';

// ---------------------------------------------------------------------------
// Proof state helpers
// Each function is a pure predicate — no side effects.
// ---------------------------------------------------------------------------

/** Returns true only when state === 'approved' (the only valid Job start gate). */
export function isProofApproved(proof: OrderProof | null | undefined): boolean {
  return proof?.state === 'approved';
}

/** Returns true when the proof can be sent to the customer (state must be 'draft'). */
export function canSendProof(proof: OrderProof | null | undefined): boolean {
  return proof?.state === 'draft';
}

/** Returns true when staff can manually mark the proof as approved. */
export function canApproveProof(proof: OrderProof | null | undefined): boolean {
  return proof?.state === 'sent';
}

/** Returns true when staff can record a customer change request. */
export function canRequestChanges(proof: OrderProof | null | undefined): boolean {
  return proof?.state === 'sent';
}

/** Returns true when a new generation can be triggered. */
export function canRegenerateProof(proof: OrderProof | null | undefined): boolean {
  return (
    proof?.state === 'failed' ||
    proof?.state === 'changes_requested' ||
    proof?.state === 'draft'
  );
}
