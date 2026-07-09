-- Prospecting: B2B agri intermediaries (coops, revendas, sindicatos, agrônomos) we
-- reach out to as distribution partners. NOT individual farmers (those come in by
-- opt-in). See .claude/plans/2026-07-09-stevi-prospecting.

create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'revenda',          -- coop | revenda | sindicato | agronomo
  city text,
  uf text,
  phone text,                                     -- E.164, or null until discovered
  wa_status text not null default 'pending',      -- pending | valid | invalid
  source text not null default 'manual',          -- manual | csv | search
  status text not null default 'discovered',      -- discovered | ready | contacted | replied | discarded
  notes text,
  -- dispatch tracking
  sent_at timestamptz,
  send_status text,                               -- null | sent | delivered | read | replied | failed
  wamid text,
  template_used text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per phone (global dedup at the data layer too). Partial: only enforce when
-- a phone exists, so rows discovered without a number yet don't collide.
create unique index if not exists prospects_phone_uq on prospects (phone) where phone is not null;
create index if not exists prospects_status_idx on prospects (status);
create index if not exists prospects_wa_status_idx on prospects (wa_status);
create index if not exists prospects_sent_at_idx on prospects (sent_at);

-- Hard opt-out blocklist — checked before every send; inbound "parar/sair" adds here.
create table if not exists prospect_optouts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,                     -- E.164
  reason text,
  created_at timestamptz not null default now()
);
