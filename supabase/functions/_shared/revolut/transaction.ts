/**
 * Incoming customer money from a Revolut transaction.
 * Amounts are major units (pounds), signed: positive lands in the account.
 * Counterparty objects carry ids, not names. The name is leg.description
 * ("From J SMITH") or GET /counterparty/{id}.name.
 */

export const INCOMING_TYPES = new Set(['transfer', 'topup', 'refund', 'card_refund', 'card_credit']);

export interface RevolutCounterparty {
  id?: string;
  account_id?: string;
  account_type?: string;
}

export interface RevolutLeg {
  leg_id?: string;
  account_id?: string;
  amount?: number;
  currency?: string;
  description?: string;
  fee?: number;
  counterparty?: RevolutCounterparty;
}

export interface RevolutTransaction {
  id: string;
  type?: string;
  state?: string;
  reference?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  legs?: RevolutLeg[];
}

export interface IncomingLeg {
  legId: string | null;
  accountId: string | null;
  amountPounds: number;
  currency: string;
  description: string | null;
  counterpartyId: string | null;
  accountType: string | null;
}

export function pounds(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Payer label. Prefers the counterparty record name over the leg description. */
export function counterpartyLabel(description: string | null | undefined, fetchedName?: string | null): string | null {
  const named = fetchedName?.trim();
  if (named) return named;
  const text = description?.trim();
  if (!text) return null;
  const from = /^from\s+(.+)$/i.exec(text);
  return (from?.[1] ?? text).trim() || null;
}

/**
 * The single incoming leg we will post, or null.
 * Skips fees, card spend, exchanges, ATM, and transfers between our own accounts
 * (account_type self, or more than one positive leg with no external counterparty).
 */
export function incomingLeg(txn: RevolutTransaction): IncomingLeg | null {
  const type = (txn.type ?? '').toLowerCase();
  if (!INCOMING_TYPES.has(type)) return null;
  const legs = txn.legs ?? [];
  const positive = legs.filter((leg) => typeof leg.amount === 'number' && leg.amount > 0);
  const external = positive.filter((leg) => (leg.counterparty?.account_type ?? '').toLowerCase() !== 'self');
  if (!external.length) return null;
  if (external.length > 1 && external.every((leg) => !leg.counterparty?.id && !leg.counterparty?.account_type)) {
    return null;
  }
  const gbp = external.filter((leg) => (leg.currency ?? '').toUpperCase() === 'GBP');
  const chosen = (gbp.length ? gbp : external)[0];
  if (!chosen || typeof chosen.amount !== 'number') return null;
  return {
    legId: chosen.leg_id ?? null,
    accountId: chosen.account_id ?? null,
    amountPounds: pounds(chosen.amount),
    currency: (chosen.currency ?? 'GBP').toUpperCase(),
    description: chosen.description ?? null,
    counterpartyId: chosen.counterparty?.id ?? null,
    accountType: chosen.counterparty?.account_type ?? null,
  };
}
