import { BookOpen, Clock, CreditCard, FileText, Mail, MessageCircle, Phone, X } from 'lucide-react';
import React from 'react';
import { KIND_ICON } from './actionKind';
import { capitalise, formatWhen, itemNeedLong, kickerText, laneRule, objectPhrase, rankLabel, waitingText } from './detailText';
import type { Prepared } from './prepare';
import { CHIP_CLASS, chipLabel, chipTone, TIMING_CLASS, timingOf } from './queueView';
import { taskMark, TASK_MARK_LABEL } from './personRows';
import { RelationIcon, SystemIcon, TaskMarkIcon } from './taskMarks';
import type { SourceKind, TodayItem } from './todayModel';
import { PANEL_HEADER_CLASS, PANEL_PRIMARY, PanelBlock, useSectionState } from '@/shared/components/mason';
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
}> = ({
  item, rank, total, now, doneVerb, customer, system, also = [], onOpenAlso, prepared, busy, error, showCallInstead,
  onPrimary, onEdit, onTomorrow, onDismiss, onCallOutcome, onCallInstead, onClose,
}) => {
  const { isOpen, toggle } = useSectionState();
  const tone = chipTone(item, !!doneVerb);
  const timing = timingOf(item, doneVerb);
  const Icon = KIND_ICON[item.kind];
  const need = capitalise(objectPhrase(item));
  const aside = prepared?.type === 'message' ? prepared.channel : prepared?.type === 'call' ? prepared.to : prepared?.title;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden bg-gardens-surf2" data-testid="today-detail" aria-label={item.name}>
      <header className={cn(PANEL_HEADER_CLASS, 'flex flex-col gap-2.5')}>
        <div className={cn('flex items-baseline justify-between gap-3', onClose && 'pr-12')}>
          <p className="m-0 flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold tabular-nums text-gardens-txm-aa">
            {system ? (
              <span title="System" className="inline-flex shrink-0 text-gardens-tx">
                <SystemIcon className="h-3.5 w-3.5" />
              </span>
            ) : customer != null && (
              <span title={customer ? 'Customer' : 'Enquiry'} className="inline-flex shrink-0 text-gardens-tx">
                <RelationIcon customer={customer} className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="truncate">{kickerText(item)}</span>
          </p>
          <p className="m-0 shrink-0 text-xs tabular-nums text-gardens-txm-aa" data-testid="today-rank">{rankLabel(rank, total)}</p>
        </div>
        <div className="flex items-center gap-3.5">
          <span
            data-testid="today-detail-chip"
            className={cn('inline-flex h-11 shrink-0 items-center gap-2 rounded-lg pl-3 pr-3.5 text-[16px] font-bold', CHIP_CLASS[tone])}
          >
            <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={2.2} aria-hidden />
            {chipLabel(item, !!doneVerb)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 line-clamp-2 break-words font-head text-[22px] font-semibold leading-tight text-gardens-tx">{need}</h2>
            <p className="m-0 line-clamp-2 break-words text-[14px] leading-5 text-gardens-txs">{item.name} · {itemNeedLong(item)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold', WAITING_CLASS[item.waitingOn])} data-testid="today-waiting">
            {waitingText(item, now)}
          </span>
          <span className={cn('inline-flex h-6 items-center rounded-full border border-gardens-bdr px-2.5 text-[12px] font-semibold', TIMING_CLASS[timing.tone])}>
            {timing.text}
          </span>
          <span className="inline-flex h-6 items-center rounded-full border border-gardens-bdr px-2.5 text-[12px] text-gardens-txs">
            {laneRule(item.lane)}
          </span>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-gardens-txs hover:bg-gardens-page">
            <X className="h-5 w-5" aria-hidden />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <PanelBlock id="prepared" title="Prepared" icon={FileText} open={isOpen('prepared')} onToggle={toggle} aside={aside} className="lg:h-full">
            {prepared ? <PreparedBody prepared={prepared} taskTitle={need} /> : (
              <p className="m-0 text-[13px] text-gardens-txs">Nothing is prepared for this yet.</p>
            )}
            {error && <p className="m-0 mt-2 text-[13px] text-gardens-na-red">{error}</p>}
            <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto">
              {prepared?.type === 'call' ? (
                <>
                  <button type="button" data-testid="today-primary" disabled={busy} onClick={onPrimary} className={cn(PANEL_PRIMARY, 'shrink-0')}>
                    {prepared.primary}
                  </button>
                  {prepared.outcomes.map((outcome) => (
                    <button key={outcome} type="button" data-testid="today-outcome" disabled={busy} onClick={() => onCallOutcome(outcome)} className={OUTLINE}>
                      {outcome}
                    </button>
                  ))}
                </>
              ) : (
                <button
                  type="button"
                  data-testid="today-primary"
                  disabled={busy}
                  onClick={prepared ? onPrimary : onEdit}
                  className={cn(prepared ? PANEL_PRIMARY : OUTLINE, 'shrink-0')}
                >
                  {prepared ? prepared.primary : 'Open in panel'}
                </button>
              )}
              {prepared && (
                <button type="button" onClick={onEdit} className={OUTLINE}>Edit</button>
              )}
              {showCallInstead && onCallInstead && (
                <button type="button" onClick={onCallInstead} className={OUTLINE}>Call instead</button>
              )}
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <button type="button" data-testid="today-tomorrow" onClick={onTomorrow} className={GHOST}>Tomorrow</button>
                <button type="button" data-testid="today-dismiss" onClick={onDismiss} className={GHOST}>Not needed</button>
              </span>
            </div>
          </PanelBlock>

          <div className="flex min-w-0 flex-col lg:h-full">
            <PanelBlock id="why" title="Why it's on your list" icon={Clock} open={isOpen('why')} onToggle={toggle} className="lg:flex-1">
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
            <PanelBlock id="evidence" title="Evidence" icon={FileText} open={isOpen('evidence')} onToggle={toggle} className="lg:flex-1">
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
          </div>
        </div>
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

const PreparedBody: React.FC<{ prepared: Prepared; taskTitle: string }> = ({ prepared, taskTitle }) => (
  <div className="space-y-2">
    {prepared.type === 'fields' ? (
      <div className="grid grid-cols-[7.5rem_minmax(0,1fr)]">
        {prepared.fields.map((field) => (
          <React.Fragment key={field.label}>
            <div className="border-t border-gardens-bdr py-2 text-[13px] text-gardens-txs">{field.label}</div>
            <div className="border-t border-gardens-bdr py-2">
              <div className={cn('text-[13px] font-semibold', field.note === 'missing' || !field.value ? 'text-gardens-na-red' : 'text-gardens-tx')}>
                {field.value || 'Missing'}
              </div>
              <div className={cn('text-xs', noteClass(field.note))}>{field.note}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
    ) : (
      <div className="space-y-2">
        {(prepared.type === 'message' ? prepared.body : prepared.notes).map((para) => (
          <p key={para} className="m-0 whitespace-pre-line text-[13px] leading-relaxed text-gardens-tx">{para}</p>
        ))}
      </div>
    )}
    <p className="m-0 flex flex-wrap items-baseline gap-x-1 gap-y-1 border-t border-gardens-bdr pt-2 text-[12px] leading-5 text-gardens-txs">
      <span className="text-gardens-acc">✦</span>
      <span>Prepared from:</span>
      <span className="break-words text-gardens-tx">{taskTitle}</span>
      {prepared.uses.map((use) => (
        <span key={use} className="inline break-words rounded bg-gardens-page px-1.5 text-gardens-acc-dk">{use}</span>
      ))}
      <span>· check before sending</span>
    </p>
  </div>
);
