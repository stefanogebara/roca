-- Founder daily-digest audit trail: each run's rollup, so digests are
-- reviewable historically even if delivery (WhatsApp/email) isn't configured.
create table if not exists public.digests (
  id          uuid primary key default gen_random_uuid(),
  ran_at      timestamptz not null default now(),
  period_start timestamptz not null,
  period_end   timestamptz not null,
  stats       jsonb,
  text        text,
  created_at  timestamptz not null default now()
);

alter table public.digests enable row level security;
