import React from "react";
import { Navigate } from "react-router-dom";
import { useOrganization } from "@/shared/context/OrganizationContext";

/**
 * Route guard for aggregate-money pages (Reporting, Payments). UI-level only — not a
 * data-access boundary.
 *
 * Redirects only on a POSITIVELY KNOWN role. OrganizationContext reports isLoading false for a
 * moment on a hard load, before the auth session resolves and the membership fetch starts
 * (role is still null then), so "not loading" alone does not mean "role decided" — waiting on
 * the role as well keeps an admin hard-loading a guarded URL from being bounced. PageShell
 * already withholds the Outlet until an organisation is active; this does not rely on it.
 */
export function RequireFinancials({ children }: { children: React.ReactNode }) {
  const { isLoading, role, canViewFinancials } = useOrganization();

  if (isLoading || role === null) return null;
  if (!canViewFinancials) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
