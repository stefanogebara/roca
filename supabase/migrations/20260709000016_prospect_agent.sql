-- Prospect conversation agent ("Olívia" layer): per-prospect thread log,
-- founder-controllable agent toggle, and the structured qualification the
-- agent extracts (the 3 validation answers + coverage). The thread is the
-- painel's management surface; the toggle is the human-takeover switch.
create table if not exists public.prospect_messages (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references public.prospects(id) on delete cascade,
  direction    text not null check (direction in ('in','out')),
  kind         text not null default 'text',   -- text|voice|image|contact
  text         text,
  created_at   timestamptz not null default now()
);
create index if not exists prospect_messages_prospect_idx
  on public.prospect_messages (prospect_id, created_at);

alter table public.prospects
  add column if not exists agent_enabled boolean not null default true,
  add column if not exists qualification jsonb;

alter table public.prospect_messages enable row level security;
