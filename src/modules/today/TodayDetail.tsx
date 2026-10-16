import { BookOpen, Clock, CreditCard, FileText, Mail, MessageCircle, Phone } from 'lucide-react';
import React, { useLayoutEffect, useRef } from 'react';
import { KIND_ICON } from './actionKind';
import { capitalise, formatWhen, kickerText, laneRule, objectPhrase, rankLabel, waitingText } from './detailText';
import type { Prepared } from './prepare';
import { CHIP_CLASS, chipLabel, chipTone, TIMING_CLASS, timingOf } from './queueView';
import { taskMark, TASK_MARK_LABEL } from './personRows';
import { RelationIcon, SystemIcon, TaskMarkIcon } from './taskMarks';
import type { SourceKind, TodayItem } from './todayModel';
import { PANEL_PRIMARY, PanelBlock, PanelHeader, useSectionState } from '@/shared/components/mason';
import { cn } from '@/shared/lib/utils';

const SOURCE_ICON: Record<SourceKind, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  email: Mail,
  stripe: CreditCard,
  order: FileText,
  pricelist: BookOpen,
  rule: Clock,
  calllog: Phone,
};

const OUTLINE = 'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gardens-bdr bg-white px-3 text-[13px] font-semibold text-gardens-tx hover:bg-gardens-page';
const GHOST = 'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-3 text-[13px] text-gardens-txs hover:bg-gardens-page hover:text-gardens-tx';

