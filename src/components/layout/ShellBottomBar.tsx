import React, { useState } from 'react';
import { Search as SearchIcon, Sparkles } from 'lucide-react';
import { useAiPanelRegistration } from '@/shared/context/aiPanel';
import { askAiPageFor } from '@/shared/lib/askAi';
import { aiPromptsFor, resolveAskAiMode, searchShortcutLabel, titleFor } from './shellRoutes';
import { AskAiSheet } from './AskAiSheet';

export type BottomBarMode = 'search' | 'ai';

interface Props {
  segment: string;
  onOpenSearch: () => void;
}

const platform = typeof navigator !== 'undefined' ? navigator.platform || navigator.userAgent : '';

/**
 * Shell v2: a compact FLOATING pill bottom-right (no full-width row). Search opens the
 * centred cmdk palette (also ⌘K / Ctrl K); Ask AI opens the page's AI sheet/panel.
 * On mobile it floats above the bottom tab bar.
 *
 * Was: Shell bottom bar (approved v7 spec + audit §3A/§5.2). A TRIGGER pill, not a text
 * field (surface fill, 3.5:1 border), so it can't be mistaken for the composer.
 * Search (default) opens the centred cmdk palette; ⌘K / Ctrl K work anywhere.
 * Ask AI source per page (resolveAskAiMode):
 *  - 'ask-ai'  Orders, Pipeline, Finance → read-only `ask-ai` edge function; chips send.
 *  - 'panel'   pages that registered an AI panel (Inbox) → opens that panel, unchanged.
 *  - 'none'    the Ask AI toggle is hidden (not greyed out).
 * The selected mode is a quiet neutral chip, not a second indigo primary.
 */
export const ShellBottomBar: React.FC<Props> = ({ segment, onOpenSearch }) => {
  const { registration, setOpen: setPanelOpen } = useAiPanelRegistration();
  const [askOpen, setAskOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const shortcut = searchShortcutLabel(platform);

  const page = askAiPageFor(segment);
  const aiMode = resolveAskAiMode(page, !!registration);
  const prompts = aiMode === 'ask-ai' ? aiPromptsFor(segment) : [];

  const openAi = (question?: string) => {
    if (aiMode === 'ask-ai') {
      setPending(question ?? null);
      setAskOpen(true);
    } else if (aiMode === 'panel') {
      setPanelOpen(true);
    }
  };

  return (
    <div
      className="fixed z-40 right-3 bottom-[calc(env(safe-area-inset-bottom)+68px)] md:right-4 md:bottom-4 flex items-center gap-1 h-10 rounded-full border border-gardens-sem-todo bg-gardens-surf shadow-lg pl-1 pr-1"
      data-testid="shell-bottom-bar"
      data-floating="true"
      role="search"
    >
      <button
        type="button"
        onClick={onOpenSearch}
        className="h-8 flex items-center gap-2 rounded-full pl-2.5 pr-2 text-left hover:bg-gardens-sem-grey-lt/60"
        aria-label={`Search orders (${shortcut})`}
        aria-haspopup="dialog"
      >
        <SearchIcon className="h-4 w-4 text-gardens-txs shrink-0" aria-hidden />
        <span className="hidden sm:inline font-body text-[13px] text-gardens-txm-aa">Search</span>
        <kbd className="hidden md:inline-flex items-center text-[11px] font-mono text-gardens-txm-aa border border-gardens-bdr2 rounded px-1 py-px">
          {shortcut}
        </kbd>
      </button>
      {aiMode !== 'none' && (
        <button
          type="button"
          onClick={() => openAi()}
          className="h-8 flex items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-gardens-txs hover:bg-gardens-sem-grey-lt/60 hover:text-gardens-tx border-l border-gardens-bdr"
          aria-label={aiMode === 'panel' ? `Open ${registration?.title ?? 'AI panel'}` : `Ask Mason AI about ${titleFor(segment)}`}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Ask AI</span>
        </button>
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
