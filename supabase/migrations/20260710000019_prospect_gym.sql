-- Vitória Gym: training runs for the PROSPECTING persona (Olímpia pattern).
-- Personas live in code (api/_lib/prospect/gym.ts); only run results persist,
-- so the ops console shows history and score evolution over time.
create table if not exists public.prospect_gym_runs (
  id          uuid primary key default gen_random_uuid(),
  ran_at      timestamptz not null default now(),
  medias      jsonb not null,   -- { naturalidade, missao, seguranca } averages
  verdicts    jsonb not null,   -- GymVerdict[] (per-persona, incl. transcript)
  created_at  timestamptz not null default now()
);

alter table public.prospect_gym_runs enable row level security;
