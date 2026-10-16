/**
 * Whether this membership may see money (Finance, Hub money figures, Reporting, Payments).
 * UI-level only — the database is the real boundary (public.user_can_view_org_finance).
 *
 * - Organisation with an owner set: only the owner.
 * - Organisation with no owner: previous rule, admin and member see money.
 * Fails closed when it is unknown whether the organisation has an owner.
 */
export function canViewFinancials(
  isOwner: boolean | null | undefined,
  orgHasOwner: boolean | null | undefined = true,
  role: string | null | undefined = null,
): boolean {
  if (isOwner === true) return true;
  if (orgHasOwner === false) return role === 'admin' || role === 'member';
  return false;
}
