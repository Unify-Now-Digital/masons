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
      return { label: 'Generating…', className: 'bg-gardens-page text-gardens-tx border-gardens-bdr' };
    case 'draft':
      return { label: 'Draft', className: 'bg-gardens-page text-gardens-tx border-gardens-bdr' };
    case 'sent':
      return { label: 'Awaiting Approval', className: 'bg-gardens-amb-lt text-gardens-amb-dk border-gardens-amb-lt' };
    case 'approved':
      return { label: 'Approved', className: 'bg-gardens-grn-lt text-gardens-grn-dk border-gardens-grn-lt' };
    case 'changes_requested':
      return { label: 'Changes Requested', className: 'bg-gardens-red-lt text-gardens-red-dk border-gardens-red-lt' };
    case 'failed':
      return { label: 'Failed', className: 'bg-gardens-red-lt text-gardens-red-dk border-gardens-red-lt' };
    case 'not_started':
    default:
      return { label: 'No Proof', className: 'bg-gardens-page text-gardens-txs border-gardens-bdr' };
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
