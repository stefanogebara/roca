-- Proactive farmer alerts (vazio sanitário transitions, later NDVI/disease
-- windows). The unique (user_id, dedup_key) pair is the idempotency claim: the
-- daily monitor may see the same upcoming transition for 7 days straight, but
-- each farmer is alerted exactly once per transition.
create table if not exists public.farmer_alerts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  kind        text not null,             -- 'vazio_start' | 'vazio_end' | ...
  dedup_key   text not null,             -- e.g. 'vazio_start:MT:2026-06-08'
  sent_at     timestamptz not null default now(),
  unique (user_id, dedup_key)
);

alter table public.farmer_alerts enable row level security;
