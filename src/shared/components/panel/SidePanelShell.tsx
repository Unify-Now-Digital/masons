import React from 'react';
import { cn } from '@/shared/lib/utils';
import { PanelHeader } from './PanelChrome';

/**
 * The shared side-panel body: grey type-word, serif name, one primary action
 * under the name, close at the top right, and a full-height scroll with no
 * visible bar. The page (or SidePanel) supplies the 420px column.
 */
export const SidePanelShell: React.FC<{
  kicker?: React.ReactNode;
  name: string;
  action?: React.ReactNode;
  extra?: React.ReactNode;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ kicker, name, action, extra, onClose, children, className }) => (
  <div className={cn('flex h-full min-h-0 min-w-0 flex-1 flex-col', className)}>
    <PanelHeader kicker={kicker} name={name} action={action} extra={extra} onClose={onClose} />
    <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
      {children}
    </div>
  </div>
);
