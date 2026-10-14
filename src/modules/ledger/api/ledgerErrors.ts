import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Missing table / view / function / column (migration not applied), as Postgres or PostgREST
 * reports it. Production still has an empty pre-ledger `public.payments` table, so a missing
 * ledger *column* (42703) also means "not set up".
 */
export function isLedgerMissing(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as Partial<PostgrestError> & { status?: number };
  if (e.code && ['42P01', '42703', '42883', 'PGRST202', 'PGRST205', 'PGRST200', 'PGRST204'].includes(e.code)) return true;
  const msg = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`.toLowerCase();
  return (
    /relation .*payment.* does not exist/.test(msg) ||
    /could not find the (table|function) .*ledger|could not find the (table|function) .*payment/.test(msg) ||
    /function .*ledger_.* does not exist/.test(msg)
  );
}
