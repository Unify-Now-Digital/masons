import React, { useState } from 'react';
import { Search as SearchIcon, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAiPanelRegistration } from '@/shared/context/aiPanel';
import { askAiPageFor } from '@/shared/lib/askAi';
import { aiPromptsFor, resolveAskAiMode, titleFor } from './shellRoutes';
import { AskAiSheet } from './AskAiSheet';

export type BottomBarMode = 'search' | 'ai';

interface Props {
  segment: string;
  onOpenSearch: () => void;
}

/**
 * Shell bottom bar: Search (default; cmdk palette, ⌘K) / Ask AI.
 * Ask AI source per page (resolveAskAiMode):
 *  - 'ask-ai'  Orders, Pipeline, Finance → read-only `ask-ai` edge function; prompt chips send.
 *  - 'panel'   pages that registered an AI panel (Inbox) → opens that panel, unchanged.
 *  - 'none'    the Ask AI toggle is hidden (not greyed out).
 */
export const ShellBottomBar: React.FC<Props> = ({ segment, onOpenSearch }) => {
  const { registration, setOpen: setPanelOpen } = useAiPanelRegistration();
  const [mode, setMode] = useState<BottomBarMode>('search');
  const [askOpen, setAskOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const page = askAiPageFor(segment);
  const aiMode = resolveAskAiMode(page, !!registration);
  const effectiveMode: BottomBarMode = aiMode === 'none' ? 'search' : mode;
  const prompts = aiMode === 'ask-ai' ? aiPromptsFor(segment) : [];

  const openAi = (question?: string) => {
    if (aiMode === 'ask-ai') {
      setPending(question ?? null);
      setAskOpen(true);
    } else if (aiMode === 'panel') {
      setPanelOpen(true);
    }
  };

  const activate = () => (effectiveMode === 'ai' ? openAi() : onOpenSearch());

  const modeBtn = (m: BottomBarMode, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      role="radio"
      aria-checked={effectiveMode === m}
      onClick={() => setMode(m)}
      className={cn(
        'h-7 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-bold transition-colors',
        effectiveMode === m ? 'bg-gardens-acc text-white' : 'text-gardens-txs hover:text-gardens-tx',
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
        {aiMode !== 'none' && (
          <div role="radiogroup" aria-label="Bottom bar mode" className="flex bg-gardens-page rounded-lg p-0.5 flex-shrink-0">
            {modeBtn('search', 'Search', <SearchIcon className="h-3.5 w-3.5" aria-hidden />)}
            {modeBtn('ai', 'Ask AI', <Sparkles className="h-3.5 w-3.5" aria-hidden />)}
          </div>
        )}
        {aiMode === 'none' && <SearchIcon className="h-4 w-4 ml-1.5 text-gardens-txm-aa shrink-0" aria-hidden />}
        <button
          type="button"
          onClick={activate}
          className="flex-1 min-w-0 h-full flex items-center gap-2 text-left"
          aria-label={effectiveMode === 'ai' ? 'Ask Mason AI' : 'Search people, orders, inscriptions'}
        >
          <span className="flex-1 truncate font-body text-[13px] text-gardens-txm-aa">
            {effectiveMode === 'ai'
              ? aiMode === 'panel'
                ? `Open ${registration?.title ?? 'AI panel'}`
                : `Ask Mason AI about ${titleFor(segment)}…`
              : 'Search people, orders…'}
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
              onClick={() => openAi(p)}
              className="h-7 px-2.5 rounded-full border border-gardens-bdr bg-gardens-page text-xs text-gardens-txs hover:text-gardens-tx whitespace-nowrap"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {page && aiMode === 'ask-ai' && (
        <AskAiSheet
          key={page}
          page={page}
          title={titleFor(segment)}
          prompts={prompts}
          open={askOpen}
          onOpenChange={setAskOpen}
          pendingQuestion={pending}
          onPendingConsumed={() => setPending(null)}
        />
      )}
    </div>
  );
};
