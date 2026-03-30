# Phase 1 Implementation Plan

## Overview

**Branch:** `feature/phase-1-module-architecture`  
**Spec File:** `specs/phase-1-module-architecture-reorganization.md`  
**Status:** Ready for implementation

This plan covers the complete Phase 1 implementation including:
1. File structure reorganization
2. Database schema and migrations
3. CRUD hooks setup
4. Page integration with real data
5. Forms and modals for create/update operations

---

## Execution Phases

| Phase | Description | Tasks |
|-------|-------------|-------|
| 0 | Directory Structure Creation | 15 tasks |
| 1 | Shared Layer Setup | 55 tasks |
| 2 | App Shell Setup | 8 tasks |
| 3 | Module File Moves | 25 tasks |
| 4 | Database Schema & Migrations | 6 tasks |
| 5 | CRUD Hooks Implementation | 25 tasks |
| 6 | Page Integration | 20 tasks |
| 7 | Forms & Drawers | 12 tasks |
| 8 | Cleanup & Validation | 10 tasks |

**Total Tasks: ~176**

---

## PHASE 0: Directory Structure Creation

### Task 0.1: Create App Structure
```
CREATE DIRECTORY: src/app/
CREATE DIRECTORY: src/app/layout/
```

### Task 0.2: Create Module Directories
```
CREATE DIRECTORY: src/modules/
CREATE DIRECTORY: src/modules/inbox/
CREATE DIRECTORY: src/modules/inbox/pages/
CREATE DIRECTORY: src/modules/inbox/components/
CREATE DIRECTORY: src/modules/inbox/hooks/
CREATE DIRECTORY: src/modules/inbox/api/
CREATE DIRECTORY: src/modules/inbox/types/

CREATE DIRECTORY: src/modules/jobs/
CREATE DIRECTORY: src/modules/jobs/pages/
CREATE DIRECTORY: src/modules/jobs/components/
CREATE DIRECTORY: src/modules/jobs/hooks/
CREATE DIRECTORY: src/modules/jobs/api/
CREATE DIRECTORY: src/modules/jobs/types/

CREATE DIRECTORY: src/modules/orders/
CREATE DIRECTORY: src/modules/orders/pages/
CREATE DIRECTORY: src/modules/orders/components/
CREATE DIRECTORY: src/modules/orders/hooks/
CREATE DIRECTORY: src/modules/orders/api/
CREATE DIRECTORY: src/modules/orders/types/

CREATE DIRECTORY: src/modules/invoicing/
CREATE DIRECTORY: src/modules/invoicing/pages/
CREATE DIRECTORY: src/modules/invoicing/components/
CREATE DIRECTORY: src/modules/invoicing/hooks/
CREATE DIRECTORY: src/modules/invoicing/api/
CREATE DIRECTORY: src/modules/invoicing/types/

CREATE DIRECTORY: src/modules/reporting/
CREATE DIRECTORY: src/modules/reporting/pages/
CREATE DIRECTORY: src/modules/reporting/components/
CREATE DIRECTORY: src/modules/reporting/hooks/
CREATE DIRECTORY: src/modules/reporting/api/
CREATE DIRECTORY: src/modules/reporting/types/

CREATE DIRECTORY: src/modules/team/
CREATE DIRECTORY: src/modules/team/pages/
CREATE DIRECTORY: src/modules/team/components/
CREATE DIRECTORY: src/modules/team/hooks/
CREATE DIRECTORY: src/modules/team/api/
CREATE DIRECTORY: src/modules/team/types/

CREATE DIRECTORY: src/modules/landing/
CREATE DIRECTORY: src/modules/landing/pages/
CREATE DIRECTORY: src/modules/landing/components/
```

### Task 0.3: Create Shared Structure
```
CREATE DIRECTORY: src/shared/
CREATE DIRECTORY: src/shared/components/
CREATE DIRECTORY: src/shared/components/ui/
CREATE DIRECTORY: src/shared/hooks/
CREATE DIRECTORY: src/shared/lib/
CREATE DIRECTORY: src/shared/types/
```

---

## PHASE 1: Shared Layer Setup

### Task 1.1: Move shadcn/ui Components (48 files)

