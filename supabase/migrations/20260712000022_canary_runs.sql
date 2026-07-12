-- Daily canary audit: one row per monitor-cron run with the structured check
-- results ([{check, ok, detail}]). The previous row is what "alert only on
-- transitions" diffs against. Tiny rows; service-role only like the rest.
create table if not exists canary_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  results jsonb not null
);

create index if not exists canary_runs_ran_at_idx on canary_runs (ran_at desc);

alter table canary_runs enable row level security;
