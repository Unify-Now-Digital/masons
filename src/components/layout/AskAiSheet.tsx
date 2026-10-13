import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { askAiErrorMessage, buildAskAiRequest, invokeAskAi, type AskAiPage } from '@/shared/lib/askAi';
import { AskAiPanelView, type AskAiViewState } from './AskAiPanelView';

interface Props {
  page: AskAiPage;
  title: string;
  prompts: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Question to send as soon as the sheet opens (from a bottom-bar prompt chip). */
  pendingQuestion: string | null;
  onPendingConsumed: () => void;
}

/** Ask AI sheet for pages backed by the read-only `ask-ai` edge function. */
export const AskAiSheet: React.FC<Props> = ({ page, title, prompts, open, onOpenChange, pendingQuestion, onPendingConsumed }) => {
  const { organizationId } = useOrganization();
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<AskAiViewState>({ status: 'idle' });

  const mutation = useMutation({ mutationFn: invokeAskAi });

  const ask = (question: string) => {
    const built = buildAskAiRequest(page, question, organizationId);
    if (built.ok === false) {
      setState({ status: 'error', question: question.trim() || '—', message: built.error });
      return;
    }
    const q = built.body.question;
    setState({ status: 'loading', question: q });
    setDraft('');
    mutation.mutate(built.body, {
      onSuccess: (res) => setState({ status: 'answer', question: q, answer: res.answer }),
      onError: (err) => setState({ status: 'error', question: q, message: askAiErrorMessage(err) }),
    });
  };

  // Fire a chip's question once when the sheet receives it.
  React.useEffect(() => {
    if (open && pendingQuestion) {
      onPendingConsumed();
      ask(pendingQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingQuestion]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="w-full sm:max-w-none md:max-w-md p-0 gap-0 flex flex-col bg-gardens-surf"
      >
        <SheetHeader className="px-4 py-3 border-b border-gardens-bdr text-left">
          <SheetTitle className="font-head text-base text-gardens-tx">Ask Mason AI · {title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AskAiPanelView state={state} draft={draft} prompts={prompts} onDraftChange={setDraft} onAsk={ask} />
        </div>
      </SheetContent>
    </Sheet>
  );
};
