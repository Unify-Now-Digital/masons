import type { NextAction } from '@/shared/lib/nextAction';

/**
 * hub-v3 "Today's plan": per-team daily caps (SM team input, v3-input/sm-*.md),
 * ordered ⚑ hard deadline ≤7d → promise passed / chased → longest waiting on us →
 * ready to move → holds. Overflow rolls to tomorrow keeping its age.
 */
export type Team = 'Sales' | 'CS' | 'Permits' | 'Finance';
export const TEAM_CAPS: Record<Team, number> = { Sales: 15, CS: 10, Permits: 7, Finance: 2 };

export type PlanGroup = 'deadline' | 'promise' | 'waiting' | 'ready' | 'hold';
export const GROUP_LABEL: Record<PlanGroup, string> = {
  deadline: '⚑ Hard deadline ≤ 7 days',
  promise: 'Promise passed · customer chased',
  waiting: 'Longest waiting on us',
  ready: 'Ready to move',
  hold: 'On hold',
};
const GROUP_RANK: Record<PlanGroup, number> = { deadline: 0, promise: 1, waiting: 2, ready: 3, hold: 4 };

export interface PlanInput {
  key: string;
  team: Team;
  name: string;
  context: string;
  explanation: string;
  action: NextAction;
  to: string;
  /** Hard deadline (e.g. fixing date) ISO, if any. */
  deadlineAt?: string | null;
  /** True when we promised something and missed it / customer chased. No source yet. */
  promisePassed?: boolean;
  /** Ms the item has been waiting on us (age). */
  waitingMs: number;
  ball: 'us' | 'customer' | 'cemetery';
  hold?: boolean;
}

export interface PlanItem extends PlanInput {
  group: PlanGroup;
}

const DAY = 86_400_000;

export function planGroup(i: PlanInput, now: number): PlanGroup {
  if (i.deadlineAt) {
    const t = Date.parse(i.deadlineAt);
    if (Number.isFinite(t) && t - now <= 7 * DAY) return 'deadline';
  }
  if (i.promisePassed) return 'promise';
  if (i.hold) return 'hold';
  if (i.ball === 'us') return 'waiting';
  return 'ready';
}

export interface Plan {
  today: PlanItem[];
  tomorrow: PlanItem[];
  byTeam: Record<Team, { planned: number; total: number }>;
  hardDeadlines: number;
}

export function buildPlan(items: PlanInput[], now: number = Date.now()): Plan {
  const withGroup = items
    .map((i) => ({ ...i, group: planGroup(i, now) }))
    .sort((a, b) => GROUP_RANK[a.group] - GROUP_RANK[b.group] || b.waitingMs - a.waitingMs);
  const byTeam = Object.fromEntries((Object.keys(TEAM_CAPS) as Team[]).map((t) => [t, { planned: 0, total: 0 }])) as Plan['byTeam'];
  const today: PlanItem[] = [];
  const tomorrow: PlanItem[] = [];
  const capUsed: Partial<Record<Team, number>> = {};
  for (const i of withGroup) {
    const t = byTeam[i.team];
    t.total += 1;
    // Hard deadlines always make today's plan and don't use up the team cap.
    if (i.group === 'deadline') {
      t.planned += 1;
      today.push(i);
    } else if ((capUsed[i.team] ?? 0) < TEAM_CAPS[i.team]) {
      capUsed[i.team] = (capUsed[i.team] ?? 0) + 1;
      t.planned += 1;
      today.push(i);
    } else tomorrow.push(i);
  }
  return { today, tomorrow, byTeam, hardDeadlines: withGroup.filter((i) => i.group === 'deadline').length };
}

/** Permits row (hub-v3): maps current permit_status values; 'ready_to_submit' needs the new column. */
export const PERMIT_STAGES: { key: string; label: string; next: string; statuses: string[] | null }[] = [
  { key: 'needs', label: 'Needs form', next: 'Send form →', statuses: ['not_started'] },
  { key: 'family', label: 'With family', next: 'Chase >7d →', statuses: ['form_sent'] },
  { key: 'returned', label: 'Returned · check', next: 'Validate →', statuses: ['customer_completed', 'returned_incomplete'] },
  { key: 'ready', label: 'Ready to submit', next: 'needs validation field', statuses: ['ready_to_submit'] },
  { key: 'council', label: 'With council', next: 'Chase >14d →', statuses: ['pending'] },
  { key: 'approved', label: 'Approved', next: 'done', statuses: ['approved'] },
];

export function permitStageCounts(statuses: (string | null)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of PERMIT_STAGES) out[s.key] = statuses.filter((x) => x != null && s.statuses!.includes(x)).length;
  return out;
}
