import React from 'react';
import type { ContextPanelSection } from '@/shared/lib/contextPanel';
import { InfoList, type InfoRowProps } from '@/shared/components/panel/InfoRow';
import { PanelSection } from '@/shared/components/panel/PanelSection';
import type { LucideIcon } from 'lucide-react';

export interface PanelBlockProps {
  id: ContextPanelSection;
  title: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: (id: ContextPanelSection) => void;
  /** Right side of the header (count, short status). Never truncated. */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** One collapsible section card. Same trigger, radius and focus ring on every page. */
export const PanelBlock: React.FC<PanelBlockProps> = ({ id, onToggle, ...rest }) => (
  <PanelSection id={id} onToggle={(next) => onToggle(next as ContextPanelSection)} {...rest} />
);

/** Label / value rows — muted label left, value right. Wraps at 320px. */
export const FactList: React.FC<{ rows: { label: string; value: React.ReactNode }[] }> = ({ rows }) => (
  <InfoList rows={rows as InfoRowProps[]} />
);