| # | Source | Destination |
|---|--------|-------------|
| 1 | `src/components/ui/accordion.tsx` | `src/shared/components/ui/accordion.tsx` |
| 2 | `src/components/ui/alert-dialog.tsx` | `src/shared/components/ui/alert-dialog.tsx` |
| 3 | `src/components/ui/alert.tsx` | `src/shared/components/ui/alert.tsx` |
| 4 | `src/components/ui/aspect-ratio.tsx` | `src/shared/components/ui/aspect-ratio.tsx` |
| 5 | `src/components/ui/avatar.tsx` | `src/shared/components/ui/avatar.tsx` |
| 6 | `src/components/ui/badge.tsx` | `src/shared/components/ui/badge.tsx` |
| 7 | `src/components/ui/breadcrumb.tsx` | `src/shared/components/ui/breadcrumb.tsx` |
| 8 | `src/components/ui/button.tsx` | `src/shared/components/ui/button.tsx` |
| 9 | `src/components/ui/calendar.tsx` | `src/shared/components/ui/calendar.tsx` |
| 10 | `src/components/ui/card.tsx` | `src/shared/components/ui/card.tsx` |
| 11 | `src/components/ui/carousel.tsx` | `src/shared/components/ui/carousel.tsx` |
| 12 | `src/components/ui/chart.tsx` | `src/shared/components/ui/chart.tsx` |
| 13 | `src/components/ui/checkbox.tsx` | `src/shared/components/ui/checkbox.tsx` |
| 14 | `src/components/ui/collapsible.tsx` | `src/shared/components/ui/collapsible.tsx` |
| 15 | `src/components/ui/command.tsx` | `src/shared/components/ui/command.tsx` |
| 16 | `src/components/ui/context-menu.tsx` | `src/shared/components/ui/context-menu.tsx` |
| 17 | `src/components/ui/dialog.tsx` | `src/shared/components/ui/dialog.tsx` |
| 18 | `src/components/ui/drawer.tsx` | `src/shared/components/ui/drawer.tsx` |
| 19 | `src/components/ui/dropdown-menu.tsx` | `src/shared/components/ui/dropdown-menu.tsx` |
| 20 | `src/components/ui/form.tsx` | `src/shared/components/ui/form.tsx` |
| 21 | `src/components/ui/hover-card.tsx` | `src/shared/components/ui/hover-card.tsx` |
| 22 | `src/components/ui/input-otp.tsx` | `src/shared/components/ui/input-otp.tsx` |
| 23 | `src/components/ui/input.tsx` | `src/shared/components/ui/input.tsx` |
| 24 | `src/components/ui/label.tsx` | `src/shared/components/ui/label.tsx` |
| 25 | `src/components/ui/menubar.tsx` | `src/shared/components/ui/menubar.tsx` |
| 26 | `src/components/ui/navigation-menu.tsx` | `src/shared/components/ui/navigation-menu.tsx` |
| 27 | `src/components/ui/pagination.tsx` | `src/shared/components/ui/pagination.tsx` |
| 28 | `src/components/ui/popover.tsx` | `src/shared/components/ui/popover.tsx` |
| 29 | `src/components/ui/progress.tsx` | `src/shared/components/ui/progress.tsx` |
| 30 | `src/components/ui/radio-group.tsx` | `src/shared/components/ui/radio-group.tsx` |
| 31 | `src/components/ui/resizable.tsx` | `src/shared/components/ui/resizable.tsx` |
| 32 | `src/components/ui/scroll-area.tsx` | `src/shared/components/ui/scroll-area.tsx` |
| 33 | `src/components/ui/select.tsx` | `src/shared/components/ui/select.tsx` |
| 34 | `src/components/ui/separator.tsx` | `src/shared/components/ui/separator.tsx` |
| 35 | `src/components/ui/sheet.tsx` | `src/shared/components/ui/sheet.tsx` |
| 36 | `src/components/ui/sidebar.tsx` | `src/shared/components/ui/sidebar.tsx` |
| 37 | `src/components/ui/skeleton.tsx` | `src/shared/components/ui/skeleton.tsx` |
| 38 | `src/components/ui/slider.tsx` | `src/shared/components/ui/slider.tsx` |
| 39 | `src/components/ui/sonner.tsx` | `src/shared/components/ui/sonner.tsx` |
| 40 | `src/components/ui/switch.tsx` | `src/shared/components/ui/switch.tsx` |
| 41 | `src/components/ui/table.tsx` | `src/shared/components/ui/table.tsx` |
| 42 | `src/components/ui/tabs.tsx` | `src/shared/components/ui/tabs.tsx` |
| 43 | `src/components/ui/textarea.tsx` | `src/shared/components/ui/textarea.tsx` |
| 44 | `src/components/ui/toast.tsx` | `src/shared/components/ui/toast.tsx` |
| 45 | `src/components/ui/toaster.tsx` | `src/shared/components/ui/toaster.tsx` |
| 46 | `src/components/ui/toggle-group.tsx` | `src/shared/components/ui/toggle-group.tsx` |
| 47 | `src/components/ui/toggle.tsx` | `src/shared/components/ui/toggle.tsx` |
| 48 | `src/components/ui/tooltip.tsx` | `src/shared/components/ui/tooltip.tsx` |
| 49 | `src/components/ui/use-toast.ts` | `src/shared/components/ui/use-toast.ts` |

**Import Update Required:** Update `@/lib/utils` → `@/shared/lib/utils` in each file

### Task 1.2: Move Shared Hooks
| Source | Destination |
|--------|-------------|
| `src/hooks/use-mobile.tsx` | `src/shared/hooks/use-mobile.tsx` |
| `src/hooks/use-toast.ts` | `src/shared/hooks/use-toast.ts` |

**Import Update:** `@/components/ui/toast` → `@/shared/components/ui/toast`

### Task 1.3: Move Shared Library Files
| Source | Destination | Import Updates |
|--------|-------------|----------------|
| `src/lib/utils.ts` | `src/shared/lib/utils.ts` | None |
| `src/integrations/supabase/client.ts` | `src/shared/lib/supabase.ts` | Update types import |
| `src/integrations/supabase/types.ts` | `src/shared/types/database.types.ts` | None |

### Task 1.4: Create Common Types File
**CREATE FILE:** `src/shared/types/common.types.ts`
```typescript
// Common type definitions shared across modules

export type ID = string;

export interface BaseEntity {
  id: ID;
  created_at: string;
  updated_at: string;
}

export type Status = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
```

---

## PHASE 2: App Shell Setup

### Task 2.1: Create Providers File
**CREATE FILE:** `src/app/providers.tsx`
```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
```

### Task 2.2: Create Router File
**CREATE FILE:** `src/app/router.tsx`
```typescript
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
```

### Task 2.3: Move and Update App.tsx
**MOVE:** `src/App.tsx` → `src/app/App.tsx`
**UPDATE CONTENT:**
```typescript
import { BrowserRouter } from "react-router-dom";
import { Providers } from "./providers";
import { AppRouter } from "./router";

const App = () => (
  <Providers>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </Providers>
);

export default App;
```

### Task 2.4: Move and Update DashboardLayout
**MOVE:** `src/pages/Dashboard.tsx` → `src/app/layout/DashboardLayout.tsx`
**UPDATE IMPORTS:**
```typescript
import React from 'react';
import { SidebarProvider } from "@/shared/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet } from 'react-router-dom';
import { SidebarTrigger } from "@/shared/components/ui/sidebar";

export const DashboardLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-white flex items-center px-4">
            <SidebarTrigger />
            <h1 className="ml-4 text-lg font-semibold">Memorial Mason Management</h1>
          </header>
          <main className="flex-1 p-6 bg-slate-50">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
```

### Task 2.5: Move and Update AppSidebar
**MOVE:** `src/components/AppSidebar.tsx` → `src/app/layout/AppSidebar.tsx`
**UPDATE IMPORTS:**
```typescript
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  useSidebar
} from "@/shared/components/ui/sidebar";
import { Inbox, MapPin, FileText, ChartBar, ListCheck } from 'lucide-react';

// ... rest unchanged
```

