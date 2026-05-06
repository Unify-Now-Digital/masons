alter table public.people
  add column if not exists is_test boolean not null default false;

update public.people
set is_test = true
where email in (
  'testquote1@tracking-test.com',
  'claude-smoke-test+5dd84e7@searsmelvin.test',
  'charlotte.test@example.com',
  'daniel.test@example.com',
  'eleanor.test@example.com',
  'brian.test@example.com',
  'alice.test@example.com',
  'smoke-appointment@searsmelvin.test',
  'smoke-call@searsmelvin.test',
  'smoke-contact@searsmelvin.test',
  'smoke-quote@searsmelvin.test',
  'smoke-shortlist@searsmelvin.test',
  'margaret.thornton@example.com'
);
