-- Daily monitor audit trail (dossier Part 9.3).
create table if not exists public.monitor_runs (
  id                 uuid primary key default gen_random_uuid(),
  ran_at             timestamptz not null default now(),
  transitions_count  int not null default 0,
  stale              boolean not null default false,
  findings           jsonb,
  created_at         timestamptz not null default now()
);

alter table public.monitor_runs enable row level security;
