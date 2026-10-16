/**
 * Fixture preview of the Today layout. No live organisation data.
 * Open /preview/today.
 */
import React, { useEffect, useState } from 'react';
import { DockedContext } from '@/shared/components/mason/DockedContext';
import type { ActivityEvent } from '@/modules/today/recentActivity';
import { TodayDetail } from '@/modules/today/TodayDetail';
import { TodayQueue } from '@/modules/today/TodayQueue';
import { todayColumns, type TodayColumns, type TodayGroupBy, type TodayView } from '@/modules/today/queueView';
import type { PersonRow } from '@/modules/today/personRows';
import type { Prepared } from '@/modules/today/prepare';
import { LANES, Tier, type Lane, type TodayItem } from '@/modules/today/todayModel';

const NOW = new Date('2026-10-16T09:30:00Z');

type RowItem = TodayItem & { prepared: Prepared | null };

function task(partial: Partial<RowItem> & Pick<RowItem, 'key' | 'lane' | 'name' | 'kind' | 'bucket' | 'prepared'>): RowItem {
  return {
    verb: 'CHASE',
    colour: 'red',
    tier: Tier.WaitingOnUs,
    why: 'They wrote and we have not replied.',
    to: '/dashboard/inbox',
    daysSinceOut: 4,
    quietDays: 4,
    carriedDays: 1,
    waitingOn: 'us',
    waitingSince: new Date('2026-10-09T10:00:00Z'),
    lateBy: 72,
    factors: ['Late', 'Waiting on us'],
    evidence: [],
    short: 'a reply',
    ...partial,
    reasons: partial.reasons ?? [{ text: partial.why ?? 'They wrote and we have not replied.', source: { kind: 'whatsapp', label: 'WhatsApp' } }],
  };
}

const haleChase = task({
  key: 'hale-chase',
  lane: 'Sales',
  name: 'Margaret Hale',
  personId: 'p-hale',
  kind: 'chase',
  bucket: 'late',
  verb: 'CHASE',
  ref: 'Q-1042',
  valueGbp: 2480,
  orderId: null,
  channel: 'whatsapp',
  lateBy: 168,
  why: 'The quote has been quiet for seven days.',
  snippet: 'Could you send the proof of the inscription when you have a moment?',
  lastInAt: '2026-10-09T10:00:00Z',
  short: 'the quiet quote',
  factors: ['7 days quiet', 'Quote value', 'Waiting on us'],
  prepared: {
    type: 'message',
    channel: 'whatsapp',
    to: 'Margaret Hale',
    primary: 'Send & next',
    uses: ['WhatsApp 9 Oct', 'Quote Q-1042'],
    body: [
      'Hello Margaret, thank you for your note about the proof.',
      'I have the inscription in front of me and I will send the proof across today. Please tell me if any wording should change before we go further.',
    ],
  },
});

const halePermit = task({
  key: 'hale-permit',
  lane: 'Permits',
  name: 'Margaret Hale',
  personId: 'p-hale',
  orderId: 'ord-hale',
  kind: 'send',
  bucket: 'today',
  verb: 'Send form',
  colour: 'amber',
  lateBy: -5,
  why: 'The cemetery form is ready to send.',
  short: 'the cemetery form',
  prepared: null,
});

const dean = task({
  key: 'dean-reply',
  lane: 'CS',
  name: 'Dean (no surname)',
  personId: 'p-dean',
  orderId: 'ord-dean',
  kind: 'reply',
  bucket: 'late',
  verb: 'REPLY',
  ref: 'ORD-000245',
  channel: 'email',
  lateBy: 48,
  why: 'Dean asked about the fixing date.',
  snippet: 'Is the stone still due next Thursday?',
  lastInAt: '2026-10-14T11:00:00Z',
  short: 'the fixing date',
  factors: ['2 days late', 'Customer waiting'],
  prepared: {
    type: 'message',
    channel: 'email',
    to: 'dean@example.com',
    primary: 'Send & next',
    uses: ['Email 14 Oct', 'Order ORD-000245'],
    body: ['Hello Dean, the fixing is still booked for Thursday. I will confirm with the cemetery this afternoon.'],
  },
});

const priya = task({
  key: 'priya-reply',
  lane: 'Sales',
  name: 'Priya Shah',
  personId: 'p-priya',
  kind: 'reply',
  bucket: 'today',
  verb: 'REPLY',
  colour: 'amber',
  channel: 'email',
  lateBy: -3,
  waitingOn: 'us',
  why: 'A new enquiry came in this morning.',
  short: 'a new enquiry',
  prepared: null,
});