### Task 2.6: Update main.tsx
**MODIFY:** `src/main.tsx`
```typescript
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
```

### Task 2.7: Delete Old App.css
**DELETE FILE:** `src/App.css` (if no longer needed - check for usage first)

---

## PHASE 3: Module File Moves

### Task 3.1: Inbox Module

| Action | Source | Destination |
|--------|--------|-------------|
| MOVE + RENAME | `src/pages/dashboard/UnifiedInbox.tsx` | `src/modules/inbox/pages/UnifiedInboxPage.tsx` |
| MOVE | `src/components/ConversationView.tsx` | `src/modules/inbox/components/ConversationView.tsx` |
| MOVE | `src/components/CommunicationIntegrations.tsx` | `src/modules/inbox/components/CommunicationIntegrations.tsx` |
| CREATE | - | `src/modules/inbox/index.ts` |

**CREATE FILE:** `src/modules/inbox/index.ts`
```typescript
export { UnifiedInboxPage } from './pages/UnifiedInboxPage';
export { ConversationView } from './components/ConversationView';
export { CommunicationIntegrations } from './components/CommunicationIntegrations';
```

**UnifiedInboxPage Import Updates:**
- `@/components/ui/*` → `@/shared/components/ui/*`
- `@/components/ConversationView` → `../components/ConversationView`
- `@/integrations/supabase/client` → `@/shared/lib/supabase`
- `@/hooks/use-toast` → `@/shared/hooks/use-toast`

**ConversationView Import Updates:**
- `@/components/ui/*` → `@/shared/components/ui/*`
- `./CommunicationIntegrations` → `./CommunicationIntegrations`

**CommunicationIntegrations Import Updates:**
- `@/components/ui/*` → `@/shared/components/ui/*`

### Task 3.2: Jobs Module

| Action | Source | Destination |
|--------|--------|-------------|
| MOVE + RENAME | `src/pages/dashboard/MapView.tsx` | `src/modules/jobs/pages/JobsMapPage.tsx` |
| MOVE | `src/components/GoogleMap.tsx` | `src/modules/jobs/components/GoogleMap.tsx` |
| CREATE | - | `src/modules/jobs/index.ts` |

**CREATE FILE:** `src/modules/jobs/index.ts`
```typescript
export { JobsMapPage } from './pages/JobsMapPage';
export { GoogleMap } from './components/GoogleMap';
```

**JobsMapPage Import Updates:**
- `@/components/ui/*` → `@/shared/components/ui/*`
- `@/components/GoogleMap` → `../components/GoogleMap`
- Rename component function: `MapView` → `JobsMapPage`

### Task 3.3: Orders Module

| Action | Source | Destination |
|--------|--------|-------------|
| MOVE + RENAME | `src/pages/dashboard/Orders.tsx` | `src/modules/orders/pages/OrdersPage.tsx` |
| MOVE | `src/components/SortableOrdersTable.tsx` | `src/modules/orders/components/SortableOrdersTable.tsx` |
| MOVE | `src/components/OrderDetailsSidebar.tsx` | `src/modules/orders/components/OrderDetailsSidebar.tsx` |
| CREATE | - | `src/modules/orders/index.ts` |

**CREATE FILE:** `src/modules/orders/index.ts`
```typescript
export { OrdersPage } from './pages/OrdersPage';
export { SortableOrdersTable } from './components/SortableOrdersTable';
export { OrderDetailsSidebar } from './components/OrderDetailsSidebar';
```

**OrdersPage Import Updates:**
- `@/components/ui/*` → `@/shared/components/ui/*`
- `@/components/SortableOrdersTable` → `../components/SortableOrdersTable`
- `@/components/OrderDetailsSidebar` → `../components/OrderDetailsSidebar`
- Rename component function: `Orders` → `OrdersPage`

### Task 3.4: Invoicing Module

| Action | Source | Destination |
|--------|--------|-------------|
| MOVE + RENAME | `src/pages/dashboard/Invoicing.tsx` | `src/modules/invoicing/pages/InvoicingPage.tsx` |
| CREATE | - | `src/modules/invoicing/index.ts` |

**CREATE FILE:** `src/modules/invoicing/index.ts`
```typescript
export { InvoicingPage } from './pages/InvoicingPage';
```

**InvoicingPage Import Updates:**
- `@/components/ui/*` → `@/shared/components/ui/*`
- Rename component function: `Invoicing` → `InvoicingPage`

### Task 3.5: Reporting Module

| Action | Source | Destination |
|--------|--------|-------------|
| MOVE + RENAME | `src/pages/dashboard/Reporting.tsx` | `src/modules/reporting/pages/ReportingPage.tsx` |
| CREATE | - | `src/modules/reporting/index.ts` |

**CREATE FILE:** `src/modules/reporting/index.ts`
```typescript
export { ReportingPage } from './pages/ReportingPage';
```

**ReportingPage Import Updates:**
- `@/components/ui/*` → `@/shared/components/ui/*`
- Rename component function: `Reporting` → `ReportingPage`

### Task 3.6: Landing Module

| Action | Source | Destination |
|--------|--------|-------------|
| MOVE + RENAME | `src/pages/Index.tsx` | `src/modules/landing/pages/LandingPage.tsx` |
| MOVE | `src/components/Navigation.tsx` | `src/modules/landing/components/Navigation.tsx` |
| MOVE | `src/components/FeatureCard.tsx` | `src/modules/landing/components/FeatureCard.tsx` |
| MOVE | `src/components/FeatureScreenshots.tsx` | `src/modules/landing/components/FeatureScreenshots.tsx` |
| MOVE | `src/components/TestimonialCard.tsx` | `src/modules/landing/components/TestimonialCard.tsx` |
| CREATE | - | `src/modules/landing/index.ts` |

**CREATE FILE:** `src/modules/landing/index.ts`
```typescript
export { LandingPage } from './pages/LandingPage';
export { Navigation } from './components/Navigation';
export { FeatureCard } from './components/FeatureCard';
export { FeatureScreenshots, AutomatedCommunicationImage, MapViewImage, OrderProgressImage, OverdueOrdersImage } from './components/FeatureScreenshots';
export { TestimonialCard } from './components/TestimonialCard';
```

