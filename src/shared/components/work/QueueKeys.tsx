import React from 'react';
import { cn } from '@/shared/lib/utils';

/** One-line keyboard hint at the list foot; hidden below 1024px (lg). */
export const QueueKeysHint: React.FC<{ className?: string }> = ({ className }) => (
  <p data-testid="queue-keys-hint" className={cn('hidden lg:block m-0 mt-2 text-[11px] text-gardens-txm-aa', className)}>
    j/k move · enter open · a act · d done
  </p>
);
