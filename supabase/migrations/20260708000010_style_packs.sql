-- Style packs: the DB-versioned, hot-swappable voice layer (design:
-- .claude/plans/2026-07-08-stevi-voice-gym). The active pack's body is appended
-- to the base system prompt at runtime (~3 min cache). Layer-1 rules (triage,
-- anti-invention, LGPD) stay in code; only voice/register/vocabulary lives here.
-- Convention: every version's body is ALSO committed to git under
-- prompts/style-packs/vN.md (pushed via scripts/stylepack-push.mjs) — the DB is
-- the runtime source, git is the durable history.
create table if not exists public.style_packs (
  id          uuid primary key default gen_random_uuid(),
  version     int not null unique,
  body        text not null,
  active      boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

-- At most one active pack at a time.
create unique index if not exists style_packs_one_active
  on public.style_packs (active) where active;

alter table public.style_packs enable row level security;
