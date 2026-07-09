-- Ops console login throttling. The /painel login is a single shared password,
-- and serverless keeps no memory between invocations — so failed attempts are
-- counted here (per IP and globally, sliding window) to make the password
-- non-brute-forceable. Rows are tiny and pruned opportunistically on insert.
create table if not exists public.ops_login_attempts (
  id          uuid primary key default gen_random_uuid(),
  ip          text not null,
  success     boolean not null,
  created_at  timestamptz not null default now()
);

create index if not exists ops_login_attempts_at_idx
  on public.ops_login_attempts (created_at);

alter table public.ops_login_attempts enable row level security;
