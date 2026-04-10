import { Routes, Route, Navigate } from "react-router-dom";
import { RouteErrorFallback } from "./components/RouteErrorFallback";
import { PageShell } from "@/components/layout/PageShell";
import { LandingPage } from "@/modules/landing";
import { LoginPage, RegisterPage, AuthCallbackPage, ProtectedRoute } from "@/modules/auth";
import { UnifiedInboxPage } from "@/modules/inbox";
import { JobsMapPage } from "@/modules/map";
import { JobsPage } from "@/modules/jobs";
import { OrdersPage } from "@/modules/orders";
import { InvoicingPage } from "@/modules/invoicing";
import { ReportingPage } from "@/modules/reporting";
import { CustomersPage } from "@/modules/customers";
import { CompaniesPage } from "@/modules/companies";
import { MemorialsPage } from "@/modules/memorials";
import { InscriptionsPage } from "@/modules/inscriptions";
import { PermitFormsPage } from "@/modules/permitForms";
import { PermitAgentPage } from "@/modules/permitAgent";
import { PermitTrackerPage } from "@/modules/permitTracker";
import { PaymentsPage } from "@/modules/payments";
import { NotificationsPage } from "@/modules/notifications";
import { TeamChatPage } from "@/modules/team";
import { WorkersPage } from "@/modules/workers";
import { ActivityPage } from "@/modules/activity/pages/ActivityPage";
import { SentryMonitorPage } from "@/modules/monitoring";
import { SettingsPage } from "@/modules/settings";
import NotFound from "@/pages/NotFound";

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
        <Route path="inbox" element={<UnifiedInboxPage />} />
        <Route path="map" element={<JobsMapPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="memorials" element={<MemorialsPage />} />
        <Route path="inscriptions" element={<InscriptionsPage />} />
        <Route path="permit-forms" element={<PermitFormsPage />} />
        <Route path="permit-agent" element={<PermitAgentPage />} />
        <Route path="permit-tracker" element={<PermitTrackerPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="invoicing" element={<InvoicingPage />} />
        <Route path="reporting" element={<ReportingPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="team" element={<TeamChatPage />} />
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