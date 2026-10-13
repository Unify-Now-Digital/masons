import React, { useState } from 'react';
import { Search as SearchIcon, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAiPanelRegistration } from '@/shared/context/aiPanel';
import { askAiPageFor } from '@/shared/lib/askAi';
import { aiPromptsFor, resolveAskAiMode, searchShortcutLabel, titleFor } from './shellRoutes';
import { AskAiSheet } from './AskAiSheet';

export type BottomBarMode = 'search' | 'ai';

interface Props {
  segment: string;
  onOpenSearch: () => void;
  /** Mobile-only nav button (the old header's hamburger lives here now). */
  mobileMenu?: React.ReactNode;
}

const platform = typeof navigator !== 'undefined' ? navigator.platform || navigator.userAgent : '';

/**
 * Shell bottom bar (approved v7 spec + audit §3A/§5.2). A TRIGGER pill, not a text
 * field (surface fill, 3.5:1 border), so it can't be mistaken for the composer.
 * Search (default) opens the centred cmdk palette; ⌘K / Ctrl K work anywhere.
 * Ask AI source per page (resolveAskAiMode):
 *  - 'ask-ai'  Orders, Pipeline, Finance → read-only `ask-ai` edge function; chips send.
 *  - 'panel'   pages that registered an AI panel (Inbox) → opens that panel, unchanged.
 *  - 'none'    the Ask AI toggle is hidden (not greyed out).
 * The selected mode is a quiet neutral chip, not a second indigo primary.
 */
export const ShellBottomBar: React.FC<Props> = ({ segment, onOpenSearch, mobileMenu }) => {
  const { registration, setOpen: setPanelOpen } = useAiPanelRegistration();
  const [mode, setMode] = useState<BottomBarMode>('search');
  const [askOpen, setAskOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const shortcut = searchShortcutLabel(platform);

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
        'h-6 px-2 rounded-full flex items-center gap-1 text-xs font-bold transition-colors',
        effectiveMode === m
          ? 'bg-gardens-surf text-gardens-tx ring-1 ring-gardens-bdr2'
          : 'text-gardens-txs hover:text-gardens-tx',
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      className="h-14 flex-shrink-0 bg-gardens-surf border-t border-gardens-bdr flex items-center gap-3 px-3 md:px-4"
      data-testid="shell-bottom-bar"
    >
      {mobileMenu}
      <div className="flex-1 min-w-0 flex justify-center items-center gap-2">
        <div
          role="search"
          className="w-full max-w-[720px] h-9 rounded-full border border-gardens-sem-todo bg-gardens-page flex items-center gap-2 pl-1 pr-1"
        >
          {aiMode !== 'none' && (
            <div role="radiogroup" aria-label="Bottom bar mode" className="flex bg-gardens-sem-grey-lt rounded-full p-0.5 gap-0.5 flex-shrink-0">
              {modeBtn('search', 'Search', <SearchIcon className="h-3.5 w-3.5" aria-hidden />)}
              {modeBtn('ai', 'Ask AI', <Sparkles className="h-3.5 w-3.5" aria-hidden />)}
            </div>
          )}
          <button
            type="button"
            onClick={activate}
            className="flex-1 min-w-0 h-full flex items-center gap-2 text-left rounded-full px-2 hover:bg-gardens-sem-grey-lt/60"
            aria-label={effectiveMode === 'ai' ? 'Ask Mason AI' : `Search people, orders, inscriptions (${shortcut})`}
            aria-haspopup="dialog"
          >
            {aiMode === 'none' && <SearchIcon className="h-4 w-4 text-gardens-txm-aa shrink-0" aria-hidden />}
            <span className="flex-1 truncate font-body text-[13px] text-gardens-txm-aa">
              {effectiveMode === 'ai'
                ? aiMode === 'panel'
                  ? `Open ${registration?.title ?? 'AI panel'}`
                  : `Ask Mason AI about ${titleFor(segment)}…`
                : 'Search people, orders…'}
            </span>
            {effectiveMode === 'search' && (
              <kbd className="hidden md:inline-flex items-center text-[11px] font-mono text-gardens-txm-aa border border-gardens-bdr2 rounded px-1 py-px">
                {shortcut}
              </kbd>
            )}
          </button>
        </div>

        {effectiveMode === 'ai' && prompts.length > 0 && (
          <div className="hidden lg:flex gap-2 flex-shrink-0" aria-label="Suggested prompts">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => openAi(p)}
                className="h-7 px-3 rounded-full border border-gardens-bdr bg-gardens-page text-xs text-gardens-txs hover:text-gardens-tx whitespace-nowrap"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

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
