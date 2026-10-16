import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { RouteErrorFallback } from "./components/RouteErrorFallback";
import { RequireFinancials } from "./components/RequireFinancials";
import { PageShell } from "@/components/layout/PageShell";
import { useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabase";
import { LoginPage, RegisterPage, AuthCallbackPage, ProtectedRoute } from "@/modules/auth";
import { UnifiedInboxPage } from "@/modules/inbox";
import { JobsPipelinePage } from "@/modules/jobsPipeline";
import { JobsPage } from "@/modules/jobs";
import { HubPage } from "@/modules/hub";
import { LogisticsPage } from "@/modules/logistics";
import { FinancePage } from "@/modules/finance";
import { OrdersPage } from "@/modules/orders";
import { ReportingPage } from "@/modules/reporting";
import { PaymentsPage } from "@/modules/payments";
import { WorkersPage } from "@/modules/workers";
import { ActivityPage } from "@/modules/activity/pages/ActivityPage";
import { NotificationsPage } from "@/modules/notifications";
import { SupplierPage } from "@/modules/supplier/pages/SupplierPage";
import FeaturePreview from "@/pages/FeaturePreview";
import { SentryMonitorPage } from "@/modules/monitoring";
import { SettingsPage } from "@/modules/settings";
import NotFound from "@/pages/NotFound";
import { DASHBOARD_ALIAS_REDIRECTS, redirectTarget, SIGNED_IN_HOME, TOP_LEVEL_REDIRECTS } from "./redirects";

// Invoicing retired as a standalone page 2026-07-20 — the workspace lives on the
// Finance page. Forward the query string so ?invoice= deep-links survive.
function InvoicingRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/dashboard/finance${search}`} replace />;
}

function TopLevelRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={redirectTarget(to, search)} replace />;
}

// Legacy /dashboard/enquiry-triage → the inbox default (grouped Customers view).
// Previously targeted ?segment=enquiries (the retired flat triage view); the
// ?conversation= deep link is still forwarded for the ?view=flat escape hatch.
function EnquiryTriageRedirect() {
  const { search } = useLocation();
  const conversation = new URLSearchParams(search).get("conversation");
  const target =
    "/dashboard/inbox" +
    (conversation ? `?conversation=${encodeURIComponent(conversation)}` : "");
  return <Navigate to={target} replace />;
}

// "/" no longer serves the old marketing landing (src/modules/landing is kept,
// unrouted). Signed-in users go to Today; everyone else to /login.
function RootRedirect() {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setTarget(session ? SIGNED_IN_HOME : "/login");
    });
    return () => { cancelled = true; };
  }, []);
  if (!target) return null;
  return <Navigate to={target} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/preview/features" element={<FeaturePreview />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <PageShell />
          </ProtectedRoute>
        }
        errorElement={<RouteErrorFallback />}
      >
        <Route index element={<Navigate to="inbox" replace />} />
        <Route path="hub" element={<HubPage />} />
        {DASHBOARD_ALIAS_REDIRECTS.map((item) => (
          <Route key={item.path} path={item.path} element={<Navigate to={item.to} replace />} />
        ))}
        <Route path="logistics" element={<LogisticsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="enquiry-triage" element={<EnquiryTriageRedirect />} />
        <Route path="inbox" element={<UnifiedInboxPage />} />
        <Route path="ghl-inbox" element={<Navigate to="/dashboard/inbox" replace />} />
        {/* Pipeline (jobs board) took over the inquiries slot at status_v2 cutover;
            the URL stays for deep links. Old module: src/modules/inquiries (unrouted). */}
        <Route path="inquiries" element={<JobsPipelinePage />} />
        {/* Install planner page removed (Oct 2026): old links land on the map. */}
        <Route path="planner" element={<Navigate to="/dashboard/logistics?tab=map" replace />} />
        <Route path="mapping" element={<Navigate to="/dashboard/logistics?tab=map" replace />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="suppliers" element={<SupplierPage />} />
        {/* Pages removed (Oct 2026): old links land on the inbox. */}
        {["cemeteries", "customers", "memorials", "inscriptions", "permit-forms", "permit-tracker", "permit-chase", "proof-review", "permit-agent"].map((p) => (
          <Route key={p} path={p} element={<Navigate to="/dashboard/inbox" replace />} />
        ))}
        <Route path="payments" element={<RequireFinancials><PaymentsPage /></RequireFinancials>} />
        <Route path="invoicing" element={<InvoicingRedirect />} />
        <Route path="reporting" element={<RequireFinancials><ReportingPage /></RequireFinancials>} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="workers" element={<WorkersPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="sentry-monitor" element={<SentryMonitorPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/permits" element={<Navigate to="/dashboard/inbox" replace />} />
      {TOP_LEVEL_REDIRECTS.map((item) => (
        <Route key={item.path} path={item.path} element={<TopLevelRedirect to={item.to} />} />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}