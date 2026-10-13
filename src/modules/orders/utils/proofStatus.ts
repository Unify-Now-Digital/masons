import type { Order } from '../types/orders.types';

export type ProofStatus = Order['proof_status'];

/**
 * Picker and filter options, in Arin's order (2026-10-13). In_Progress is a legacy
 * value: still valid on rows (CHECK + schema), shown read-only, never offered.
 */
export const PROOF_STATUSES: ProofStatus[] = ['NA', 'Not_Received', 'Received', 'Sent', 'Revision', 'Approved', 'Lettered'];

export const isOfferedProofStatus = (status: string): boolean =>
  (PROOF_STATUSES as string[]).includes(status);

export const getProofVariant = (status: string): 'green' | 'amber' | 'blue' | 'red' | 'grey' => {
  switch (status) {
    case 'Approved': return 'green';
    case 'Lettered': return 'green';
    case 'Sent': return 'amber';
    case 'Revision': return 'amber';
    case 'In_Progress': return 'amber';
    case 'Received': return 'blue';
    case 'Not_Received': return 'red';
    default: return 'grey';
  }
};

export const formatProofLabel = (status: string): string => {
  switch (status) {
    case 'Not_Received': return 'Not received';
    case 'In_Progress': return 'In progress';
    default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
};
