import React, { createContext, useContext, useMemo, useState } from 'react';
import { useAiPanelRegistration } from '@/shared/context/aiPanel';
import { askAiPageFor } from '@/shared/lib/askAi';
import { aiPromptsFor, resolveAskAiMode, searchShortcutLabel, titleFor } from './shellRoutes';
import { AskAiSheet } from './AskAiSheet';

/**
 * Shell actions (Oct 2026): Search and Ask AI live in the navigation — two rail items
 * under Map on desktop, and in the "More" menu on mobile — instead of the old floating
 * pill that covered content. Search opens the centred cmdk palette (also ⌘K / Ctrl K);
 * Ask AI opens the page's AI source (resolveAskAiMode):
 *  - 'ask-ai'  Orders, Pipeline, Finance → read-only `ask-ai` edge function sheet.
 *  - 'panel'   pages that registered an AI panel (Inbox) → opens that panel.
 *  - 'none'    the Ask AI item is hidden.
 */
interface ShellActionsValue {
  openSearch: () => void;
  openAi: () => void;
  aiAvailable: boolean;
  aiLabel: string;
  shortcut: string;
}

const Ctx = createContext<ShellActionsValue>({
  openSearch: () => {}, openAi: () => {}, aiAvailable: false, aiLabel: 'Ask AI', shortcut: 'Ctrl K',
});
export const useShellActions = () => useContext(Ctx);

const platform = typeof navigator !== 'undefined' ? navigator.platform || navigator.userAgent : '';

export const ShellActionsProvider: React.FC<{ segment: string; onOpenSearch: () => void; children: React.ReactNode }> = ({
  segment, onOpenSearch, children,
}) => {
  const { registration, setOpen: setPanelOpen } = useAiPanelRegistration();
  const [askOpen, setAskOpen] = useState(false);
  const page = askAiPageFor(segment);
  const aiMode = resolveAskAiMode(page, !!registration);
  const prompts = aiMode === 'ask-ai' ? aiPromptsFor(segment) : [];

  const value = useMemo<ShellActionsValue>(() => ({
    openSearch: onOpenSearch,
    openAi: () => {
      if (aiMode === 'ask-ai') setAskOpen(true);
      else if (aiMode === 'panel') setPanelOpen(true);
    },
    aiAvailable: aiMode !== 'none',
    aiLabel: aiMode === 'panel' ? `Open ${registration?.title ?? 'AI panel'}` : `Ask Mason AI about ${titleFor(segment)}`,
    shortcut: searchShortcutLabel(platform),
  }), [onOpenSearch, aiMode, setPanelOpen, registration?.title, segment]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {page && aiMode === 'ask-ai' && (
        <AskAiSheet key={page} page={page} title={titleFor(segment)} prompts={prompts} open={askOpen} onOpenChange={setAskOpen} pendingQuestion={null} onPendingConsumed={() => {}} />
      )}
    </Ctx.Provider>
  );
};