const james = task({
  key: 'james-proof',
  lane: 'Proofs',
  name: 'James Whitfield',
  personId: 'p-james',
  orderId: 'ord-james',
  kind: 'send',
  bucket: 'today',
  verb: 'Send proof',
  colour: 'amber',
  ref: 'ORD-000188',
  lateBy: -3,
  why: 'The proof is drawn and ready to send.',
  short: 'the drawn proof',
  prepared: {
    type: 'fields',
    title: 'Send proof',
    target: 'open',
    primary: 'Open proof',
    uses: ['Proof v2'],
    fields: [{ label: 'Proof', value: 'Version 2', note: 'drawn today' }],
  },
});

const helen = task({
  key: 'helen-pay',
  lane: 'Finance',
  name: 'Helen Crowe',
  personId: 'p-helen',
  orderId: 'ord-helen',
  kind: 'order',
  bucket: 'today',
  verb: 'Record payment',
  colour: 'blue',
  ref: 'ORD-000090',
  lateBy: -8,
  why: 'A balance is ready to record.',
  short: 'the balance',
  prepared: {
    type: 'fields',
    title: 'Record payment',
    target: 'payments',
    primary: 'Record payment',
    uses: ['Invoice 1044'],
    fields: [{ label: 'Balance', value: '£640', note: 'on the invoice' }],
  },
});

const robert = task({
  key: 'robert-done',
  lane: 'Sales',
  name: 'Robert Ellis',
  personId: 'p-robert',
  kind: 'reply',
  bucket: 'today',
  verb: 'REPLY',
  colour: 'green',
  lateBy: 0,
  why: 'Replied this morning.',
  short: 'the reply',
  prepared: null,
});

const PEOPLE: PersonRow[] = [
  { key: 'p-hale', personId: 'p-hale', name: 'Margaret Hale', customer: true, system: false, tasks: [haleChase, halePermit], lead: haleChase, done: false },
  { key: 'p-dean', personId: 'p-dean', name: 'Dean (no surname)', customer: true, system: false, tasks: [dean], lead: dean, done: false },
  { key: 'p-priya', personId: 'p-priya', name: 'Priya Shah', customer: false, system: false, tasks: [priya], lead: priya, done: false },
  { key: 'p-james', personId: 'p-james', name: 'James Whitfield', customer: true, system: false, tasks: [james], lead: james, done: false },
  { key: 'p-helen', personId: 'p-helen', name: 'Helen Crowe', customer: true, system: false, tasks: [helen], lead: helen, done: false },
  { key: 'p-robert', personId: 'p-robert', name: 'Robert Ellis', customer: true, system: false, tasks: [robert], lead: robert, done: true, doneVerb: 'Sent' },
];

const DOCK: Record<string, { kind: string; contact: string; record: string; product: string; spec: string; facts: { label: string; value: string; tone?: 'amber' | 'green' | 'muted' }[]; others: string; events: ActivityEvent[] }> = {
  'p-hale': {
    kind: 'Enquiry',
    contact: 'margaret@example.com · WhatsApp 07700 900123',
    record: 'Quote',
    product: 'Ogee headstone',
    spec: 'Grey granite, light',
    facts: [
      { label: 'Quote', value: 'Q-1042' },
      { label: 'Stage', value: 'Quoted', tone: 'muted' },
      { label: 'Cemetery', value: 'Sutton Road' },
    ],
    others: 'None',
    events: [
      { id: 'e1', at: '2026-10-09T10:00:00Z', when: '9 Oct', title: 'They wrote', quote: 'Could you send the proof of the inscription when you have a moment?', href: '/preview/today', icon: 'message' },
      { id: 'e2', at: '2026-10-02T09:00:00Z', when: '2 Oct', title: 'Quote sent', detail: 'Q-1042', href: '/preview/today', icon: 'file' },
      { id: 'e3', at: '2026-10-01T09:00:00Z', when: '1 Oct', title: 'We wrote', quote: 'The quote is attached.', href: '/preview/today', icon: 'message' },
      { id: 'e4', at: '2026-09-28T09:00:00Z', when: '28 Sep', title: 'Quote created', detail: 'Q-1042', href: '/preview/today', icon: 'file' },
    ],
  },
  'p-dean': {
    kind: 'Customer',
    contact: 'dean@example.com · 07700 900456',
    record: 'Order',
    product: 'Lawn memorial',
    spec: 'Black granite',
    facts: [
      { label: 'Order', value: 'ORD-000245' },
      { label: 'Stone', value: 'Not ordered', tone: 'amber' },
      { label: 'Cemetery', value: 'All Saints' },
    ],
    others: '1 · ORD-000100',
    events: [
      { id: 'd1', at: '2026-10-14T11:00:00Z', when: '14 Oct', title: 'They wrote', quote: 'Is the stone still due next Thursday?', href: '/preview/today', icon: 'mail' },
      { id: 'd2', at: '2026-10-10T09:00:00Z', when: '10 Oct', title: 'Proof sent', detail: 'Version 1', href: '/preview/today', icon: 'proof' },
    ],
  },
};

