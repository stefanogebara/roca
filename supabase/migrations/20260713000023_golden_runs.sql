-- Golden-set eval runs: accuracy as a tracked number. One row per manual/OS
-- run; results carry per-case verdicts, failures the named missed criteria.
-- Service-role only (RLS on, zero policies — matches the schema's posture).
create table if not exists golden_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  pack_version integer,                -- style pack under test (null = base prompt)
  total integer not null,
  passed integer not null,
  rate double precision not null,
  failures jsonb not null default '[]'::jsonb,
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table golden_runs enable row level security;
