-- Market-learning playbook: what the prospect conversations teach us. A weekly
-- job mines threads (objections, what converts) + funnel stats; the latest row
-- feeds an informational block into Vitória's prompt and the painel. Append-only
-- so learning history is auditable.
create table if not exists public.prospect_playbook (
  id          uuid primary key default gen_random_uuid(),
  learnings   jsonb not null,     -- array of short strings
  stats       jsonb,              -- funnel numbers the learnings came from
  created_at  timestamptz not null default now()
);

alter table public.prospect_playbook enable row level security;