**LandingPage Import Updates:**
- `@/components/Navigation` → `../components/Navigation`
- `@/components/FeatureCard` → `../components/FeatureCard`
- `@/components/FeatureScreenshots` → `../components/FeatureScreenshots`
- `@/components/TestimonialCard` → `../components/TestimonialCard`
- `@/components/ui/*` → `@/shared/components/ui/*`
- Rename component function: `Index` → `LandingPage`

### Task 3.7: Team Module (Placeholder)

**CREATE FILE:** `src/modules/team/pages/TeamChatPage.tsx`
```typescript
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { MessageSquare } from 'lucide-react';

export const TeamChatPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Chat</h1>
        <p className="text-sm text-slate-600 mt-1">
          Coming in Phase 2
        </p>
      </div>
      
      <Card className="h-96 flex items-center justify-center">
        <CardContent className="text-center text-slate-400">
          <MessageSquare className="h-12 w-12 mx-auto mb-4" />
          <p>Team chat functionality will be available in Phase 2</p>
        </CardContent>
      </Card>
    </div>
  );
};
```

**CREATE FILE:** `src/modules/team/index.ts`
```typescript
export { TeamChatPage } from './pages/TeamChatPage';
```

---

## PHASE 4: Database Schema & Migrations

### Task 4.1: Create Orders Table Migration
**CREATE FILE:** `supabase/migrations/20250607000001_create_orders_table.sql`
```sql
-- Create orders table for Phase 1
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text,
  customer_phone text,
  order_type text not null,
  sku text,
  material text,
  color text,
  stone_status text default 'NA' check (stone_status in ('NA', 'Ordered', 'In Stock')),
  permit_status text default 'pending' check (permit_status in ('form_sent', 'customer_completed', 'pending', 'approved')),
  proof_status text default 'Not_Received' check (proof_status in ('NA', 'Not_Received', 'Received', 'In_Progress', 'Lettered')),
  deposit_date date,
  second_payment_date date,
  due_date date,
  installation_date date,
  location text,
  value decimal(10,2),
  progress integer default 0 check (progress >= 0 and progress <= 100),
  assigned_to text,
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  timeline_weeks integer default 12,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.orders enable row level security;

-- Create policies (allow all for now - will be restricted with auth later)
create policy "Allow all access to orders" on public.orders
  for all using (true) with check (true);

-- Create updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_orders_updated_at
  before update on public.orders
  for each row execute function public.update_updated_at_column();
```

### Task 4.2: Create Invoices Table Migration
**CREATE FILE:** `supabase/migrations/20250607000002_create_invoices_table.sql`
```sql
-- Create invoices table for Phase 1
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  invoice_number text unique not null,
  customer_name text not null,
  amount decimal(10,2) not null,
  status text default 'pending' check (status in ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
  due_date date not null,
  issue_date date default current_date,
  payment_method text,
  payment_date date,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.invoices enable row level security;

-- Create policies
create policy "Allow all access to invoices" on public.invoices
  for all using (true) with check (true);

-- Create updated_at trigger
create trigger update_invoices_updated_at
  before update on public.invoices
  for each row execute function public.update_updated_at_column();

-- Create invoice number sequence
create sequence if not exists invoice_number_seq start 1001;
```

### Task 4.3: Create Jobs Table Migration
**CREATE FILE:** `supabase/migrations/20250607000003_create_jobs_table.sql`
```sql
-- Create jobs table for Phase 1 (installations/map view)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  customer_name text not null,
  location_name text not null,
  address text not null,
  latitude decimal(10,8),
  longitude decimal(11,8),
  status text default 'scheduled' check (status in ('scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled')),
  scheduled_date date,
  estimated_duration text,
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.jobs enable row level security;

-- Create policies
create policy "Allow all access to jobs" on public.jobs
  for all using (true) with check (true);

-- Create updated_at trigger
create trigger update_jobs_updated_at
  before update on public.jobs
  for each row execute function public.update_updated_at_column();
```

### Task 4.4: Create Messages Table Migration
**CREATE FILE:** `supabase/migrations/20250607000004_create_messages_table.sql`
```sql
-- Create messages table for Phase 1 (unified inbox - manual messages only)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  thread_id uuid,
  type text default 'email' check (type in ('email', 'phone', 'note', 'internal')),
  direction text default 'inbound' check (direction in ('inbound', 'outbound')),
  from_name text not null,
  from_email text,
  from_phone text,
  subject text,
  content text not null,
  is_read boolean default false,
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.messages enable row level security;

-- Create policies
create policy "Allow all access to messages" on public.messages
  for all using (true) with check (true);

-- Create updated_at trigger
create trigger update_messages_updated_at
  before update on public.messages
  for each row execute function public.update_updated_at_column();

-- Create index for thread lookups
create index if not exists idx_messages_thread_id on public.messages(thread_id);
create index if not exists idx_messages_order_id on public.messages(order_id);
```

### Task 4.5: Create Reporting Views Migration
**CREATE FILE:** `supabase/migrations/20250607000005_create_reporting_views.sql`
```sql
-- Create reporting views for Phase 1

-- Monthly revenue summary
create or replace view public.v_monthly_revenue as
select 
  date_trunc('month', i.issue_date) as month,
  count(*) as invoice_count,
  sum(case when i.status = 'paid' then i.amount else 0 end) as paid_amount,
  sum(case when i.status in ('pending', 'overdue') then i.amount else 0 end) as outstanding_amount,
  sum(i.amount) as total_amount
from public.invoices i
group by date_trunc('month', i.issue_date)
order by month desc;

-- Order status summary
create or replace view public.v_order_status_summary as
select 
  count(*) as total_orders,
  count(*) filter (where stone_status = 'In Stock' and permit_status = 'approved' and proof_status = 'Lettered') as ready_for_install,
  count(*) filter (where due_date < current_date and progress < 100) as overdue,
  count(*) filter (where permit_status in ('pending', 'form_sent') or proof_status = 'Not_Received') as pending_approval,
  avg(progress) as avg_progress
from public.orders;

-- Top products by revenue
create or replace view public.v_top_products as
select 
  o.order_type as product_name,
  count(*) as order_count,
  sum(o.value) as total_revenue
from public.orders o
where o.value is not null
group by o.order_type
order by total_revenue desc
limit 10;
```

