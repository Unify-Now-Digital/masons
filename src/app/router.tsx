import { Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./layout/DashboardLayout";
import { LandingPage } from "@/modules/landing";
import { UnifiedInboxPage } from "@/modules/inbox";
import { JobsMapPage } from "@/modules/jobs";
import { OrdersPage } from "@/modules/orders";
import { InvoicingPage } from "@/modules/invoicing";
import { ReportingPage } from "@/modules/reporting";
import NotFound from "@/pages/NotFound";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route path="inbox" element={<UnifiedInboxPage />} />
        <Route path="map" element={<JobsMapPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="invoicing" element={<InvoicingPage />} />
        <Route path="reporting" element={<ReportingPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

