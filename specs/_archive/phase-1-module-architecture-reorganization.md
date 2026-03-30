# Phase 1: Reorganize Project Structure into Feature-Based Module Architecture

## Overview

This specification defines the reorganization of the existing Lovable-generated project from a flat structure into a scalable, feature-based module architecture. This is a foundational change that must be completed **before** implementing any new Phase 1 features.

---

## 1. Current Structure Analysis

### Current Directory Layout

```
src/
├── App.tsx                          # Root component with routes + providers
├── main.tsx                         # Entry point
├── index.css                        # Global styles
├── vite-env.d.ts                    # Vite types
│
├── assets/                          # Static images
│   ├── england-detailed-map.jpg
│   ├── england-map.jpg
│   └── london-map.jpg
│
├── components/                      # Mixed shared + feature components
│   ├── AppSidebar.tsx              # Dashboard sidebar navigation
│   ├── CommunicationIntegrations.tsx  # Inbox feature component
│   ├── ConversationView.tsx        # Inbox feature component
│   ├── FeatureCard.tsx             # Landing page component
│   ├── FeatureScreenshots.tsx      # Landing page component
│   ├── GoogleMap.tsx               # Jobs map feature component
│   ├── Navigation.tsx              # Landing page navigation
│   ├── OrderDetailsSidebar.tsx     # Orders feature component
│   ├── SortableOrdersTable.tsx     # Orders feature component
│   ├── TestimonialCard.tsx         # Landing page component
│   └── ui/                         # shadcn/ui primitives (48 files)
│       ├── accordion.tsx
│       ├── alert-dialog.tsx
│       ├── ...
│       └── use-toast.ts
│
├── hooks/                           # General hooks
│   ├── use-mobile.tsx
│   └── use-toast.ts
│
├── integrations/
│   └── supabase/
│       ├── client.ts               # Supabase client instance
│       └── types.ts                # Auto-generated database types
│
├── lib/
│   └── utils.ts                    # cn() utility
│
└── pages/
    ├── Dashboard.tsx               # Dashboard shell with Outlet
    ├── Index.tsx                   # Landing page
    ├── NotFound.tsx                # 404 page
    └── dashboard/                  # Nested dashboard pages
        ├── UnifiedInbox.tsx
        ├── MapView.tsx
        ├── Orders.tsx
        ├── Invoicing.tsx
        └── Reporting.tsx
```

### Current File Dependencies

| File | Key Dependencies |
|------|------------------|
| `App.tsx` | QueryClientProvider, BrowserRouter, all page imports |
| `Dashboard.tsx` | SidebarProvider, AppSidebar, Outlet |
| `UnifiedInbox.tsx` | ConversationView, supabase client, useToast |
| `MapView.tsx` | GoogleMap component |
| `Orders.tsx` | SortableOrdersTable, OrderDetailsSidebar |
| `Invoicing.tsx` | UI components only (no custom components) |
| `Reporting.tsx` | UI components only (no custom components) |

---

## 2. Target Architecture

### New Directory Structure

