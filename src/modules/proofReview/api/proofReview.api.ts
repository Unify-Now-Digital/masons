import { supabase } from '@/shared/lib/supabase';

export type ProofState =
  | 'not_started'
  | 'generating'
  | 'draft'
  | 'sent'
  | 'approved'
  | 'changes_requested'
  | 'failed';

export type ProofCheckLevel = 'pass' | 'info' | 'warn' | 'fail';

export interface ProofCheck {
  id: string;
  version: number;
  level: ProofCheckLevel;
  label: string;
  suggest: string | null;
  dismissedAt: string | null;
}

export interface ProofVersionEvent {
  id: string;
  version: number;
  event: string;
  actor: string;
  note: string | null;
  renderUrl: string | null;
  daysFromInscription: number | null;
  createdAt: string;
}

export interface ProofItem {
  id: string;
  orderId: string;
  orderNumber: number | null;
  customerName: string;
  state: ProofState;
  inscriptionText: string | null;
  fontStyle: string | null;
  renderUrl: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  changesRequestedAt: string | null;
  inscriptionReceivedAt: string | null;
  daysSinceInscription: number | null;
  daysSinceSent: number | null;
  version: number;
  versions: ProofVersionEvent[];
  aiChecks: ProofCheck[];
  isOverdue: boolean;
  isApproaching: boolean;
}

export interface ProofPayload {
  queue: ProofItem[];
  recentlyApproved: ProofItem[];
  totals: {
    drafting: number;
    awaiting: number;
    approvedThisMonth: number;
    overdue: number;
  };
  targetDays: number;
}

const DAY = 1000 * 60 * 60 * 24;

