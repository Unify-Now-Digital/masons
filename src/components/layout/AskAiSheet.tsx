import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { askAiErrorMessage, buildAskAiRequest, invokeAskAi, type AskAiPage } from '@/shared/lib/askAi';
import { AskAiPanelView, type AskAiViewState } from './AskAiPanelView';

interface Props {
  page: AskAiPage | null;
  title: string;
  prompts: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Question to send as soon as the sheet opens (from a bottom-bar prompt chip). */
  pendingQuestion: string | null;
  onPendingConsumed: () => void;
}

const SUPPORTED = [
  { to: '/dashboard/orders', label: 'Orders' },
  { to: '/dashboard/inquiries', label: 'Pipeline' },
  { to: '/dashboard/finance', label: 'Finance' },
] as const;

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
    if (open && pendingQuestion && page) {
      onPendingConsumed();
      ask(pendingQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingQuestion, page]);

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
          {page ? (
            <AskAiPanelView state={state} draft={draft} prompts={prompts} onDraftChange={setDraft} onAsk={ask} />
          ) : (
            <div className="flex flex-col gap-3 p-4" data-testid="ask-ai-unavailable">
              <p className="text-sm text-gardens-tx">
                Ask Mason AI answers questions about Orders, Pipeline and Finance. Open one of those pages to ask.
              </p>
              <ul className="flex flex-col gap-1">
                {SUPPORTED.map((s) => (
                  <li key={s.to}>
                    <NavLink
                      to={s.to}
                      onClick={() => onOpenChange(false)}
                      className="flex items-center rounded-md px-2 py-2 text-sm font-medium text-gardens-txs hover:bg-gardens-page hover:text-gardens-tx"
                    >
                      {s.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
