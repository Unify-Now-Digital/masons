import { MessageCircle } from 'lucide-react';
import React, { useLayoutEffect, useRef } from 'react';
import { KIND_ICON } from './actionKind';
import { capitalise, formatDay, kickerText, laneRule, objectPhrase } from './detailText';
import type { Prepared } from './prepare';
import { CHIP_CLASS, chipLabel, chipTone, TIMING_CLASS, timingOf } from './queueView';
import { taskMark, TASK_MARK_LABEL } from './personRows';
import { TaskMarkIcon } from './taskMarks';
import type { TodayItem } from './todayModel';
import { cn } from '@/shared/lib/utils';

const OUTLINE = 'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gardens-bdr bg-white px-3 text-[13px] font-semibold text-gardens-tx hover:bg-gardens-page';
const GHOST = 'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-3 text-[13px] text-gardens-txs hover:bg-gardens-page hover:text-gardens-tx';
const PRIMARY = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-gardens-acc px-4 text-[13.5px] font-bold text-white hover:bg-gardens-acc-dk disabled:pointer-events-none disabled:opacity-50';

function noteClass(note: string): string {
  if (note === 'missing') return 'text-gardens-na-red';
  if (note === 'suggested' || note.startsWith('matches')) return 'text-gardens-acc';
  return 'text-gardens-txm-aa';
}