```
src/
├── main.tsx                         # Entry point (unchanged)
├── index.css                        # Global styles (unchanged)
├── vite-env.d.ts                    # Vite types (unchanged)
│
├── app/                             # Application shell
│   ├── App.tsx                      # Root component (moved from src/)
│   ├── router.tsx                   # Route definitions extracted
│   ├── layout/
│   │   ├── DashboardLayout.tsx      # Renamed from Dashboard.tsx
│   │   └── AppSidebar.tsx           # Moved from components/
│   └── providers.tsx                # QueryClient, Tooltip, etc.
│
├── modules/                         # Feature modules
│   ├── inbox/
│   │   ├── pages/
│   │   │   └── UnifiedInboxPage.tsx
│   │   ├── components/
│   │   │   ├── ConversationView.tsx
│   │   │   ├── CommunicationIntegrations.tsx
│   │   │   └── MessageList.tsx      # Future: extract from page
│   │   ├── hooks/
│   │   │   └── useMessages.ts       # Future: CRUD hook
│   │   ├── api/
│   │   │   └── inbox.api.ts         # Future: Supabase queries
│   │   ├── types/
│   │   │   └── inbox.types.ts       # Future: module types
│   │   └── index.ts                 # Module barrel export
│   │
│   ├── jobs/
│   │   ├── pages/
│   │   │   └── MapOfJobsPage.tsx
│   │   ├── components/
│   │   │   └── GoogleMap.tsx
│   │   ├── hooks/
│   │   ├── api/
│   │   └── index.ts
│   │
│   ├── orders/
│   │   ├── pages/
│   │   │   └── OrdersPage.tsx
│   │   ├── components/
│   │   │   ├── SortableOrdersTable.tsx
│   │   │   └── OrderDetailsSidebar.tsx
│   │   ├── hooks/
│   │   │   └── useOrders.ts         # Future: CRUD hook
│   │   ├── api/
│   │   │   └── orders.api.ts        # Future: Supabase queries
│   │   └── index.ts
│   │
│   ├── invoicing/
│   │   ├── pages/
│   │   │   └── InvoicingPage.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── index.ts
│   │
│   ├── reporting/
│   │   ├── pages/
│   │   │   └── ReportingPage.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── index.ts
│   │
│   ├── team/                        # Placeholder for Phase 2
│   │   ├── pages/
│   │   │   └── TeamChatPage.tsx     # Placeholder
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── index.ts
│   │
│   └── landing/                     # Marketing/public pages
│       ├── pages/
│       │   └── LandingPage.tsx      # Renamed from Index.tsx
│       ├── components/
│       │   ├── Navigation.tsx
│       │   ├── FeatureCard.tsx
│       │   ├── FeatureScreenshots.tsx
│       │   └── TestimonialCard.tsx
│       └── index.ts
│
├── shared/                          # Shared utilities
│   ├── components/
│   │   └── ui/                      # All shadcn components (moved)
│   │       ├── accordion.tsx
│   │       ├── ...
│   │       └── tooltip.tsx
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── utils.ts
│   │   └── supabase.ts              # Renamed from integrations/supabase/client.ts
│   └── types/
│       ├── database.types.ts        # Renamed from integrations/supabase/types.ts
│       └── common.types.ts          # Shared type definitions
│
├── assets/                          # Static assets (unchanged location)
│   ├── england-detailed-map.jpg
│   ├── england-map.jpg
│   └── london-map.jpg
│
└── pages/                           # Keep for 404 and future static pages
    └── NotFound.tsx
```

---

## 3. Exact File Moves

### Phase 1A: Create New Directories

```bash
# Create app structure
mkdir -p src/app/layout

# Create module directories
mkdir -p src/modules/inbox/{pages,components,hooks,api,types}
mkdir -p src/modules/jobs/{pages,components,hooks,api,types}
mkdir -p src/modules/orders/{pages,components,hooks,api,types}
mkdir -p src/modules/invoicing/{pages,components,hooks,api,types}
mkdir -p src/modules/reporting/{pages,components,hooks,api,types}
mkdir -p src/modules/team/{pages,components,hooks,api,types}
mkdir -p src/modules/landing/{pages,components}

# Create shared directories
mkdir -p src/shared/{components/ui,hooks,lib,types}
```

### Phase 1B: Move Files

| Source | Destination | Notes |
|--------|-------------|-------|
| `src/App.tsx` | `src/app/App.tsx` | Update imports |
| `src/pages/Dashboard.tsx` | `src/app/layout/DashboardLayout.tsx` | Rename component |
| `src/components/AppSidebar.tsx` | `src/app/layout/AppSidebar.tsx` | Move to layout |
| `src/pages/dashboard/UnifiedInbox.tsx` | `src/modules/inbox/pages/UnifiedInboxPage.tsx` | Rename component |
| `src/components/ConversationView.tsx` | `src/modules/inbox/components/ConversationView.tsx` | Move to module |
| `src/components/CommunicationIntegrations.tsx` | `src/modules/inbox/components/CommunicationIntegrations.tsx` | Move to module |
| `src/pages/dashboard/MapView.tsx` | `src/modules/jobs/pages/MapOfJobsPage.tsx` | Rename component |
| `src/components/GoogleMap.tsx` | `src/modules/jobs/components/GoogleMap.tsx` | Move to module |
| `src/pages/dashboard/Orders.tsx` | `src/modules/orders/pages/OrdersPage.tsx` | Rename component |
| `src/components/SortableOrdersTable.tsx` | `src/modules/orders/components/SortableOrdersTable.tsx` | Move to module |
| `src/components/OrderDetailsSidebar.tsx` | `src/modules/orders/components/OrderDetailsSidebar.tsx` | Move to module |
| `src/pages/dashboard/Invoicing.tsx` | `src/modules/invoicing/pages/InvoicingPage.tsx` | Rename component |
| `src/pages/dashboard/Reporting.tsx` | `src/modules/reporting/pages/ReportingPage.tsx` | Rename component |
| `src/pages/Index.tsx` | `src/modules/landing/pages/LandingPage.tsx` | Rename component |
| `src/components/Navigation.tsx` | `src/modules/landing/components/Navigation.tsx` | Move to module |
| `src/components/FeatureCard.tsx` | `src/modules/landing/components/FeatureCard.tsx` | Move to module |
| `src/components/FeatureScreenshots.tsx` | `src/modules/landing/components/FeatureScreenshots.tsx` | Move to module |
| `src/components/TestimonialCard.tsx` | `src/modules/landing/components/TestimonialCard.tsx` | Move to module |
| `src/components/ui/*` | `src/shared/components/ui/*` | Move all 48 files |
| `src/hooks/use-mobile.tsx` | `src/shared/hooks/use-mobile.tsx` | Move hook |
| `src/hooks/use-toast.ts` | `src/shared/hooks/use-toast.ts` | Move hook |
| `src/lib/utils.ts` | `src/shared/lib/utils.ts` | Move utility |
| `src/integrations/supabase/client.ts` | `src/shared/lib/supabase.ts` | Move + rename |
| `src/integrations/supabase/types.ts` | `src/shared/types/database.types.ts` | Move + rename |