function useColumns(): TodayColumns {
  const [cols, setCols] = useState<TodayColumns>(() => todayColumns());
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const wide = window.matchMedia('(min-width: 1280px)');
    const mid = window.matchMedia('(min-width: 1024px)');
    const apply = () => setCols(wide.matches ? 'three' : mid.matches ? 'split' : 'queue');
    apply();
    wide.addEventListener?.('change', apply);
    mid.addEventListener?.('change', apply);
    return () => {
      wide.removeEventListener?.('change', apply);
      mid.removeEventListener?.('change', apply);
    };
  }, []);
  return cols;
}

export default function TodayPreview() {
  const cols = useColumns();
  const [view, setView] = useState<TodayView>('All');
  const [groupBy, setGroupBy] = useState<TodayGroupBy>('urgency');
  const [selectedKey, setSelectedKey] = useState('p-hale');
  const [taskKey, setTaskKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState('');

  const visible = view === 'All' ? PEOPLE : PEOPLE.filter((row) => row.lead.lane === view || row.tasks.some((item) => item.lane === view));
  const person = visible.find((row) => row.key === selectedKey) ?? visible[0] ?? null;
  const selected = (person?.tasks.find((item) => item.key === taskKey) ?? person?.lead ?? null) as RowItem | null;
  const rank = person ? visible.findIndex((row) => row.key === person.key) + 1 : 0;
  const prepared = selected?.prepared ?? null;
  const draft = selected && prepared?.type === 'message'
    ? (drafts[selected.key] ?? prepared.body.join('\n\n'))
    : '';
  const dock = person ? DOCK[person.key] ?? DOCK['p-hale'] : DOCK['p-hale'];
  const actionDocked = cols !== 'queue';

  const rowsFor = (lane: Lane) => PEOPLE.filter((row) => row.lead.lane === lane || row.tasks.some((item) => item.lane === lane));

  const onSelect = (row: PersonRow) => {
    setSelectedKey(row.key);
    setTaskKey(null);
    if (cols === 'queue') setSheetOpen(true);
  };

  const detail = person && selected ? (
    <TodayDetail
      item={selected}
      rank={rank}
      total={visible.length}
      now={NOW}
      doneVerb={person.done ? person.doneVerb : undefined}
      customer={person.customer}
      also={person.tasks.filter((item) => item.key !== selected.key)}
      onOpenAlso={(item) => setTaskKey(item.key)}
      prepared={prepared}
      showCallInstead={false}
      onPrimary={() => setOpened('send')}
      onEdit={() => setOpened('edit')}
      onTomorrow={() => setOpened('tomorrow')}
      onDismiss={() => setOpened('dismiss')}
      onCallOutcome={() => {}}
      onClose={actionDocked ? undefined : () => setSheetOpen(false)}
      showOpenFull={cols !== 'three'}
      onOpenFull={() => setOpened('full')}
      draft={draft}
      onDraft={(value) => setDrafts((prev) => ({ ...prev, [selected.key]: value }))}
    />
  ) : null;

  const grid = cols === 'three'
    ? 'min-[1280px]:grid min-[1280px]:h-full min-[1280px]:grid-cols-[372px_minmax(0,1fr)_360px]'
    : cols === 'split'
      ? 'lg:grid lg:h-full lg:grid-cols-[372px_minmax(0,1fr)]'
      : '';

  return (
    <div className="h-dvh min-h-0 bg-gardens-page" data-opened={opened}>
      <div
        className={`flex h-full min-h-0 w-full flex-col overflow-x-hidden lg:overflow-hidden ${grid}`}
        data-testid="today"
        data-columns={cols}
      >
        <TodayQueue
          allRows={PEOPLE}
          rows={visible}
          later={[]}
          showLater={false}
          onToggleLater={() => {}}
          lanes={[...LANES]}
          view={view}
          onView={setView}
          rowsFor={rowsFor}
          groupBy={groupBy}
          onGroupBy={setGroupBy}
          now={NOW}
          selectedKey={person?.key ?? null}
          onSelect={onSelect}
          emptyText="Nothing to do in this list."
        />
        {actionDocked && detail}
        {cols === 'three' && person && (
          <DockedContext
            testId="today-dock"
            kindLabel={dock.kind}
            name={person.name}
            contact={dock.contact}
            onOpenFull={() => setOpened('full')}
            events={dock.events}
            recordLabel={dock.record}
            productName={dock.product}
            productHref="/preview/today"
            specLine={dock.spec}
            facts={dock.facts}
            otherOrders={dock.others}
          />
        )}
        {!actionDocked && sheetOpen && detail && (
          <div className="fixed inset-0 z-50 flex min-h-0 flex-col bg-gardens-surf2" role="dialog" aria-label="Today" data-testid="today-sheet">
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
