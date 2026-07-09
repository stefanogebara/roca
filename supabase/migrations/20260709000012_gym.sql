-- The Gym (Phase B): offline voice-training runs. Scenarios (personas) live in
-- code (api/_lib/gym/personas.ts) so they're versioned in git; only RUN RESULTS
-- are stored here, so the ops console can show history and the champion lineage.
create table if not exists public.gym_runs (
  id            uuid primary key default gen_random_uuid(),
  ran_at        timestamptz not null default now(),
  champion      int not null,          -- pack version A
  challenger    int not null,          -- pack version B
  tally         jsonb not null,        -- { A, B, tie }
  recommended   int,                   -- recommended winner version
  reason        text,
  verdicts      jsonb,                 -- PairedVerdict[] (per-persona)
  transcripts   jsonb,                 -- SimTranscript[] (for review)
  created_at    timestamptz not null default now()
);

alter table public.gym_runs enable row level security;
