import React from 'react';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';

export type AskAiViewState =
  | { status: 'idle' }
  | { status: 'loading'; question: string }
  | { status: 'error'; question: string; message: string }
  | { status: 'answer'; question: string; answer: string };

interface Props {
  state: AskAiViewState;
  draft: string;
  prompts: string[];
  onDraftChange: (v: string) => void;
  onAsk: (question: string) => void;
}

/** Presentational Ask AI panel: prompts, question box and the four states. */
export const AskAiPanelView: React.FC<Props> = ({ state, draft, prompts, onDraftChange, onAsk }) => {
  const busy = state.status === 'loading';
  return (
    <div className="flex flex-col gap-4 p-4" data-testid="ask-ai-panel" data-state={state.status}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onAsk(draft);
        }}
      >
        <input
          aria-label="Ask Mason AI"
          className="flex-1 min-w-0 h-9 rounded-lg border border-gardens-bdr2 bg-gardens-surf2 px-3 text-sm text-gardens-tx placeholder:text-gardens-txm-aa"
          placeholder="Ask about this page…"
          value={draft}
          maxLength={500}
          onChange={(e) => onDraftChange(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="h-9 px-3 rounded-lg bg-gardens-acc text-white text-sm font-semibold disabled:opacity-50"
        >
          Ask
        </button>
      </form>

      {prompts.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Suggested prompts">
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              disabled={busy}
              onClick={() => onAsk(p)}
              className="h-7 px-2.5 rounded-full border border-gardens-bdr bg-gardens-page text-xs text-gardens-txs hover:text-gardens-tx disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {state.status === 'idle' && (
        <p className="text-sm text-gardens-txm-aa">
          Ask a question about this page. Mason AI reads a summary of the page&rsquo;s data and answers. It can&rsquo;t change anything.
        </p>
      )}

      {state.status !== 'idle' && (
        <div className="text-sm font-semibold text-gardens-tx" data-testid="ask-ai-question">{state.question}</div>
      )}

      {state.status === 'loading' && (
        <div role="status" className="flex items-center gap-2 text-sm text-gardens-txs">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Thinking…
        </div>
      )}

      {state.status === 'error' && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-gardens-sem-red-line bg-gardens-sem-red-lt p-3 text-sm text-gardens-sem-red">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <div className="flex-1">
            <div>{state.message}</div>
            <button type="button" className="mt-1 underline font-semibold" onClick={() => onAsk(state.question)}>
              Try again
            </button>
          </div>
        </div>
      )}

      {state.status === 'answer' && (
        <div className="rounded-lg border border-gardens-bdr bg-gardens-surf2 p-3 text-sm text-gardens-tx whitespace-pre-wrap" data-testid="ask-ai-answer">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-gardens-txm-aa">
            <Sparkles className="h-3 w-3" aria-hidden /> Mason AI · read-only
          </div>
          {state.answer}
        </div>
      )}
    </div>
  );
};