### Phase 1C: Delete Empty Directories

```bash
rm -rf src/components
rm -rf src/hooks
rm -rf src/lib
rm -rf src/integrations
rm -rf src/pages/dashboard
```

---

## 4. Naming Conventions

### Files

| Type | Convention | Example |
|------|------------|---------|
| Pages | `PascalCase` + `Page` suffix | `OrdersPage.tsx` |
| Components | `PascalCase` | `SortableOrdersTable.tsx` |
| Hooks | `camelCase` with `use` prefix | `useOrders.ts` |
| API files | `kebab-case` + `.api.ts` | `orders.api.ts` |
| Type files | `kebab-case` + `.types.ts` | `orders.types.ts` |
| Utility files | `kebab-case` | `utils.ts` |

### Components

| Type | Convention | Example |
|------|------------|---------|
| Page components | `{Feature}Page` | `OrdersPage`, `InvoicingPage` |
| Layout components | `{Name}Layout` | `DashboardLayout` |
| Feature components | Descriptive PascalCase | `SortableOrdersTable` |
| UI components | Single word or compound | `Button`, `AlertDialog` |

### Hooks

| Type | Convention | Example |
|------|------------|---------|
| Query hooks | `use{Resource}` | `useOrders`, `useInvoices` |
| Query hooks (single) | `use{Resource}` | `useOrder` |
| Mutation hooks | `use{Action}{Resource}` | `useCreateOrder`, `useUpdateOrder` |
| Utility hooks | `use{Behavior}` | `useToast`, `useIsMobile` |

### Modules

| Module | Route Path | Description |
|--------|------------|-------------|
| `inbox` | `/dashboard/inbox` | Unified communications |
| `jobs` | `/dashboard/map` | Map of jobs/installations |
| `orders` | `/dashboard/orders` | Order management |
| `invoicing` | `/dashboard/invoicing` | Invoice management |
| `reporting` | `/dashboard/reporting` | Analytics & reports |
| `team` | `/dashboard/team` | Team chat (Phase 2) |
| `landing` | `/` | Public marketing page |

---

## 5. Import Path Updates

### Before (Current Paths)

```typescript
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ConversationView from "@/components/ConversationView";
```

### After (New Paths)

```typescript
// Shared UI components
import { Button } from "@/shared/components/ui/button";

// Supabase client
import { supabase } from "@/shared/lib/supabase";

// Shared hooks
import { useToast } from "@/shared/hooks/use-toast";

// Module components (relative within module)
import ConversationView from "../components/ConversationView";

// Cross-module imports (use barrel exports)
import { OrdersPage } from "@/modules/orders";
```

