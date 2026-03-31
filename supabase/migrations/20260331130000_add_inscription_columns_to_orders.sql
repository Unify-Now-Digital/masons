-- ============================================================
-- Migration: add_inscription_columns_to_orders
-- Apply via: Supabase dashboard → SQL editor
-- Adds 5 nullable inscription columns to the existing orders
-- table. No constraints, no defaults, no RLS changes.
-- ============================================================

alter table public.orders
  add column if not exists inscription_text       text,
  add column if not exists inscription_font       text,
  add column if not exists inscription_font_other text,
  add column if not exists inscription_layout     text,
  add column if not exists inscription_additional text;
