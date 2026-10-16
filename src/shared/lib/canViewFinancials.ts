/**
 * Whether this membership may see money (Finance, Hub money figures, Reporting, Payments).
 * UI-level only — the database is the real boundary.
 *
 * Fails closed: only an explicit owner flag passes. Admin and member do not.
 */
export function canViewFinancials(isOwner: boolean | null | undefined): boolean {
  return isOwner === true;
}