### Task 4.6: Seed Sample Data Migration
**CREATE FILE:** `supabase/migrations/20250607000006_seed_sample_data.sql`
```sql
-- Seed sample data for development/testing

-- Sample orders
insert into public.orders (customer_name, customer_email, order_type, sku, material, color, stone_status, permit_status, proof_status, deposit_date, due_date, location, value, progress, assigned_to, priority, timeline_weeks) values
('John Smith', 'john.smith@email.com', 'Granite Headstone', 'GH-001-BLK', 'Black Granite', 'Jet Black', 'Ordered', 'approved', 'In_Progress', '2025-05-20', '2025-06-15', 'Oak Hill Cemetery', 2500.00, 65, 'Mike Johnson', 'high', 18),
('Sarah Johnson', 'sarah.j@email.com', 'Marble Memorial', 'MM-002-WHT', 'Carrara Marble', 'Pure White', 'In Stock', 'approved', 'Lettered', '2025-05-15', '2025-06-10', 'Greenwood Memorial', 3800.00, 95, 'Sarah Davis', 'medium', 20),
('Mike Brown', 'mike.b@email.com', 'Bronze Plaque', 'BP-003-BRZ', 'Cast Bronze', 'Antique Bronze', 'NA', 'form_sent', 'Not_Received', '2025-05-25', '2025-06-20', 'Sunset Cemetery', 1200.00, 25, 'Tom Wilson', 'low', 12);

-- Sample jobs (linked to orders)
insert into public.jobs (order_id, customer_name, location_name, address, latitude, longitude, status, scheduled_date, estimated_duration, priority)
select 
  id,
  customer_name,
  location,
  location || ', Springfield',
  40.7128 + (random() * 0.1),
  -74.0060 + (random() * 0.1),
  case 
    when progress >= 95 then 'ready_for_installation'
    when progress >= 50 then 'in_progress'
    else 'scheduled'
  end,
  due_date,
  case 
    when order_type like '%Plaque%' then '1 hour'
    when order_type like '%Headstone%' then '2 hours'
    else '4 hours'
  end,
  priority
from public.orders;

-- Sample invoices
insert into public.invoices (order_id, invoice_number, customer_name, amount, status, due_date, issue_date, payment_method)
select 
  id,
  'INV-' || lpad(nextval('invoice_number_seq')::text, 3, '0'),
  customer_name,
  value,
  case 
    when progress >= 95 then 'paid'
    when due_date < current_date then 'overdue'
    else 'pending'
  end,
  due_date - interval '14 days',
  deposit_date,
  case floor(random() * 3)
    when 0 then 'Credit Card'
    when 1 then 'Bank Transfer'
    else 'Check'
  end
from public.orders
where value is not null;

-- Sample messages
insert into public.messages (order_id, type, direction, from_name, from_email, subject, content, is_read, priority)
select 
  id,
  'email',
  'inbound',
  customer_name,
  customer_email,
  'Inquiry about order ' || sku,
  'Hello, I would like to get an update on my order. Please let me know the current status and expected completion date.',
  case when progress > 50 then true else false end,
  priority
from public.orders;
```

---

## PHASE 5: CRUD Hooks Implementation

### Task 5.1: Orders Module Types
**CREATE FILE:** `src/modules/orders/types/orders.types.ts`
```typescript
import type { Tables, TablesInsert, TablesUpdate } from '@/shared/types/database.types';

export type Order = Tables<'orders'>;
export type OrderInsert = TablesInsert<'orders'>;
export type OrderUpdate = TablesUpdate<'orders'>;

export type OrderStatus = Order['stone_status'];
export type PermitStatus = Order['permit_status'];
export type ProofStatus = Order['proof_status'];
export type Priority = Order['priority'];
```

### Task 5.2: Orders API Functions
**CREATE FILE:** `src/modules/orders/api/orders.api.ts`
```typescript
import { supabase } from '@/shared/lib/supabase';
import type { Order, OrderInsert, OrderUpdate } from '../types/orders.types';

export async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Order[];
}

export async function fetchOrder(id: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Order;
}

export async function createOrder(order: OrderInsert) {
  const { data, error } = await supabase
    .from('orders')
    .insert(order)
    .select()
    .single();
  
  if (error) throw error;
  return data as Order;
}

export async function updateOrder(id: string, updates: OrderUpdate) {
  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Order;
}

export async function deleteOrder(id: string) {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}
```

### Task 5.3: Orders CRUD Hooks
**CREATE FILE:** `src/modules/orders/hooks/useOrders.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchOrders, fetchOrder, createOrder, updateOrder, deleteOrder } from '../api/orders.api';
import type { OrderInsert, OrderUpdate } from '../types/orders.types';

export const ordersKeys = {
  all: ['orders'] as const,
  detail: (id: string) => ['orders', id] as const,
};

export function useOrdersList() {
  return useQuery({
    queryKey: ordersKeys.all,
    queryFn: fetchOrders,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ordersKeys.detail(id),
    queryFn: () => fetchOrder(id),
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (order: OrderInsert) => createOrder(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: OrderUpdate }) => 
      updateOrder(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
      queryClient.setQueryData(ordersKeys.detail(data.id), data);
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
    },
  });
}
```

### Task 5.4: Invoicing Module Types
**CREATE FILE:** `src/modules/invoicing/types/invoicing.types.ts`
```typescript
import type { Tables, TablesInsert, TablesUpdate } from '@/shared/types/database.types';

export type Invoice = Tables<'invoices'>;
export type InvoiceInsert = TablesInsert<'invoices'>;
export type InvoiceUpdate = TablesUpdate<'invoices'>;

export type InvoiceStatus = Invoice['status'];
```

