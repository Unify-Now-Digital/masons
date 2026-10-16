import React from 'react';
import { SidePanel } from '@/shared/components/panel/SidePanel';

/**
 * Below 1024px the panel is a full-screen sheet.
 * From 1024px it is a right rail. Pages keep the list visible with a matching right margin — no scrim.
 */
export const PanelShell: React.FC<{
  mode: 'dock' | 'overlay';
  label: string;
  testId?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ mode, label, testId, children, className }) => (
  <SidePanel mode={mode} label={label} testId={testId} className={className}>
    {children}
  </SidePanel>
);
