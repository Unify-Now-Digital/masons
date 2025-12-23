-- Add job_id column to orders table
-- This allows Orders to be linked to Jobs (one Order can belong to one Job)
alter table public.orders
  add column job_id uuid references public.jobs(id) on delete set null;