### Task 5.5: Invoicing API Functions
**CREATE FILE:** `src/modules/invoicing/api/invoicing.api.ts`
```typescript
import { supabase } from '@/shared/lib/supabase';
import type { Invoice, InvoiceInsert, InvoiceUpdate } from '../types/invoicing.types';

export async function fetchInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Invoice[];
}

export async function fetchInvoice(id: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Invoice;
}

export async function createInvoice(invoice: InvoiceInsert) {
  const { data, error } = await supabase
    .from('invoices')
    .insert(invoice)
    .select()
    .single();
  
  if (error) throw error;
  return data as Invoice;
}

export async function updateInvoice(id: string, updates: InvoiceUpdate) {
  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Invoice;
}

export async function deleteInvoice(id: string) {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}
```

### Task 5.6: Invoicing CRUD Hooks
**CREATE FILE:** `src/modules/invoicing/hooks/useInvoices.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchInvoices, fetchInvoice, createInvoice, updateInvoice, deleteInvoice } from '../api/invoicing.api';
import type { InvoiceInsert, InvoiceUpdate } from '../types/invoicing.types';

export const invoicesKeys = {
  all: ['invoices'] as const,
  detail: (id: string) => ['invoices', id] as const,
};

export function useInvoicesList() {
  return useQuery({
    queryKey: invoicesKeys.all,
    queryFn: fetchInvoices,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoicesKeys.detail(id),
    queryFn: () => fetchInvoice(id),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (invoice: InvoiceInsert) => createInvoice(invoice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: InvoiceUpdate }) => 
      updateInvoice(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
      queryClient.setQueryData(invoicesKeys.detail(data.id), data);
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoicesKeys.all });
    },
  });
}
```

### Task 5.7: Jobs Module Types
**CREATE FILE:** `src/modules/jobs/types/jobs.types.ts`
```typescript
import type { Tables, TablesInsert, TablesUpdate } from '@/shared/types/database.types';

export type Job = Tables<'jobs'>;
export type JobInsert = TablesInsert<'jobs'>;
export type JobUpdate = TablesUpdate<'jobs'>;

export type JobStatus = Job['status'];
```

### Task 5.8: Jobs API Functions
**CREATE FILE:** `src/modules/jobs/api/jobs.api.ts`
```typescript
import { supabase } from '@/shared/lib/supabase';
import type { Job, JobInsert, JobUpdate } from '../types/jobs.types';

export async function fetchJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('scheduled_date', { ascending: true });
  
  if (error) throw error;
  return data as Job[];
}

export async function fetchJob(id: string) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Job;
}

export async function createJob(job: JobInsert) {
  const { data, error } = await supabase
    .from('jobs')
    .insert(job)
    .select()
    .single();
  
  if (error) throw error;
  return data as Job;
}

export async function updateJob(id: string, updates: JobUpdate) {
  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Job;
}

export async function deleteJob(id: string) {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}
```

### Task 5.9: Jobs CRUD Hooks
**CREATE FILE:** `src/modules/jobs/hooks/useJobs.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJobs, fetchJob, createJob, updateJob, deleteJob } from '../api/jobs.api';
import type { JobInsert, JobUpdate } from '../types/jobs.types';

export const jobsKeys = {
  all: ['jobs'] as const,
  detail: (id: string) => ['jobs', id] as const,
};

export function useJobsList() {
  return useQuery({
    queryKey: jobsKeys.all,
    queryFn: fetchJobs,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobsKeys.detail(id),
    queryFn: () => fetchJob(id),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (job: JobInsert) => createJob(job),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: JobUpdate }) => 
      updateJob(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
      queryClient.setQueryData(jobsKeys.detail(data.id), data);
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}
```

### Task 5.10: Inbox Module Types
**CREATE FILE:** `src/modules/inbox/types/inbox.types.ts`
```typescript
import type { Tables, TablesInsert, TablesUpdate } from '@/shared/types/database.types';

export type Message = Tables<'messages'>;
export type MessageInsert = TablesInsert<'messages'>;
export type MessageUpdate = TablesUpdate<'messages'>;

export type MessageType = Message['type'];
export type MessageDirection = Message['direction'];
```

### Task 5.11: Inbox API Functions
**CREATE FILE:** `src/modules/inbox/api/inbox.api.ts`
```typescript
import { supabase } from '@/shared/lib/supabase';
import type { Message, MessageInsert, MessageUpdate } from '../types/inbox.types';

export async function fetchMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Message[];
}

export async function fetchMessage(id: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Message;
}

export async function fetchThreadMessages(threadId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data as Message[];
}

export async function createMessage(message: MessageInsert) {
  const { data, error } = await supabase
    .from('messages')
    .insert(message)
    .select()
    .single();
  
  if (error) throw error;
  return data as Message;
}

export async function updateMessage(id: string, updates: MessageUpdate) {
  const { data, error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Message;
}

export async function markMessageAsRead(id: string) {
  return updateMessage(id, { is_read: true });
}

export async function deleteMessage(id: string) {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}
```

### Task 5.12: Inbox CRUD Hooks
**CREATE FILE:** `src/modules/inbox/hooks/useMessages.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchMessages, 
  fetchMessage, 
  fetchThreadMessages,
  createMessage, 
  updateMessage, 
  markMessageAsRead,
  deleteMessage 
} from '../api/inbox.api';
import type { MessageInsert, MessageUpdate } from '../types/inbox.types';

export const messagesKeys = {
  all: ['messages'] as const,
  detail: (id: string) => ['messages', id] as const,
  thread: (threadId: string) => ['messages', 'thread', threadId] as const,
};

export function useMessagesList() {
  return useQuery({
    queryKey: messagesKeys.all,
    queryFn: fetchMessages,
  });
}

export function useMessage(id: string) {
  return useQuery({
    queryKey: messagesKeys.detail(id),
    queryFn: () => fetchMessage(id),
    enabled: !!id,
  });
}

export function useThreadMessages(threadId: string) {
  return useQuery({
    queryKey: messagesKeys.thread(threadId),
    queryFn: () => fetchThreadMessages(threadId),
    enabled: !!threadId,
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (message: MessageInsert) => createMessage(message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.all });
    },
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MessageUpdate }) => 
      updateMessage(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.all });
      queryClient.setQueryData(messagesKeys.detail(data.id), data);
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => markMessageAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.all });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.all });
    },
  });
}
```

