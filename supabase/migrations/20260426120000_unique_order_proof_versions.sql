-- Enforce one row per (proof_id, version) on order_proof_versions.
-- Concurrent inserts during proof state transitions can otherwise race and
-- produce duplicate version numbers, which would corrupt the proof timeline
-- ("customer approved v3" — but which v3?).
--
-- Table is currently empty (0 rows) so this index applies cleanly without
-- a backfill or de-duplication pass. The existing
-- idx_order_proof_versions_proof (proof_id, version desc) index is kept
-- for fast "latest version" reads; this new unique index supplies the
-- missing data-integrity guarantee.

create unique index if not exists idx_order_proof_versions_proof_version_unique
  on public.order_proof_versions (proof_id, version);

comment on index public.idx_order_proof_versions_proof_version_unique is
  'Prevent duplicate (proof_id, version) rows from racing inserts.';
