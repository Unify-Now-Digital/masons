import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { RouteErrorFallback } from "./components/RouteErrorFallback";
import { PageShell } from "@/components/layout/PageShell";
import { LandingPage } from "@/modules/landing";
import { LoginPage, RegisterPage, AuthCallbackPage, ProtectedRoute } from "@/modules/auth";
import { UnifiedInboxPage } from "@/modules/inbox";
import { JobsPipelinePage } from "@/modules/jobsPipeline";
import { JobsMapPage } from "@/modules/map";
import { JobsPage } from "@/modules/jobs";
import { HubPage } from "@/modules/hub";
import { LogisticsPage } from "@/modules/logistics";
import { FinancePage } from "@/modules/finance";
import { PipelinePage } from "@/modules/pipeline";
import { CemeteriesPage } from "@/modules/cemeteries";
import { PriorityPage } from "@/modules/priority";
import { ProofReviewPage } from "@/modules/proofReview";
import { PermitChasePage } from "@/modules/permitChase";
import { OrdersPage } from "@/modules/orders";
import { ReportingPage } from "@/modules/reporting";
import { CustomersPage } from "@/modules/customers";
import { MemorialsPage } from "@/modules/memorials";
import { InscriptionsPage } from "@/modules/inscriptions";
import { PermitFormsPage } from "@/modules/permitForms";
import { PermitTrackerPage } from "@/modules/permitTracker";
import { PaymentsPage } from "@/modules/payments";
import { NotificationsPage } from "@/modules/notifications";
import { WorkersPage } from "@/modules/workers";
import { ActivityPage } from "@/modules/activity/pages/ActivityPage";
import { SentryMonitorPage } from "@/modules/monitoring";
import { SettingsPage } from "@/modules/settings";
import NotFound from "@/pages/NotFound";

// Invoicing retired as a standalone page 2026-07-20 — the workspace lives in
// Finance → Invoices. Forward the query string so ?invoice= deep-links survive.
function InvoicingRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/dashboard/finance${search}`} replace />;
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

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
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
        <Route path="priority" element={<PriorityPage />} />
        <Route path="logistics" element={<LogisticsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="enquiry-triage" element={<EnquiryTriageRedirect />} />
        <Route path="proof-review" element={<ProofReviewPage />} />
        <Route path="permit-chase" element={<PermitChasePage />} />
        <Route path="inbox" element={<UnifiedInboxPage />} />
        <Route path="ghl-inbox" element={<Navigate to="/dashboard/inbox" replace />} />
        {/* Pipeline (jobs board) took over the inquiries slot at status_v2 cutover;
            the URL stays for deep links. Old module: src/modules/inquiries (unrouted). */}
        <Route path="inquiries" element={<JobsPipelinePage />} />
        <Route path="map" element={<JobsMapPage />} />
        <Route path="mapping" element={<Navigate to="/dashboard/logistics?tab=map" replace />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="cemeteries" element={<CemeteriesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="memorials" element={<MemorialsPage />} />
        <Route path="inscriptions" element={<InscriptionsPage />} />
        <Route path="permit-forms" element={<PermitFormsPage />} />
        <Route path="permit-agent" element={<Navigate to="/dashboard/permit-tracker" replace />} />
        <Route path="permit-tracker" element={<PermitTrackerPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="invoicing" element={<InvoicingRedirect />} />
        <Route path="reporting" element={<ReportingPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="workers" element={<WorkersPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="sentry-monitor" element={<SentryMonitorPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/permits" element={<Navigate to="/dashboard/permit-tracker" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}