### Task 5.13: Reporting Module Types & Hooks
**CREATE FILE:** `src/modules/reporting/types/reporting.types.ts`
```typescript
export interface MonthlyRevenue {
  month: string;
  invoice_count: number;
  paid_amount: number;
  outstanding_amount: number;
  total_amount: number;
}

export interface OrderStatusSummary {
  total_orders: number;
  ready_for_install: number;
  overdue: number;
  pending_approval: number;
  avg_progress: number;
}

export interface TopProduct {
  product_name: string;
  order_count: number;
  total_revenue: number;
}
```

**CREATE FILE:** `src/modules/reporting/api/reporting.api.ts`
```typescript
import { supabase } from '@/shared/lib/supabase';
import type { MonthlyRevenue, OrderStatusSummary, TopProduct } from '../types/reporting.types';

export async function fetchMonthlyRevenue() {
  const { data, error } = await supabase
    .from('v_monthly_revenue')
    .select('*')
    .limit(12);
  
  if (error) throw error;
  return data as MonthlyRevenue[];
}

export async function fetchOrderStatusSummary() {
  const { data, error } = await supabase
    .from('v_order_status_summary')
    .select('*')
    .single();
  
  if (error) throw error;
  return data as OrderStatusSummary;
}

export async function fetchTopProducts() {
  const { data, error } = await supabase
    .from('v_top_products')
    .select('*');
  
  if (error) throw error;
  return data as TopProduct[];
}
```

**CREATE FILE:** `src/modules/reporting/hooks/useReporting.ts`
```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchMonthlyRevenue, fetchOrderStatusSummary, fetchTopProducts } from '../api/reporting.api';

export const reportingKeys = {
  monthlyRevenue: ['reporting', 'monthly-revenue'] as const,
  orderSummary: ['reporting', 'order-summary'] as const,
  topProducts: ['reporting', 'top-products'] as const,
};

export function useMonthlyRevenue() {
  return useQuery({
    queryKey: reportingKeys.monthlyRevenue,
    queryFn: fetchMonthlyRevenue,
  });
}

export function useOrderStatusSummary() {
  return useQuery({
    queryKey: reportingKeys.orderSummary,
    queryFn: fetchOrderStatusSummary,
  });
}

export function useTopProducts() {
  return useQuery({
    queryKey: reportingKeys.topProducts,
    queryFn: fetchTopProducts,
  });
}
```

---

## PHASE 6: Page Integration

### Task 6.1: Update OrdersPage to Use Real Data
**MODIFY:** `src/modules/orders/pages/OrdersPage.tsx`
- Import `useOrdersList` hook
- Replace static `orders` array with `const { data: orders, isLoading, error } = useOrdersList()`
- Add loading state UI
- Add error state UI
- Keep existing UI components

### Task 6.2: Update InvoicingPage to Use Real Data
**MODIFY:** `src/modules/invoicing/pages/InvoicingPage.tsx`
- Import `useInvoicesList` hook
- Replace static `invoices` array with real data
- Add loading/error states

### Task 6.3: Update JobsMapPage to Use Real Data
**MODIFY:** `src/modules/jobs/pages/JobsMapPage.tsx`
- Import `useJobsList` hook
- Replace static `jobs` array with real data
- Transform job data to include coordinates for map markers
- Add loading/error states

### Task 6.4: Update UnifiedInboxPage to Use Real Data
**MODIFY:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- Import `useMessagesList`, `useMarkAsRead` hooks
- Replace static `communications` array with real data
- Remove Gmail-specific code (save for Phase 3)
- Add loading/error states

### Task 6.5: Update ReportingPage to Use Real Data
**MODIFY:** `src/modules/reporting/pages/ReportingPage.tsx`
- Import `useMonthlyRevenue`, `useOrderStatusSummary`, `useTopProducts` hooks
- Replace static metrics with real data
- Add loading/error states

### Task 6.6: Update GoogleMap Component
**MODIFY:** `src/modules/jobs/components/GoogleMap.tsx`
- Update job prop types to match database schema
- Handle nullable coordinates

---

## PHASE 7: Forms & Drawers

### Task 7.1: Create Order Form Schema
**CREATE FILE:** `src/modules/orders/components/OrderForm.tsx`
```typescript
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Textarea } from '@/shared/components/ui/textarea';
import type { OrderInsert } from '../types/orders.types';

const orderSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_email: z.string().email().optional().or(z.literal('')),
  customer_phone: z.string().optional(),
  order_type: z.string().min(1, 'Order type is required'),
  sku: z.string().optional(),
  material: z.string().optional(),
  color: z.string().optional(),
  stone_status: z.enum(['NA', 'Ordered', 'In Stock']).default('NA'),
  permit_status: z.enum(['form_sent', 'customer_completed', 'pending', 'approved']).default('pending'),
  proof_status: z.enum(['NA', 'Not_Received', 'Received', 'In_Progress', 'Lettered']).default('Not_Received'),
  deposit_date: z.string().optional(),
  due_date: z.string().optional(),
  location: z.string().optional(),
  value: z.number().positive().optional(),
  assigned_to: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  timeline_weeks: z.number().int().positive().default(12),
  notes: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface OrderFormProps {
  defaultValues?: Partial<OrderFormData>;
  onSubmit: (data: OrderInsert) => void;
  isLoading?: boolean;
}

export function OrderForm({ defaultValues, onSubmit, isLoading }: OrderFormProps) {
  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_name: '',
      order_type: '',
      stone_status: 'NA',
      permit_status: 'pending',
      proof_status: 'Not_Received',
      priority: 'medium',
      timeline_weeks: 12,
      ...defaultValues,
    },
  });

  const handleSubmit = (data: OrderFormData) => {
    onSubmit(data as OrderInsert);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="customer_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="customer_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="customer_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="order_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order Type *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Granite Headstone" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="stone_status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stone Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="NA">N/A</SelectItem>
                    <SelectItem value="Ordered">Ordered</SelectItem>
                    <SelectItem value="In Stock">In Stock</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Value (£)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Cemetery name" />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Order'}
        </Button>
      </form>
    </Form>
  );
}
```