const WAITING_CLASS = {
  us: 'border-transparent bg-gardens-na-red-lt text-gardens-na-red',
  them: 'border-transparent bg-gardens-na-blue-lt text-gardens-na-blue',
  record: 'border-transparent bg-gardens-na-amber-lt text-gardens-na-amber',
} as const;

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
  /** Editable message body. The header sends this text. */
  draft?: string;
  onDraft?: (value: string) => void;
}> = ({
  item, rank, total, now, doneVerb, customer, system, also = [], onOpenAlso, prepared, busy, error, showCallInstead,
  onPrimary, onEdit, onTomorrow, onDismiss, onCallOutcome, onCallInstead, onClose, draft = '', onDraft,
}) => {
  const { isOpen, toggle } = useSectionState();
  const tone = chipTone(item, !!doneVerb);
  const timing = timingOf(item, doneVerb);
  const Icon = KIND_ICON[item.kind];
  const need = capitalise(objectPhrase(item));
  const aside = prepared?.type === 'message' ? prepared.channel : prepared?.type === 'call' ? prepared.to : prepared?.title;

  const subject = subjectLine(item);
  const primaryLabel = prepared?.primary ?? null;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden bg-gardens-surf2" data-testid="today-detail" aria-label={item.name}>
      <PanelHeader
        kicker={(
          <>
            {system ? (
              <span title="System" className="inline-flex shrink-0 text-gardens-tx">
                <SystemIcon className="h-3.5 w-3.5" />
              </span>
            ) : customer != null && (
              <span title={customer ? 'Customer' : 'Enquiry'} className="inline-flex shrink-0 text-gardens-tx">
                <RelationIcon customer={customer} className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="min-w-0 truncate">{kickerText(item)}</span>
            <span className="shrink-0" data-testid="today-rank">{rankLabel(rank, total)}</span>
          </>
        )}
        name={item.name}
        source={subject ? <span className="line-clamp-2 break-words text-[14px] leading-5 text-gardens-txs">{subject}</span> : undefined}
        action={primaryLabel ? (
          <button type="button" data-testid="today-primary" disabled={busy} onClick={onPrimary} className={PANEL_PRIMARY}>
            {primaryLabel}
          </button>
        ) : undefined}
        onClose={onClose}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <div className="flex flex-wrap items-center gap-1.5 px-6 pt-3">
            <span
              data-testid="today-detail-chip"
              className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold', CHIP_CLASS[tone])}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
              {chipLabel(item, !!doneVerb)}
            </span>
            <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold', WAITING_CLASS[item.waitingOn])} data-testid="today-waiting">
              {waitingText(item, now)}
            </span>
            <span className={cn('inline-flex h-6 items-center rounded-full border border-gardens-bdr px-2.5 text-[12px] font-semibold', TIMING_CLASS[timing.tone])}>
              {timing.text}
            </span>
            <span className="inline-flex h-6 items-center rounded-full border border-gardens-bdr px-2.5 text-[12px] text-gardens-txs">
              {laneRule(item.lane, item.kind)}
            </span>
          </div>
          <PanelBlock id="prepared" title="Prepared" icon={FileText} open={isOpen('prepared')} onToggle={toggle} aside={aside} className="flex flex-1 flex-col">
            {prepared ? (
              <PreparedBody prepared={prepared} taskTitle={need} draft={draft} onDraft={onDraft} busy={busy} />
            ) : (
              <p className="m-0 text-[13px] text-gardens-txs">Nothing is prepared for this yet.</p>
            )}
            {error && <p className="m-0 mt-2 text-[13px] text-gardens-na-red">{error}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {prepared?.type === 'call' && prepared.outcomes.map((outcome) => (
                <button key={outcome} type="button" data-testid="today-outcome" disabled={busy} onClick={() => onCallOutcome(outcome)} className={OUTLINE}>
                  {outcome}
                </button>
              ))}
              {!prepared && (
                <button type="button" data-testid="today-primary" disabled={busy} onClick={onEdit} className={OUTLINE}>
                  Open in panel
                </button>
              )}
              {prepared && (
                <button type="button" onClick={onEdit} className={OUTLINE}>Edit</button>
              )}
              {showCallInstead && onCallInstead && (
                <button type="button" onClick={onCallInstead} className={OUTLINE}>Call instead</button>
              )}
              <span className="flex flex-wrap items-center gap-1">
                <button type="button" data-testid="today-tomorrow" onClick={onTomorrow} className={GHOST}>Tomorrow</button>
                <button type="button" data-testid="today-dismiss" onClick={onDismiss} className={GHOST}>Not needed</button>
              </span>
            </div>
          </PanelBlock>

          <PanelBlock id="why" title="Why it's on your list" icon={Clock} open={isOpen('why')} onToggle={toggle}>
              <ul className="m-0 list-none space-y-2 p-0" data-testid="today-why">
                {item.reasons.map((fact) => (
                  <li key={`${fact.source.label}:${fact.text}`} className="text-[13px] leading-snug text-gardens-tx">
                    <span className={fact.suggested ? 'text-gardens-acc' : 'text-gardens-txs'} aria-hidden>{fact.suggested ? '✦' : '•'}</span>
                    {' '}{fact.text}
                    <span className={cn('mt-0.5 block text-xs', fact.suggested ? 'text-gardens-acc' : 'text-gardens-txm-aa')}>
                      {fact.suggested ? '✦ ' : ''}{fact.source.label}
                    </span>
                  </li>
                ))}
              </ul>
              {item.factors.length > 0 && (
                <div className="mt-3 border-t border-gardens-bdr pt-2.5">
                  <p className="m-0 text-xs font-semibold text-gardens-txs">What sets its place in the list</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {item.factors.map((factor) => (
                      <span key={factor} className="inline-flex h-6 items-center rounded-lg bg-gardens-page px-2 text-[12px] text-gardens-tx">{factor}</span>
                    ))}
                  </div>
                </div>
              )}
            </PanelBlock>
            <PanelBlock id="evidence" title="Evidence" icon={FileText} open={isOpen('evidence')} onToggle={toggle}>
              <ol className="m-0 list-none p-0" data-testid="today-evidence">
                {item.evidence.map((entry, i) => {
                  const SourceIcon = SOURCE_ICON[entry.source.kind] ?? FileText;
                  return (
                    <li key={`${entry.source.label}:${i}`} className={cn('flex gap-2 py-2', i > 0 && 'border-t border-gardens-bdr')}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gardens-page text-gardens-txs">
                        <SourceIcon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-semibold text-gardens-tx">{entry.source.label}</span>
                          <span className="text-xs text-gardens-txm-aa">{formatWhen(entry.at, now)}</span>
                          {entry.href && (
                            <a href={entry.href} className="ml-auto shrink-0 text-xs font-semibold text-gardens-acc-dk">Open ↗</a>
                          )}
                        </div>
                        <p className={cn('m-0 mt-1 text-[13px] text-gardens-tx', entry.quote && 'border-l-2 border-gardens-bdr2 pl-2.5 font-head italic')}>
                          {entry.text}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </PanelBlock>
        {also.length > 0 && (
          <div className="px-3 pb-2" data-testid="today-also">
            <p className="m-0 px-3 pt-1 text-xs font-semibold text-gardens-txs">Also for this person</p>
            {also.map((task) => {
              const mark = taskMark(task);
              const timing = timingOf(task, undefined);
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
                  <span className={cn('w-[6.75rem] shrink-0 text-right text-[12px] font-bold tabular-nums', TIMING_CLASS[timing.tone])}>{timing.text}</span>
                </button>
              );
            })}
          </div>
        )}
        <p className="hidden px-6 pb-4 text-xs text-gardens-txm-aa [@media(hover:hover)]:block" data-testid="today-keys">
          j / k to move · e to send · t for tomorrow
        </p>
      </div>
    </section>
  );
};

function subjectLine(item: TodayItem): string {
  const subject = item.subject?.replace(/\s+/g, ' ').trim();
  if (subject) return subject;
  return capitalise(objectPhrase(item));
}

/** A card sends something when its primary is a send, not a record or a call log. */
function sendsSomething(prepared: Prepared): boolean {
  if (prepared.type === 'message') return true;
  return prepared.type === 'fields' && (prepared.target === 'permit' || prepared.target === 'stone');
}

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
    el.style.height = `${Math.min(el.scrollHeight, 256)}px`;
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
      className="max-h-64 w-full resize-none overflow-y-auto rounded-md border border-gardens-bdr bg-gardens-surf2 px-2.5 py-2 text-[13px] leading-relaxed text-gardens-tx"
    />
  );
}

const PreparedBody: React.FC<{
  prepared: Prepared;
  taskTitle: string;
  draft: string;
  onDraft?: (value: string) => void;
  busy?: boolean;
}> = ({ prepared, taskTitle, draft, onDraft, busy }) => (
  <div className="flex min-h-0 flex-1 flex-col gap-2">
    <div className={prepared.type === 'message' ? 'min-w-0' : 'flex min-h-[8rem] min-w-0 flex-1 flex-col'}>
      {prepared.type === 'fields' ? (
        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)]">
          {prepared.fields.map((field) => (
            <React.Fragment key={field.label}>
              <div className="border-t border-gardens-bdr py-2 text-[13px] text-gardens-txs">{field.label}</div>
              <div className="border-t border-gardens-bdr py-2">
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
        <div className="min-h-[8rem] flex-1 space-y-2">
          {prepared.notes.map((para) => (
            <p key={para} className="m-0 whitespace-pre-line text-[13px] leading-relaxed text-gardens-tx">{para}</p>
          ))}
        </div>
      )}
    </div>
    <p className="m-0 flex flex-wrap items-baseline gap-x-1 gap-y-1 border-t border-gardens-bdr pt-2 text-[12px] leading-5 text-gardens-txs">
      <span className="text-gardens-acc">✦</span>
      <span>Prepared from:</span>
      <span className="break-words text-gardens-tx">{taskTitle}</span>
      {prepared.uses.map((use) => (
        <span key={use} className="inline break-words rounded bg-gardens-page px-1.5 text-gardens-acc-dk">{use}</span>
      ))}
      {sendsSomething(prepared) && <span>· check before sending</span>}
    </p>
  </div>
);
