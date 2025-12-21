-- Migration: Add invoice_id column to orders table
-- Purpose: Establish Invoices as the architectural spine; Orders reference Invoices
-- Date: 2025-12-22

-- Add invoice_id column to orders table
-- Column is nullable to allow for gradual migration and backward compatibility
alter table public.orders
  add column invoice_id uuid references public.invoices(id) on delete set null;

-- Create index for query performance on invoice_id lookups
-- This enables efficient queries: "Which orders belong to this invoice?"
create index if not exists idx_orders_invoice_id on public.orders(invoice_id);

-- Add comment to document the column purpose
comment on column public.orders.invoice_id is 'References the invoice that this order belongs to. Invoices are the architectural spine. Nullable to allow for gradual migration.';