### TypeScript Path Aliases (tsconfig.json)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/app/*": ["./src/app/*"],
      "@/modules/*": ["./src/modules/*"],
      "@/shared/*": ["./src/shared/*"]
    }
  }
}
```

---

## 6. Module Structure Details

### Barrel Exports (index.ts)

Each module should have an `index.ts` that exports public interfaces:

```typescript
// src/modules/orders/index.ts
export { OrdersPage } from './pages/OrdersPage';
export { SortableOrdersTable } from './components/SortableOrdersTable';
export { OrderDetailsSidebar } from './components/OrderDetailsSidebar';
// Future: export { useOrders, useOrder, useCreateOrder } from './hooks/useOrders';
// Future: export type { Order, OrderStatus } from './types/orders.types';
```

### Module Internal Structure

```
modules/{module}/
├── pages/           # Route-level components (1 per route typically)
├── components/      # Feature-specific components
├── hooks/           # TanStack Query hooks for this module
├── api/             # Supabase query functions
├── types/           # TypeScript types for this module
└── index.ts         # Barrel export
```

---

## 7. Router Configuration

### New Router File: `src/app/router.tsx`

```typescript
import { Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./layout/DashboardLayout";
import { LandingPage } from "@/modules/landing";
import { UnifiedInboxPage } from "@/modules/inbox";
import { MapOfJobsPage } from "@/modules/jobs";
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
        <Route path="map" element={<MapOfJobsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="invoicing" element={<InvoicingPage />} />
        <Route path="reporting" element={<ReportingPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

---

## 8. CRUD Hooks Organization (Future Reference)

When adding database CRUD in Phase 1 implementation, hooks will follow this pattern:

```typescript
// src/modules/orders/hooks/useOrders.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { Order } from '../types/orders.types';

// List all orders
export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Order[];
    }
  });
}

// Get single order
export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Order;
    },
    enabled: !!id
  });
}

// Create order mutation
export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: Omit<Order, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('orders')
        .insert(order)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });
}
```

---

## 9. Assumptions

1. **No database schema changes** during reorganization - only file structure changes
2. **All existing functionality** must remain working after reorganization
3. **Import path alias `@/`** is already configured and working
4. **No new features** will be added during this reorganization phase
5. **Empty module folders** (api/, hooks/, types/) will be created as placeholders for Phase 1 CRUD implementation
6. **shadcn/ui components** will retain exact same API - only import paths change
7. **Supabase types file** is auto-generated and will continue to be regenerated in new location
8. **Team module** is a placeholder for Phase 2 and will have minimal implementation
9. **Git history** should be preserved using `git mv` where possible

---

## 10. Phase 1 Scope Reminder

Per requirements, Phase 1 will **NOT** include:
- ❌ Workflows or automations
- ❌ AI features
- ❌ Gmail integration (existing code stays but disabled)
- ❌ WhatsApp integration
- ❌ Stripe integration
- ❌ Any third-party integrations

Phase 1 **WILL** include:
- ✅ This structural reorganization
- ✅ Basic CRUD using Supabase + TanStack Query
- ✅ Replace static demo data with real database queries
- ✅ Add drawers/modals/forms for create/update operations
- ✅ Keep all pages functional but simple
- ✅ Reporting with placeholder SQL views

---

## 11. Implementation Checklist

### Pre-flight
- [ ] Create feature branch: `feature/phase-1-module-architecture`
- [ ] Verify all tests pass on current structure (if any)
- [ ] Document current import paths for reference

### Directory Creation
- [ ] Create `src/app/` directory structure
- [ ] Create `src/modules/` with all module subdirectories
- [ ] Create `src/shared/` directory structure

### File Moves - App Shell
- [ ] Move `App.tsx` to `src/app/App.tsx`
- [ ] Move `Dashboard.tsx` to `src/app/layout/DashboardLayout.tsx`
- [ ] Move `AppSidebar.tsx` to `src/app/layout/AppSidebar.tsx`
- [ ] Create `src/app/router.tsx`
- [ ] Create `src/app/providers.tsx`

### File Moves - Shared
- [ ] Move all `src/components/ui/*` to `src/shared/components/ui/`
- [ ] Move `src/hooks/*` to `src/shared/hooks/`
- [ ] Move `src/lib/utils.ts` to `src/shared/lib/utils.ts`
- [ ] Move Supabase client to `src/shared/lib/supabase.ts`
- [ ] Move Supabase types to `src/shared/types/database.types.ts`

### File Moves - Modules
- [ ] Inbox module: Move pages and components
- [ ] Jobs module: Move pages and components
- [ ] Orders module: Move pages and components
- [ ] Invoicing module: Move page
- [ ] Reporting module: Move page
- [ ] Landing module: Move page and components

### Import Updates
- [ ] Update all import paths in moved files
- [ ] Update `main.tsx` to import from `src/app/App.tsx`
- [ ] Create barrel exports for each module

### Cleanup
- [ ] Delete empty `src/components/` directory
- [ ] Delete empty `src/hooks/` directory
- [ ] Delete empty `src/lib/` directory
- [ ] Delete empty `src/integrations/` directory
- [ ] Delete empty `src/pages/dashboard/` directory

### Validation
- [ ] Run `npm run build` - no TypeScript errors
- [ ] Run `npm run dev` - app starts correctly
- [ ] Verify all routes work: `/`, `/dashboard/*`
- [ ] Verify no console errors

---

## 12. Next Steps After Reorganization

Once this reorganization is complete, Phase 1 implementation can proceed with:

1. **Database Schema Design** - Create tables for orders, invoices, jobs, messages
2. **Migration Files** - Write Supabase migrations
3. **CRUD Hooks** - Implement TanStack Query hooks per module
4. **Form Components** - Add create/edit forms with React Hook Form + Zod
5. **Replace Demo Data** - Connect pages to real database queries

---

*Specification created: Phase 1 Module Architecture Reorganization*
*Ready for implementation via `/plan` command*

