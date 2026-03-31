// ---------------------------------------------------------------------------
// Proof Agent — public module surface
// ---------------------------------------------------------------------------

// Types
export type {
  OrderProof,
  ProofState,
  ProofRenderMethod,
  ProofSentVia,
  ProofApprovedBy,
  ProofGenerateRequest,
  ProofGenerateResponse,
  ProofSendRequest,
  ProofSendResponse,
} from './types/proofs.types';

// State helpers
export {
  isProofApproved,
  canSendProof,
  canApproveProof,
  canRequestChanges,
  canRegenerateProof,
} from './utils/proofState';

// Hooks
export {
  proofKeys,
  useProofByOrder,
  useProofsByOrders,
  useGenerateProof,
  useSendProof,
  useApproveProof,
  useRequestProofChanges,
} from './hooks/useProofs';

// Components
export { ProofPanel } from './components/ProofPanel';
export { ProofGenerateForm } from './components/ProofGenerateForm';
export { ProofApprovalBadge } from './components/ProofApprovalBadge';
export { ProofSendModal } from './components/ProofSendModal';