export const TodayDetail: React.FC<{
  item: TodayItem;
  rank: number;
  total: number;
  now: Date;
  doneVerb?: string;
  customer?: boolean;
  /** Ledger row, not a person. */
  system?: boolean;
  /** Other tasks for this person, most urgent first. The open card above is the prepared one. */
  also?: TodayItem[];
  onOpenAlso?: (item: TodayItem) => void;
  prepared: Prepared | null;
  busy?: boolean;
  error?: string | null;
  showCallInstead?: boolean;
  onPrimary: () => void;
  onEdit: () => void;
  onTomorrow: () => void;
  onDismiss: () => void;
  onCallOutcome: (outcome: string) => void;
  onCallInstead?: () => void;
  onClose?: () => void;
  /** Shown when the context panel is collapsed, so the overlay can still be opened. */
  showOpenFull?: boolean;
  onOpenFull?: () => void;
  /** Editable message body. The button under the draft sends this text. */
  draft?: string;
  onDraft?: (value: string) => void;
}> = ({
  item, rank, total, now, doneVerb, also = [], onOpenAlso, prepared, busy, error, showCallInstead,
  onPrimary, onEdit, onTomorrow, onDismiss, onCallOutcome, onCallInstead, onClose, showOpenFull, onOpenFull,
  draft = '', onDraft,
}) => {
  const tone = chipTone(item, !!doneVerb);
  const timing = timingOf(item, doneVerb);
  const Icon = KIND_ICON[item.kind];
  const reason = item.reasons[0]?.text || item.why;
  const factorTitle = item.factors.length ? `Ranked by: ${item.factors.join(' · ')}` : 'Ranked by the list';
  const primaryLabel = prepared ? prepared.primary : 'Write reply';
  const aside = prepared?.type === 'message' ? prepared.channel : prepared?.type === 'call' ? prepared.to : prepared?.title;
  const prepTitle = !prepared
    ? 'Prepared'
    : prepared.type === 'message'
      ? 'Prepared · Reply'
      : prepared.type === 'call'
        ? 'Prepared · Call'
        : `Prepared · ${prepared.title}`;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto bg-gardens-surf2" data-testid="today-detail" aria-label={item.name}>
      <header className="border-b border-gardens-bdr bg-gardens-surf px-6 pb-3.5 pt-4">
        <div className="flex items-center gap-2.5">
          <span className="min-w-0 truncate text-[11.5px] font-bold uppercase tracking-[.08em] text-gardens-txm-aa">{kickerText(item)}</span>
          <span className="ml-auto flex shrink-0 items-center gap-3">
            {showOpenFull && onOpenFull && (
              <button type="button" data-testid="today-open-full" onClick={onOpenFull} className="text-[12px] font-semibold text-gardens-acc-dk">
                Open full ↗
              </button>
            )}
            <span
              data-testid="today-rank"
              title={factorTitle}
              className="cursor-help whitespace-nowrap border-b border-dotted border-gardens-txm text-[12px] text-gardens-txs"
            >
              #{rank} of {total}
            </span>
          </span>
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-3">
          <span
            data-testid="today-detail-chip"
            className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[15px] font-bold', CHIP_CLASS[tone])}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} aria-hidden />
            {chipLabel(item, !!doneVerb)}
          </span>
          <h2 className="m-0 min-w-0 flex-1 truncate font-head text-[24px] font-semibold leading-tight text-gardens-tx">{item.name}</h2>
          <span className={cn('shrink-0 text-[13px] font-bold tabular-nums', TIMING_CLASS[timing.tone])}>{timing.text}</span>
        </div>
        <p className="m-0 mt-2 text-[14px] leading-relaxed text-gardens-tx">
          <b className="font-semibold">Why:</b> {reason}{' '}
          <span className="text-gardens-txm-aa">{laneRule(item.lane, item.kind)}</span>
        </p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="mt-2 text-[13px] font-semibold text-gardens-txs">
            Close
          </button>
        )}
      </header>

      <div className="flex min-w-0 flex-col gap-3 px-6 py-4">
        {item.snippet?.trim() && (
          <div className="grid grid-cols-[18px_minmax(0,1fr)] items-start gap-2" data-testid="today-last-words">
            <MessageCircle className="mt-0.5 h-3.5 w-3.5 text-gardens-txm-aa" aria-hidden />
            <p className="m-0 font-head text-[14px] italic leading-relaxed text-gardens-tx">
              {item.snippet.trim()}{' '}
              {item.lastInAt && (
                <span className="font-sans text-[12px] not-italic text-gardens-txm-aa">{formatDay(new Date(item.lastInAt), now)}</span>
              )}
            </p>
          </div>
        )}

        <section data-section="prepared" className="overflow-hidden rounded-lg border border-[#C9D0E3] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#E6E9F2] bg-[#F6F7FB] px-3.5 py-2.5">
            <span className="text-[11.5px] font-bold uppercase tracking-[.08em] text-gardens-acc-dk">{prepTitle}</span>
            {aside && <span className="ml-auto truncate text-[12px] text-gardens-txs">{aside}</span>}
          </div>
          {prepared ? (
            <PreparedBody prepared={prepared} draft={draft} onDraft={onDraft} busy={busy} />
          ) : (
            <p className="m-0 border-b border-[#EEEAE1] px-4 py-4 text-[13.5px] leading-relaxed text-gardens-txs">
              No draft: there's nothing on file to build one from. Write the reply, or open the conversation.
            </p>
          )}
          {error && <p className="m-0 px-4 pt-2 text-[13px] text-gardens-na-red">{error}</p>}
          <div className="flex flex-wrap items-center gap-2 px-3.5 py-3">
            <button
              type="button"
              data-testid="today-primary"
              disabled={busy}
              onClick={prepared ? onPrimary : onEdit}
              className={PRIMARY}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              {primaryLabel}
            </button>
            {prepared?.type === 'call' && prepared.outcomes.map((outcome) => (
              <button key={outcome} type="button" data-testid="today-outcome" disabled={busy} onClick={() => onCallOutcome(outcome)} className={OUTLINE}>
                {outcome}
              </button>
            ))}
            {prepared && (
              <button type="button" onClick={onEdit} className={OUTLINE}>Edit</button>
            )}
            {showCallInstead && onCallInstead && (
              <button type="button" onClick={onCallInstead} className={OUTLINE}>Call instead</button>
            )}
            <span className="ml-auto flex flex-wrap items-center gap-1">
              <button type="button" data-testid="today-tomorrow" onClick={onTomorrow} className={GHOST}>Tomorrow</button>
              <button type="button" data-testid="today-dismiss" onClick={onDismiss} className={GHOST}>Not needed</button>
            </span>
          </div>
        </section>

        {also.length > 0 && (
          <div data-testid="today-also">
            <p className="m-0 text-xs font-semibold text-gardens-txs">Also for this person</p>
            {also.map((task) => {
              const mark = taskMark(task);
              const taskTiming = timingOf(task, undefined);
              return (
                <button
                  key={task.key}
                  type="button"
                  onClick={() => onOpenAlso?.(task)}
                  className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg border border-gardens-bdr bg-white px-3 py-2 text-left"
                >
                  <span title={TASK_MARK_LABEL[mark]} className="text-gardens-txs">
                    <TaskMarkIcon mark={mark} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-normal break-words text-[13px] font-semibold leading-snug text-gardens-tx">{capitalise(objectPhrase(task))}</span>
                    <span className="mt-0.5 line-clamp-2 break-words text-[12px] leading-4 text-gardens-txs">{task.short}</span>
                  </span>
                  <span className={cn('w-[6.75rem] shrink-0 text-right text-[12px] font-bold tabular-nums', TIMING_CLASS[taskTiming.tone])}>{taskTiming.text}</span>
                </button>
              );
            })}
          </div>
        )}

        <p className="hidden text-[11.5px] text-gardens-txm-aa [@media(hover:hover)]:block" data-testid="today-keys">
          j / k to move · e to send · t for tomorrow
        </p>
      </div>
    </section>
  );
};

