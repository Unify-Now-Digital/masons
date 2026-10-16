/**
 * DrawerSection — section card for drawer form content.
 * Collapsible sections use the same header as every right-hand panel.
 */
import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { PanelSection } from '@/shared/components/panel';
import { cn } from '@/shared/lib/utils';

export interface DrawerSectionProps {
  title?: string;
  /** When true, section is collapsible. Default open when defaultOpen=true. */
  collapsible?: boolean;
  /** When collapsible, start open (true) or closed (false). */
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const DrawerSection: React.FC<DrawerSectionProps> = ({
  title,
  collapsible = false,
  defaultOpen = true,
  children,
  className,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = (title ?? 'section').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  if (collapsible && title) {
    return (
      <PanelSection id={id} title={title} icon={ClipboardList} open={open} onToggle={() => setOpen((value) => !value)} className={cn('mx-0', className)}>
        {children}
      </PanelSection>
    );
  }

  return (
    <div className={cn('rounded-lg border border-gardens-bdr bg-white px-3.5 py-3', className)}>
      {title ? <h3 className="m-0 mb-2 text-xs font-semibold text-gardens-tx">{title}</h3> : null}
      {children}
    </div>
  );
};
