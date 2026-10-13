import React, { useState } from 'react';
import { Search as SearchIcon, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAiPanelRegistration } from '@/shared/context/aiPanel';
import { aiPromptsFor } from './shellRoutes';

export type BottomBarMode = 'search' | 'ai';

interface Props {
  segment: string;
  onOpenSearch: () => void;
}

/**
 * Mason UI phase 1 bottom bar: replaces the top-header search trigger and the
 * floating AI button. "Search" (default) opens the existing cmdk palette (⌘K
 * still works globally). "Ask AI" opens the page's registered AI panel
 * (useRegisterAiPanel) — on pages with no panel the toggle is disabled, the
 * same "no registration, no AI" rule the floating button followed (FR-012).
 * Suggested prompts are static per route for now and just open the panel.
 */
export const ShellBottomBar: React.FC<Props> = ({ segment, onOpenSearch }) => {
  const { registration, setOpen } = useAiPanelRegistration();
  const [mode, setMode] = useState<BottomBarMode>('search');
  const aiAvailable = !!registration;
  const effectiveMode: BottomBarMode = aiAvailable ? mode : 'search';
  const prompts = aiPromptsFor(segment);

  const activate = () => {
    if (effectiveMode === 'ai') setOpen(true);
    else onOpenSearch();
  };

  const modeBtn = (m: BottomBarMode, label: string, icon: React.ReactNode, disabled = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={effectiveMode === m}
      disabled={disabled}
      title={disabled ? 'No AI assistant on this page yet' : undefined}
      onClick={() => setMode(m)}
      className={cn(
        'h-7 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-bold transition-colors',
        effectiveMode === m ? 'bg-gardens-acc text-white' : 'text-gardens-txs hover:text-gardens-tx',
        disabled && 'opacity-40 cursor-not-allowed hover:text-gardens-txs',
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      className="h-14 flex-shrink-0 bg-gardens-surf border-t border-gardens-bdr flex items-center gap-2.5 px-3 md:px-[18px]"
      data-testid="shell-bottom-bar"
    >
      <div
        role="search"
        className="flex-1 min-w-0 h-[38px] border border-gardens-bdr2 rounded-xl bg-gardens-surf2 flex items-center gap-2 pl-1.5 pr-1.5"
      >
        <div role="radiogroup" aria-label="Bottom bar mode" className="flex bg-gardens-page rounded-lg p-0.5 flex-shrink-0">
          {modeBtn('search', 'Search', <SearchIcon className="h-3.5 w-3.5" aria-hidden />)}
          {modeBtn('ai', 'Ask AI', <Sparkles className="h-3.5 w-3.5" aria-hidden />, !aiAvailable)}
        </div>
        <button
          type="button"
          onClick={activate}
          className="flex-1 min-w-0 h-full flex items-center gap-2 text-left"
          aria-label={effectiveMode === 'ai' ? registration?.title ?? 'Ask AI' : 'Search people, orders, inscriptions'}
        >
          <span className="flex-1 truncate font-body text-[13px] text-gardens-txm-aa">
            {effectiveMode === 'ai' ? `Ask Mason AI — ${registration?.title ?? ''}` : 'Search people, orders…'}
          </span>
          {effectiveMode === 'search' && (
            <kbd className="hidden md:inline-flex items-center text-[10px] font-mono text-gardens-txm-aa bg-gardens-surf border border-gardens-bdr rounded px-1 py-px mr-1">
              ⌘K
            </kbd>
          )}
        </button>
      </div>

      {effectiveMode === 'ai' && prompts.length > 0 && (
        <div className="hidden lg:flex gap-1.5 flex-shrink-0" aria-label="Suggested prompts">
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setOpen(true)}
              className="h-7 px-2.5 rounded-full border border-gardens-bdr bg-gardens-page text-xs text-gardens-txs hover:text-gardens-tx whitespace-nowrap"
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