### Task 7.2: Create Order Drawer
**CREATE FILE:** `src/modules/orders/components/OrderDrawer.tsx`
```typescript
import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet';
import { OrderForm } from './OrderForm';
import { useCreateOrder, useUpdateOrder } from '../hooks/useOrders';
import type { Order, OrderInsert } from '../types/orders.types';
import { useToast } from '@/shared/hooks/use-toast';

interface OrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: Order | null;
}

export function OrderDrawer({ open, onOpenChange, order }: OrderDrawerProps) {
  const { toast } = useToast();
  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();
  
  const isEditing = !!order;
  const isLoading = createOrder.isPending || updateOrder.isPending;

  const handleSubmit = async (data: OrderInsert) => {
    try {
      if (isEditing && order) {
        await updateOrder.mutateAsync({ id: order.id, updates: data });
        toast({ title: 'Order updated successfully' });
      } else {
        await createOrder.mutateAsync(data);
        toast({ title: 'Order created successfully' });
      }
      onOpenChange(false);
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: 'Failed to save order',
        variant: 'destructive'
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Order' : 'Create New Order'}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <OrderForm 
            defaultValues={order || undefined}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

### Task 7.3: Create Invoice Form & Drawer
**CREATE FILE:** `src/modules/invoicing/components/InvoiceForm.tsx`
**CREATE FILE:** `src/modules/invoicing/components/InvoiceDrawer.tsx`
(Similar structure to OrderForm/OrderDrawer)

### Task 7.4: Create Message Compose Drawer
**CREATE FILE:** `src/modules/inbox/components/ComposeMessageDrawer.tsx`
(For creating new manual messages)

### Task 7.5: Update Index Exports
**UPDATE FILE:** `src/modules/orders/index.ts`
```typescript
export { OrdersPage } from './pages/OrdersPage';
export { SortableOrdersTable } from './components/SortableOrdersTable';
export { OrderDetailsSidebar } from './components/OrderDetailsSidebar';
export { OrderForm } from './components/OrderForm';
export { OrderDrawer } from './components/OrderDrawer';
export { useOrdersList, useOrder, useCreateOrder, useUpdateOrder, useDeleteOrder } from './hooks/useOrders';
export type { Order, OrderInsert, OrderUpdate } from './types/orders.types';
```

---

## PHASE 8: Cleanup & Validation

### Task 8.1: Delete Empty Directories
```
DELETE: src/components/ (after all files moved)
DELETE: src/hooks/ (after all files moved)
DELETE: src/lib/ (after all files moved)
DELETE: src/integrations/ (after all files moved)
DELETE: src/pages/dashboard/ (after all files moved)
DELETE: src/pages/Dashboard.tsx (moved to app/layout)
DELETE: src/pages/Index.tsx (moved to modules/landing)
```

### Task 8.2: Update components.json for shadcn/ui
**MODIFY:** `components.json`
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/shared/components",
    "utils": "@/shared/lib/utils",
    "ui": "@/shared/components/ui",
    "lib": "@/shared/lib",
    "hooks": "@/shared/hooks"
  }
}
```

### Task 8.3: Run Type Check
```bash
npm run build
```

### Task 8.4: Test All Routes
- [ ] `/` - Landing page
- [ ] `/dashboard/inbox` - Unified inbox
- [ ] `/dashboard/map` - Jobs map
- [ ] `/dashboard/orders` - Orders management
- [ ] `/dashboard/invoicing` - Invoicing
- [ ] `/dashboard/reporting` - Reporting

### Task 8.5: Apply Migrations
```bash
supabase db push
```

### Task 8.6: Regenerate Supabase Types
```bash
supabase gen types typescript --local > src/shared/types/database.types.ts
```

---

## Execution Order Summary

| Step | Phase | Description | Est. Time |
|------|-------|-------------|-----------|
| 1 | 0 | Create directory structure | 5 min |
| 2 | 1 | Move shared UI components (48 files) | 30 min |
| 3 | 1 | Move shared hooks and lib files | 10 min |
| 4 | 2 | Create app shell (providers, router, layout) | 20 min |
| 5 | 3 | Move module files (pages + components) | 45 min |
| 6 | 3 | Update all imports in moved files | 60 min |
| 7 | 4 | Create and apply database migrations | 30 min |
| 8 | 5 | Create CRUD types, API, and hooks | 60 min |
| 9 | 6 | Integrate real data into pages | 45 min |
| 10 | 7 | Create forms and drawers | 60 min |
| 11 | 8 | Cleanup and validation | 30 min |

**Total Estimated Time: ~6.5 hours**

---

## Safety Checklist

- [ ] No workflow or automation code added
- [ ] No AI features implemented
- [ ] No third-party integrations (Gmail, WhatsApp, Stripe)
- [ ] All existing UI preserved exactly
- [ ] Module boundaries respected
- [ ] Import paths correctly updated
- [ ] Router paths match existing routes
- [ ] TypeScript compiles without errors
- [ ] All routes accessible and functional

---

## Files Created Summary

### New Files (CREATE)
| Count | Category |
|-------|----------|
| 35+ | Directories |
| 7 | Module index.ts files |
| 6 | Database migrations |
| 5 | Type definition files |
| 5 | API function files |
| 5 | CRUD hook files |
| 3 | App shell files |
| 4 | Form/Drawer components |
| 1 | Common types file |

### Moved Files (MOVE)
| Count | Category |
|-------|----------|
| 49 | UI components (src/components/ui/) |
| 5 | Dashboard pages |
| 10 | Feature components |
| 4 | Landing page components |
| 2 | Shared hooks |
| 2 | Lib files (utils, supabase) |
| 1 | Database types |

### Modified Files (UPDATE)
| Count | Category |
|-------|----------|
| 1 | main.tsx |
| 1 | components.json |
| 65+ | Import path updates in moved files |
| 5 | Pages (data integration) |

---

*Implementation Plan Ready for `/implement` command*
*Branch: `feature/phase-1-module-architecture`*