export async function fetchProofPayload(organizationId: string): Promise<ProofPayload> {
  // SLA target — fall back to 3 days if workflow_slas isn't seeded yet
  let targetDays = 3;
  try {
    const { data: slaRow } = await supabase
      .from('workflow_slas')
      .select('target_days')
      .eq('organization_id', organizationId)
      .eq('workflow', 'proof')
      .eq('stage', 'first_proof')
      .maybeSingle();
    if (slaRow?.target_days) targetDays = slaRow.target_days as number;
  } catch {
    // table may not exist yet
  }

  // Active proofs — anything not yet approved
  let proofRows: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await supabase
      .from('order_proofs')
      .select(
        `id, order_id, state, inscription_text, font_style, render_url, sent_at, approved_at, changes_requested_at, inscription_received_at, created_at,
         orders:orders!inner(id, organization_id, order_number, customer_name)`,
      )
      .eq('orders.organization_id', organizationId);
    if (error) throw error;
    proofRows = data ?? [];
  } catch {
    proofRows = [];
  }

  if (proofRows.length === 0) {
    return {
      queue: [],
      recentlyApproved: [],
      totals: { drafting: 0, awaiting: 0, approvedThisMonth: 0, overdue: 0 },
      targetDays,
    };
  }

  // Versions + checks for the proofs
  const proofIds = proofRows.map((r) => (r as { id: string }).id);
  let versionsRows: Array<Record<string, unknown>> = [];
  let checksRows: Array<Record<string, unknown>> = [];
  try {
    const { data } = await supabase
      .from('order_proof_versions')
      .select('id, proof_id, version, event, actor, note, render_url, days_from_inscription, created_at')
      .in('proof_id', proofIds)
      .order('version', { ascending: true })
      .order('created_at', { ascending: true });
    versionsRows = data ?? [];
  } catch {
    versionsRows = [];
  }
  try {
    const { data } = await supabase
      .from('order_proof_ai_checks')
      .select('id, proof_id, version, level, label, suggest, dismissed_at')
      .in('proof_id', proofIds);
    checksRows = data ?? [];
  } catch {
    checksRows = [];
  }

  const versionsByProof: Record<string, ProofVersionEvent[]> = {};
  for (const raw of versionsRows) {
    const r = raw as {
      id: string;
      proof_id: string;
      version: number;
      event: string;
      actor: string;
      note: string | null;
      render_url: string | null;
      days_from_inscription: number | null;
      created_at: string;
    };
    if (!versionsByProof[r.proof_id]) versionsByProof[r.proof_id] = [];
    versionsByProof[r.proof_id].push({
      id: r.id,
      version: r.version,
      event: r.event,
      actor: r.actor,
      note: r.note,
      renderUrl: r.render_url,
      daysFromInscription: r.days_from_inscription,
      createdAt: r.created_at,
    });
  }

  const checksByProof: Record<string, ProofCheck[]> = {};
  for (const raw of checksRows) {
    const r = raw as {
      id: string;
      proof_id: string;
      version: number;
      level: ProofCheckLevel;
      label: string;
      suggest: string | null;
      dismissed_at: string | null;
    };
    if (!checksByProof[r.proof_id]) checksByProof[r.proof_id] = [];
    checksByProof[r.proof_id].push({
      id: r.id,
      version: r.version,
      level: r.level,
      label: r.label,
      suggest: r.suggest,
      dismissedAt: r.dismissed_at,
    });
  }

  const today = new Date();
  const items: ProofItem[] = proofRows.map((raw) => {
    const r = raw as {
      id: string;
      order_id: string;
      state: ProofState;
      inscription_text: string | null;
      font_style: string | null;
      render_url: string | null;
      sent_at: string | null;
      approved_at: string | null;
      changes_requested_at: string | null;
      inscription_received_at: string | null;
      created_at: string;
      orders: { id: string; order_number: number | null; customer_name: string } | null;
    };
    const versions = versionsByProof[r.id] ?? [];
    const version = versions.length
      ? Math.max(...versions.map((v) => v.version))
      : 0;
    const inscriptionAt = r.inscription_received_at ?? r.created_at;
    const daysSinceInscription = inscriptionAt
      ? Math.max(0, Math.round((today.getTime() - new Date(inscriptionAt).getTime()) / DAY))
      : null;
    const daysSinceSent = r.sent_at
      ? Math.max(0, Math.round((today.getTime() - new Date(r.sent_at).getTime()) / DAY))
      : null;
    const isPending = !r.approved_at;
    const isOverdue = isPending && daysSinceInscription != null && daysSinceInscription > targetDays;
    const isApproaching = isPending && daysSinceInscription === targetDays;

    return {
      id: r.id,
      orderId: r.orders?.id ?? r.order_id,
      orderNumber: r.orders?.order_number ?? null,
      customerName: r.orders?.customer_name ?? 'Unknown',
      state: r.state,
      inscriptionText: r.inscription_text,
      fontStyle: r.font_style,
      renderUrl: r.render_url,
      sentAt: r.sent_at,
      approvedAt: r.approved_at,
      changesRequestedAt: r.changes_requested_at,
      inscriptionReceivedAt: r.inscription_received_at,
      daysSinceInscription,
      daysSinceSent,
      version,
      versions,
      aiChecks: checksByProof[r.id] ?? [],
      isOverdue,
      isApproaching,
    };
  });

  const queue = items
    .filter((p) => !p.approvedAt)
    .sort((a, b) => {
      const aDraft = a.sentAt == null ? 1 : 0;
      const bDraft = b.sentAt == null ? 1 : 0;
      if (aDraft !== bDraft) return bDraft - aDraft;
      return (b.daysSinceInscription ?? 0) - (a.daysSinceInscription ?? 0);
    });
  const recentlyApproved = items
    .filter((p) => !!p.approvedAt)
    .sort((a, b) => new Date(b.approvedAt!).getTime() - new Date(a.approvedAt!).getTime())
    .slice(0, 8);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return {
    queue,
    recentlyApproved,
    totals: {
      drafting: queue.filter((p) => !p.sentAt).length,
      awaiting: queue.filter((p) => !!p.sentAt).length,
      approvedThisMonth: items.filter(
        (p) => p.approvedAt && new Date(p.approvedAt).getTime() >= monthStart.getTime(),
      ).length,
      overdue: queue.filter((p) => p.isOverdue).length,
    },
    targetDays,
  };
}
