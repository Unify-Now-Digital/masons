-- Add source tracking and tombstone-unmute to inbox_muted_senders.
-- source: 'manual' (Hide sender action), 'seed' (July 21 census seed),
--         'auto' (ingest-side robot-pattern auto-mute, added this session).
-- unmuted_at: tombstone — non-null means the sender was unmuted. Unmute is an
-- UPDATE (set unmuted_at = now()), NOT a delete, so the auto-mute inserter's
-- "on conflict do nothing" collides with the tombstone and correctly declines
-- to re-mute a sender a human chose to unhide. Re-mute via manual action is an
-- upsert clearing unmuted_at. Filters must read "unmuted_at is null" as muted.
-- Applied via Dashboard SQL editor July 21 2026.
--
-- Read-back at apply time (org 3770972d-1bbd-417b-b413-297e844db285):
--   select source, count(*), count(*) filter (where unmuted_at is not null)
--   from inbox_muted_senders group by source;
--   => manual 1 (tombstoned 0), seed 45 (tombstoned 0)

alter table public.inbox_muted_senders
  add column source text not null default 'manual'
    check (source in ('manual','seed','auto')),
  add column unmuted_at timestamptz;

update public.inbox_muted_senders set source = 'seed' where created_by is null;