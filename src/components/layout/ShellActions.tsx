import React, { useMemo, useState } from 'react';
import { useAiPanelRegistration } from '@/shared/context/aiPanel';
import { askAiPageFor } from '@/shared/lib/askAi';
import { aiPromptsFor, resolveAskAiMode, searchShortcutLabel, titleFor } from './shellRoutes';
import { AskAiSheet } from './AskAiSheet';
import { ShellActionsContext, type ShellActionsValue } from './shellActionsContext';

/**
 * Shell actions (Oct 2026): Search and Ask AI live in the navigation — two rail items
 * under Map on desktop, and in the "More" menu on mobile — instead of the old floating
 * pill that covered content. Search opens the centred cmdk palette (also ⌘K / Ctrl K);
 * Ask AI opens the page's AI source (resolveAskAiMode):
 *  - 'ask-ai'  Orders, Pipeline, Finance → read-only `ask-ai` edge function sheet.
 *  - 'panel'   pages that registered an AI panel (Inbox) → opens that panel.
 *  - 'none'    no page-specific AI; the Ask AI item still stays visible and opens a
 *              sheet pointing the user at Orders / Pipeline / Finance (so it never
 *              vanishes on Map / Hub / Settings).
 */
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
      if (aiMode === 'panel') setPanelOpen(true);
      else setAskOpen(true);
    },
    // Always show Ask AI in the rail / More menu (Search's sibling). Mode only
    // chooses what opens — never whether the item is rendered.
    aiAvailable: true,
    aiLabel: aiMode === 'panel' ? `Open ${registration?.title ?? 'AI panel'}` : `Ask Mason AI about ${titleFor(segment)}`,
    shortcut: searchShortcutLabel(platform),
  }), [onOpenSearch, aiMode, setPanelOpen, registration?.title, segment]);

  return (
    <ShellActionsContext.Provider value={value}>
      {children}
      {aiMode !== 'panel' && (
        <AskAiSheet key={page ?? 'none'} page={page} title={titleFor(segment)} prompts={prompts} open={askOpen} onOpenChange={setAskOpen} pendingQuestion={null} onPendingConsumed={() => {}} />
      )}
    </ShellActionsContext.Provider>
  );
};
