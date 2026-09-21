/**
 * Whether a role may see aggregate-money UI (Finance stat strip, Hub money KPIs, Reporting,
 * Payments). UI-level only — not a data-access boundary.
 *
 * Fails closed: only the roles named here pass, so a new or unknown role value, null and
 * undefined all read false. Takes a plain string so an unvalidated `organization_members.role`
 * (OrganizationContext casts, it does not validate) cannot slip through the type.
 */
export function canViewFinancials(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'member';
}
