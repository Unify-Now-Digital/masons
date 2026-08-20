/**
 * AppDrawerLayout - Shared layout for create/edit drawers.
 * Sticky header (title, description, close), scrollable body, sticky footer (Cancel + Primary).
 * Use inside DrawerContent. Width: w-[720px] max-w-[90vw] desktop, full on mobile.
 */
import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { DrawerTitle, DrawerDescription } from '@/shared/components/ui/drawer';

export interface AppDrawerLayoutProps {
  title: string;
  description?: string;
  primaryLabel: string;
  primaryDisabled?: boolean;
  /** When 'submit', primary button is type="submit" (form handles it). When 'button', uses onClick. */
  primaryType?: 'button' | 'submit';
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary: () => void;
  onClose?: () => void;
  children: React.ReactNode;
  bodyMaxWidth?: boolean;
  className?: string;
}

export const AppDrawerLayout: React.FC<AppDrawerLayoutProps> = ({
  title,
  description,
  primaryLabel,
  primaryDisabled,
  primaryType = 'button',
  onPrimary,
  secondaryLabel = 'Cancel',
  onSecondary,
  onClose,
  children,
  bodyMaxWidth = true,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-h-0 w-full max-w-[720px]',
        className
      )}
    >
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b shrink-0 px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Accessible dialog labelling for Radix Drawer (screen-reader only) */}
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          {description && (
            <DrawerDescription className="sr-only">{description}</DrawerDescription>
          )}
          {/* Visible heading and subtext */}
          <h2 className="text-base font-semibold truncate">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
          )}
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-auto [--background:0_0%_100%]">
        <div className={cn('p-4 space-y-4', bodyMaxWidth && 'max-w-[680px] w-full mx-auto')}>
          {children}
        </div>
      </div>

      <footer className="sticky bottom-0 z-20 bg-background/95 backdrop-blur border-t shrink-0 px-4 py-3 flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={onSecondary} className="shrink-0">
          {secondaryLabel}
        </Button>
        <Button
          size="sm"
          type={primaryType}
          onClick={primaryType === 'button' ? onPrimary : undefined}
          disabled={primaryDisabled}
          className="shrink-0"
        >
          {primaryLabel}
        </Button>
      </footer>
    </div>
  );
};