function AutoDraft({
  draft,
  busy,
  onDraft,
}: {
  draft: string;
  busy?: boolean;
  onDraft?: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);
  return (
    <textarea
      ref={ref}
      rows={2}
      data-testid="today-draft"
      aria-label="Draft"
      value={draft}
      disabled={busy}
      onChange={(e) => onDraft?.(e.target.value)}
      className="w-full resize-none overflow-hidden rounded-md border border-gardens-bdr bg-gardens-surf2 px-2.5 py-2 text-[13.5px] leading-relaxed text-gardens-tx"
    />
  );
}

function sendsSomething(prepared: Prepared): boolean {
  if (prepared.type === 'message') return true;
  return prepared.type === 'fields' && (prepared.target === 'permit' || prepared.target === 'stone');
}

const PreparedBody: React.FC<{
  prepared: Prepared;
  draft: string;
  onDraft?: (value: string) => void;
  busy?: boolean;
}> = ({ prepared, draft, onDraft, busy }) => (
  <>
    <div className="border-b border-[#EEEAE1] px-4 py-3.5">
      {prepared.type === 'fields' ? (
        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)]">
          {prepared.fields.map((field) => (
            <React.Fragment key={field.label}>
              <div className="border-t border-[#F2EFE8] py-2 text-[13px] text-gardens-txs">{field.label}</div>
              <div className="border-t border-[#F2EFE8] py-2">
                <div className={cn('break-words text-[13px] font-semibold', field.note === 'missing' || !field.value ? 'text-gardens-na-red' : 'text-gardens-tx')}>
                  {field.value || 'Missing'}
                </div>
                <div className={cn('text-xs', noteClass(field.note))}>{field.note}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      ) : prepared.type === 'message' ? (
        <AutoDraft draft={draft} busy={busy} onDraft={onDraft} />
      ) : (
        <div className="space-y-2">
          {prepared.notes.map((para) => (
            <p key={para} className="m-0 whitespace-pre-line text-[13.5px] leading-relaxed text-gardens-tx">{para}</p>
          ))}
        </div>
      )}
    </div>
    <p className="m-0 flex flex-wrap items-center gap-1.5 border-b border-[#EEEAE1] bg-[#FBFAF6] px-4 py-2 text-[12px] text-gardens-txs">
      <span className="font-bold text-gardens-acc">✦ Uses</span>
      {prepared.uses.map((use) => (
        <span key={use} className="inline break-words rounded bg-[#EEF0F6] px-1.5 text-gardens-acc-dk">{use}</span>
      ))}
      {sendsSomething(prepared) && <span>· check before sending</span>}
    </p>
  </>
);
