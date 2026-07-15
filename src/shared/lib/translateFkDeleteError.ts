/**
 * Translate a Postgres FK-violation delete error (code 23503) into plain language.
 * Returns null when the error isn't an FK violation, so callers can fall back
 * to their generic message.
 */
const TABLE_LABELS: Record<string, string> = {
  enquiries: 'enquiries',
  order_people: 'orders',
  quotes: 'quotes',
  customer_activity: 'activity history',
  invoices: 'invoices',
};

export function translateFkDeleteError(
  error: unknown,
  entityLabel = 'record',
): string | null {
  const e = error as { code?: string; details?: string; message?: string } | null;
  if (!e || e.code !== '23503') return null;
  const source = `${e.details ?? ''} ${e.message ?? ''}`;
  // Prefer the details field ('referenced from table "x"') — unambiguous.
  // The message mentions two tables ('delete on table "people" ... on table
  // "enquiries"'); the referencing table is the LAST "on table" occurrence.
  const onTableMatches = [...source.matchAll(/on table "([a-z_]+)"/gi)];
  const table =
    source.match(/referenced from table "([a-z_]+)"/i)?.[1] ??
    onTableMatches[onTableMatches.length - 1]?.[1];
  const label = table ? (TABLE_LABELS[table] ?? table.replace(/_/g, ' ')) : 'other records';
  return `Can't delete this ${entityLabel} — they still have linked ${label}. Remove or reassign those first.`;
}
