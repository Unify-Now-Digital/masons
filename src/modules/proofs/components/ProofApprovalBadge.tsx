import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { OrderProof, ProofState } from '../types/proofs.types';

interface ProofApprovalBadgeProps {
  proof: OrderProof | null | undefined;
  size?: 'sm' | 'md';
}

interface BadgeConfig {
  label: string;
  className: string;
}

function getBadgeConfig(state: ProofState | null | undefined): BadgeConfig {
  switch (state) {
    case 'generating':
      return { label: 'Generating…', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    case 'draft':
      return { label: 'Draft', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    case 'sent':
      return { label: 'Awaiting Approval', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    case 'approved':
      return { label: 'Approved', className: 'bg-green-100 text-green-700 border-green-200' };
    case 'changes_requested':
      return { label: 'Changes Requested', className: 'bg-red-100 text-red-700 border-red-200' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200' };
    case 'not_started':
    default:
      return { label: 'No Proof', className: 'bg-slate-100 text-slate-500 border-slate-200' };
  }
}

export const ProofApprovalBadge: React.FC<ProofApprovalBadgeProps> = ({
  proof,
  size = 'sm',
}) => {
  const config = getBadgeConfig(proof?.state);

  return (
    <Badge
      variant="outline"
      className={cn(
        config.className,
        size === 'sm' && 'text-xs px-1.5 py-0',
        size === 'md' && 'text-sm px-2 py-0.5',
      )}
    >
      {config.label}
    </Badge>
  );
};
